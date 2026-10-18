/**
 * Dxcufgb's canvas effects - keeps the areas of the viewed scene on the canvas.
 *
 * Each area is an AreaMesh in the primary canvas group, sorted above the map, tiles and drawings
 * but below the tokens. The effect window can show an unsaved effect on the map while you edit it
 * (an "override"), which is dropped again when the window closes.
 */

import { MODULE_ID, LAYER } from "./constants.js";
import { AreaMesh } from "./area-mesh.js";
import { customSources } from "./effects.js";
import { sceneAreas, getArea } from "./store.js";
import { syncLights, tickLights, clearLights } from "./lights.js";
import { syncSounds, tickSounds, stopSounds, playOnce } from "./sounds.js";

const state = {
  meshes: new Map(),        // area id -> AreaMesh
  overrides: new Map(),     // area id -> partial area shown instead of the saved one
  local: new Map(),         // area id -> area saved by us, shown before the server confirms it
  ticking: false,
  syncing: Promise.resolve(),
  images: new Map()         // src -> Promise<texture|null>
};

export function quality() {
  return { high: 1, medium: 0.6, low: 0.3 }[game.settings.get(MODULE_ID, "quality")] ?? 1;
}

export function enabled() {
  return game.settings.get(MODULE_ID, "enabled");
}

/** Load (once) the images of your own an effect needs: {custom: {src: texture}}. */
export async function effectImages(cfg) {
  const custom = {};
  await Promise.all(customSources(cfg).map(async src => {
    if (!state.images.has(src)) {
      state.images.set(src, foundry.canvas.loadTexture(src).catch(err => {
        console.warn(`${MODULE_ID} | image ${src} could not be loaded`, err);
        state.images.delete(src);
        return null;
      }));
    }
    const tex = await state.images.get(src);
    if (tex) custom[src] = tex;
  }));
  return { custom };
}

/** The scene's background image and where it lies, for effects that redraw the map (or null). */
export function sceneBackdrop() {
  const tex = canvas?.primary?.background?.texture;
  if (!tex?.valid || tex === PIXI.Texture.EMPTY) return null;
  const r = canvas.dimensions.sceneRect;
  return { texture: tex, rect: { x: r.x, y: r.y, width: r.width, height: r.height } };
}

export function meshFor(id) {
  const m = state.meshes.get(id);
  return m && !m.destroyed ? m : null;
}

export function meshes() {
  return [...state.meshes.values()].filter(m => !m.destroyed);
}

/** The areas as shown right now: saved, or just saved by us, with any override on top. */
export function shownAreas() {
  dropStale();
  const saved = sceneAreas();
  const byId = new Map(saved.map(a => [a.id, a]));
  for (const [id, { area: a }] of state.local) {
    if (a === null) byId.delete(id);
    else byId.set(id, a);
  }
  return [...byId.values()]
    .map(a => (state.overrides.has(a.id) ? { ...a, ...state.overrides.get(a.id) } : a))
    .sort((a, b) => a.sort - b.sort);
}

/** The areas without any override from the effect window: what is (about to be) saved. */
export function editableAreas() {
  dropStale();
  const byId = new Map(sceneAreas().map(a => [a.id, a]));
  for (const [id, { area }] of state.local) {
    if (area === null) byId.delete(id);
    else byId.set(id, area);
  }
  return [...byId.values()].sort((a, b) => a.sort - b.sort);
}

export function editableArea(id) {
  return editableAreas().find(a => a.id === id) ?? null;
}

/** A local copy the server never confirmed (failed or no-op update) stops hiding the saved one. */
function dropStale() {
  const now = Date.now();
  for (const [id, { t }] of state.local) if (now - t > 10000) state.local.delete(id);
}

/** Show an area right away, before the scene update comes back (null: removed). */
export function showLocal(id, area) {
  state.local.set(id, { area, t: Date.now() });
  return sync();
}

/** Show an unsaved version of an area (effect, soft edge, ...) while it is being edited; null to stop. */
export function setOverride(id, partial) {
  if (partial) state.overrides.set(id, partial);
  else state.overrides.delete(id);
  return sync();
}

/** Bring the canvas up to date with the scene. Calls are queued, so they never overlap. */
export function sync() {
  state.syncing = state.syncing.then(syncNow).catch(err => console.error(`${MODULE_ID} | sync failed`, err));
  return state.syncing;
}

async function syncNow() {
  if (!canvas?.ready || !canvas.primary) return;
  const all = shownAreas();
  // Exclusion zones only matter for the areas below them; players don't need to see them at all.
  const exclusionZones = all.filter(a => a.exclude && a.shapes.length);
  // Players only need an exclusion zone when it has an effect of its own.
  const areas = all.filter(a => (game.user.isGM || a.visible) && (game.user.isGM || !a.exclude || a.effect.layers.length));
  const keep = new Set(areas.map(a => a.id));

  for (const [id, mesh] of state.meshes) {
    if (!keep.has(id) || mesh.destroyed) {
      if (!mesh.destroyed) mesh.destroy();
      state.meshes.delete(id);
    }
  }
  // The overlay may still show the textures of destroyed meshes: redraw it before waiting on images.
  canvas[LAYER]?.refreshOverlay?.();

  const grid = canvas.dimensions.size;
  const q = quality();
  for (const area of areas) {
    if (!area.shapes.length) {
      meshFor(area.id)?.destroy();
      state.meshes.delete(area.id);
      continue;
    }
    // An exclusion zone shows its own effect inside itself; it is only cut by exclusion zones above it.
    const shown = area;
    const cuts = area.ignoreExclusions ? [] : exclusionZones.filter(e => e.sort > area.sort && e.id !== area.id);
    const textures = await effectImages(shown.effect);
    if (!canvas?.ready) return;
    let mesh = meshFor(area.id);
    if (mesh) {
      const before = mesh.maskKey;
      mesh.setArea(shown, textures, cuts);
      // A moved area was shown shifted while dragged; now it is drawn at its new place.
      if (mesh.maskKey !== before || !mesh.dragging) { mesh.position.set(0, 0); mesh.dragging = false; }
    }
    else {
      mesh = new AreaMesh(shown, { renderer: canvas.app.renderer, grid, quality: q, textures, maxMask: q < 1 ? 1024 : 2048, playSound: effectSound, backdrop: sceneBackdrop(), exclusions: cuts });
      state.meshes.set(area.id, mesh);
      canvas.primary.addChild(mesh);
    }
    mesh.showEffects = enabled();
    mesh.alpha = area.visible ? 1 : 0.5;          // hidden from players: the GM sees it faded
  }
  canvas.primary.sortDirty = true;
  canvas[LAYER]?.refreshOverlay?.();
  // Light from the effects: only from areas the players can see, and only with effects on.
  const lit = enabled() ? areas.filter(a => a.visible).map(area => ({ area, mesh: meshFor(area.id) })).filter(x => x.mesh?.bounds) : [];
  syncLights(lit);
  // Sounds: from what is shown (the GM also hears hidden areas, softer, as they see them faded).
  syncSounds(enabled() ? areas.filter(a => a.shapes.length).map(area => ({ area, faded: !area.visible })) : []);
  attachGlows();
  startTicker();
}

/**
 * Put the glowing layers into Foundry's illumination. Foundry empties that container on every
 * lighting refresh, so this runs again from the "lightingRefresh" hook (see main.js).
 */
export function attachGlows() {
  const lights = canvas?.effects?.illumination?.lights;
  if (!lights) return;
  for (const mesh of state.meshes.values()) {
    if (mesh.destroyed) continue;
    const p = mesh.glowProxy;
    const want = enabled() && mesh.emissive && (game.user.isGM || mesh.area?.visible);
    if (want && p.parent !== lights) lights.addChild(p);
    else if (!want && p.parent) p.parent.removeChild(p);
  }
}

/** Throw everything away (canvas torn down, or a setting changed that needs a rebuild). */
export function clearAll() {
  for (const mesh of state.meshes.values()) if (!mesh.destroyed) mesh.destroy();
  state.meshes.clear();
  stopSounds();
  if (canvas?.ready) syncLights([]);
}

export function rebuildAll() {
  clearAll();
  canvas[LAYER]?.refreshOverlay?.();
  return sync();
}

/** The scene changed on the server: what we showed locally is now saved (or replaced). */
export function onSceneUpdate() {
  const now = Date.now();
  for (const [id, { area, t }] of state.local) {
    const saved = getArea(id);
    const done = area === null ? !saved : (saved && JSON.stringify(saved) === JSON.stringify(area));
    if (done || now - t > 5000) state.local.delete(id);
  }
  return sync();
}

export function onTearDown() {
  for (const mesh of state.meshes.values()) if (!mesh.destroyed) mesh.destroy();
  state.meshes.clear();
  clearLights();
  stopSounds();
  state.local.clear();
  state.overrides.clear();
}

/* -------------------------------------------- */
/*  Animation                                   */
/* -------------------------------------------- */

function startTicker() {
  if (state.ticking || !canvas?.app?.ticker) return;
  state.ticking = true;
  canvas.app.ticker.add(tick);
}

function tick() {
  if (!canvas?.ready) return;
  const dt = Math.min(0.1, (canvas.app.ticker.deltaMS ?? 16.7) / 1000);
  for (const mesh of state.meshes.values()) {
    if (mesh.destroyed || !mesh.visible) continue;
    mesh.update(dt);
  }
  tickLights();
  tickSounds();
}

/** Thunder from effects: played on this computer only, on the Ambient channel, heard from where the area is. */
function effectSound(src, delay = 0, volume = 1, layer = null, area = null) {
  if (src && enabled()) playOnce(src, delay, volume, area ? { shapes: area.shapes, range: layer?.soundRange } : null);
}
