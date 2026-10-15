/**
 * Dxcufgb's canvas effects - ambience: fire, firelight, candles, rain and lightning.
 *
 * Made for a map seen from straight above:
 *  - flames lean and stream downwind and grow as they rise toward the camera, they don't climb the screen;
 *  - rain falls from a height: each drop starts shifted toward the light (top left) and upwind,
 *    streaks onto the spot it lands on and splashes there;
 *  - lightning is a flash over the whole area, sometimes with a bolt coming down onto one spot.
 * Fire, candles, firelight and lightning can also cast real Foundry light (see lights()), so they
 * light the map and the tokens in a dark scene.
 */

import {
  AreaEffect, effectTextures, clamp, rand, pick, rad, hexToNum, mixColor, hash01, LIGHT_DIR, TAU
} from "./effect-base.js";
import { shapeBounds, shapeContains } from "./geometry.js";

const centerOf = b => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

/** Three colours from hot to cool: the style's, or built around the layer's own colour. */
function ramp(effect) {
  const st = effect.styleDef;
  if (effect.layer.color) {
    const c = hexToNum(effect.layer.color);
    return [mixColor(c, 0xffffff, 0.75), c, mixColor(c, 0x000000, 0.45)];
  }
  return (st.ramp ?? ["#fff3c4", "#ff9a2a", "#c83a12"]).map(hexToNum);
}

function rampAt(r, k) {
  return k < 0.5 ? mixColor(r[0], r[1], k * 2) : mixColor(r[1], r[2], (k - 0.5) * 2);
}

/* ======================================================================== */
/*  Fire                                                                    */
/* ======================================================================== */

/** A fire seen from above: a bed of glowing coals, flame tongues streaming downwind, a white-hot heart. */
export class FireEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid, tex = effectTextures();
    const b = ctx.rawBounds;
    this.center = centerOf(b);
    this.colors = ramp(this);
    const add = PIXI.BLEND_MODES.ADD;
    const scale = this.layer.scale;

    // Coals
    this.coals = [];
    const coalLayer = this.addChild(new PIXI.Container());
    const nCoals = Math.round(clamp(ctx.squares * 4 * this.layer.density, 3, 60));
    for (let i = 0; i < nCoals; i++) {
      const s = coalLayer.addChild(new PIXI.Sprite(tex.dot));
      s.anchor.set(0.5);
      s.blendMode = add;
      const p = ctx.randomPoint();
      s.position.set(p.x, p.y);
      s.scale.set((rand(0.3, 0.6) * g * scale) / s.texture.width);
      this.coals.push({ s, phase: Math.random() * TAU, rate: rand(1.5, 4) });
    }

    // Smoke (outdoor fires): soft dark puffs drifting further downwind, drawn under the flames.
    this.smoke = [];
    if (st.smoke) {
      const smokeLayer = this.addChild(new PIXI.Container());
      const n = Math.round(clamp(ctx.squares * 2, 4, 40) * ctx.quality);
      for (let i = 0; i < n; i++) {
        const s = smokeLayer.addChild(new PIXI.Sprite(tex.dot));
        s.anchor.set(0.5);
        const p = { s, age: 0, life: 1 };
        this._spawnSmoke(p, true);
        this.smoke.push(p);
      }
    }

    // Flame tongues
    this.flames = [];
    const flameLayer = this.addChild(new PIXI.Container());
    const n = Math.round(clamp((st.rate ?? 6) * this.layer.density * ctx.squares, 8, 260) * ctx.quality);
    for (let i = 0; i < n; i++) {
      const s = flameLayer.addChild(new PIXI.Sprite(tex.flame));
      s.anchor.set(0.3, 0.5);
      s.blendMode = add;
      const p = { s, age: 0, life: 1, phase: Math.random() * TAU };
      this._spawn(p, true);
      this.flames.push(p);
    }

    // The hottest part, in the middle
    this.cores = [];
    const coreLayer = this.addChild(new PIXI.Container());
    const nCores = Math.round(clamp(ctx.squares * 1.5, 1, 12));
    for (let i = 0; i < nCores; i++) {
      const s = coreLayer.addChild(new PIXI.Sprite(tex.dot));
      s.anchor.set(0.5);
      s.blendMode = add;
      const p = ctx.randomPoint();
      const x = p.x + (this.center.x - p.x) * 0.5, y = p.y + (this.center.y - p.y) * 0.5;
      s.position.set(x, y);
      s.scale.set((rand(0.25, 0.45) * g * scale) / s.texture.width);
      this.cores.push({ s, phase: Math.random() * TAU });
    }
  }

  _spawn(p, first = false) {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid;
    const pt = ctx.randomPoint();
    const pull = st.gather ?? 0.3;                       // flames crowd toward the middle of the fire
    p.x = pt.x + (this.center.x - pt.x) * pull;
    p.y = pt.y + (this.center.y - pt.y) * pull;
    const w = this.wind;
    const jitter = 0.18 * g;
    p.vx = w.x * w.s * g * rand(0.5, 1.1) + rand(-1, 1) * jitter;
    p.vy = w.y * w.s * g * rand(0.5, 1.1) + rand(-1, 1) * jitter;
    p.life = pick(st.life ?? [0.45, 1.0]);
    p.age = first ? Math.random() * p.life : 0;
    p.size = (pick(st.size ?? [0.28, 0.5]) * g * this.layer.scale) / p.s.texture.width;
  }

  _spawnSmoke(p, first = false) {
    const g = this.ctx.grid;
    const pt = this.ctx.randomPoint();
    p.x = pt.x; p.y = pt.y;
    const w = this.wind;
    p.vx = w.x * Math.max(0.3, w.s) * g * rand(0.6, 1.2);
    p.vy = w.y * Math.max(0.3, w.s) * g * rand(0.6, 1.2);
    p.life = rand(2.5, 4.5);
    p.age = first ? Math.random() * p.life : 0;
    p.size = (rand(0.5, 0.9) * g * this.layer.scale) / p.s.texture.width;
    p.s.tint = hexToNum(this.styleDef.smokeColor ?? "#2a2624");
  }

  animate(dt, time) {
    const st = this.styleDef;
    const colors = this.colors.map(c => this.hued(c));
    const w = this.wind;
    const stretch = 1 + Math.min(1.5, w.s * 1.2);

    for (const c of this.coals) {
      c.s.tint = colors[2];
      c.s.alpha = 0.35 + 0.25 * Math.sin(time * c.rate + c.phase) + 0.1 * Math.sin(time * 7.3 + c.phase * 3);
    }
    for (const p of this.smoke) {
      p.age += dt;
      if (p.age >= p.life) this._spawnSmoke(p);
      const k = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.s.position.set(p.x, p.y);
      p.s.scale.set(p.size * (0.6 + 1.4 * k));
      p.s.alpha = 0.35 * Math.sin(Math.PI * k);
    }
    for (const p of this.flames) {
      p.age += dt;
      if (p.age >= p.life) this._spawn(p);
      const k = p.age / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.s.position.set(p.x, p.y);
      // Grows as it licks up toward the camera, then thins out.
      const grow = k < 0.3 ? 0.6 + k / 0.3 * 0.5 : 1.1 - (k - 0.3) / 0.7 * 0.7;
      p.s.scale.set(p.size * grow * stretch, p.size * grow);
      p.s.rotation = Math.atan2(p.vy, p.vx);
      p.s.tint = rampAt(colors, k);
      const fade = k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88;
      p.s.alpha = Math.max(0, fade) * (0.75 + 0.25 * Math.sin(time * 19 + p.phase));
    }
    for (const c of this.cores) {
      c.s.tint = colors[0];
      c.s.alpha = 0.55 + 0.3 * Math.sin(time * 11 + c.phase) * Math.sin(time * 3.1 + c.phase);
    }
    void st;
  }

  lights() {
    const st = this.styleDef, g = this.ctx.grid, b = this.ctx.rawBounds;
    const r = Math.max(b.width, b.height) / 2;
    const k = this.layer.scale;
    return [{
      x: this.center.x, y: this.center.y,
      bright: r + (st.lightBright ?? 1.5) * g * k,
      dim: r + (st.lightDim ?? 5) * g * k,
      color: this.colors[1], alpha: st.lightAlpha ?? 0.55,
      animation: { type: "torch", speed: 4, intensity: 4 }, walls: true
    }];
  }
}

/* ======================================================================== */
/*  Glow                                                                    */
/* ======================================================================== */

/** A soft light filling the area from its middle, flickering like firelight (or steady like the moon). */
export class GlowEffect extends AreaEffect {
  build() {
    const b = this.ctx.rawBounds;
    const tex = effectTextures().glow;
    this.center = centerOf(b);
    const k = this.layer.scale;
    this.outer = this.tintable(new PIXI.Sprite(tex));
    this.outer.anchor.set(0.5);
    this.outer.width = b.width * 1.25 * k;
    this.outer.height = b.height * 1.25 * k;
    this.inner = this.tintable(new PIXI.Sprite(tex));
    this.inner.anchor.set(0.5);
    this.inner.width = b.width * 0.55 * k;
    this.inner.height = b.height * 0.55 * k;
    this.addChild(this.outer, this.inner);
    this.base = { ow: this.outer.scale.x, oh: this.outer.scale.y };
    this.phase = Math.random() * 100;
  }

  animate(dt, time) {
    const st = this.styleDef;
    const t = time + this.phase;
    const f = st.flicker ?? 0.3;
    // Several sines at odd rates make an unsteady flicker; now and then the flame gutters.
    const n = 0.5 + 0.22 * Math.sin(t * 7.1) + 0.16 * Math.sin(t * 13.7 + 1.3) + 0.12 * Math.sin(t * 2.3 + 0.4);
    const gutter = Math.max(0, Math.sin(t * 0.7) * Math.sin(t * 1.9)) > 0.85 ? 0.35 : 0;
    const level = 1 - f * (1 - n) - f * gutter;
    const a = st.alpha ?? 0.5;
    this.outer.alpha = a * level;
    this.inner.alpha = a * 0.8 * (0.8 + 0.2 * level);
    const j = (st.jitter ?? 0.04) * this.ctx.grid * f;
    const x = this.center.x + Math.sin(t * 9.3) * j, y = this.center.y + Math.cos(t * 8.1) * j;
    this.outer.position.set(x, y);
    this.inner.position.set(x, y);
    const breathe = 1 + 0.04 * f * Math.sin(t * 5.3);
    this.outer.scale.set(this.base.ow * breathe, this.base.oh * breathe);
  }

  lights() {
    const st = this.styleDef, b = this.ctx.rawBounds;
    const r = (Math.max(b.width, b.height) / 2) * this.layer.scale;
    return [{
      x: this.center.x, y: this.center.y, bright: r * 0.4, dim: r * 1.05,
      color: this.baseColor, alpha: st.lightAlpha ?? 0.5,
      animation: st.anim ? { type: st.anim, speed: 4, intensity: 4 } : {}, walls: true
    }];
  }
}

/* ======================================================================== */
/*  Candles                                                                 */
/* ======================================================================== */

/**
 * Candles placed by what you paint: a dot (click with the brush) is one candle, a stroke or wall
 * line is a row of candles along it, a filled shape gets candles scattered inside it.
 * The brush width is the reach of each candle's glow.
 */
export class CandleEffect extends AreaEffect {
  _spots() {
    const ctx = this.ctx, g = ctx.grid;
    const spacing = Math.max(0.2, 0.5 / this.layer.density) * g;
    const out = [];
    for (const s of ctx.shapes) {
      if (s.erase) continue;
      if (s.type === "stroke") {
        const p = s.points;
        if (p.length === 2) { out.push({ x: p[0], y: p[1] }); continue; }
        let carry = spacing / 2;
        for (let i = 0; i + 3 < p.length; i += 2) {
          const dx = p[i + 2] - p[i], dy = p[i + 3] - p[i + 1];
          const len = Math.hypot(dx, dy);
          let d = carry;
          while (d <= len) {
            out.push({ x: p[i] + (dx * d) / len, y: p[i + 1] + (dy * d) / len });
            d += spacing;
          }
          carry = d - len;
        }
        if (out.length === 0) out.push({ x: p[0], y: p[1] });
      } else {
        const b = shapeBounds(s);
        const n = clamp(Math.round((b.width * b.height) / (g * g) * 0.6 * this.layer.density), 1, 40);
        for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
          const x = b.x + Math.random() * b.width, y = b.y + Math.random() * b.height;
          if (shapeContains(s, x, y)) { out.push({ x, y }); i++; }
        }
      }
      if (out.length > 150) break;
    }
    // Only where the area is still painted (not erased).
    return out.filter(p => ctx.contains(p.x, p.y)).slice(0, 150);
  }

  build() {
    const st = this.styleDef, g = this.ctx.grid, tex = effectTextures();
    const k = this.layer.scale;
    this.colors = ramp(this);
    this.candles = this._spots().map(p => ({ ...p, phase: Math.random() * TAU, rate: rand(0.8, 1.3) }));

    // Wax (seen from above: a disc), with its shadow down and to the right.
    if (st.wax) {
      const wax = this.addChild(new (PIXI.LegacyGraphics ?? PIXI.Graphics)());
      const r = 0.075 * g * k;
      for (const c of this.candles) {
        wax.beginFill(0x000000, 0.35).drawCircle(c.x + r * 0.5, c.y + r * 0.5, r * 1.05).endFill();
        wax.beginFill(hexToNum(st.wax), 1).drawCircle(c.x, c.y, r).endFill();
        wax.beginFill(0xffffff, 0.18).drawCircle(c.x - r * 0.3, c.y - r * 0.3, r * 0.45).endFill();
      }
    }
    const add = PIXI.BLEND_MODES.ADD;
    const layer = this.addChild(new PIXI.Container());
    for (const c of this.candles) {
      c.halo = layer.addChild(new PIXI.Sprite(tex.glow));
      c.halo.anchor.set(0.5);
      c.halo.blendMode = add;
      c.haloSize = (0.9 * (st.halo ?? 1) * g * k) / tex.glow.width;
      c.flame = layer.addChild(new PIXI.Sprite(tex.flame));
      c.flame.anchor.set(0.25, 0.5);
      c.flame.blendMode = add;
      c.flameSize = (0.16 * g * k) / tex.flame.width;
      c.core = layer.addChild(new PIXI.Sprite(tex.flake));
      c.core.anchor.set(0.5);
      c.core.blendMode = add;
      c.coreSize = (0.07 * g * k) / tex.flake.width;
    }
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid;
    const colors = this.colors.map(c => this.hued(c));
    const w = this.wind;
    const lean = Math.min(1, w.s);
    const angle = Math.atan2(w.y, w.x);
    for (const c of this.candles) {
      const t = time * c.rate + c.phase;
      // Flicker, with a rare dip as if a draught touched it.
      let f = 0.82 + 0.1 * Math.sin(t * 13) + 0.08 * Math.sin(t * 7.7 + 2);
      if (Math.sin(t * 0.37) > 0.97) f *= 0.6;
      const bob = st.float ? Math.sin(t * 1.3) * 0.05 * g : 0;
      const x = c.x, y = c.y + bob;
      c.halo.position.set(x, y);
      c.halo.scale.set(c.haloSize * (0.92 + 0.08 * f));
      c.halo.tint = colors[1];
      c.halo.alpha = (st.haloAlpha ?? 0.45) * f;
      // The flame leans downwind and stretches; without wind it sways a little.
      const sway = Math.sin(t * 2.1) * 0.35 * (1 - lean);
      c.flame.position.set(x, y);
      c.flame.rotation = lean > 0.05 ? angle + Math.sin(t * 5) * 0.15 : -Math.PI / 4 + sway;
      c.flame.scale.set(c.flameSize * (1 + lean * 1.2) * f, c.flameSize * (0.8 + 0.2 * f));
      c.flame.tint = colors[1];
      c.flame.alpha = 0.9 * f;
      c.core.position.set(x + Math.cos(c.flame.rotation) * 0.02 * g, y + Math.sin(c.flame.rotation) * 0.02 * g);
      c.core.scale.set(c.coreSize * f);
      c.core.tint = colors[0];
      c.core.alpha = f;
    }
  }

  lights() {
    const st = this.styleDef, g = this.ctx.grid, k = this.layer.scale * (st.light ?? 1);
    // Each candle is its own light, up to 16 (more would slow the lighting down).
    return this.candles.slice(0, 16).map(c => ({
      x: c.x, y: c.y, bright: 0.35 * g * k, dim: 1.6 * g * k,
      color: this.colors[1], alpha: st.lightAlpha ?? 0.45,
      animation: { type: "flame", speed: 5, intensity: 4 }, walls: true
    }));
  }
}

/* ======================================================================== */
/*  Rain                                                                    */
/* ======================================================================== */

/** Rain from above: drops fall from a height onto their landing spot (upwind, toward the light) and splash. */
export class RainEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, tex = effectTextures();
    const n = Math.round(clamp((st.rate ?? 10) * this.layer.density * ctx.squares, 20, 1500) * ctx.quality);
    this.drops = [];
    this.splashes = [];
    const splashLayer = this.addChild(new PIXI.Container());
    const dropLayer = this.addChild(new PIXI.Container());
    for (let i = 0; i < n; i++) {
      const s = this.tintable(new PIXI.Sprite(tex.streak));
      s.anchor.set(0.5, 1);
      const d = { s };
      this._spawn(d, true);
      this.drops.push(d);
      dropLayer.addChild(s);
    }
    const nSplash = Math.min(600, Math.ceil(n * 0.6));
    for (let i = 0; i < nSplash; i++) {
      const s = this.tintable(new PIXI.Sprite(tex.ring));
      s.anchor.set(0.5);
      s.visible = false;
      this.splashes.push({ s, age: 0, life: 0.25, on: false });
      splashLayer.addChild(s);
    }
    this.nextSplash = 0;
  }

  _spawn(d, first = false) {
    const st = this.styleDef;
    const p = this.ctx.randomPoint();
    d.x = p.x; d.y = p.y;
    d.fall = pick(st.fall ?? [0.35, 0.55]);
    d.z = first ? Math.random() : 1;
    d.alpha = rand(0.5, 1);
  }

  _splash(x, y) {
    const sp = this.splashes[this.nextSplash];
    if (!sp) return;
    this.nextSplash = (this.nextSplash + 1) % this.splashes.length;
    sp.on = true;
    sp.age = 0;
    sp.life = rand(0.18, 0.3);
    sp.s.position.set(x, y);
    sp.s.visible = true;
  }

  animate(dt) {
    const st = this.styleDef, g = this.ctx.grid;
    const w = this.wind;
    const k = this.layer.scale;
    // Where a drop is while it is still high up, per unit of height: toward the light, and upwind.
    // (Strong wind slants the rain more, but a drop never starts more than ~1.4 squares off its spot.)
    const height = (st.height ?? 0.7) * g;
    const slant = Math.min(1.6, w.s) * (st.slant ?? 0.6) * g;
    const ox = (LIGHT_DIR.x * height) - w.x * slant;
    const oy = (LIGHT_DIR.y * height) - w.y * slant;
    const len = Math.hypot(ox, oy) || 1;
    const rot = Math.atan2(-oy, -ox) - Math.PI / 2;     // the streak points to where it will land
    const streak = Math.min(len * (st.streak ?? 0.35), 0.45 * g) * k;
    const width = (st.width ?? 1.6) * (g / 100) * k;
    const sx = width / 6, sy = streak / 64;
    const alpha = st.dropAlpha ?? 0.6;
    for (const d of this.drops) {
      d.z -= dt / d.fall;
      if (d.z <= 0) {
        if (Math.random() < (st.splashRate ?? 0.7)) this._splash(d.x, d.y);
        this._spawn(d);
      }
      const s = d.s;
      s.position.set(d.x + ox * d.z, d.y + oy * d.z);
      s.rotation = rot;
      s.scale.set(sx, sy);
      s.alpha = alpha * d.alpha;
    }
    const ring = (st.splash ?? 0.12) * g * k / 32;
    for (const sp of this.splashes) {
      if (!sp.on) continue;
      sp.age += dt;
      const t = sp.age / sp.life;
      if (t >= 1) { sp.on = false; sp.s.visible = false; continue; }
      sp.s.scale.set(ring * (0.2 + t));
      sp.s.alpha = (st.splashAlpha ?? 0.6) * (1 - t);
    }
  }
}

/* ======================================================================== */
/*  Lightning                                                               */
/* ======================================================================== */

/**
 * Lightning: the whole area flashes, two or three times in quick succession, and sometimes a bolt
 * comes down on one spot. Strikes follow the clock, so every player sees the same strike at the
 * same moment. An optional thunder sound plays a moment later.
 */
export class LightningEffect extends AreaEffect {
  build() {
    const b = this.ctx.bounds, tex = effectTextures();
    const add = PIXI.BLEND_MODES.ADD;
    this.flash = this.addChild(new PIXI.Sprite(PIXI.Texture.WHITE));
    this.flash.position.set(b.x, b.y);
    this.flash.width = b.width;
    this.flash.height = b.height;
    this.flash.blendMode = add;
    this.flash.alpha = 0;
    this.glow = this.addChild(new PIXI.Sprite(tex.glow));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = add;
    this.glow.alpha = 0;
    this.bolt = this.addChild(new (PIXI.LegacyGraphics ?? PIXI.Graphics)());
    this.bolt.blendMode = add;
    this.bolt.alpha = 0;
    this.level = 0;
    this.current = null;
  }

  /** The strike going on at this moment (or null): the same on every computer. */
  _strike(now) {
    const st = this.styleDef;
    const period = (st.every ?? 8) / Math.max(0.1, this.layer.density);
    const seed = this.ctx.seed ?? 1;
    const slot = Math.floor(now / period);
    for (const k of [slot, slot - 1]) {
      if (hash01(seed, k) > (st.chance ?? 0.75)) continue;
      const start = k * period + hash01(seed + 7, k) * period * 0.7;
      const t = now - start;
      if (t >= 0 && t < 1.8) return { key: k, t, bolt: hash01(seed + 13, k) < (st.bolt ?? 0.5) };
    }
    return null;
  }

  /** A jagged bolt from the sky (drawn toward the light) down onto its spot, with a few branches. */
  _drawBolt(key) {
    const ctx = this.ctx, g = ctx.grid, b = ctx.rawBounds, seed = (ctx.seed ?? 1) + key * 31;
    let n = 0;
    const r = () => hash01(seed, n++);
    let px = b.x + b.width / 2, py = b.y + b.height / 2;
    for (let i = 0; i < 30; i++) {
      // Away from the edges, so the bolt (which comes in from the top left) stays in the area.
      const x = b.x + (0.3 + r() * 0.65) * b.width, y = b.y + (0.3 + r() * 0.65) * b.height;
      if (ctx.contains(x, y)) { px = x; py = y; break; }
    }
    this.spot = { x: px, y: py };
    const reach = (this.styleDef.reach ?? 3.5) * g;
    const sx = px + LIGHT_DIR.x * reach, sy = py + LIGHT_DIR.y * reach;
    const path = (x0, y0, x1, y1, steps, jag) => {
      const pts = [[x0, y0]];
      const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const off = (r() - 0.5) * jag * (1 - t * 0.6);
        pts.push([x0 + (x1 - x0) * t + (nx / nl) * off, y0 + (y1 - y0) * t + (ny / nl) * off]);
      }
      pts.push([x1, y1]);
      return pts;
    };
    const main = path(sx, sy, px, py, 12, 0.9 * g);
    const branches = [];
    for (let i = 0; i < 3; i++) {
      const from = main[2 + Math.floor(r() * 7)];
      const a = Math.atan2(py - sy, px - sx) + (r() - 0.5) * 2.2;
      const l = (0.6 + r()) * g;
      branches.push(path(from[0], from[1], from[0] + Math.cos(a) * l, from[1] + Math.sin(a) * l, 5, 0.4 * g));
    }
    const color = this.hued(this.baseColor);
    const gfx = this.bolt;
    gfx.clear();
    const stroke = (pts, width, alpha) => {
      gfx.lineStyle({ width, color, alpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
      gfx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) gfx.lineTo(p[0], p[1]);
    };
    for (const p of [main, ...branches]) stroke(p, 0.22 * g, 0.25);
    stroke(main, 0.07 * g, 0.9);
    for (const p of branches) stroke(p, 0.035 * g, 0.8);
    gfx.lineStyle({ width: 0.025 * g, color: 0xffffff, alpha: 1 });
    gfx.moveTo(main[0][0], main[0][1]);
    for (const p of main.slice(1)) gfx.lineTo(p[0], p[1]);
    this.glow.position.set(px, py);
    this.glow.scale.set((2.2 * g) / this.glow.texture.width);
  }

  animate() {
    const st = this.styleDef;
    const now = (this.ctx.clock?.() ?? Date.now()) / 1000;
    const s = this._strike(now);
    const color = this.hued(this.baseColor);
    if (!s) {
      this.flash.alpha = this.glow.alpha = this.bolt.alpha = 0;
      this.level = 0;
      return;
    }
    if (this.current !== s.key) {
      this.current = s.key;
      if (s.bolt) this._drawBolt(s.key);
      else this.bolt.clear();
      // Thunder a moment later (further away: later). Only for strikes that just began.
      if (this.layer.sound && s.t < 0.25 && this.ctx.playSound) {
        const delay = 300 + hash01((this.ctx.seed ?? 1) + 3, s.key) * 2200;
        this.ctx.playSound(this.layer.sound, delay, s.bolt ? 1 : 0.6);
      }
    }
    // Two or three quick flashes, then an afterglow.
    const t = s.t;
    const peaks = [0, 0.09 + hash01(s.key, 5) * 0.06, 0.24 + hash01(s.key, 9) * 0.1];
    let f = 0;
    for (let i = 0; i < peaks.length; i++) f = Math.max(f, (1 - i * 0.25) * Math.exp(-(((t - peaks[i]) / 0.04) ** 2)));
    f = Math.max(f, 0.18 * Math.exp(-t / 0.35));
    this.level = f;
    this.flash.tint = color;
    this.flash.alpha = f * (st.flash ?? 0.5);
    if (s.bolt) {
      this.bolt.alpha = t < 0.45 ? Math.min(1, f * 1.6 + 0.2) : 0;
      this.glow.tint = color;
      this.glow.alpha = Math.min(1, f * 1.4) + 0.35 * Math.exp(-t / 0.5);
    } else {
      this.bolt.alpha = 0;
      this.glow.alpha = 0;
    }
  }

  lights() {
    const st = this.styleDef, b = this.ctx.rawBounds;
    const r = Math.hypot(b.width, b.height) / 2 + this.ctx.grid * 2;
    return [{
      x: b.x + b.width / 2, y: b.y + b.height / 2, bright: r * 0.7, dim: r,
      color: this.baseColor, alpha: 0, walls: false, animation: {},
      dynamic: () => this.level * (st.light ?? 0.9)
    }];
  }
}
