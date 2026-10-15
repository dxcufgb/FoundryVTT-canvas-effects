/**
 * Dxcufgb's canvas effects - real Foundry light from effects.
 *
 * Fire, candles, firelight and lightning can cast light: Foundry light sources (the same kind an
 * Ambient Light uses) that this module adds itself, without creating any documents. They light the
 * map and the tokens in a dark scene, are blocked by walls (except lightning) and flicker with
 * Foundry's own torch and flame animations. A lightning flash is a "dynamic" light whose
 * brightness follows the flash, frame by frame.
 */

import { MODULE_ID } from "./constants.js";

const sources = new Map();     // sourceId -> {source, json, dynamic, base, level}

function sourceData(l, elevation) {
  return {
    x: l.x, y: l.y, elevation,
    dim: Math.max(1, l.dim), bright: Math.max(0, Math.min(l.bright, l.dim)),
    color: l.color ?? null, alpha: l.alpha ?? 0.5,
    attenuation: 0.5, luminosity: 0.5, coloration: 1,
    animation: l.animation ?? {}, walls: l.walls !== false, vision: false,
    angle: 360, rotation: 0, priority: 0, seed: Math.floor(Math.abs(l.x * 7 + l.y * 13)) % 100000,
    disabled: !!l.dynamic
  };
}

/**
 * Bring the light sources up to date with the areas on the canvas.
 * @param {Array<{area: object, mesh: AreaMesh}>} shown   the areas that are visible to this user
 */
export function syncLights(shown) {
  if (!canvas?.ready || !canvas.effects?.lightSources) return;
  const LightSource = CONFIG.Canvas.lightSourceClass;
  const want = new Set();
  let changed = false;
  for (const { area, mesh } of shown) {
    for (const l of mesh.lights) {
      const id = `${MODULE_ID}.${area.id}.${l.key}`;
      want.add(id);
      const data = sourceData(l, area.elevation ?? 0);
      const json = JSON.stringify(data);
      let entry = sources.get(id);
      if (entry && entry.json === json) {
        entry.dynamic = l.dynamic ?? null;
        continue;
      }
      try {
        if (!entry) {
          entry = { source: new LightSource({ sourceId: id }), level: 0 };
          sources.set(id, entry);
        }
        entry.source.initialize(data, { reset: true });
        entry.source.add();
        entry.json = json;
        entry.base = data.alpha;
        entry.dynamic = l.dynamic ?? null;
        changed = true;
      } catch (err) {
        console.error(`${MODULE_ID} | could not add a light`, err);
        sources.delete(id);
      }
    }
  }
  for (const [id, entry] of sources) {
    if (want.has(id)) continue;
    entry.source.remove();
    entry.source.destroy?.();
    sources.delete(id);
    changed = true;
  }
  if (changed) canvas.perception.update({ refreshLighting: true, refreshVision: true });
}

/** Every frame: follow the flashes of dynamic lights. */
export function tickLights() {
  let changed = false;
  for (const entry of sources.values()) {
    if (!entry.dynamic) continue;
    const level = Math.max(0, Math.min(1, entry.dynamic() || 0));
    if (Math.abs(level - entry.level) < 0.04 && !(level < 0.08 && entry.level >= 0.08)) continue;
    entry.level = level;
    // Brightness follows the flash; below a glimmer the light is switched off.
    entry.source.initialize({ alpha: level, luminosity: 0.15 + 0.55 * level, disabled: level < 0.08 });
    changed = true;
  }
  if (changed) canvas.perception.update({ refreshLighting: true });
}

/** The canvas goes away: Foundry clears its light collection itself. */
export function clearLights() {
  sources.clear();
}
