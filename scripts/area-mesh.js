/**
 * Dxcufgb's canvas effects - one painted area with its effect.
 *
 * An AreaMesh is a PIXI.Container in scene coordinates:
 *  - a mask: the area's shapes rendered once into a render texture (white = painted, erasers cut
 *    it away, soft edges are a blur), used as a sprite mask, so effects only show where painted;
 *  - the effect layers inside the mask, bottom to top;
 *  - an "under" container with the effects that redraw the map itself (filters, lava, water):
 *    drawn just above the map and below tiles. It follows this container onto its parent;
 *  - an "over" container with the layers marked "Above the tokens" (rain, snow, clouds over
 *    everyone's heads): drawn above the tokens. It follows this container the same way.
 * It never blocks sight or movement: it is only something drawn.
 *
 * The same class draws the area on the canvas and in the effect window's preview; the mask is
 * rendered with the renderer that will show it (render textures belong to one renderer).
 */

import { SORT_LAYER, OVER_SORT_LAYER } from "./constants.js";

/** The "under" effects: above the scene background (sort layer 0), below tiles (500). */
const UNDER_SORT_LAYER = 450;
import { areaBounds, areaContains, buildMaskGraphics } from "./geometry.js";
import { normalizeEffect, createEffect, structuralKey } from "./effects.js";

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * Draws an area's glowing layers a second time, into Foundry's illumination (see manager.attachGlows):
 * there they lift the darkness where they are, so fireflies, embers or lava stay bright at night.
 */
class GlowProxy extends PIXI.Container {
  constructor(mesh) {
    super();
    this.mesh = mesh;
    this.eventMode = "none";
  }

  render(renderer) {
    const m = this.mesh;
    if (!m || m.destroyed || !m.visible || !m.content.renderable) return;
    for (const e of m.effects) {
      if (e.emissive && e.visible && !e.destroyed && e.worldAlpha > 0) e.render(renderer);
    }
  }
}

export class AreaMesh extends PIXI.Container {

  /**
   * @param {object} area           a normalized area
   * @param {object} opts
   * @param {PIXI.Renderer} opts.renderer
   * @param {number} opts.grid      pixels per grid square
   * @param {number} [opts.quality] 1 .. 0.3
   * @param {object} [opts.textures] {custom: {src: texture}}
   * @param {number} [opts.maxMask] largest side of the mask texture in pixels
   * @param {object} [opts.backdrop] the map image: {texture, rect: scene rectangle it covers}
   */
  constructor(area, { renderer, grid, quality = 1, textures = {}, maxMask = 2048, playSound = null, backdrop = null, exclusions = [] }) {
    super();
    this.exclusions = exclusions;
    this.backdrop = backdrop;
    this.under = new PIXI.Container();
    this.under.sortLayer = UNDER_SORT_LAYER;
    this.under.eventMode = "none";
    this.underMask = this.under.addChild(new PIXI.Sprite(PIXI.Texture.EMPTY));
    this.underContent = this.under.addChild(new PIXI.Container());
    this.underContent.mask = this.underMask;
    this.over = new PIXI.Container();
    this.over.sortLayer = OVER_SORT_LAYER;
    this.over.eventMode = "none";
    this.overMask = this.over.addChild(new PIXI.Sprite(PIXI.Texture.EMPTY));
    this.overContent = this.over.addChild(new PIXI.Container());
    this.overContent.mask = this.overMask;
    // Keep the under container next to this one, just before it, and the over container just after it.
    this.on("added", parent => {
      if (this.under.parent !== parent) parent.addChildAt(this.under, Math.max(0, parent.getChildIndex(this)));
      if (this.over.parent !== parent) parent.addChildAt(this.over, parent.getChildIndex(this) + 1);
    });
    this.on("removed", () => {
      this.under.parent?.removeChild(this.under);
      this.over.parent?.removeChild(this.over);
    });
    this.playSound = playSound;
    this.renderer = renderer;
    this.grid = grid;
    this.quality = quality;
    this.textures = textures;
    this.maxMask = maxMask;
    this.sortLayer = SORT_LAYER;
    this.eventMode = "none";
    this.interactiveChildren = false;
    this.maskTexture = null;
    this.maskSprite = null;
    this.content = this.addChild(new PIXI.Container());
    this.effects = [];
    this.glowProxy = new GlowProxy(this);
    this.setArea(area, textures, exclusions);
  }

  get areaId() {
    return this.area?.id;
  }

  /**
   * Show a changed area. Only what changed is rebuilt: the mask when the shapes or the soft edge
   * changed, the effects when a structural option changed; everything else updates live.
   */
  setArea(area, textures = this.textures, exclusions = this.exclusions ?? []) {
    const old = this.area;
    this.exclusions = exclusions;
    this.area = area;
    this.textures = textures;
    this.elevation = this.under.elevation = this.over.elevation = area.elevation ?? 0;
    this.sort = this.under.sort = this.over.sort = area.sort ?? 0;
    const maskKey = JSON.stringify([area.shapes, area.feather, exclusions.map(e => [e.id, e.shapes, e.feather])]);
    const effect = normalizeEffect(area.effect);
    const effectKey = structuralKey(effect);
    const texKey = Object.keys(textures?.custom ?? {}).join("|");

    if (maskKey !== this.maskKey) {
      this.maskKey = maskKey;
      this.#buildMask();
      this.effectKey = null;          // the bounds changed: the effects are built again
    }
    if (effectKey !== this.effectKey || texKey !== this.texKey || !old) {
      this.effectKey = effectKey;
      this.texKey = texKey;
      this.#buildEffects(effect);
    } else {
      effect.layers.forEach((l, i) => this.effects[i]?.setLayer(l));
    }
  }

  /** Bounds of the painted area plus room for the soft edge, or null. */
  get bounds() {
    return this.paddedBounds;
  }

  #buildMask() {
    const area = this.area;
    const b = areaBounds(area.shapes);
    if (!b) {
      this.paddedBounds = null;
      if (this.maskSprite) this.maskSprite.visible = false;
      this.content.visible = false;
      this.underContent.visible = false;
      this.overContent.visible = false;
      return;
    }
    const feather = clamp(area.feather ?? 0, 0, 4) * this.grid;
    const pad = Math.ceil(feather + 2);
    const pb = { x: Math.floor(b.x - pad), y: Math.floor(b.y - pad), width: Math.ceil(b.width + 2 * pad), height: Math.ceil(b.height + 2 * pad) };
    this.paddedBounds = pb;
    this.rawBounds = b;

    const res = Math.min(1, this.maxMask / Math.max(pb.width, pb.height)) * (this.quality < 1 ? 0.75 : 1);
    const w = Math.max(1, Math.ceil(pb.width * res));
    const h = Math.max(1, Math.ceil(pb.height * res));

    if (!this.maskTexture) this.maskTexture = PIXI.RenderTexture.create({ width: w, height: h });
    else this.maskTexture.resize(w, h, true);

    this.#renderShapes(area.shapes, feather, res, pb, w, h, this.maskTexture);

    // Exclusion zones above this area cut their shape out of it (soft edge and all).
    for (const ex of this.exclusions) {
      const tmp = PIXI.RenderTexture.create({ width: w, height: h });
      this.#renderShapes(ex.shapes, clamp(ex.feather ?? 0, 0, 4) * this.grid, res, pb, w, h, tmp);
      const cut = new PIXI.Sprite(tmp);
      cut.blendMode = PIXI.BLEND_MODES.ERASE;
      this.renderer.render(cut, { renderTexture: this.maskTexture, clear: false });
      cut.destroy();
      tmp.destroy(true);
    }

    if (!this.maskSprite) {
      this.maskSprite = this.addChild(new PIXI.Sprite(this.maskTexture));
      this.content.mask = this.maskSprite;
    }
    this.maskSprite.visible = true;
    this.maskSprite.position.set(pb.x, pb.y);
    this.maskSprite.scale.set(1 / res);
    this.underMask.texture = this.maskTexture;
    this.underMask.position.set(pb.x, pb.y);
    this.underMask.scale.set(1 / res);
    this.overMask.texture = this.maskTexture;
    this.overMask.position.set(pb.x, pb.y);
    this.overMask.scale.set(1 / res);
    this.maskRes = res;
    this.content.visible = true;
    this.underContent.visible = true;
    this.overContent.visible = true;

    // How much of the box is painted (for particle counts), from a few samples.
    let hit = 0;
    const N = 160;
    for (let i = 0; i < N; i++) {
      if (areaContains(area.shapes, b.x + Math.random() * b.width, b.y + Math.random() * b.height)) hit++;
    }
    this.coverage = Math.max(0.02, hit / N);
  }

  /** Render shapes (white, erasers cut) into a render texture covering pb at resolution res. */
  #renderShapes(shapes, feather, res, pb, w, h, target) {
    const g = buildMaskGraphics(shapes);
    g.scale.set(res);
    g.position.set(-pb.x * res, -pb.y * res);
    if (feather > 0) {
      const blur = new PIXI.BlurFilter(Math.max(1, feather * res * 0.5), 4);
      blur.padding = Math.ceil(feather * res);
      const holder = new PIXI.Container();
      holder.addChild(g);
      holder.filters = [blur];
      holder.filterArea = new PIXI.Rectangle(0, 0, w, h);
      this.renderer.render(holder, { renderTexture: target, clear: true });
      holder.destroy({ children: true });
      blur.destroy();
    } else {
      this.renderer.render(g, { renderTexture: target, clear: true });
      g.destroy({ children: true });
    }
  }

  #context() {
    const shapes = this.area.shapes;
    const b = this.rawBounds;
    const cuts = this.exclusions;
    const contains = (x, y) => areaContains(shapes, x, y) && !cuts.some(ex => areaContains(ex.shapes, x, y));
    let seed = 0;
    for (const ch of String(this.area.id)) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
    return {
      bounds: this.paddedBounds,
      rawBounds: b,
      shapes,
      seed,
      clock: () => Date.now(),
      playSound: this.playSound && ((src, delay, volume, layer) => this.playSound(src, delay, volume, layer, this.area)),
      backdrop: this.backdrop,
      grid: this.grid,
      quality: this.quality,
      textures: this.textures,
      squares: (b.width * b.height * this.coverage) / (this.grid * this.grid),
      contains,
      randomPoint: () => {
        for (let i = 0; i < 24; i++) {
          const x = b.x + Math.random() * b.width, y = b.y + Math.random() * b.height;
          if (contains(x, y)) return { x, y };
        }
        return { x: b.x + Math.random() * b.width, y: b.y + Math.random() * b.height };
      }
    };
  }

  #buildEffects(effect) {
    for (const e of this.effects) e.destroy({ children: true });
    this.effects = [];
    if (!this.paddedBounds) return;
    const ctx = this.#context();
    for (const layer of effect.layers) {
      try {
        const e = createEffect(layer, ctx);
        (e.def.under ? this.underContent : layer.aboveTokens ? this.overContent : this.content).addChild(e);
        this.effects.push(e);
      } catch (err) {
        console.error("dxcufgbs-canvas-effects | could not build an effect layer", layer, err);
      }
    }
  }

  /**
   * The Foundry lights this area casts: [{key, ...light data}] from the layers with "Casts light" on.
   */
  get lights() {
    const out = [];
    this.effects.forEach((e, i) => {
      if (!e.layer.light) return;
      let list = [];
      try { list = e.lights() ?? []; } catch (err) { console.error("dxcufgbs-canvas-effects | lights", err); }
      list.forEach((l, j) => out.push({ key: `${i}.${j}`, ...l }));
    });
    return out;
  }

  /** Does any layer glow by itself? */
  get emissive() {
    return this.effects.some(e => e.emissive);
  }

  /** Show or hide the effects (the mask stays, for the painting overlay). */
  set showEffects(v) {
    this.content.renderable = this.underContent.renderable = this.overContent.renderable = !!v;
  }

  update(dt) {
    // The under and over containers follow this one (moved while dragged, faded for hidden areas).
    for (const c of [this.under, this.over]) {
      c.position.copyFrom(this.position);
      c.alpha = this.alpha;
      c.visible = this.visible;
    }
    if (!this.content.renderable || !this.content.visible) return;
    for (const e of this.effects) e.update(dt);
  }

  destroy(options) {
    for (const e of this.effects) e.destroy({ children: true });
    this.effects = [];
    const tex = this.maskTexture;
    this.maskTexture = null;
    this.under.destroy({ children: true });
    this.over.destroy({ children: true });
    this.glowProxy.parent?.removeChild(this.glowProxy);
    this.glowProxy.destroy();
    super.destroy({ children: true });
    tex?.destroy(true);
  }
}
