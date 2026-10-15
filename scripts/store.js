/**
 * Dxcufgb's canvas effects - where things are kept.
 *
 * Painted areas live on the Scene as a flag:
 *   flags["dxcufgbs-canvas-effects"].areas = {
 *     [id]: {id, name, visible, feather, elevation, sort, shapes: [...], effect: {layers: [...]}}
 *   }
 * Saved effects ("presets") are kept per user, in a flag on the User: [{id, name, cfg}].
 */

import { MODULE_ID, FLAG } from "./constants.js";
import { normalizeShapes } from "./geometry.js";
import { normalizeEffect, defaultEffect } from "./effects.js";

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

export function normalizeArea(a) {
  if (!a?.id) return null;
  return {
    id: String(a.id),
    name: String(a.name ?? "").trim().slice(0, 60) || game.i18n.localize("DXCFX.Area.Unnamed"),
    visible: a.visible !== false,
    exclude: a.exclude === true,
    ignoreExclusions: a.ignoreExclusions === true,
    feather: Math.min(4, Math.max(0, num(a.feather, 0.25))),
    elevation: num(a.elevation, 0),
    sort: num(a.sort, 0),
    shapes: normalizeShapes(a.shapes),
    effect: normalizeEffect(a.effect)
  };
}

/** The areas of a scene, in drawing order. */
export function sceneAreas(scene = canvas?.scene) {
  const raw = scene?.flags?.[MODULE_ID]?.[FLAG];
  if (!raw || typeof raw !== "object") return [];
  return Object.values(raw).map(normalizeArea).filter(Boolean)
    .sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
}

export function getArea(id, scene = canvas?.scene) {
  const raw = scene?.flags?.[MODULE_ID]?.[FLAG]?.[id];
  return raw ? normalizeArea(raw) : null;
}

export function canEdit(scene = canvas?.scene) {
  return !!scene && game.user.isGM && scene.canUserModify(game.user, "update");
}

export async function saveArea(area, scene = canvas?.scene) {
  if (!canEdit(scene)) return null;
  const data = normalizeArea(area);
  if (!data) return null;
  await scene.update({ [`flags.${MODULE_ID}.${FLAG}.${data.id}`]: data });
  return data;
}

/** Save several areas in one scene update (e.g. after reordering). */
export async function saveAreas(list, scene = canvas?.scene) {
  if (!canEdit(scene)) return;
  const update = {};
  for (const a of list) {
    const data = normalizeArea(a);
    if (data) update[`flags.${MODULE_ID}.${FLAG}.${data.id}`] = data;
  }
  await scene.update(update);
}

export async function deleteArea(id, scene = canvas?.scene) {
  if (!canEdit(scene)) return;
  await scene.update({ [`flags.${MODULE_ID}.${FLAG}.-=${id}`]: null });
}

export async function deleteAllAreas(scene = canvas?.scene) {
  if (!canEdit(scene)) return;
  await scene.unsetFlag(MODULE_ID, FLAG);
}

/** A new area (not saved yet) with the effect last applied on this computer. */
export function newArea(shapes = [], scene = canvas?.scene, { exclude = false } = {}) {
  const areas = sceneAreas(scene);
  const taken = new Set(areas.map(a => a.name));
  let n = areas.filter(a => a.exclude === exclude).length + 1;
  const label = game.i18n.localize(exclude ? "DXCFX.Area.ExclusionName" : "DXCFX.Area.DefaultName");
  while (taken.has(`${label} ${n}`)) n++;
  let effect = game.settings.get(MODULE_ID, "lastEffect");
  effect = effect?.layers?.length ? normalizeEffect(effect) : defaultEffect();
  return normalizeArea({
    id: foundry.utils.randomID(),
    name: `${label} ${n}`,
    visible: true,
    exclude,
    feather: game.settings.get(MODULE_ID, "brush")?.feather ?? 0.25,
    sort: Math.max(0, ...areas.map(a => a.sort)) + 1,
    shapes,
    effect: exclude ? { layers: [] } : effect
  });
}

/* -------------------------------------------- */
/*  Saved effects (per user)                    */
/* -------------------------------------------- */

export function presets() {
  const list = game.user.getFlag(MODULE_ID, "presets");
  return Array.isArray(list) ? list.filter(p => p?.id && p.cfg) : [];
}

/** Save an effect under a name; one with the same name is replaced. Returns its id. */
export async function savePreset(name, cfg) {
  name = String(name ?? "").trim().slice(0, 60);
  if (!name) return null;
  const list = presets();
  const old = list.find(p => p.name.toLowerCase() === name.toLowerCase());
  const entry = { id: old?.id ?? foundry.utils.randomID(), name, cfg: normalizeEffect(cfg) };
  const next = old ? list.map(p => (p === old ? entry : p)) : [...list, entry];
  next.sort((a, b) => a.name.localeCompare(b.name));
  await game.user.setFlag(MODULE_ID, "presets", next);
  return entry.id;
}

export async function deletePreset(id) {
  await game.user.setFlag(MODULE_ID, "presets", presets().filter(p => p.id !== id));
}
