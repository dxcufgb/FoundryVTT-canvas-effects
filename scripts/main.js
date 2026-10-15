/**
 * Dxcufgb's canvas effects (dxcufgbs-canvas-effects) - Foundry VTT V13
 *
 * Paint areas ("effect walls") on the map and fill them with animated effects. The areas are
 * always see-through: they never block sight, light or movement, they only hold the effect.
 * Effects are drawn above the map, tiles and drawings and below the tokens.
 *
 * The areas are stored on the Scene (see store.js), painted with the "Canvas effects" tools in the
 * Scene Controls (layer.js), and given an effect in the Canvas Effect window (config-app.js),
 * where effects are built in layers, saved by name, exported and imported.
 *
 * API: game.modules.get("dxcufgbs-canvas-effects").api
 *   .areas(scene?)               the areas of a scene
 *   .open(areaId)                open the Canvas Effect window for an area
 *   .saveArea(area) / .deleteArea(id)
 *   .effects                     the available effects and their styles
 *   .presets()                   this user's saved effects
 *   .exportEffect(cfg, name)     save an effect (with its own images) as one .canvas-effect.json file
 *   .importEffect(file)          read such a file, add its images to this world -> {name, cfg, uploaded, skipped}
 */

import { MODULE_ID, LAYER } from "./constants.js";
import { CanvasEffectsLayer } from "./layer.js";
import { EffectPainter } from "./palette.js";
import { CanvasEffectConfig } from "./config-app.js";
import { EFFECTS } from "./effects.js";
import { sceneAreas, saveArea, deleteArea, presets } from "./store.js";
import { sync, rebuildAll, onSceneUpdate, onTearDown, attachGlows } from "./manager.js";
import { exportEffect, importEffect } from "./transfer.js";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enabled", {
    name: "DXCFX.Settings.Enabled.Name", hint: "DXCFX.Settings.Enabled.Hint",
    scope: "client", config: true, type: Boolean, default: true,
    onChange: () => rebuildAll()
  });
  game.settings.register(MODULE_ID, "quality", {
    name: "DXCFX.Settings.Quality.Name", hint: "DXCFX.Settings.Quality.Hint",
    scope: "client", config: true, type: String, default: "high",
    choices: { high: "DXCFX.Settings.Quality.High", medium: "DXCFX.Settings.Quality.Medium", low: "DXCFX.Settings.Quality.Low" },
    onChange: () => rebuildAll()
  });
  game.settings.register(MODULE_ID, "brush", { scope: "client", config: false, type: Object, default: { width: 1, snap: true, feather: 0.25 } });
  game.settings.register(MODULE_ID, "lastEffect", { scope: "client", config: false, type: Object, default: {} });

  // The painting layer sits with the other interface layers; its Scene Controls come from it.
  CONFIG.Canvas.layers[LAYER] = { layerClass: CanvasEffectsLayer, group: "interface" };

  CanvasEffectsLayer.hooks = {
    openConfig: id => CanvasEffectConfig.open(id),
    openPalette: () => EffectPainter.open(),
    closePalette: () => EffectPainter.close(),
    changed: () => EffectPainter.refresh()
  };

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    mod.api = {
      areas: scene => sceneAreas(scene),
      open: id => CanvasEffectConfig.open(id),
      saveArea, deleteArea, presets, exportEffect, importEffect,
      effects: EFFECTS
    };
  }
});

Hooks.on("canvasReady", () => sync());
Hooks.on("canvasTearDown", () => {
  onTearDown();
  CanvasEffectConfig.instance?.close();
});

Hooks.on("updateScene", (scene, changes) => {
  if (scene !== canvas?.scene) return;
  if (!foundry.utils.hasProperty(changes, `flags.${MODULE_ID}`)) return;
  onSceneUpdate().then(() => {
    EffectPainter.refresh();
    CanvasEffectConfig.instance?.onAreasChanged();
  });
});

// Foundry rebuilds its illumination on every lighting refresh: put the glowing layers back.
Hooks.on("lightingRefresh", () => attachGlows());

// The palette shows a hint for the chosen tool.
Hooks.on("renderSceneControls", () => {
  if (canvas?.[LAYER]?.active) EffectPainter.refresh();
});
