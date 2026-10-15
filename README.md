# Dxcufgb's canvas effects

Paint areas and walls on the map and fill them with animated effects, all made for a map seen from above:

| Category | Effects |
| --- | --- |
| Weather | Rain, Snow, Fog & Smoke, Clouds, Sandstorm, Lightning |
| Ambient | Leaves & Petals, Embers, Stars, Fireflies, Ghosts, Particles |
| Fire & light | Fire, Light & Glow, Candles, Sunlight |
| Animals | Birds, Bats, Rats, Spiders, Fish |
| Filters | Colour Wash, Colour Grade, Bloom, Underwater, Old Film, Glitch |
| Surfaces | Lava Flow, Living Water, Heat Haze, Vortex, Your image |

Every effect has several styles (135 in all). The painted areas are always see-through. They never block sight, light or movement; they only hold the effect. Effects are drawn above the map, tiles and drawings and below the tokens.

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

- **Casts light**: fire, candles, firelight and lightning add real Foundry light sources, so they light the map and the tokens in a dark scene (walls block them, lightning excepted).
- **Thunder**: give a lightning layer a sound file and it plays a moment after each strike. Strikes follow the clock, so every player sees and hears the same one.
- **Examples** in the saved effects list: Fireplace, Firelight, Campfire, Candles, Ritual circle, Heavy rain, Thunderstorm. Paint the firebox for a fire, one brush dot per candle (a stroke is a row of candles), the whole map for rain.

**Saved effects** are kept with your user and can be put on any area. **Export** saves an effect, with any images of your own, as one `.canvas-effect.json` file; **Import** reads it in any world (the images are uploaded into `worlds/<world>/dxcufgbs-canvas-effects/imported/`).

**Filters and surfaces** (Colour Grade, Underwater, Old Film, Glitch, Lava Flow, Living Water, Heat Haze, Vortex, Bloom) redraw the scene's background image inside the painted area. They are drawn just above the map and below tiles, so they need a scene with a background image, and tiles stay on top of them.

**Glowing layers** (fire, candles, embers, fireflies, ghosts, stars, lava, sunlight, lightning) are also drawn into Foundry's lighting, so they stay bright in a dark scene.

## Settings

| Setting | Scope | What it does |
| --- | --- | --- |
| Show canvas effects | this computer | Turn the effects off, for example if the canvas is slow |
| Effect detail | this computer | Particle counts and edge sharpness |

## For developers

Areas are stored on the scene: `flags["dxcufgbs-canvas-effects"].areas`. New effects are added in `scripts/effects.js` (see the comment at the top of the file).

```js
const api = game.modules.get("dxcufgbs-canvas-effects").api;
api.areas();                 // the areas of the viewed scene
api.open(areaId);            // open the Canvas effect window
api.effects;                 // effects and their styles
```
