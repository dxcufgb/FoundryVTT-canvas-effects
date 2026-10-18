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

Every effect has several styles (135 in all). The painted areas are always see-through. They never block sight, light or movement; they only hold the effect. Effects are drawn above the map, tiles and drawings and below the tokens. Tick **Above the tokens** on a layer to draw that layer over the tokens instead, so rain, snow or clouds fall on everyone's heads.

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
- **Above the tokens**: any layer except the filters and surfaces can be drawn over the tokens instead of under them, for rain, snow, clouds or lightning falling on everyone's heads. The other layers of the same effect stay under the tokens, so a fog layer can stay on the ground below the rain.
- **Sounds**: every layer can make a sound, chosen under **Sound** in the effect window: one of the built-in sounds offered for its effect, a file of your own, or none, with its own volume. Sounds play for every player on Foundry's **Ambient** channel, louder the closer the area is to what you are looking at (fading out about a screen away) and the stronger the layer (its opacity and density). Several areas with the same sound play it once, louder. The GM also hears hidden areas, softer.
- **Thunder**: lightning plays thunder matched to each flash. Every strike has its own strength: a bright strike with a bolt cracks almost at once, loud; a medium flash rumbles a moment later; a faint flash rolls in from far off, quietly and late. The layer's opacity and the style's flash count too, so the Distant style mostly rumbles far away. A recorded thunderclap or a file of your own gets the same volume and delay. Strikes follow the clock, so every player sees and hears the same one.
- **Examples** in the saved effects list: Fireplace, Firelight, Campfire, Candles, Ritual circle, Heavy rain, Thunderstorm. Paint the firebox for a fire, one brush dot per candle (a stroke is a row of candles), the whole map for rain.

**Saved effects** are kept with your user and can be put on any area. **Export** saves an effect, with any images of your own, as one `.canvas-effect.json` file; **Import** reads it in any world (the images are uploaded into `worlds/<world>/dxcufgbs-canvas-effects/imported/`).

**Filters and surfaces** (Colour Grade, Underwater, Old Film, Glitch, Lava Flow, Living Water, Heat Haze, Vortex, Bloom) redraw the scene's background image inside the painted area. They are drawn just above the map and below tiles, so they need a scene with a background image, and tiles stay on top of them.

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

**Glowing layers** (fire, candles, embers, fireflies, ghosts, stars, lava, sunlight, lightning) are also drawn into Foundry's lighting, so they stay bright in a dark scene.

## Settings

| Setting | Scope | What it does |
| --- | --- | --- |
| Show canvas effects | this computer | Turn the effects off, for example if the canvas is slow |
| Effect detail | this computer | Particle counts and edge sharpness |
| Standard sounds for new effects | world (GM) | On (default): a new layer gets the sound that suits its effect. Off: new layers start silent. Existing layers keep their sound either way |

## For developers

Areas are stored on the scene: `flags["dxcufgbs-canvas-effects"].areas`. New effects are added in `scripts/effects.js` (see the comment at the top of the file).

```js
const api = game.modules.get("dxcufgbs-canvas-effects").api;
api.areas();                 // the areas of the viewed scene
api.open(areaId);            // open the Canvas effect window
api.effects;                 // effects and their styles
```
