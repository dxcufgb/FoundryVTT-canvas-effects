# Dxcufgb's canvas effects

FoundryVTT v13 module (id `dxcufgbs-canvas-effects`, the install folder must have the same name), system agnostic.
The GM paints see-through effect areas on a scene (brush, wall line, rectangle, ellipse, polygon, eraser, exclusion
zones) and fills each with an animated top-down effect built of up to 8 layers (`MAX_LAYERS`). Areas are stored on the
Scene; every client draws them with PIXI (v7, global `PIXI`) in the primary canvas group, above the map and below the
tokens (or above the tokens per layer). Layers can cast Foundry light and play ambient sounds. No build step and no npm
dependencies.

## Layout
- `scripts/main.js` – settings, API, registers the `dxcfxAreas` canvas layer, canvas / scene / `lightingRefresh` hooks.
- `scripts/constants.js` – `MODULE_ID`, `FLAG` (`"areas"`), `LAYER`, `SORT_LAYER` (650), `OVER_SORT_LAYER` (900).
- `scripts/store.js` – areas in `scene.flags[MODULE_ID].areas[id]`, `normalizeArea`, `canEdit` (GM who may update the scene), `saveArea` / `saveAreas` / `deleteArea`, saved effects (User flag `presets`).
- `scripts/geometry.js` – shape types (`stroke`, `rect`, `ellipse`, `polygon`, `erase`), `normalizeShape(s)`, bounds, hit tests, mask graphics.
- `scripts/manager.js` – keeps one `AreaMesh` per shown area on the canvas (`sync`, queued), editor overrides and local copies, glow proxies in Foundry's illumination (`attachGlows`), the single ticker, teardown.
- `scripts/area-mesh.js` – `AreaMesh`: render-texture mask of the shapes (soft edge, exclusion cuts), the effect layers, and the `under` / `over` containers; rebuilds only what changed (`maskKey`, `structuralKey`).
- `scripts/effects.js` – `EFFECTS` (32 effects, 139 styles), `PARAMS`, `BLENDS`, `CATEGORIES`, `EXAMPLES`, `normalizeLayer` / `normalizeEffect`, `createEffect`. Its header comment is the how-to for a new effect.
- `scripts/effect-base.js` – `AreaEffect` base class (`build`, `animate`, `lights`, `tintable`, `wind`, `STRUCTURAL`), runtime textures, colour helpers, `hash01`.
- `scripts/effects-basic.js`, `effects-ambience.js`, `effects-nature.js`, `effects-animals.js`, `effects-shader.js` – the effect classes (colour, fog, particles, image; fire, glow, candles, rain, lightning; falling things, clouds, sandstorm, stars, ghosts; flyers, crawlers, swimmers; GLSL filters and surfaces).
- `scripts/lights.js` – Foundry light sources made directly (no documents) from layers with "Casts light"; dynamic lightning lights.
- `scripts/sounds.js` – `SOUNDS`, `EFFECT_SOUNDS` (options and standard sound per effect), `normalizeSound`, loops on the Ambient channel heard from the user's tokens (walls muffle), one-shot thunder.
- `scripts/layer.js` – `CanvasEffectsLayer` (the painting tools, GM-only Scene Controls, the floating HUD on the current area).
- `scripts/palette.js` (+ `templates/palette.hbs`) – the Effect Painter window. `scripts/config-app.js` (+ `templates/config.hbs`) – the Canvas effect window with its own `PIXI.Application` preview. `styles/canvas-effects.css`.
- `scripts/transfer.js` – `.canvas-effect.json` export/import (format `dxcufgbs-canvas-effects.effect`, `FORMAT_VERSION` 1) with embedded images, uploaded to `worlds/<world>/dxcufgbs-canvas-effects/imported/`.
- `sounds/ambience/`, `sounds/thunder/` – CC0 / public-domain recordings; `sounds/CREDITS.md` lists the source of every file.
- `.github/workflows/ci.yml` / `release.yml` – thin callers of `dxcufgb/foundry-module-ci` (checks, packaging, release); identical in every module, do not edit here.

## Conventions
- `MODULE_ID` must equal `id` in `module.json`; every visible setting needs a Name and Hint in `lang/en.json` (CI checks both). UI strings are under `DXCFX.*`; effect and style labels are plain English in `EFFECTS`.
- A complete new **effect**: a class extending `AreaEffect` (build in `build()`, move in `animate(dt, time)`, scene pixels, counts scaled by `ctx.squares` and `ctx.quality`); an `EFFECTS` entry with `label`, `icon`, `cls`, `params` (keys of `PARAMS`) and `styles`, plus `emissive`, `lights`, `blend`, `backdrop` / `under` as needed; its id in a `CATEGORIES` group (otherwise the window never shows it); optional sounds in `EFFECT_SOUNDS`; README tables (effects by category, the style count, the sound table). A shader effect adds its GLSL to `GLSL` in `effects-shader.js`.
- A new **built-in sound**: the file under `sounds/`, an entry in `SOUNDS` with a `DXCFX.Sound.*` label, its use in `EFFECT_SOUNDS`, a row in `sounds/CREDITS.md` (CC0 or public domain only) and the README sound table.
- Update `README.md` when effects, settings or the API change.

## Review focus
- **GM-only editing**: every write goes through `store.js`, which checks `canEdit()` (GM and `scene.canUserModify`); the Scene Controls, Effect Painter and Canvas effect window are GM-only. Players only see areas with `visible` on (and exclusion zones only when they have an effect of their own); the GM sees hidden ones faded. Keep both rules in `syncNow` and `attachGlows`.
- **Untrusted / old data**: everything read from the scene flag, presets or imported files goes through `normalizeArea` / `normalizeEffect` / `normalizeShape(s)` / `normalizeSound` first; a bad value must fall back, never throw into the canvas (`#buildEffects` catches per layer). On import, images are accepted only by sniffed bytes (PNG, WebP, JPEG, GIF, AVIF; never SVG) and under `MAX_IMAGE_BYTES`.
- **Per-frame cost**: `tick` updates every visible `AreaMesh` every frame, on big maps with many areas. In `animate`, no new PIXI objects, textures, filters or geometries, no flag reads or `normalize*` calls; build in `build()`, reuse sprites, scale counts by `ctx.squares × ctx.quality`. Sounds tick every 250 ms; dynamic lights only re-initialise when the level changes. `ShaderEffect.animate` makes new `Float32Array`s for `uColor` / `uWind` every frame (small, but do not add more of that).
- **Cleanup**: `AreaMesh.destroy` must destroy its effects, the `under` / `over` containers, the glow proxy and the mask render texture; `sync` destroys meshes of removed areas; `canvasTearDown` runs `onTearDown` (meshes, lights, sounds, overrides) and closes the effect window, whose `close()` destroys the preview app and drops its override. Light sources are removed in `syncLights` when no longer wanted; sound loops fade and stop.
- **Same on every client**: randomness that players must agree on (lightning strikes, placement from `ctx.seed`) uses `hash01` and `ctx.clock()`, not `Math.random()`.
- **Layering**: `SORT_LAYER` 650 (between drawings 600 and tokens 700), `OVER_SORT_LAYER` 900 (below Foundry weather 1000), `under` 450 for effects that redraw the map (`backdrop` / `under`, never `aboveTokens`). Areas never block sight, light or movement.
- **Stored data**: effect ids, style ids, layer fields and sound ids are saved in scenes, presets and exported files; renaming one silently falls back (first style, `DEFAULT_EFFECT`, no sound). `normalizeSound` still reads old layers that kept a file path in `sound`; keep that.
- Escaping: templates use `{{ }}` only; HTML built in code (dialogs, the HUD) goes through `escapeHTML`.
