/**
 * Dxcufgb's canvas effects - the Effect Painter palette.
 *
 * A small window that is open while the painting layer is active: the brush width, grid snapping,
 * the areas of the scene (pick, show or hide for players, open the effect, delete) and a button for
 * the current area's effect.
 */

import { MODULE_ID, LAYER } from "./constants.js";
import { sceneAreas, saveArea, saveAreas, canEdit } from "./store.js";
import { brush, setBrush, TOOLS } from "./layer.js";
import { meshFor, showLocal } from "./manager.js";
import { EFFECTS, layerLabel } from "./effects.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class EffectPainter extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "dxcfx-palette",
    classes: ["dxcfx-palette"],
    tag: "div",
    window: { title: "DXCFX.Palette.Title", icon: "fa-solid fa-wand-magic-sparkles", resizable: false, minimizable: true },
    position: { width: 300, height: "auto", left: 130, top: 90 },
    actions: {
      pickArea: EffectPainter.#onPick,
      focusArea: EffectPainter.#onFocus,
      configArea: EffectPainter.#onConfig,
      toggleArea: EffectPainter.#onToggle,
      deleteArea: EffectPainter.#onDelete,
      newArea: EffectPainter.#onNew,
      newExclusion: EffectPainter.#onNewExclusion,
      moveArea: EffectPainter.#onMove,
      configure: EffectPainter.#onConfigure
    }
  };

  static PARTS = {
    main: { template: `modules/${MODULE_ID}/templates/palette.hbs` }
  };

  static instance = null;

  static open() {
    if (!game.user.isGM) return null;
    this.instance ??= new this();
    this.instance.render({ force: true });
    return this.instance;
  }

  static close() {
    this.instance?.close();
  }

  /** Re-render if open (areas, current area or tool changed). */
  static refresh() {
    const app = this.instance;
    if (!app?.rendered) return;
    clearTimeout(app._timer);
    app._timer = setTimeout(() => app.render({ parts: ["main"] }), 30);
  }

  get layer() {
    return canvas[LAYER];
  }

  async _prepareContext() {
    const b = brush();
    const current = this.layer?.currentId ?? null;
    const tool = game.activeTool;
    const areas = sceneAreas().slice().reverse().map(a => {
      const layers = a.effect.layers;
      const first = layers[0];
      return {
        id: a.id,
        name: a.name,
        visible: a.visible,
        exclude: a.exclude,
        active: a.id === current,
        icon: a.exclude ? "fa-solid fa-ban" : first ? EFFECTS[first.effect]?.icon : "fa-regular fa-circle",
        effect: a.exclude && !first ? game.i18n.localize("DXCFX.Palette.ExclusionHint")
          : first ? (a.exclude ? "⊘ " : "") + layerLabel(first) + (layers.length > 1 ? ` +${layers.length - 1}` : "") : game.i18n.localize("DXCFX.Palette.NoEffect")
      };
    });
    const currentArea = areas.find(a => a.active) ?? null;
    return {
      width: b.width,
      widthText: this.#squares(b.width),
      snap: b.snap,
      areas,
      currentArea,
      nextExclude: !!this.layer?.nextExclude && !current,
      hint: game.i18n.localize(`DXCFX.Hint.${Object.values(TOOLS).includes(tool) ? tool : "other"}`),
      canEdit: canEdit()
    };
  }

  #squares(v) {
    return game.i18n.format("DXCFX.Palette.Squares", { n: Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 }) });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;
    const width = html.querySelector("input[name=width]");
    width?.addEventListener("input", ev => {
      html.querySelector("output[data-for=width]").textContent = this.#squares(ev.currentTarget.value);
    });
    width?.addEventListener("change", ev => setBrush({ width: Number(ev.currentTarget.value) }));
    html.querySelector("input[name=snap]")?.addEventListener("change", ev => setBrush({ snap: ev.currentTarget.checked }));
  }

  async close(options = {}) {
    // Esc while painting: keep the palette, let the layer drop the current area instead.
    if (options.closeKey && canvas?.[LAYER]?.active) return this;
    EffectPainter.instance = null;
    return super.close(options);
  }

  /* -------------------------------------------- */

  static #onPick(event, target) {
    const id = target.closest("[data-id]")?.dataset.id;
    this.layer?.setCurrent(id === this.layer.currentId ? null : id);
  }

  static #onFocus(event, target) {
    const id = target.closest("[data-id]")?.dataset.id;
    const b = meshFor(id)?.rawBounds;
    this.layer?.setCurrent(id);
    if (b) canvas.animatePan({ x: b.x + b.width / 2, y: b.y + b.height / 2, duration: 250 });
  }

  static #onConfig(event, target) {
    const id = target.closest("[data-id]")?.dataset.id;
    this.layer?.openConfig(id);
  }

  static async #onToggle(event, target) {
    const id = target.closest("[data-id]")?.dataset.id;
    const area = sceneAreas().find(a => a.id === id);
    if (!area) return;
    area.visible = !area.visible;
    showLocal(area.id, area);
    await saveArea(area);
    EffectPainter.refresh();
  }

  static #onDelete(event, target) {
    const id = target.closest("[data-id]")?.dataset.id;
    this.layer?.removeArea(id);
  }

  static #onNew() {
    this.layer?.setCurrent(null);
    ui.notifications.info(game.i18n.localize("DXCFX.Notify.NewArea"));
  }

  static #onNewExclusion() {
    if (!this.layer) return;
    this.layer.setCurrent(null);
    this.layer.nextExclude = true;
    ui.notifications.info(game.i18n.localize("DXCFX.Notify.NewExclusion"));
    EffectPainter.refresh();
  }

  /** Move an area up (drawn later, on top) or down in the list. Exclusion zones cut what is below them. */
  static async #onMove(event, target) {
    const id = target.closest("[data-id]")?.dataset.id;
    const dir = Number(target.dataset.dir);
    const list = sceneAreas().map((a, i) => ({ ...a, sort: i + 1 }));      // renumber: no ties
    const i = list.findIndex(a => a.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i].sort, list[j].sort] = [list[j].sort, list[i].sort];
    for (const a of list) showLocal(a.id, a);
    await saveAreas(list);
    EffectPainter.refresh();
  }

  static #onConfigure() {
    this.layer?.openConfig();
  }
}
