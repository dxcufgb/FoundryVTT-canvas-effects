# Dxcufgb's canvas effects

[![Foundry v13](https://img.shields.io/github/v/release/dxcufgb/FoundryVTT-canvas-effects?label=Foundry%20v13&logo=foundryvirtualtabletop&color=ff6400)](https://github.com/dxcufgb/FoundryVTT-canvas-effects/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/dxcufgb/FoundryVTT-canvas-effects/module.zip?label=downloads&color=blue)](https://github.com/dxcufgb/FoundryVTT-canvas-effects/releases)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-support-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/dxcufgb)\
[![CI](https://img.shields.io/github/actions/workflow/status/dxcufgb/FoundryVTT-canvas-effects/ci.yml?branch=main&label=CI)](https://github.com/dxcufgb/FoundryVTT-canvas-effects/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/dxcufgb/FoundryVTT-canvas-effects)](LICENSE)

<a href="https://dxcufgb.github.io/FVTT-dev-showcase/"><img src="https://dxcufgb.github.io/FVTT-dev-showcase/assets/img/workshop-badge.png" alt="Dxcufgb's Workshop: every Foundry VTT project, video and changelog in one place" width="650"></a>

Paint areas and walls on the map and fill them with animated effects, all made for a map seen from above:

| Category | Effects |
| --- | --- |
| Weather | Rain, Snow, Fog & Smoke, Clouds, Sandstorm, Lightning |
| Ambient | Leaves & Petals, Embers, Stars, Fireflies, Ghosts, Particles |
| Fire & light | Fire, Light & Glow, Candles, Sunlight |
| Animals | Birds, Bats, Rats, Spiders, Fish |
| Filters | Colour Wash, Colour Grade, Bloom, Underwater, Old Film, Glitch |
| Surfaces | Lava Flow, Living Water, Heat Haze, Vortex, Your image |

Every effect has several styles (139 in all). The painted areas are always see-through. They never block sight, light or movement; they only hold the effect. Effects are drawn above the map, tiles and drawings and below the tokens. Tick **Above the tokens** on a layer to draw that layer over the tokens instead, so rain, snow or clouds fall on everyone's heads.

**Foundry VTT:** v13 · system agnostic

## Installation

In Foundry: **Add-on Modules → Install Module**, paste this link into **Manifest URL** at the bottom, and click **Install**:

```
https://github.com/dxcufgb/FoundryVTT-canvas-effects/releases/latest/download/module.json
```

## Painting

Open **Canvas effects** (the magic wand) in the Scene Controls. The **Effect Painter** opens next to it with the brush width, grid snapping and the list of effect areas on the scene.

| Tool | How |
| --- | --- |
| Pick | Click an area to make it the current one, double-click to open its effect |
| Move | Drag an area to move it with its effect. Hold Alt to drag a copy, Shift to move it freely |
| Paint brush | Drag to paint, click for a dot |
| Effect wall | Click-drag the first stretch, click to add corners, double-click to finish. As thick as the brush |
| Rectangle / Ellipse | Drag |
| Polygon | Click-drag the first side, click to add corners, double-click or click the first corner to close |
| Eraser | Paint away from the current area (or from every area under it when none is current) |

- Everything you paint goes into the **current area**. When there is none, the next stroke starts a new area. **New area** in the Effect Painter, or Esc, lets go of the current one.
- Hold **Alt** while drawing a rectangle, ellipse, polygon or wall to cut it out instead. Hold **Shift** to place points without snapping to the grid. Right-click removes the last corner.
- **Ctrl+Z** undoes, **Delete** removes the current area.
- **Exclusion zones** hide effects: paint rain over the whole map, click **New exclusion** in the Effect Painter and paint the inside of each building. An exclusion zone hides the effects of every area *below* it in the Effect Painter's list (top of the list is drawn on top), so a fireplace painted afterwards still burns inside. Use the arrows in the list to change the order, or tick **Exclusion zone** in an area's effect window to turn any area into one.
- **Effects inside an exclusion zone**: an exclusion zone can have an effect of its own (dust motes, firelight for the whole room), shown inside it. Candles, a fireplace or anything else painted as its own area shows inside the zone when it is above the zone in the list, or always when **Ignore exclusion zones** is ticked in its effect window. The rain from outside stays out either way.
- The current area has a floating **Effect…** button, a button to show or hide it for players, and one to let go of it.

## Effects

The **Canvas effect** window builds an area's effect in layers, drawn bottom to top, like the windows of the lively tokens and dice trails modules:

- pick an effect and a style for each layer, or use an image of your own (tiled or stretched, still or drifting);
- fine-tune size, speed, opacity, density, direction, colour and blending, and add pulse or rainbow;
- set the area's name, its soft edge and whether players can see it.

Every change shows in the preview and on the map right away. Nothing is saved until **Apply**; closing the window or **Undo changes** puts the area back as it was.

- **Casts light**: fire, candles, light & glow, lava flow and lightning add real Foundry light sources, so they light the map and the tokens in a dark scene (walls block them, lightning excepted).
- **Above the tokens**: any layer except the ones that redraw the map (see *Filters and surfaces* below) can be drawn over the tokens instead of under them, for rain, snow, clouds or lightning falling on everyone's heads. The other layers of the same effect stay under the tokens, so a fog layer can stay on the ground below the rain.
- **Sounds**: every layer can make a sound, chosen under **Sound** in the effect window: one of the built-in sounds offered for its effect, a file of your own, or none, with its own volume. Sounds play on Foundry's **Ambient** channel and are heard from your token, like Foundry's own ambient sounds: from the tokens you have selected, or, for a player with none selected, the tokens they own. Inside the area a sound plays at full volume; beyond it, it fades out over the layer's **Heard from** range (in grid squares, 8 by default, 40 for lightning). A wall that blocks sound, or a closed door, between your token and the area muffles it: quieter and dull, not silent. A part cut out of the area (with the eraser or an exclusion zone) counts as outside it, so for rain outside a house, cut the house out: inside, the rain is heard muffled through its walls. Rain painted over the house is heard inside it at full volume. With no token to hear from, the sound follows what you are looking at instead (fading out about a screen away). Louder the stronger the layer (its opacity and density). Several areas with the same sound play it once, louder. The GM also hears hidden areas, softer.
- **Thunder**: lightning plays thunder matched to each flash. Every strike has its own strength: a bright strike with a bolt cracks almost at once, loud; a medium flash rumbles a moment later; a faint flash rolls in from far off, quietly and late. The layer's opacity and the style's flash count too, so the Distant style mostly rumbles far away. A recorded thunderclap or a file of your own gets the same volume and delay. Strikes follow the clock, so every player sees the same one, and hears it from where their token stands: fainter further from the storm, muffled indoors.
- **Examples** in the saved effects list: Fireplace, Firelight, Campfire, Candles, Ritual circle, Heavy rain, Thunderstorm. Paint the firebox for a fire, one brush dot per candle (a stroke is a row of candles), the whole map for rain.

**Saved effects** are kept with your user and can be put on any area. **Export** saves an effect, with any images of your own, as one `.canvas-effect.json` file; **Import** reads it in any world (the images are uploaded into `worlds/<world>/dxcufgbs-canvas-effects/imported/`).

**Filters and surfaces** (Colour Grade, Underwater, Old Film, Glitch, Lava Flow, Living Water, Heat Haze, Vortex, Bloom) redraw the scene's background image inside the painted area, so they need a scene with a background image. They are drawn just above the map and below tiles, so tiles stay on top of them; Bloom is the exception and is drawn with the other effects, above tiles.

**Sunlight** follows the layer's **Wind direction**, the way the light travels (0° east, 90° south, 180° west, −90° north): Sunbeams and Sunset run along it and Dappled Light drifts along it; Light from Above ignores it. A new Sunlight layer starts at 45° (light from the top left).

**Built-in sounds** (all CC0 or public domain; sources in [`sounds/CREDITS.md`](sounds/CREDITS.md)). A new layer gets its effect's standard sound (in bold) unless the *Standard sounds for new effects* setting is off; examples get them too, your saved effects keep their own.

| Effect | Sounds |
| --- | --- |
| Lightning | **Thunder (crack, rumble or distant roll)**, Thunderclap (recorded) |
| Rain | **Steady rain**, Pattering rain, Heavy downpour, Rain and thunder, Downpour with thunder, Rain on a roof, Rain in a forest |
| Snow | **Wind**, Howling wind, Breeze, Creaking ice, Singing ice, Distant wolf howl |
| Sandstorm | **Wind**, Howling wind, Desert night |
| Clouds | Wind, Howling wind, Breeze |
| Fog & Smoke | Dark drone, Low rumble, Cave, Ghostly whispers, Horror drone, Swamp, Eerie wind, Distant wolf howl, Wind |
| Fire | **Crackling fire**, Fireplace |
| Candles | Crackling fire, Fireplace |
| Embers | Crackling fire, Fireplace |
| Light & Glow | Crackling fire, Low rumble, Arcane hum |
| Leaves & Petals | Wind, Breeze, Forest, Birdsong, Creaking trees, Rain in a forest |
| Stars | Crickets at night, Owls, Distant wolf howl, Desert night |
| Fireflies | **Crickets at night**, Owls, Forest |
| Ghosts | **Ghostly whispers**, Horror drone, Dark drone, Low rumble, Eerie swell |
| Birds | **Birdsong**, Morning birds, Chirping birds, Seagulls, Forest |
| Bats | **Bat squeaks**, Cave, Dripping water, Owls, Low rumble |
| Rats | Rat squeaks, Dungeon, Cave, Dripping water, Buzzing flies |
| Spiders | Skittering, Cave, Dungeon, Dripping water |
| Fish | Babbling stream, River, Lapping water, Waves on a shore, Bubbling, Frogs |
| Living Water | Babbling stream, River, **Lapping water**, Waves on a shore, Seagulls, Frogs, Swamp, Bubbling |
| Underwater | **Bubbling**, Dripping water, Low rumble |
| Old Film | Film projector |
| Sunlight | Morning birds, Chirping birds, Breeze |
| Lava Flow | **Boiling, bubbling**, Bubbling, Deep rumble, Crackling fire |
| Vortex | **Arcane hum**, Eerie swell, Eerie wind, Horror drone, Deep rumble, Dark drone, Lapping water |
| Glitch | Static |
| Heat Haze | Wind, Breeze, Eerie wind, Low rumble |

Every other effect can play a file of your own.

**Glowing layers** (fire, light & glow, candles, embers, fireflies, ghosts, stars, bloom, lava, sunlight, lightning) are also drawn into Foundry's lighting, so they stay bright in a dark scene.

## Settings

| Setting | Scope | What it does |
| --- | --- | --- |
| Show canvas effects | this computer | Turn the effects off, for example if the canvas is slow |
| Effect detail | this computer | Particle counts and edge sharpness |
| GM: hear effect sounds from | this computer | GM only: *The selected tokens* (default; with none selected you hear from the camera) or *The camera*, to hear the whole map you are looking at. Players always hear from their tokens |
| Standard sounds for new effects | world (GM) | On (default): a new layer gets the sound that suits its effect. Off: new layers start silent. Existing layers keep their sound either way |

## For developers

Areas are stored on the scene: `flags["dxcufgbs-canvas-effects"].areas`. New effects are added in `scripts/effects.js` (see the comment at the top of the file).

```js
const api = game.modules.get("dxcufgbs-canvas-effects").api;
api.areas();                          // the areas of the viewed scene, bottom first (api.areas(scene) for another scene)
api.open(areaId);                     // GM: open the Canvas effect window for an area
await api.saveArea(area);             // GM: add an area or replace the one with the same id -> the saved area, or null
await api.deleteArea(areaId);         // GM: remove an area
api.effects;                          // effects and their styles, by id
api.presets();                        // this user's saved effects: [{id, name, cfg}]
await api.exportEffect(cfg, name);    // download cfg as one .canvas-effect.json file -> {file, data, missing}
await api.importEffect(file);         // read such a file, upload its images to this world -> {name, cfg, uploaded, skipped}
```

- `saveArea` and `deleteArea` take the scene as an optional last argument (default: the viewed scene). They do nothing for a player, or for a GM who can't update the scene; `open` shows a warning and returns `null` for them. `open` returns the window.
- `saveArea` cleans the area up before saving it (unknown effects and styles fall back, at most 8 layers), so it needs only an `id` and its `shapes`. Layers saved this way have no sound unless you set `sound`.
- `importEffect` takes a `File`, the file's text or the parsed object, and also a bare `{layers: [...]}`. It throws on a file it can't read or one from a newer version of the module. Images are uploaded only when the user may upload files. It doesn't save anything: put `cfg` on an area as its `effect`.
- `exportEffect` lists in `missing` the images it could not embed (they keep their address).
- `api.effects[id]` has `label`, `icon`, `params` (the sliders it uses) and `styles` (`{styleId: {label, …}}`); the other fields are internal.

Paint rain over the whole scene, drawn above the tokens:

```js
const api = game.modules.get("dxcufgbs-canvas-effects").api;
const r = canvas.dimensions.sceneRect;
await api.saveArea({
  id: foundry.utils.randomID(),
  name: "Rain",
  shapes: [{ type: "rect", x: r.x, y: r.y, width: r.width, height: r.height }],
  effect: { layers: [{ effect: "rain", style: "downpour", aboveTokens: true, sound: "rain-steady" }] }
});
```

**From another module**

The API is set during `init`, so it is ready from `setup` on. The module calls no hooks of its own; watch `updateScene` for changes to the flag. Make the integration optional:

```js
Hooks.once("ready", () => {
  const mod = game.modules.get("dxcufgbs-canvas-effects");
  if (!mod?.active) return;   // Dxcufgb's canvas effects not installed or not enabled
  const areas = mod.api.areas();
});
```

Add `{ "id": "dxcufgbs-canvas-effects", "type": "module" }` to `relationships.recommends` in your `module.json`.

**Data**

- An area: `{id, name, visible, exclude, ignoreExclusions, feather, elevation, sort, shapes, effect}`. `visible`: players see it; `exclude`: an exclusion zone, which hides the effects of areas with a lower `sort`; `ignoreExclusions`: no exclusion zone hides this area; `feather`: the soft edge in grid squares (0 to 4); `sort`: the drawing order, higher on top.
- A shape, in scene pixels: `{type: "rect" | "ellipse", x, y, width, height}`, `{type: "polygon", points: [x0, y0, x1, y1, …]}` or `{type: "stroke", points, width}` (a brush stroke or wall). Add `erase: true` to cut the shape out of the area.
- An effect: `{layers: [...]}`, drawn bottom to top. A layer: `{effect, style, scale, speed, alpha, density, direction, wind, pulse, rainbow, color, blend}`, plus `src` and `fit` (`"tile"` or `"stretch"`) for `"image"`, `light` for the effects that can cast light, `aboveTokens`, and `sound` (a built-in sound id, `"custom"` with `soundSrc`, or `""`), `soundVolume` (0 to 1) and `soundRange` (grid squares).
- Saved effects are a flag on the User: `flags["dxcufgbs-canvas-effects"].presets`, read them with `api.presets()`.
- Exported files: `<name>.canvas-effect.json`, `{format: "dxcufgbs-canvas-effects.effect", formatVersion: 1, name, exported, moduleVersion, effect, images}`. `images` holds each image of your own as a data URL, keyed by the `image` field of its layer.
