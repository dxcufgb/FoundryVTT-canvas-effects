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

Requirements: see [Installation](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Installation) in the wiki.

## Documentation

The full guide is in the [wiki](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki):

- [Effects](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Effects): every effect, filters and surfaces, light in dark scenes
- [Painting](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Painting): the Effect Painter and its tools
- [Exclusion Zones](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Exclusion-Zones): keep effects out of buildings
- [The Canvas Effect Window](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/The-Canvas-Effect-Window): layers, styles and fine-tuning
- [Sounds](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Sounds): layer sounds, thunder and the built-in sounds
- [Saved Effects](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Saved-Effects): examples, export and import
- [Settings](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Settings): client and world settings
- [API](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/API): for macro and module authors
- [Troubleshooting](https://github.com/dxcufgb/FoundryVTT-canvas-effects/wiki/Troubleshooting)

## Development

New effects are added in `scripts/effects.js` (see the comment at the top of the file).
