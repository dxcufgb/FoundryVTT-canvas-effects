/**
 * Dxcufgb's canvas effects - the painting layer and its Scene Controls.
 *
 * Tools (GM only):
 *   Pick      click an area to make it the current one, double-click to open its effect
 *   Move      drag an area (and its effect) somewhere else; hold Alt to drag a copy
 *   Brush     paint freehand (drag) or a dot (click)
 *   Wall      click-drag, then click to add corners, double-click to finish: a line of brush width
 *   Rectangle / Ellipse   drag
 *   Polygon   click-drag, then click to add corners, double-click (or click the first corner) to close
 *   Eraser    paint away from the current area (or from every area under it when none is current)
 * Hold Alt while drawing a rectangle, ellipse, polygon or wall to cut it out instead.
 * Hold Shift to place points without snapping to the grid. Right-click removes the last corner.
 * Ctrl+Z undoes, Delete removes the current area, Esc lets go of it.
 *
 * The painted areas never block sight or movement; they only hold the effects.
 */

import { MODULE_ID, LAYER } from "./constants.js";
import { drawShape, translateShapes, normalizeShape, shapeBounds, boxesTouch, areaContains, thinPoints, Graphics } from "./geometry.js";
import { sceneAreas, getArea, saveArea, deleteArea, deleteAllAreas, newArea, canEdit } from "./store.js";
import { meshFor, showLocal, shownAreas, editableAreas, editableArea } from "./manager.js";

export const TOOLS = {
  pick: "dxcfxPick",
  move: "dxcfxMove",
  brush: "dxcfxBrush",
  wall: "dxcfxWall",
  rect: "dxcfxRect",
  ellipse: "dxcfxEllipse",
  polygon: "dxcfxPolygon",
  erase: "dxcfxErase"
};
const DRAW_TOOLS = [TOOLS.brush, TOOLS.wall, TOOLS.rect, TOOLS.ellipse, TOOLS.polygon, TOOLS.erase];
const POINT_TOOLS = [TOOLS.wall, TOOLS.polygon];

const COLORS = { current: 0xff9a3c, other: 0x3cc8ff, erase: 0xff3c5a, exclude: 0xff3c5a };

const escapeHTML = str => String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** Brush settings on this computer: {width (grid squares), snap, feather}. */
export function brush() {
  const b = game.settings.get(MODULE_ID, "brush") ?? {};
  return {
    width: Math.min(20, Math.max(0.1, Number(b.width) || 1)),
    snap: b.snap !== false,
    feather: Math.min(4, Math.max(0, Number(b.feather ?? 0.25)))
  };
}

export async function setBrush(changes) {
  await game.settings.set(MODULE_ID, "brush", { ...brush(), ...changes });
  canvas[LAYER]?.refreshCursor();
}

export class CanvasEffectsLayer extends foundry.canvas.layers.InteractionLayer {

  static get layerOptions() {
    return Object.assign(super.layerOptions, { name: LAYER, zIndex: 180 });
  }

  /** Callbacks for the palette and the effect window (set in main.js, avoids circular imports). */
  static hooks = { openConfig: null, openPalette: null, closePalette: null, changed: null };

  /** The area being painted into, or null: the next stroke starts a new one. */
  currentId = null;

  /** The next new area is an exclusion zone. */
  nextExclude = false;

  #undo = [];
  #overlay;
  #preview;
  #cursor;
  #hud = null;
  #onMove = null;

  /* -------------------------------------------- */
  /*  Scene Controls                              */
  /* -------------------------------------------- */

  static prepareSceneControls() {
    const L = () => canvas[LAYER];
    const tool = (name, order, icon, extra = {}) => ({ name, order, title: `DXCFX.Tool.${name}`, icon, ...extra });
    return {
      name: LAYER,
      order: 12,
      title: "DXCFX.Controls.Title",
      icon: "fa-solid fa-wand-magic-sparkles",
      layer: LAYER,
      visible: game.user.isGM,
      onChange: (event, active) => { if (active) L()?.activate(); },
      onToolChange: () => { L()?.refreshCursor(); CanvasEffectsLayer.hooks.changed?.(); },
      activeTool: TOOLS.brush,
      tools: {
        [TOOLS.pick]: tool(TOOLS.pick, 1, "fa-solid fa-arrow-pointer"),
        [TOOLS.move]: tool(TOOLS.move, 1.5, "fa-solid fa-up-down-left-right"),
        [TOOLS.brush]: tool(TOOLS.brush, 2, "fa-solid fa-paintbrush"),
        [TOOLS.wall]: tool(TOOLS.wall, 3, "fa-solid fa-bezier-curve"),
        [TOOLS.rect]: tool(TOOLS.rect, 4, "fa-solid fa-square"),
        [TOOLS.ellipse]: tool(TOOLS.ellipse, 5, "fa-solid fa-circle"),
        [TOOLS.polygon]: tool(TOOLS.polygon, 6, "fa-solid fa-draw-polygon"),
        [TOOLS.erase]: tool(TOOLS.erase, 7, "fa-solid fa-eraser"),
        dxcfxConfig: tool("dxcfxConfig", 8, "fa-solid fa-sliders", {
          button: true,
          onChange: () => L()?.openConfig()
        }),
        dxcfxPalette: tool("dxcfxPalette", 9, "fa-solid fa-layer-group", {
          button: true,
          onChange: () => CanvasEffectsLayer.hooks.openPalette?.()
        }),
        dxcfxClear: tool("dxcfxClear", 10, "fa-solid fa-trash", {
          button: true,
          onChange: () => L()?.clearAll()
        })
      }
    };
  }

  /* -------------------------------------------- */
  /*  Drawing                                     */
  /* -------------------------------------------- */

  async _draw(options) {
    await super._draw(options);
    this.#overlay = this.addChild(new PIXI.Container());
    this.#preview = this.addChild(Graphics());
    this.#cursor = this.addChild(Graphics());
    this.#overlay.eventMode = this.#preview.eventMode = this.#cursor.eventMode = "none";
    this.visible = false;
    this.#onMove = event => this.#drawCursor(event.getLocalPosition(canvas.stage));
    this.on("pointermove", this.#onMove);
    if (!sceneAreas().some(a => a.id === this.currentId)) this.currentId = null;
    this.#undo = [];
  }

  async _tearDown(options) {
    this.off("pointermove", this.#onMove);
    this.#removeHud();
    return super._tearDown(options);
  }

  _activate() {
    this.visible = true;
    this.refreshOverlay();
    this.refreshCursor();
    CanvasEffectsLayer.hooks.openPalette?.();
  }

  _deactivate() {
    this.visible = false;
    this.#preview?.clear();
    this.#cursor?.clear();
    this.#removeHud();
    CanvasEffectsLayer.hooks.closePalette?.();
  }

  get tool() {
    return game.activeTool;
  }

  /** Make an area the current one (null: none, the next stroke starts a new area). */
  setCurrent(id) {
    this.currentId = id ?? null;
    if (id) this.nextExclude = false;
    this.refreshOverlay();
    CanvasEffectsLayer.hooks.changed?.();
  }

  /** Redraw the outlines of the painted areas and the current area's button. */
  refreshOverlay() {
    const overlay = this.#overlay;
    if (!overlay || overlay.destroyed) return;
    for (const c of overlay.removeChildren()) c.destroy({ children: true });
    if (!this.active) { this.#removeHud(); return; }
    const areas = shownAreas();
    if (this.currentId && !areas.some(a => a.id === this.currentId)) this.currentId = null;
    const size = canvas.dimensions.size;
    for (const area of areas) {
      const mesh = meshFor(area.id);
      if (!mesh?.maskTexture || !mesh.bounds) continue;
      const current = area.id === this.currentId;
      const s = new PIXI.Sprite(mesh.maskTexture);
      s._areaId = area.id;
      s.position.set(mesh.bounds.x, mesh.bounds.y);
      s.scale.set(1 / mesh.maskRes);
      s.tint = area.exclude ? COLORS.exclude : current ? COLORS.current : COLORS.other;
      s.alpha = area.exclude ? (current ? 0.3 : 0.18) : current ? 0.22 : 0.1;
      overlay.addChild(s);
      const g = overlay.addChild(Graphics());
      g._areaId = area.id;
      for (const shape of area.shapes) {
        if (shape.type === "stroke") continue;
        drawShape(g, shape, { alpha: 0, line: current ? 3 : 2, lineColor: shape.erase ? COLORS.erase : (current ? COLORS.current : COLORS.other), lineAlpha: current ? 0.9 : 0.5 });
      }
      const label = new PIXI.Text(`${area.exclude ? "⊘ " : area.visible ? "" : "◌ "}${area.name}`, {
        fontFamily: "Signika, sans-serif", fontSize: Math.max(14, size * 0.22), fill: current ? COLORS.current : 0xffffff,
        stroke: 0x000000, strokeThickness: 4
      });
      const b = mesh.rawBounds ?? mesh.bounds;
      label.position.set(b.x + 4, b.y + 4);
      label.alpha = current ? 1 : 0.7;
      label._areaId = area.id;
      overlay.addChild(label);
    }
    this.#updateHud();
  }

  refreshCursor() {
    this.#drawCursor();
  }

  #drawCursor(pos) {
    const g = this.#cursor;
    if (!g || g.destroyed) return;
    g.clear();
    if (!this.active || ![TOOLS.brush, TOOLS.erase, TOOLS.wall].includes(this.tool)) return;
    if (pos) this.#mouse = { x: pos.x, y: pos.y };
    const p = this.#mouse ?? canvas.mousePosition;
    if (!p) return;
    const r = (brush().width * canvas.dimensions.size) / 2;
    const color = this.tool === TOOLS.erase ? COLORS.erase : COLORS.current;
    g.lineStyle({ width: 2, color, alpha: 0.9 }).drawCircle(p.x, p.y, r);
    g.lineStyle({ width: 1, color: 0x000000, alpha: 0.5 }).drawCircle(p.x, p.y, r + 2);
  }

  /* -------------------------------------------- */
  /*  Floating button on the current area         */
  /* -------------------------------------------- */

  #updateHud() {
    const area = this.currentId ? shownAreas().find(a => a.id === this.currentId) : null;
    const mesh = area ? meshFor(area.id) : null;
    const root = canvas.hud?.element;
    if (!this.active || !area || !mesh?.rawBounds || !root) return this.#removeHud();
    if (!this.#hud || !this.#hud.isConnected) {
      this.#hud = document.createElement("div");
      this.#hud.id = "dxcfx-area-hud";
      this.#hud.addEventListener("pointerdown", ev => ev.stopPropagation());
      this.#hud.addEventListener("click", ev => {
        const btn = ev.target.closest("button[data-act]");
        if (!btn) return;
        ev.preventDefault();
        ev.stopPropagation();
        if (btn.dataset.act === "config") this.openConfig(this.currentId);
        else if (btn.dataset.act === "visible") this.toggleVisible(this.currentId);
        else if (btn.dataset.act === "done") this.setCurrent(null);
      });
      root.appendChild(this.#hud);
    }
    const t = k => escapeHTML(game.i18n.localize(k));
    this.#hud.innerHTML = `
      <button type="button" data-act="config" class="dxcfx-hud-main"><i class="fa-solid fa-wand-magic-sparkles"></i> ${t("DXCFX.Hud.Configure")}</button>
      <button type="button" data-act="visible" data-tooltip="${t(area.visible ? "DXCFX.Hud.Hide" : "DXCFX.Hud.Show")}"><i class="fa-solid ${area.visible ? "fa-eye" : "fa-eye-slash"}"></i></button>
      <button type="button" data-act="done" data-tooltip="${t("DXCFX.Hud.Done")}"><i class="fa-solid fa-check"></i></button>`;
    const b = mesh.rawBounds;
    Object.assign(this.#hud.style, { left: `${b.x + b.width}px`, top: `${b.y}px` });
    this.alignHud();
  }

  /** Keep the button the same size on screen whatever the zoom. */
  alignHud() {
    if (!this.#hud) return;
    const zoom = canvas.stage.scale.x || 1;
    this.#hud.style.transformOrigin = "0 0";
    this.#hud.style.transform = `scale(${1 / zoom}) translate(-100%, -100%)`;
  }

  #removeHud() {
    this.#hud?.remove();
    this.#hud = null;
  }

  /* -------------------------------------------- */
  /*  Area operations                             */
  /* -------------------------------------------- */

  openConfig(id = this.currentId) {
    if (!id) {
      const areas = sceneAreas();
      if (areas.length === 1) id = areas[0].id;
      else return ui.notifications.info(game.i18n.localize("DXCFX.Notify.PickFirst"));
    }
    this.setCurrent(id);
    CanvasEffectsLayer.hooks.openConfig?.(id);
  }

  async toggleVisible(id) {
    const area = editableArea(id);
    if (!area) return;
    area.visible = !area.visible;
    await this.#save(area);
  }

  #remember(id) {
    this.#undo.push({ id, before: editableArea(id) });
    if (this.#undo.length > 50) this.#undo.shift();
  }

  async #save(area) {
    showLocal(area.id, area);
    await saveArea(area);
    CanvasEffectsLayer.hooks.changed?.();
  }

  /** Add a finished shape: to the current area, or to a new one. Erasers cut the area(s) under them. */
  async #commit(shape) {
    shape = normalizeShape(shape);
    if (!shape || !canEdit()) return;

    if (shape.erase) {
      const box = shapeBounds(shape);
      const targets = this.currentId
        ? [editableArea(this.currentId)].filter(Boolean)
        : editableAreas().filter(a => boxesTouch(meshFor(a.id)?.rawBounds, box));
      if (!targets.length) return ui.notifications.info(game.i18n.localize("DXCFX.Notify.NothingToErase"));
      for (const area of targets) {
        this.#remember(area.id);
        await this.#save({ ...area, shapes: [...area.shapes, shape] });
      }
      return;
    }

    let area = this.currentId ? editableArea(this.currentId) : null;
    const created = !area;
    if (created) {
      area = newArea([shape], undefined, { exclude: !!this.nextExclude });
      this.nextExclude = false;
    }
    else area = { ...area, shapes: [...area.shapes, shape] };
    this.#remember(area.id);
    this.currentId = area.id;
    await this.#save(area);
    if (created) ui.notifications.info(game.i18n.format("DXCFX.Notify.Created", { name: area.name }));
  }

  async undo() {
    const step = this.#undo.pop();
    if (!step) return false;
    if (step.before) await this.#save(step.before);
    else {
      showLocal(step.id, null);
      await deleteArea(step.id);
      if (this.currentId === step.id) this.currentId = null;
      CanvasEffectsLayer.hooks.changed?.();
    }
    return true;
  }

  async removeArea(id = this.currentId) {
    const area = getArea(id);
    if (!area) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "DXCFX.Area.DeleteTitle" },
      content: `<p>${game.i18n.format("DXCFX.Area.DeleteConfirm", { name: escapeHTML(area.name) })}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    this.#remember(id);
    showLocal(id, null);
    await deleteArea(id);
    if (this.currentId === id) this.currentId = null;
    CanvasEffectsLayer.hooks.changed?.();
  }

  async clearAll() {
    if (!sceneAreas().length || !canEdit()) return;
    const ok = await foundry.applications.api.DialogV2.confirm({
      window: { title: "DXCFX.Area.ClearTitle" },
      content: `<p>${game.i18n.localize("DXCFX.Area.ClearConfirm")}</p>`,
      rejectClose: false
    });
    if (!ok) return;
    for (const a of sceneAreas()) this.#undo.push({ id: a.id, before: a });
    for (const a of sceneAreas()) showLocal(a.id, null);
    await deleteAllAreas();
    this.currentId = null;
    CanvasEffectsLayer.hooks.changed?.();
  }

  /** The topmost area painted at a point. */
  areaAt(x, y) {
    const areas = shownAreas();
    for (let i = areas.length - 1; i >= 0; i--) {
      if (areaContains(areas[i].shapes, x, y)) return areas[i];
    }
    return null;
  }

  /* -------------------------------------------- */
  /*  Mouse                                       */
  /* -------------------------------------------- */

  getSnappedPoint(point) {
    if (!brush().snap) return { x: point.x, y: point.y };
    const M = CONST.GRID_SNAPPING_MODES;
    const size = canvas.dimensions.size;
    return canvas.grid.getSnappedPoint({ x: point.x, y: point.y }, {
      mode: M.CENTER | M.VERTEX | M.SIDE_MIDPOINT,
      resolution: size >= 128 ? 4 : 2
    });
  }

  #snap(event, point) {
    return event.shiftKey ? { x: point.x, y: point.y } : this.getSnappedPoint(point);
  }

  #width() {
    return brush().width * canvas.dimensions.size;
  }

  _canDragLeftStart(user, event) {
    return (DRAW_TOOLS.includes(this.tool) || this.tool === TOOLS.move) && canEdit();
  }

  /* -------------------------------------------- */
  /*  Moving areas                                */
  /* -------------------------------------------- */

  /** Show an area (its effect, outline and label) shifted by dx, dy while it is dragged. */
  #offsetArea(id, dx, dy) {
    const mesh = meshFor(id);
    if (mesh) {
      mesh.dragging = dx !== 0 || dy !== 0;
      mesh.position.set(dx, dy);
    }
    for (const c of this.#overlay?.children ?? []) {
      if (c._areaId !== id) continue;
      c._base ??= { x: c.x, y: c.y };
      c.position.set(c._base.x + dx, c._base.y + dy);
    }
  }

  /** How far the area is dragged: whole half-squares while snapping, so grid-aligned shapes stay aligned. */
  #moveDelta(event, interaction) {
    const { origin: o, destination: d } = interaction;
    let dx = d.x - o.x, dy = d.y - o.y;
    if (brush().snap && !event.shiftKey && !canvas.grid.isGridless) {
      const step = canvas.dimensions.size / 2;
      dx = Math.round(dx / step) * step;
      dy = Math.round(dy / step) * step;
    }
    return { dx, dy };
  }

  #startMove(event) {
    const interaction = event.interactionData;
    const o = interaction.origin;
    const area = this.areaAt(o.x, o.y);
    if (!area) return false;
    const saved = editableArea(area.id) ?? area;
    interaction.drawingTool = TOOLS.move;
    interaction.moving = { id: area.id, area: saved, copy: !!event.altKey };
    interaction.destination = { x: o.x, y: o.y };
    if (this.currentId !== area.id) this.setCurrent(area.id);
    this.#removeHud();
    return true;
  }

  #dragMove(event) {
    const interaction = event.interactionData;
    const { dx, dy } = this.#moveDelta(event, interaction);
    this.#offsetArea(interaction.moving.id, dx, dy);
    if (interaction.moving.copy) {
      // Alt: a copy follows the mouse; the original stays.
      this.#offsetArea(interaction.moving.id, 0, 0);
      const g = this.#preview;
      g.clear();
      for (const s of translateShapes(interaction.moving.area.shapes, dx, dy)) {
        drawShape(g, s, { color: COLORS.current, alpha: s.erase ? 0 : 0.25, line: 2, lineColor: s.erase ? COLORS.erase : COLORS.current, lineAlpha: 0.9 });
      }
    }
  }

  async #dropMove(event) {
    const interaction = event.interactionData;
    const { id, area, copy } = interaction.moving;
    const { dx, dy } = this.#moveDelta(event, interaction);
    interaction.drawingTool = null;
    this.#preview.clear();
    if (!dx && !dy) {
      this.#offsetArea(id, 0, 0);
      this.refreshOverlay();
      return;
    }
    const shapes = translateShapes(area.shapes, dx, dy);
    if (copy) {
      this.#offsetArea(id, 0, 0);
      const twin = newArea(shapes);
      Object.assign(twin, {
        name: game.i18n.format("DXCFX.Area.CopyName", { name: area.name }),
        effect: foundry.utils.deepClone(area.effect), feather: area.feather, visible: area.visible
      });
      this.#remember(twin.id);
      this.currentId = twin.id;
      await this.#save(twin);
      return;
    }
    // The mesh stays shifted until it is rebuilt at the new place (see manager.sync).
    this.#remember(id);
    await this.#save({ ...area, shapes });
  }

  #cancelMove(event) {
    const interaction = event.interactionData;
    if (interaction.moving) this.#offsetArea(interaction.moving.id, 0, 0);
    this.#preview.clear();
    interaction.drawingTool = null;
    this.refreshOverlay();
  }

  _onClickLeft(event) {
    const interaction = event.interactionData;

    // Placing corners of a wall or polygon.
    if (POINT_TOOLS.includes(interaction.drawingTool)) {
      const { points } = interaction;
      const p = this.#snap(event, interaction.destination ?? interaction.origin);
      if (interaction.drawingTool === TOOLS.polygon && points.length >= 6
        && p.x.almostEqual(points[0]) && p.y.almostEqual(points[1])) {
        interaction.complete = true;
      } else if (!(p.x.almostEqual(points.at(-2)) && p.y.almostEqual(points.at(-1)))) {
        points.push(p.x, p.y);
        this.#drawPreview(event);
      }
      return;
    }

    const pos = interaction.origin;
    if (this.tool === TOOLS.pick || this.tool === TOOLS.move) {
      this.setCurrent(this.areaAt(pos.x, pos.y)?.id ?? null);
      return;
    }
    // A click (no drag) with the brush or eraser paints a dot. Clicks arrive on mouse-down,
    // before we know whether a drag follows, so the dot waits for the button to come up.
    if ((this.tool === TOOLS.brush || this.tool === TOOLS.erase) && canEdit()) {
      const dot = { type: "stroke", points: [pos.x, pos.y], width: this.#width(), erase: this.tool === TOOLS.erase };
      this.#pendingDot = dot;
      window.addEventListener("pointerup", () => {
        if (this.#pendingDot !== dot) return;
        this.#pendingDot = null;
        this.#commit(dot);
      }, { once: true });
    }
  }

  #pendingDot = null;
  #mouse = null;

  _onClickLeft2(event) {
    const interaction = event.interactionData;
    if (POINT_TOOLS.includes(interaction.drawingTool)) {
      interaction.complete = true;
      return;
    }
    if (this.tool === TOOLS.pick || this.tool === TOOLS.move) {
      const pos = interaction.origin;
      const area = this.areaAt(pos.x, pos.y);
      if (area) this.openConfig(area.id);
    }
  }

  _onDragLeftStart(event) {
    const interaction = event.interactionData;
    const tool = this.tool;
    this.#pendingDot = null;
    if (tool === TOOLS.move) {
      if (!this.#startMove(event)) interaction.drawingTool = null;
      return;
    }
    interaction.drawingTool = tool;
    interaction.erase = tool === TOOLS.erase || !!event.altKey;
    interaction.width = this.#width();
    if (tool === TOOLS.brush || tool === TOOLS.erase) {
      interaction.points = [interaction.origin.x, interaction.origin.y];
    } else {
      interaction.origin = this.#snap(event, interaction.origin);
      if (POINT_TOOLS.includes(tool)) interaction.points = [interaction.origin.x, interaction.origin.y];
    }
    interaction.destination = { x: interaction.origin.x, y: interaction.origin.y };
    this.#drawPreview(event);
  }

  _onDragLeftMove(event) {
    const interaction = event.interactionData;
    const tool = interaction.drawingTool;
    if (!tool) return;
    if (tool === TOOLS.move) return this.#dragMove(event);
    if (tool === TOOLS.brush || tool === TOOLS.erase) {
      const d = interaction.destination;
      const pts = interaction.points;
      const step = Math.max(2, interaction.width * 0.08);
      if (Math.hypot(d.x - pts.at(-2), d.y - pts.at(-1)) >= step) pts.push(d.x, d.y);
    } else {
      interaction.destination = this.#snap(event, interaction.destination);
    }
    this.#drawPreview(event);
    this.#drawCursor(interaction.destination);
  }

  _onDragLeftDrop(event) {
    const interaction = event.interactionData;
    const tool = interaction.drawingTool;
    if (!tool) return;
    if (tool === TOOLS.move) return this.#dropMove(event);
    // The mouse-up gives the raw position: snap it again like the preview.
    if (tool !== TOOLS.brush && tool !== TOOLS.erase) interaction.destination = this.#snap(event, interaction.destination);

    // Walls and polygons go on until they are finished with a double-click.
    if (POINT_TOOLS.includes(tool) && interaction.complete !== true) {
      // Releasing the first drag places a corner; a right-button release (removing a corner) does not.
      const p = interaction.destination;
      const pts = interaction.points;
      if (event.button === 0 && !(p.x.almostEqual(pts.at(-2)) && p.y.almostEqual(pts.at(-1)))) pts.push(p.x, p.y);
      this.#drawPreview(event);
      event.preventDefault();
      return;
    }

    const shape = this.#shapeFrom(interaction);
    this.#preview.clear();
    interaction.drawingTool = null;
    if (shape) this.#commit(shape);
  }

  _onDragLeftCancel(event) {
    const interaction = event.interactionData;
    const tool = interaction.drawingTool;
    if (!tool) return;
    if (tool === TOOLS.move) return this.#cancelMove(event);
    if (POINT_TOOLS.includes(tool) && interaction.complete !== true && !interaction.cancelled) {
      interaction.points.splice(-2, 2);
      if (interaction.points.length) {
        event.preventDefault();
        this.#drawPreview(event);
        return;
      }
    }
    this.#preview.clear();
    interaction.drawingTool = null;
  }

  _onClickRight(event) {
    const interaction = event.interactionData;
    if (interaction.drawingTool) return canvas.mouseInteractionManager._dragRight = false;
  }

  #shapeFrom(interaction) {
    const { drawingTool: tool, origin: o, destination: d, erase, width } = interaction;
    const box = { x: Math.min(o.x, d.x), y: Math.min(o.y, d.y), width: Math.abs(d.x - o.x), height: Math.abs(d.y - o.y) };
    switch (tool) {
      case TOOLS.brush:
      case TOOLS.erase:
        return { type: "stroke", points: thinPoints(interaction.points, width * 0.08), width, erase };
      case TOOLS.wall: {
        const pts = interaction.points;
        return pts.length >= 2 ? { type: "stroke", points: pts.slice(), width, erase } : null;
      }
      case TOOLS.rect: return box.width > 2 && box.height > 2 ? { type: "rect", ...box, erase } : null;
      case TOOLS.ellipse: return box.width > 2 && box.height > 2 ? { type: "ellipse", ...box, erase } : null;
      case TOOLS.polygon: {
        const pts = interaction.points.slice();
        if (pts.length >= 4 && pts.at(-2).almostEqual(pts[0]) && pts.at(-1).almostEqual(pts[1])) pts.splice(-2, 2);
        return pts.length >= 6 ? { type: "polygon", points: pts, erase } : null;
      }
    }
    return null;
  }

  #drawPreview(event) {
    const g = this.#preview;
    const interaction = event.interactionData;
    g.clear();
    const tool = interaction.drawingTool;
    if (!tool) return;
    const color = interaction.erase ? COLORS.erase : COLORS.current;
    const style = { color, alpha: 0.3, line: 2, lineColor: color, lineAlpha: 0.9 };
    if (POINT_TOOLS.includes(tool)) {
      const pts = [...interaction.points];
      const d = interaction.destination;
      if (d) pts.push(d.x, d.y);
      if (tool === TOOLS.wall) {
        drawShape(g, { type: "stroke", points: pts, width: interaction.width }, style);
      } else {
        g.lineStyle({ width: 2, color, alpha: 0.9 });
        if (pts.length >= 6) g.beginFill(color, 0.2).drawPolygon(pts).endFill();
        else g.moveTo(pts[0], pts[1]).lineTo(pts[2] ?? pts[0], pts[3] ?? pts[1]);
      }
      g.lineStyle(0).beginFill(color, 1);
      for (let i = 0; i < interaction.points.length; i += 2) g.drawCircle(interaction.points[i], interaction.points[i + 1], 4);
      g.endFill();
      return;
    }
    const shape = this.#shapeFrom(interaction);
    if (shape) drawShape(g, shape, style);
  }

  /* -------------------------------------------- */
  /*  Keys                                        */
  /* -------------------------------------------- */

  _onUndoKey(event) {
    if (!this.#undo.length) return false;
    this.undo();
    return true;
  }

  _onDeleteKey(event) {
    if (!this.currentId) return false;
    this.removeArea(this.currentId);
    return true;
  }

  _onDismissKey(event) {
    if (!this.currentId) return false;
    this.setCurrent(null);
    return true;
  }
}

/** Keep the floating button sized to the zoom. */
Hooks.on("canvasPan", () => canvas[LAYER]?.alignHud?.());
