/**
 * Dxcufgb's canvas effects - the Canvas Effect window.
 *
 * Build an area's effect out of layers (an effect and a style, or an image of your own), tune each
 * layer, and see it live: in the preview and on the map itself. Nothing is saved until Apply; closing
 * the window without applying puts the area back as it was. Effects can be saved by name, exported
 * to a file and imported again.
 */

import { MODULE_ID } from "./constants.js";
import {
  EFFECTS, PARAMS, COMMON_PARAMS, BLENDS, FITS, IMAGE, MAX_LAYERS, EXAMPLES, CATEGORIES,
  normalizeEffect, normalizeLayer, layerLabel, defaultEffect
} from "./effects.js";
import { getArea, saveArea, normalizeArea, presets, savePreset, deletePreset, canEdit } from "./store.js";
import { setOverride, effectImages, showLocal, shownAreas, editableArea, sceneBackdrop } from "./manager.js";
import { AreaMesh } from "./area-mesh.js";
import { areaBounds } from "./geometry.js";
import { exportEffect, importEffect } from "./transfer.js";
import { SOUNDS, CUSTOM, RANGE, soundOptions, isStrikeSound, withStandardSound, standardSoundsOn } from "./sounds.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PREVIEW_W = 320;
const PREVIEW_H = 240;

const escapeHTML = str => String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** How a slider's value is shown next to it. */
const FORMAT = {
  pct: v => `${Math.round(v * 100)}%`,
  int: v => `${Math.round(v)}`,
  deg: v => `${Math.round(v)}°`,
  sq: v => `${Number(v).toFixed(2).replace(/\.?0+$/, "")}`
};

export class CanvasEffectConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "dxcfx-config",
    classes: ["dxcfx-config"],
    tag: "div",
    window: { title: "DXCFX.App.Title", icon: "fa-solid fa-wand-magic-sparkles", resizable: false },
    position: { width: 900, height: "auto" },
    actions: {
      effect: CanvasEffectConfig.#onEffect,
      style: CanvasEffectConfig.#onStyle,
      selectLayer: CanvasEffectConfig.#onSelectLayer,
      addLayer: CanvasEffectConfig.#onAddLayer,
      duplicateLayer: CanvasEffectConfig.#onDuplicateLayer,
      moveLayer: CanvasEffectConfig.#onMoveLayer,
      removeLayer: CanvasEffectConfig.#onRemoveLayer,
      browseImage: CanvasEffectConfig.#onBrowseImage,
      browseSound: CanvasEffectConfig.#onBrowseSound,
      uploadImage: CanvasEffectConfig.#onUploadImage,
      loadPreset: CanvasEffectConfig.#onLoadPreset,
      savePreset: CanvasEffectConfig.#onSavePreset,
      deletePreset: CanvasEffectConfig.#onDeletePreset,
      exportEffect: CanvasEffectConfig.#onExport,
      importEffect: CanvasEffectConfig.#onImport,
      apply: CanvasEffectConfig.#onApply,
      revert: CanvasEffectConfig.#onRevert,
      clearEffect: CanvasEffectConfig.#onClearEffect,
      resetLayer: CanvasEffectConfig.#onResetLayer
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/config.hbs` }
  };

  /** The open window, if any. */
  static instance = null;

  /** Open the window for an area of the viewed scene. */
  static open(areaId) {
    if (!canEdit()) {
      ui.notifications.warn(game.i18n.localize("DXCFX.App.NotAllowed"));
      return null;
    }
    // Just painted: the scene update may not be back yet, so take the area as shown.
    const area = getArea(areaId) ?? shownAreas().find(a => a.id === areaId);
    if (!area) return null;
    if (this.instance) this.instance.setArea(area);
    else this.instance = new this(area);
    if (this.instance.rendered) this.instance.bringToFront();
    this.instance.render({ force: true });
    return this.instance;
  }

  constructor(area, options = {}) {
    super(options);
    this.presetId = null;
    this.previewApp = null;
    this.previewMesh = null;
    this.previewBuild = 0;
    this.#load(area);
  }

  #load(area) {
    this.areaId = area.id;
    this.saved = foundry.utils.deepClone(area);
    this.settings = { name: area.name, feather: area.feather, visible: area.visible, exclude: area.exclude, ignoreExclusions: area.ignoreExclusions };
    let cfg = area.effect;
    // An exclusion zone may have no effect of its own; an effect area always starts with one.
    if (!cfg.layers.length && !area.exclude) cfg = defaultEffect();
    this.#setConfig(cfg);
    this.dirty = false;
    this.previewKey = null;
  }

  /** Switch to another area while open: the unsaved changes of the old one are dropped. */
  setArea(area) {
    if (area.id === this.areaId) return;
    if (this.dirty) setOverride(this.areaId, null);
    this.#load(area);
  }

  get layer() {
    return this.cfg.layers[this.sel];
  }

  get title() {
    return `${game.i18n.localize("DXCFX.App.Title")}: ${this.settings?.name ?? ""}`;
  }

  #setConfig(cfg, sel = 0) {
    this.cfg = normalizeEffect(cfg);
    if (!this.cfg.layers.length && !this.settings?.exclude) this.cfg = defaultEffect();
    this.sel = Math.min(Math.max(0, sel), Math.max(0, this.cfg.layers.length - 1));
  }

  /** The area as it would be with the changes in this window. */
  #edited() {
    const area = editableArea(this.areaId) ?? this.saved;
    return normalizeArea({ ...area, ...this.settings, effect: this.cfg });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const layer = this.layer;
    const saved0 = presets();
    const base = {
      areaName: this.settings.name,
      feather: this.settings.feather,
      featherText: game.i18n.format("DXCFX.Palette.Squares", { n: FORMAT.sq(this.settings.feather) }),
      visible: this.settings.visible,
      exclude: this.settings.exclude,
      ignoreExclusions: this.settings.ignoreExclusions,
      dirty: this.dirty,
      presets: saved0.map(p => ({ id: p.id, name: p.name, selected: p.id === this.presetId })),
      examples: EXAMPLES.map(p => ({ id: p.id, name: p.name, selected: p.id === this.presetId })),
      hasPreset: !!this.presetId,
      canDeletePreset: !!this.presetId && saved0.some(p => p.id === this.presetId)
    };
    // An exclusion zone without an effect of its own: only the button to add one.
    if (!layer) return { ...base, hasLayer: false };
    const def = EFFECTS[layer.effect];
    const isImage = layer.effect === IMAGE;
    const slider = (name, p = PARAMS[name]) =>
      ({ name, label: p.label, hint: def.hints?.[name] ?? null, min: p.min, max: p.max, step: p.step, fmt: p.fmt, value: layer[name], text: FORMAT[p.fmt](layer[name]) });
    const saved = presets();
    if (this.presetId && !saved.some(p => p.id === this.presetId) && !EXAMPLES.some(p => p.id === this.presetId)) this.presetId = null;

    return {
      ...base,
      hasLayer: true,

      layers: this.cfg.layers.map((l, i) => ({
        index: i,
        label: layerLabel(l),
        icon: EFFECTS[l.effect]?.icon ?? "fa-solid fa-question",
        thumb: l.effect === IMAGE && l.src ? l.src : null,
        active: i === this.sel
      })),
      layerNumber: this.sel + 1,
      layerCount: this.cfg.layers.length,
      canAddLayer: this.cfg.layers.length < MAX_LAYERS,
      canRemoveLayer: this.cfg.layers.length > 1 || !!this.settings.exclude,
      canMoveDown: this.sel > 0,
      canMoveUp: this.sel < this.cfg.layers.length - 1,

      effectGroups: CATEGORIES.map(c => ({
        label: c.label,
        effects: c.effects.filter(id => EFFECTS[id]).map(id => {
          const d = EFFECTS[id];
          return { id, label: d.label, icon: d.icon, active: id === layer.effect, custom: !!d.custom };
        })
      })),
      needsMap: !!def.backdrop && !canvas.primary?.background?.texture?.valid,
      effectLabel: def.label,
      styles: Object.entries(def.styles).map(([id, s]) => ({ id, label: s.label, active: id === layer.style })),

      isImage,
      src: isImage ? layer.src : "",
      fits: Object.entries(FITS).map(([id, label]) => ({ id, label, selected: id === layer.fit })),
      canUpload: game.user.can("FILES_UPLOAD"),
      canBrowse: game.user.can("FILES_BROWSE"),

      sliders: (def.params ?? []).map(n => slider(n)),
      common: COMMON_PARAMS.map(n => slider(n)),
      useColor: !!layer.color,
      color: layer.color ?? def.styles[layer.style]?.color ?? "#8a5aff",
      blends: [
        { id: "", label: "DXCFX.Blend.Style", selected: !layer.blend },
        ...Object.entries(BLENDS).map(([id, label]) => ({ id, label, selected: id === layer.blend }))
      ],

      hasLight: !!def.lights,
      light: !!layer.light,
      canAboveTokens: !def.under && !def.backdrop,
      aboveTokens: !!layer.aboveTokens,
      sounds: [
        { id: "", label: "DXCFX.Sound.None", selected: !layer.sound },
        ...soundOptions(layer.effect).map(id => ({ id, label: SOUNDS[id].label, selected: id === layer.sound })),
        { id: CUSTOM, label: "DXCFX.Sound.Custom", selected: layer.sound === CUSTOM }
      ],
      hasSoundChoice: !!layer.sound,
      soundCustom: layer.sound === CUSTOM,
      soundSrc: layer.soundSrc ?? "",
      soundVolume: layer.soundVolume,
      soundVolumeText: FORMAT.pct(layer.soundVolume),
      soundRange: layer.soundRange,
      soundRangeMin: RANGE.min, soundRangeMax: RANGE.max, soundRangeStep: RANGE.step,
      soundRangeText: game.i18n.format("DXCFX.Palette.Squares", { n: layer.soundRange }),
      soundHint: isStrikeSound(layer.effect) ? "DXCFX.App.ThunderHint" : "DXCFX.App.SoundHint",

      presets: saved.map(p => ({ id: p.id, name: p.name, selected: p.id === this.presetId })),
      examples: EXAMPLES.map(p => ({ id: p.id, name: p.name, selected: p.id === this.presetId })),
      hasPreset: !!this.presetId,
      canDeletePreset: !!this.presetId && saved.some(p => p.id === this.presetId)
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;
    const layer = () => this.layer;
    if (this.window?.title) this.window.title.textContent = this.title;

    for (const input of html.querySelectorAll("input[type=range][data-param]")) {
      input.addEventListener("input", ev => {
        const el = ev.currentTarget;
        const v = Number(el.value);
        layer()[el.name] = el.dataset.fmt === "int" ? Math.round(v) : v;
        const out = html.querySelector(`output[data-for="${el.name}"]`);
        if (out) out.textContent = FORMAT[el.dataset.fmt ?? "pct"](v);
        this.#changed();
      });
    }

    const useColor = html.querySelector("input[name=useColor]");
    const color = html.querySelector("input[name=color]");
    const onColor = () => {
      layer().color = useColor.checked ? color.value : null;
      color.disabled = !useColor.checked;
      this.#changed();
    };
    useColor?.addEventListener("change", onColor);
    color?.addEventListener("input", onColor);

    html.querySelector("select[name=blend]")?.addEventListener("change", ev => {
      layer().blend = ev.currentTarget.value || null;
      this.#changed();
    });
    html.querySelector("input[name=light]")?.addEventListener("change", ev => {
      layer().light = ev.currentTarget.checked;
      this.#changed();
    });
    html.querySelector("input[name=aboveTokens]")?.addEventListener("change", ev => {
      layer().aboveTokens = ev.currentTarget.checked;
      this.#changed();
    });
    html.querySelector("select[name=sound]")?.addEventListener("change", ev => {
      layer().sound = ev.currentTarget.value;
      this.#changed(true);
    });
    html.querySelector("input[name=soundSrc]")?.addEventListener("change", ev => {
      layer().soundSrc = ev.currentTarget.value.trim();
      this.#changed();
    });
    html.querySelector("input[name=soundVolume]")?.addEventListener("input", ev => {
      const v = Number(ev.currentTarget.value);
      layer().soundVolume = v;
      const out = html.querySelector("output[data-for=soundVolume]");
      if (out) out.textContent = FORMAT.pct(v);
      this.#changed();
    });
    html.querySelector("input[name=soundRange]")?.addEventListener("input", ev => {
      const v = Number(ev.currentTarget.value);
      layer().soundRange = v;
      const out = html.querySelector("output[data-for=soundRange]");
      if (out) out.textContent = game.i18n.format("DXCFX.Palette.Squares", { n: v });
      this.#changed();
    });
    html.querySelector("select[name=fit]")?.addEventListener("change", ev => {
      layer().fit = ev.currentTarget.value;
      this.#changed();
    });
    html.querySelector("input[name=src]")?.addEventListener("change", ev => {
      layer().src = ev.currentTarget.value.trim();
      this.#changed(true);
    });
    html.querySelector("input[name=imageFile]")?.addEventListener("change", ev => {
      const file = ev.currentTarget.files?.[0];
      ev.currentTarget.value = "";
      if (file) this.#upload(file);
    });
    html.querySelector("input[name=effectFile]")?.addEventListener("change", ev => {
      const file = ev.currentTarget.files?.[0];
      ev.currentTarget.value = "";
      if (file) this.#import(file);
    });
    html.querySelector("select[name=preset]")?.addEventListener("change", ev => {
      this.presetId = ev.currentTarget.value || null;
      this.render({ parts: ["main"] });
    });

    // The area itself
    html.querySelector("input[name=areaName]")?.addEventListener("change", ev => {
      this.settings.name = ev.currentTarget.value.trim().slice(0, 60) || this.settings.name;
      if (this.window?.title) this.window.title.textContent = this.title;
      this.#changed();
    });
    const feather = html.querySelector("input[name=feather]");
    feather?.addEventListener("input", ev => {
      html.querySelector("output[data-for=feather]").textContent =
        game.i18n.format("DXCFX.Palette.Squares", { n: FORMAT.sq(ev.currentTarget.value) });
    });
    feather?.addEventListener("change", ev => {
      this.settings.feather = Number(ev.currentTarget.value);
      this.#changed();
    });
    html.querySelector("input[name=exclude]")?.addEventListener("change", ev => {
      this.settings.exclude = ev.currentTarget.checked;
      if (!this.settings.exclude && !this.cfg.layers.length) this.#setConfig(defaultEffect());
      this.#changed(true);
    });
    html.querySelector("input[name=ignoreExclusions]")?.addEventListener("change", ev => {
      this.settings.ignoreExclusions = ev.currentTarget.checked;
      this.#changed();
    });
    html.querySelector("input[name=visible]")?.addEventListener("change", ev => {
      this.settings.visible = ev.currentTarget.checked;
      this.#changed();
    });

    await this.#mountPreview();
    this.#showOnMap();
  }

  /** Something changed: update the preview and the map (soon, so sliders stay smooth). */
  #changed(rerender = false) {
    if (!this.dirty) {
      this.dirty = true;
      this.element?.querySelector(".dxcfx-dirty")?.classList.add("on");
    }
    if (rerender) return this.render({ parts: ["main"] });
    clearTimeout(this._changeTimer);
    this._changeTimer = setTimeout(() => {
      this.#rebuildPreview();
      this.#showOnMap();
    }, 40);
  }

  /** Show the edited (unsaved) effect on the map. */
  #showOnMap() {
    if (!this.dirty) return;
    const { effect, feather, visible, name, exclude, ignoreExclusions } = this.#edited();
    setOverride(this.areaId, { effect, feather, visible, name, exclude, ignoreExclusions });
  }

  /* -------------------------------------------- */
  /*  Preview                                     */
  /* -------------------------------------------- */

  async #mountPreview() {
    const host = this.element.querySelector(".dxcfx-preview");
    if (!host) return;
    if (!this.previewApp) {
      this.previewApp = new PIXI.Application({
        width: PREVIEW_W, height: PREVIEW_H, backgroundAlpha: 0, antialias: true,
        autoDensity: true, resolution: window.devicePixelRatio || 1
      });
      this.previewWorld = this.previewApp.stage.addChild(new PIXI.Container());
      this.previewApp.ticker.add(() => this.previewMesh?.update(Math.min(0.1, this.previewApp.ticker.deltaMS / 1000)));
    }
    host.appendChild(this.previewApp.view);
    await this.#rebuildPreview();
  }

  /** Fit the area into the preview, with the map under it. */
  #frame(area) {
    const b = areaBounds(area.shapes);
    if (!b) return null;
    const grid = canvas.dimensions.size;
    const pad = grid * (0.5 + area.feather);
    const box = { x: b.x - pad, y: b.y - pad, width: b.width + 2 * pad, height: b.height + 2 * pad };
    const s = Math.min(PREVIEW_W / box.width, PREVIEW_H / box.height);
    return { box, s, key: JSON.stringify([area.shapes, area.feather]) };
  }

  #drawBackground(frame) {
    const world = this.previewWorld;
    this.previewBg?.destroy();
    this.previewBg = null;
    const tex = canvas.primary?.background?.texture;
    const d = canvas.dimensions;
    if (!tex?.valid || tex.baseTexture?.resource instanceof PIXI.VideoResource) return;
    try {
      const bg = new PIXI.Sprite(tex);
      bg.position.set(d.sceneX, d.sceneY);
      bg.width = d.sceneWidth;
      bg.height = d.sceneHeight;
      this.previewBg = world.addChildAt(bg, 0);
    } catch (err) {
      console.debug(`${MODULE_ID} | no map in the preview`, err);
    }
  }

  async #rebuildPreview() {
    if (!this.previewApp) return;
    const build = ++this.previewBuild;
    const area = this.#edited();
    const textures = await effectImages(area.effect);
    if (build !== this.previewBuild || !this.previewApp) return;
    const frame = this.#frame(area);
    const world = this.previewWorld;
    if (!frame) {
      this.previewMesh?.destroy();
      this.previewMesh = null;
      return;
    }
    // Same shapes: only the effect changes (live). Otherwise everything is placed again.
    if (frame.key !== this.previewKey || !this.previewMesh) {
      this.previewKey = frame.key;
      this.previewMesh?.destroy();
      this.previewMesh = null;
      world.scale.set(frame.s);
      world.position.set(-frame.box.x * frame.s + (PREVIEW_W - frame.box.width * frame.s) / 2,
        -frame.box.y * frame.s + (PREVIEW_H - frame.box.height * frame.s) / 2);
      if (!this.previewBg) this.#drawBackground(frame);
    }
    if (this.previewMesh) this.previewMesh.setArea(area, textures);
    else {
      this.previewMesh = new AreaMesh(area, {
        renderer: this.previewApp.renderer, grid: canvas.dimensions.size, quality: 1, textures, maxMask: 512,
        backdrop: sceneBackdrop()
      });
      world.addChild(this.previewMesh);
    }
    this.previewMesh.alpha = area.visible ? 1 : 0.6;
  }

  async close(options) {
    this.previewBuild++;
    clearTimeout(this._changeTimer);
    this.previewMesh?.destroy();
    this.previewBg?.destroy();
    this.previewApp?.destroy(true, { children: true });
    this.previewApp = this.previewMesh = this.previewBg = this.previewWorld = null;
    // Not applied: the area goes back to how it is saved.
    setOverride(this.areaId, null);
    CanvasEffectConfig.instance = null;
    return super.close(options);
  }

  /** The area was deleted, or the scene changed. */
  onAreasChanged() {
    if (!this.rendered) return;
    if (!getArea(this.areaId) && !shownAreas().some(a => a.id === this.areaId)) return this.close();
    this.#rebuildPreview();      // the shapes may have changed
  }

  /* -------------------------------------------- */
  /*  Your own image                              */
  /* -------------------------------------------- */

  #setImage(path) {
    if (!path || this.layer.effect !== IMAGE) return;
    this.layer.src = path;
    this.#changed(true);
  }

  async #upload(file) {
    if (!game.user.can("FILES_UPLOAD")) return ui.notifications.warn(game.i18n.localize("DXCFX.App.NoUpload"));
    if (!file.type.startsWith("image/")) return ui.notifications.warn(game.i18n.localize("DXCFX.App.NotImage"));
    const FP = foundry.applications.apps.FilePicker.implementation;
    const dir = `worlds/${game.world.id}/${MODULE_ID}`;
    try { await FP.createDirectory("data", dir, {}); } catch (_) { /* already there */ }
    try {
      const res = await FP.upload("data", dir, file, {}, { notify: true });
      if (res?.path) this.#setImage(res.path);
    } catch (err) {
      console.error(`${MODULE_ID} | upload failed`, err);
      ui.notifications.error(game.i18n.localize("DXCFX.App.UploadFailed"));
    }
  }

  /* -------------------------------------------- */
  /*  Export / import                             */
  /* -------------------------------------------- */

  static #freeName(name) {
    const taken = new Set(presets().map(p => p.name.toLowerCase()));
    let candidate = name.slice(0, 60);
    for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${name.slice(0, 54)} (${i})`;
    return candidate;
  }

  async #import(file) {
    if (this._importing) return;
    this._importing = true;
    try {
      const result = await importEffect(file);
      if (!result.cfg.layers.length) throw new Error(game.i18n.localize("DXCFX.Transfer.Empty"));
      this.#setConfig(result.cfg);
      const name = CanvasEffectConfig.#freeName(result.name);
      this.presetId = await savePreset(name, result.cfg);
      ui.notifications.info(game.i18n.format("DXCFX.Transfer.Imported", { name, n: result.uploaded }));
      if (result.skipped.length) {
        ui.notifications.warn(game.i18n.format(game.user.can("FILES_UPLOAD") ? "DXCFX.Transfer.ImageFailed" : "DXCFX.Transfer.NoUploadImport",
          { files: result.skipped.join(", ") }));
      }
      this.#changed(true);
    } catch (err) {
      console.error(`${MODULE_ID} | import failed`, err);
      ui.notifications.error(game.i18n.format("DXCFX.Transfer.ImportFailed", { error: err.message }));
    } finally {
      this._importing = false;
    }
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static #onEffect(event, target) {
    const id = target.dataset.effect;
    const old = this.layer;
    if (id === old.effect || !EFFECTS[id]) return;
    // Keep the fine-tuning, change what is drawn.
    const keep = { alpha: old.alpha, speed: old.speed, scale: old.scale, density: old.density, direction: old.direction, pulse: old.pulse, rainbow: old.rainbow };
    // A slider the old effect didn't show was never set: the new effect's own default wins (Sunlight: 45).
    const shown = EFFECTS[old.effect]?.params ?? [];
    for (const k of Object.keys(EFFECTS[id].defaults ?? {})) if (!shown.includes(k)) delete keep[k];
    const layer = normalizeLayer({ ...keep, effect: id });
    // A file of your own stays; otherwise the new effect gets its own standard sound.
    if (old.sound === CUSTOM) Object.assign(layer, { sound: CUSTOM, soundSrc: old.soundSrc, soundVolume: old.soundVolume, soundRange: old.soundRange });
    else withStandardSound(layer, standardSoundsOn());
    this.cfg.layers[this.sel] = layer;
    this.#changed(true);
  }

  static #onStyle(event, target) {
    const id = target.dataset.style;
    const layer = this.layer;
    if (!EFFECTS[layer.effect].styles[id] || id === layer.style) return;
    layer.style = id;
    this.#changed(true);
  }

  static #onSelectLayer(event, target) {
    const i = Number(target.dataset.index);
    if (!this.cfg.layers[i] || i === this.sel) return;
    this.sel = i;
    this.render({ parts: ["main"] });
  }

  static #onAddLayer() {
    if (this.cfg.layers.length >= MAX_LAYERS) return;
    // A few particles are the most common thing to add on top.
    this.cfg.layers.push(withStandardSound(normalizeLayer({ effect: "particles", style: "motes" }), standardSoundsOn()));
    this.sel = this.cfg.layers.length - 1;
    this.#changed(true);
  }

  static #onDuplicateLayer() {
    if (this.cfg.layers.length >= MAX_LAYERS) return;
    this.cfg.layers.splice(this.sel + 1, 0, foundry.utils.deepClone(this.layer));
    this.sel++;
    this.#changed(true);
  }

  /** Move the layer towards the top (+1, drawn later) or the bottom (-1). */
  static #onMoveLayer(event, target) {
    const to = this.sel + Number(target.dataset.dir);
    if (to < 0 || to >= this.cfg.layers.length) return;
    const [l] = this.cfg.layers.splice(this.sel, 1);
    this.cfg.layers.splice(to, 0, l);
    this.sel = to;
    this.#changed(true);
  }

  static #onRemoveLayer() {
    if (this.cfg.layers.length <= 1 && !this.settings.exclude) return;
    this.cfg.layers.splice(this.sel, 1);
    this.sel = Math.min(this.sel, this.cfg.layers.length - 1);
    this.#changed(true);
  }

  static #onBrowseImage() {
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({ type: "image", current: this.layer.src || "", callback: path => this.#setImage(path) }).render(true);
  }

  static #onBrowseSound() {
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({
      type: "audio", current: this.layer.soundSrc || "",
      callback: path => { this.layer.sound = CUSTOM; this.layer.soundSrc = path; this.#changed(true); }
    }).render(true);
  }

  static #onUploadImage() {
    this.element.querySelector("input[name=imageFile]")?.click();
  }

  static #onLoadPreset() {
    const p = presets().find(x => x.id === this.presetId) ?? EXAMPLES.find(x => x.id === this.presetId);
    if (!p) return;
    this.#setConfig(foundry.utils.deepClone(p.cfg));
    // The examples come with the standard sounds (if wanted); saved effects keep their own.
    if (EXAMPLES.includes(p)) for (const l of this.cfg.layers) withStandardSound(l, standardSoundsOn());
    this.#changed(true);
  }

  static async #onSavePreset() {
    const current = presets().find(x => x.id === this.presetId);
    let name;
    try {
      name = await foundry.applications.api.DialogV2.prompt({
        window: { title: "DXCFX.App.SaveTitle" },
        content: `<label>${game.i18n.localize("DXCFX.App.SaveName")} <input type="text" name="name" value="${escapeHTML(current?.name)}" maxlength="60" autofocus></label>`,
        ok: { label: "DXCFX.App.Save", icon: "fa-solid fa-floppy-disk", callback: (ev, button) => button.form.elements.name.value },
        rejectClose: false
      });
    } catch (_) { return; }
    if (!name?.trim()) return;
    this.presetId = await savePreset(name, this.cfg);
    ui.notifications.info(game.i18n.format("DXCFX.App.Saved", { name: name.trim() }));
    this.render({ parts: ["main"] });
  }

  static async #onDeletePreset() {
    const p = presets().find(x => x.id === this.presetId);
    if (!p) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "DXCFX.App.DeleteTitle" },
      content: `<p>${game.i18n.format("DXCFX.App.DeleteConfirm", { name: escapeHTML(p.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    await deletePreset(p.id);
    this.presetId = null;
    this.render({ parts: ["main"] });
  }

  static async #onExport() {
    const current = presets().find(x => x.id === this.presetId);
    let name;
    try {
      name = await foundry.applications.api.DialogV2.prompt({
        window: { title: "DXCFX.Transfer.ExportTitle", icon: "fa-solid fa-file-export" },
        content: `<p>${game.i18n.localize("DXCFX.Transfer.ExportText")}</p>
          <label>${game.i18n.localize("DXCFX.App.SaveName")} <input type="text" name="name" value="${escapeHTML(current?.name ?? this.settings.name)}" maxlength="60" autofocus></label>`,
        ok: { label: "DXCFX.Transfer.Export", icon: "fa-solid fa-file-export", callback: (ev, button) => button.form.elements.name.value },
        rejectClose: false
      });
    } catch (_) { return; }
    if (name === null || name === undefined) return;
    try {
      const { file } = await exportEffect(this.cfg, name);
      ui.notifications.info(game.i18n.format("DXCFX.Transfer.Exported", { file }));
    } catch (err) {
      console.error(`${MODULE_ID} | export failed`, err);
      ui.notifications.error(game.i18n.localize("DXCFX.Transfer.ExportFailed"));
    }
  }

  static #onImport() {
    this.element.querySelector("input[name=effectFile]")?.click();
  }

  static async #onApply() {
    const area = this.#edited();
    if (area.effect.layers.some(l => l.effect === IMAGE && !l.src)) {
      return ui.notifications.warn(game.i18n.localize("DXCFX.App.NoImage"));
    }
    showLocal(area.id, area);
    await saveArea(area);
    if (!area.exclude && area.effect.layers.length) await game.settings.set(MODULE_ID, "lastEffect", area.effect);
    this.saved = foundry.utils.deepClone(area);
    this.dirty = false;
    await setOverride(this.areaId, null);
    ui.notifications.info(game.i18n.format("DXCFX.App.Applied", { name: area.name }));
    this.render({ parts: ["main"] });
  }

  /** Throw the changes away and show the area as it is saved. */
  static async #onRevert() {
    const area = editableArea(this.areaId) ?? this.saved;
    const sel = this.sel;
    this.#load(area);
    this.sel = Math.min(sel, this.cfg.layers.length - 1);
    await setOverride(this.areaId, null);
    this.render({ parts: ["main"] });
  }

  /** Remove the effect from the area (the painted area stays, empty). */
  static async #onClearEffect() {
    const area = { ...this.#edited(), effect: { layers: [] } };
    showLocal(area.id, area);
    await saveArea(area);
    await setOverride(this.areaId, null);
    ui.notifications.info(game.i18n.format("DXCFX.App.Cleared", { name: area.name }));
    this.close();
  }

  /** Reset the current layer's fine-tuning (keeps what it shows). */
  static #onResetLayer() {
    const l = this.layer;
    if (!l) return;
    this.cfg.layers[this.sel] = normalizeLayer({ effect: l.effect, style: l.style, src: l.src, fit: l.fit, sound: l.sound, soundSrc: l.soundSrc, soundVolume: l.soundVolume, soundRange: l.soundRange });
    this.#changed(true);
  }
}
