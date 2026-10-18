/**
 * Dxcufgb's canvas effects - the effects an area can show.
 *
 * An area's effect is a stack of layers, drawn bottom to top:
 *   {layers: [{effect, style, alpha, speed, scale, density, direction, wind, color, blend, pulse, rainbow,
 *              src, fit (your image), light (casts Foundry light), sound (lightning: thunder),
 *              aboveTokens (drawn over the tokens; not for effects that redraw the map)}, ...]}
 *
 * The Wind direction slider (`direction`, in degrees) and the Wind slider (`wind`) should visibly
 * steer every effect that lists them: use this.wind in effect-base.js.
 *
 * ADDING AN EFFECT
 * ----------------
 * 1. Write a class that extends AreaEffect (below). Build your display objects in build() and move
 *    them in animate(dt, time). Everything is in scene pixels; this.ctx has what you need:
 *      ctx.bounds      {x, y, width, height}  the painted area (with room for soft edges)
 *      ctx.grid        pixels per grid square (use it so effects look the same on every map)
 *      ctx.squares     how many grid squares the area covers (for particle counts)
 *      ctx.quality     1 (high) .. 0.3 (low): scale particle counts with it
 *      ctx.contains(x, y), ctx.randomPoint()   is a point painted / a random painted point
 *      ctx.rawBounds   the painted area without that room
 *      ctx.shapes      the area's shapes (see geometry.js), e.g. to place things where the user clicked
 *      ctx.seed        a number from the area's id (the same on every computer)
 *      ctx.clock()     milliseconds, the same on every computer (roughly): for synchronised events
 *      ctx.playSound(src, delayMs, volume)   only on the canvas, not in the preview
 *      ctx.textures    {custom: {src: PIXI.Texture}} images of your own
 *    The area masks the effect, so you can simply cover ctx.bounds.
 *    Register sprites that should take the layer's colour with this.tintable(sprite); the colour,
 *    rainbow, pulse and opacity are then handled for you.
 *    Return Foundry light sources from lights() (see effect-base.js) and set `lights: true` in EFFECTS
 *    to get a "Casts light" checkbox.
 * 2. Add it to EFFECTS with a label, an icon, its styles and the sliders it uses (see PARAMS).
 *
 * This file only needs the global PIXI (v7), so it runs both on the canvas and in the preview.
 */

export const MAX_LAYERS = 8;

/** Sliders a layer can have. Each effect lists the ones that make sense for it. */
export const PARAMS = {
  scale:     { label: "DXCFX.Param.Scale",     min: 0.2, max: 4,    step: 0.05, fmt: "pct", default: 1 },
  speed:     { label: "DXCFX.Param.Speed",     min: 0,   max: 3,    step: 0.05, fmt: "pct", default: 1 },
  alpha:     { label: "DXCFX.Param.Opacity",   min: 0,   max: 1,    step: 0.01, fmt: "pct", default: 1 },
  density:   { label: "DXCFX.Param.Density",   min: 0.1, max: 3,    step: 0.05, fmt: "pct", default: 1 },
  direction: { label: "DXCFX.Param.Direction", min: -180, max: 180, step: 1,    fmt: "deg", default: 0 },
  wind:      { label: "DXCFX.Param.Wind",      min: 0,   max: 3,    step: 0.05, fmt: "pct", default: 1 },
  pulse:     { label: "DXCFX.Param.Pulse",     min: 0,   max: 1,    step: 0.01, fmt: "pct", default: 0 },
  rainbow:   { label: "DXCFX.Param.Rainbow",   min: 0,   max: 1,    step: 0.01, fmt: "pct", default: 0 }
};

/** Sliders shown in the "Effects" group for every layer. */
export const COMMON_PARAMS = ["pulse", "rainbow"];

export const BLENDS = {
  normal: "DXCFX.Blend.Normal",
  add: "DXCFX.Blend.Add",
  screen: "DXCFX.Blend.Screen",
  multiply: "DXCFX.Blend.Multiply"
};

export const IMAGE = "image";
export const FITS = { tile: "DXCFX.Fit.Tile", stretch: "DXCFX.Fit.Stretch" };

import { AreaEffect, BLEND_MODE, clamp, effectTextures, hexToNum } from "./effect-base.js";
import { ColorEffect, FogEffect, ParticleEffect, ImageEffect } from "./effects-basic.js";
import { FireEffect, GlowEffect, CandleEffect, RainEffect, LightningEffect } from "./effects-ambience.js";
import { FallEffect, CloudEffect, SandstormEffect, StarEffect, GhostEffect } from "./effects-nature.js";
import { FlyerEffect, CrawlerEffect, SwimmerEffect } from "./effects-animals.js";
import { ShaderEffect } from "./effects-shader.js";

export { AreaEffect, effectTextures, hexToNum };

/* ======================================================================== */
/*  Registry                                                                */
/* ======================================================================== */

/**
 * The effects to choose from. `label` and the style labels are shown as written; `params` are the
 * sliders under "Fine-tune" (pulse and rainbow are always there).
 */
export const EFFECTS = {
  fire: {
    label: "Fire", icon: "fa-solid fa-fire", cls: FireEffect, emissive: true, lights: true,
    params: ["scale", "speed", "alpha", "density", "direction", "wind"],
    styles: {
      hearth:   { label: "Hearth",    ramp: ["#fff1bf", "#ff9226", "#b8300c"], wind: 0.2, rate: 7, lightBright: 1, lightDim: 3.5 },
      campfire: { label: "Campfire",  ramp: ["#fff3c4", "#ffa233", "#c83a12"], wind: 0.6, rate: 6, smoke: true, lightBright: 2, lightDim: 7 },
      brazier:  { label: "Brazier",   ramp: ["#fff6d8", "#ffb347", "#d9541a"], wind: 0.3, rate: 9, gather: 0.5, lightBright: 1, lightDim: 4 },
      arcane:   { label: "Arcane Fire", ramp: ["#f2e6ff", "#a768ff", "#4a1a9a"], wind: 0.3, rate: 7, lightBright: 1.5, lightDim: 5 },
      fel:      { label: "Fel Fire",  ramp: ["#efffd0", "#7ee830", "#1f6a10"], wind: 0.3, rate: 7, lightBright: 1.5, lightDim: 5 },
      ghost:    { label: "Ghostfire", ramp: ["#e8fbff", "#7fd8ff", "#1a4a7a"], wind: 0.15, rate: 5, life: [0.8, 1.6], lightBright: 1, lightDim: 4, lightAlpha: 0.4 }
    }
  },
  glow: {
    label: "Light & Glow", icon: "fa-solid fa-sun", cls: GlowEffect, emissive: true, blend: "add", lights: true,
    params: ["scale", "speed", "alpha"],
    styles: {
      firelight:   { label: "Firelight",   color: "#ff9a3c", alpha: 0.35, flicker: 0.35, anim: "torch" },
      candlelight: { label: "Candlelight", color: "#ffd48a", alpha: 0.3, flicker: 0.15, anim: "flame" },
      moonlight:   { label: "Moonlight",   color: "#a9c8ff", alpha: 0.25, flicker: 0, blend: "screen" },
      arcane:      { label: "Arcane",      color: "#a070ff", alpha: 0.35, flicker: 0.1, anim: "pulse" },
      hellfire:    { label: "Hellfire",    color: "#ff3a1a", alpha: 0.4, flicker: 0.4, anim: "torch" }
    }
  },
  candles: {
    label: "Candles", icon: "fa-solid fa-candle-holder", cls: CandleEffect, emissive: true, lights: true,
    params: ["scale", "speed", "alpha", "density", "direction", "wind"],
    styles: {
      wax:    { label: "Wax",     ramp: ["#fff8e0", "#ffb648", "#e06a1a"], wax: "#efe4c8", wind: 0.1 },
      votive: { label: "Votive",  ramp: ["#fff1d0", "#ff6a3a", "#b0201a"], wax: "#8a1c1c", wind: 0.05, halo: 1.2, haloAlpha: 0.55 },
      ritual: { label: "Ritual",  ramp: ["#f3e6ff", "#b46cff", "#5a1aa0"], wax: "#1c1820", wind: 0.1 },
      spirit: { label: "Spirit",  ramp: ["#eafff8", "#6ff0d0", "#1a7a6a"], wind: 0.05, float: true, halo: 1.3, lightAlpha: 0.35 }
    }
  },
  rain: {
    label: "Rain", icon: "fa-solid fa-cloud-showers-heavy", cls: RainEffect, blend: "normal",
    params: ["scale", "speed", "alpha", "density", "direction", "wind"],
    styles: {
      downpour: { label: "Downpour", color: "#d6e6f4", rate: 12, wind: 0.4, fall: [0.3, 0.45], width: 2.4, dropAlpha: 0.75 },
      drizzle:  { label: "Drizzle",  color: "#d8e6f0", rate: 4, wind: 0.2, fall: [0.5, 0.8], streak: 0.2, width: 1.1, dropAlpha: 0.45, splash: 0.07, splashRate: 0.5 },
      storm:    { label: "Storm",    color: "#d0e0ee", rate: 16, wind: 1.1, fall: [0.25, 0.4], streak: 0.45, splash: 0.14, width: 2.4, dropAlpha: 0.75 },
      blood:    { label: "Blood Rain", color: "#b0202a", rate: 9, wind: 0.4, dropAlpha: 0.7 }
    }
  },
  lightning: {
    label: "Lightning", icon: "fa-solid fa-bolt", cls: LightningEffect, emissive: true, blend: "add", lights: true, sound: true,
    params: ["alpha", "density"],
    styles: {
      storm:   { label: "Storm",    color: "#dbe8ff", every: 8, chance: 0.75, bolt: 0.55, flash: 0.5 },
      distant: { label: "Distant",  color: "#b8c8ff", every: 9, chance: 0.7, bolt: 0, flash: 0.22, light: 0.4 },
      crimson: { label: "Crimson",  color: "#ff6a6a", every: 8, chance: 0.75, bolt: 0.6, flash: 0.45 },
      arcane:  { label: "Arcane",   color: "#c08aff", every: 6, chance: 0.8, bolt: 0.7, flash: 0.45 }
    }
  },
  fog: {
    label: "Fog & Smoke", icon: "fa-solid fa-smog", cls: FogEffect, blend: "normal",
    params: ["scale", "speed", "alpha", "density", "direction", "wind"],
    styles: {
      mist:    { label: "Mist",       color: "#e4eaf0", alpha: 0.6, flow: 0.2 },
      smoke:   { label: "Smoke",      color: "#3b3a3f", alpha: 0.8, flow: 0.3, drift: -90 },
      poison:  { label: "Poison Gas", color: "#8fdc3a", alpha: 0.65, flow: 0.25 },
      arcane:  { label: "Arcane Haze", color: "#9a6bff", alpha: 0.6, flow: 0.2, blend: "screen" },
      blood:   { label: "Blood Mist", color: "#a3121c", alpha: 0.6, flow: 0.15 },
      dark:    { label: "Darkness",   color: "#050308", alpha: 0.95, flow: 0.1 },
      clouds:  { label: "Storm Clouds", color: "#070a12", alpha: 0.45, flow: 0.8 }
    }
  },
  particles: {
    label: "Particles", icon: "fa-solid fa-fire-flame-curved", cls: ParticleEffect, blend: "add",
    params: ["scale", "speed", "alpha", "density", "direction", "wind"],
    styles: {
      embers:  { label: "Embers", emissive: true,   color: "#ff8a2a", texture: "dot", rate: 3, dir: 0, spread: 35, speed: [0.15, 0.6], life: [1.5, 3.5], size: [0.05, 0.12], wander: 0.3, flicker: true, grow: true, windy: true },
      motes:   { label: "Fireflies", emissive: true, color: "#ffe27a", texture: "dot", rate: 1.2, dir: 0, spread: 180, speed: [0.02, 0.1], life: [3, 6], size: [0.08, 0.14], wander: 0.35, flicker: true },
      snow:    { label: "Snow",     color: "#ffffff", texture: "flake", rate: 4, dir: 90, spread: 15, speed: [0.25, 0.5], life: [3, 6], size: [0.04, 0.09], wander: 0.2, blend: "normal" },
      bubbles: { label: "Bubbles",  color: "#9fe8ff", texture: "bubble", rate: 1, dir: -90, spread: 15, speed: [0.1, 0.3], life: [2, 4], size: [0.12, 0.25], wander: 0.15, blend: "normal" },
      sparks:  { label: "Arcane Sparks", emissive: true, color: "#b48cff", texture: "dot", rate: 2.5, dir: 0, spread: 180, breeze: 0.4, speed: [0.3, 0.9], life: [0.6, 1.4], size: [0.04, 0.08], wander: 0.6, shrink: true }
    }
  },
  color: {
    label: "Colour Wash", icon: "fa-solid fa-fill-drip", cls: ColorEffect, blend: "normal",
    params: ["alpha"],
    styles: {
      arcane:  { label: "Arcane", color: "#8a5aff", alpha: 0.45, blend: "screen" },
      fire:    { label: "Fire",   color: "#ff5a1a", alpha: 0.45, blend: "add" },
      acid:    { label: "Acid",   color: "#7fdc2a", alpha: 0.4 },
      frost:   { label: "Frost",  color: "#8fdcff", alpha: 0.4, blend: "screen" },
      shadow:  { label: "Shadow", color: "#120a1c", alpha: 0.6 },
      holy:    { label: "Holy",   color: "#ffe9a0", alpha: 0.4, blend: "add" },
      wet:     { label: "Wet Ground", color: "#4a6680", alpha: 0.35, blend: "multiply" },
      gloom:   { label: "Gloom",  color: "#5a6680", alpha: 0.35, blend: "multiply" }
    }
  },
  [IMAGE]: {
    label: "Your image", icon: "fa-solid fa-image", cls: ImageEffect, blend: "normal", custom: true,
    params: ["scale", "speed", "alpha", "direction"],
    styles: {
      still: { label: "Still" },
      drift: { label: "Drift", flow: 0.15 },
      flow:  { label: "Flow",  flow: 0.6 },
      sway:  { label: "Sway",  sway: 0.15 }
    }
  }
};

const MOVE = ["scale", "speed", "alpha", "density", "direction", "wind"];
const SHADER = ["scale", "speed", "alpha"];

Object.assign(EFFECTS, {
  /* ---- Weather ---- */
  snow: {
    label: "Snow", icon: "fa-solid fa-snowflake", cls: FallEffect, params: MOVE,
    styles: {
      light:    { label: "Light Snow", color: "#ffffff", texture: "flake", rate: 3, fall: [4, 7], size: [0.05, 0.1], wind: 0.3, rest: [1, 2.5] },
      heavy:    { label: "Heavy Snow", color: "#ffffff", texture: "flake", rate: 9, fall: [3, 5], size: [0.05, 0.12], wind: 0.5, rest: [1.5, 3] },
      blizzard: { label: "Blizzard",   color: "#f2f6ff", texture: "flake", rate: 14, fall: [1.2, 2.2], size: [0.04, 0.09], wind: 1.6, slant: 1.6, flutter: 0.1, rest: [0.4, 1], skitter: 0.8 },
      wet:      { label: "Wet Snow",   color: "#e8eef4", texture: "flake", rate: 4, fall: [2.5, 4], size: [0.1, 0.18], wind: 0.3, itemAlpha: 0.85, rest: [0.6, 1.4] },
      ash:      { label: "Ash Fall",   colors: ["#9a958e", "#6f6a64", "#c8c2b8"], texture: "ash", rate: 4, fall: [4, 8], size: [0.05, 0.12], wind: 0.4, spin: 2, rest: [2, 4], skitter: 0.2 }
    }
  },
  clouds: {
    label: "Clouds", icon: "fa-solid fa-cloud", cls: CloudEffect, params: MOVE,
    styles: {
      shadows:  { label: "Cloud Shadows", shadow: 0.42, speed: 0.6, wind: 0.6 },
      fair:     { label: "Fair Weather",  shadow: 0.35, tops: 0.35, color: "#ffffff", speed: 0.5, wind: 0.5, height: 2.5 },
      overcast: { label: "Overcast",      shadow: 0.55, tops: 0.5, color: "#b8bec8", speed: 0.35, wind: 0.5, height: 2 },
      storm:    { label: "Storm Front",   shadow: 0.65, tops: 0.45, color: "#4a505c", speed: 1.4, wind: 1, height: 2 }
    }
  },
  sandstorm: {
    label: "Sandstorm", icon: "fa-solid fa-wind", cls: SandstormEffect, params: MOVE,
    styles: {
      sand:   { label: "Sandstorm",  color: "#9a6a38", grainColor: "#fff0cc", wash: 0.35, flow: 2.2, grains: 7, wind: 1.2 },
      dust:   { label: "Dust Drift", color: "#8a7a62", grainColor: "#f4ead8", wash: 0.15, flow: 1, grains: 3, wind: 0.6 },
      ash:    { label: "Ash Storm",  color: "#4a4440", grainColor: "#c8c0b8", wash: 0.35, flow: 1.8, grains: 6, wind: 1 },
      red:    { label: "Red Dust",   color: "#8a3a1e", grainColor: "#ffc8a0", wash: 0.3, flow: 1.6, grains: 6, wind: 1 }
    }
  },
  /* ---- Ambient ---- */
  leaves: {
    label: "Leaves & Petals", icon: "fa-solid fa-leaf", cls: FallEffect, params: MOVE,
    styles: {
      autumn:  { label: "Autumn",  colors: ["#d2691e", "#b8321e", "#e0a526", "#8b4513"], texture: "leaf", rate: 1.2, fall: [3, 6], size: [0.14, 0.22], wind: 0.5, tumble: 3, spin: 1.5, flutter: 0.4, rest: [2, 4], skitter: 0.3, shadow: 0.35 },
      spring:  { label: "Spring",  colors: ["#6aa83a", "#8ccf4a", "#4a8a2a"], texture: "leaf", rate: 1, fall: [3, 6], size: [0.12, 0.2], wind: 0.5, tumble: 3, spin: 1.5, flutter: 0.4, rest: [1.5, 3], skitter: 0.3, shadow: 0.35 },
      blossom: { label: "Cherry Blossom", colors: ["#ffc8dc", "#ffb0cc", "#fff0f5"], texture: "petal", rate: 2.5, fall: [4, 7], size: [0.07, 0.11], wind: 0.6, tumble: 4, spin: 2, flutter: 0.5, rest: [1.5, 3], skitter: 0.5, shadow: 0.25 },
      dead:    { label: "Dead Leaves", colors: ["#6b4a2a", "#8a6a3a", "#4a3a2a"], texture: "leaf", rate: 0.8, fall: [2.5, 4], size: [0.14, 0.22], wind: 0.8, tumble: 2, spin: 1, flutter: 0.3, rest: [3, 6], skitter: 0.6, shadow: 0.35 }
    }
  },
  embers: {
    label: "Embers", icon: "fa-solid fa-fire-flame-curved", cls: ParticleEffect, emissive: true, blend: "add", params: MOVE,
    styles: {
      embers:   { label: "Embers",   color: "#ff8a2a", texture: "dot", rate: 2, dir: 0, spread: 35, speed: [0.15, 0.6], life: [1.5, 3.5], size: [0.05, 0.12], wander: 0.3, flicker: true, grow: true, windy: true },
      cinders:  { label: "Cinder Storm", color: "#ff6a1a", texture: "dot", rate: 5, dir: 0, spread: 20, speed: [0.8, 1.6], life: [0.8, 1.8], size: [0.04, 0.09], wander: 0.4, flicker: true, shrink: true, windy: true },
      soulfire: { label: "Soulfire", color: "#6ad8ff", texture: "dot", rate: 1.5, dir: 0, spread: 60, speed: [0.1, 0.4], life: [2, 4], size: [0.06, 0.12], wander: 0.4, flicker: true, grow: true, windy: true },
      ash:      { label: "Glowing Ash", color: "#ffb070", texture: "ash", rate: 1.5, dir: 0, spread: 50, speed: [0.1, 0.4], life: [3, 6], size: [0.05, 0.1], wander: 0.25, flicker: true, windy: true }
    }
  },
  stars: {
    label: "Stars", icon: "fa-solid fa-star", cls: StarEffect, emissive: true, params: ["scale", "speed", "alpha", "density"],
    styles: {
      starfield: { label: "Starfield", colors: ["#ffffff", "#cfe0ff", "#fff0d0"], rate: 8 },
      nebula:    { label: "Night Sky", colors: ["#ffffff", "#d8d0ff"], rate: 10, nebula: "#5a3a9a" },
      astral:    { label: "Astral", colors: ["#c8b0ff", "#a0e0ff", "#ffffff"], rate: 4, nebula: "#203a7a", shooting: 2 },
      constellation: { label: "Constellations", colors: ["#ffffff", "#ffe8b0"], rate: 5, lines: "#8fb0ff", shooting: 0.5 }
    }
  },
  fireflies: {
    label: "Fireflies", icon: "fa-solid fa-sparkles", cls: ParticleEffect, emissive: true, blend: "add", params: MOVE,
    styles: {
      fireflies: { label: "Fireflies", color: "#e0ff70", texture: "dot", rate: 1.4, dir: 0, spread: 180, speed: [0.02, 0.12], life: [4, 8], size: [0.12, 0.2], wander: 0.4, blink: true, blinkRate: 1.3 },
      fairy:     { label: "Fairy Lights", color: "#ffd0f0", texture: "flake", rate: 1.2, dir: 0, spread: 180, speed: [0.05, 0.2], life: [3, 6], size: [0.05, 0.09], wander: 0.6, blink: true, blinkRate: 2.2 },
      glowworms: { label: "Glow-worms", color: "#6ae8ff", texture: "dot", rate: 2, dir: 0, spread: 180, breeze: 0.03, speed: [0.005, 0.02], life: [6, 10], size: [0.04, 0.07], wander: 0.05, blink: true, blinkRate: 0.5 },
      swamp:     { label: "Swamp Lights", color: "#9aff8a", texture: "dot", rate: 0.4, dir: 0, spread: 180, speed: [0.05, 0.15], life: [5, 9], size: [0.12, 0.2], wander: 0.3, blink: true, blinkRate: 0.7 }
    }
  },
  ghosts: {
    label: "Ghosts", icon: "fa-solid fa-ghost", cls: GhostEffect, emissive: true, blend: "add", params: MOVE,
    styles: {
      spirits: { label: "Spirits", color: "#cfefff", rate: 0.12, speed: 0.4, size: [0.8, 1.2] },
      wraiths: { label: "Wraiths", emissive: false, color: "#1a1622", rate: 0.1, speed: 0.55, size: [1, 1.5], blend: "normal", ghostAlpha: 0.6 },
      wisps:   { label: "Will-o'-wisps", color: "#a8ff9a", rate: 0.15, speed: 0.6, size: [0.25, 0.35], orb: true, trail: 5, ghostAlpha: 0.9 },
      souls:   { label: "Lost Souls", color: "#ffe2a0", rate: 0.15, speed: 0.3, size: [0.6, 0.9], life: [8, 14] }
    }
  },
  /* ---- Animals ---- */
  birds: {
    label: "Birds", icon: "fa-solid fa-crow", cls: FlyerEffect, params: MOVE,
    styles: {
      crows:    { label: "Crows",    color: "#15151a", texture: "bird", rate: 0.04, flock: [4, 8], speed: 2.2, flap: 9, height: 1.5, wind: 1, size: [0.5, 0.65] },
      gulls:    { label: "Gulls",    colors: ["#ffffff", "#e8ecf0"], texture: "bird", rate: 0.03, flock: [3, 6], speed: 1.8, flap: 6, glide: 0.4, height: 1.8, size: [0.65, 0.85] },
      doves:    { label: "Doves",    colors: ["#e8e6e0", "#b8b4b0"], texture: "bird", rate: 0.05, flock: [6, 12], speed: 2, flap: 11, height: 1.2, size: [0.4, 0.5] },
      vultures: { label: "Vultures (circling)", color: "#2a2018", texture: "bird", rate: 0.015, mode: "circle", speed: 1, flap: 4, glide: 1.5, height: 2.4, size: [1, 1.3] }
    }
  },
  bats: {
    label: "Bats", icon: "fa-solid fa-bat", cls: FlyerEffect, params: MOVE,
    styles: {
      swarm:   { label: "Bat Swarm", color: "#3a3036", texture: "bat", rate: 0.25, mode: "swarm", speed: 3, flap: 22, height: 0.9, size: [0.4, 0.55] },
      few:     { label: "A Few Bats", color: "#3a3036", texture: "bat", rate: 0.05, mode: "swarm", speed: 2.4, flap: 18, height: 1, size: [0.5, 0.65] },
      vampire: { label: "Vampire Bats", color: "#5a1420", texture: "bat", rate: 0.12, mode: "swarm", speed: 3.2, flap: 20, height: 0.8, size: [0.45, 0.6] },
      flock:   { label: "Bat Flight", color: "#3a3036", texture: "bat", rate: 0.12, mode: "flock", flock: [8, 16], speed: 3, flap: 20, height: 1.2, size: [0.4, 0.5] }
    }
  },
  rats: {
    label: "Rats", icon: "fa-solid fa-paw", cls: CrawlerEffect, params: ["scale", "speed", "alpha", "density"],
    styles: {
      sewer:  { label: "Sewer Rats", colors: ["#7a6656", "#6a5848", "#8a7464"], kind: "rat", rate: 0.25, speed: 1.6, size: [0.45, 0.6] },
      mice:   { label: "Mice", colors: ["#a89888", "#c0b0a0"], kind: "rat", rate: 0.3, speed: 2, size: [0.25, 0.32], pause: [0.2, 0.8] },
      plague: { label: "Plague Rats", colors: ["#6a7a4a", "#5a6a40"], kind: "rat", rate: 0.35, speed: 1.4, size: [0.45, 0.6] },
      giant:  { label: "Giant Rats", colors: ["#5a4a40"], kind: "rat", rate: 0.05, speed: 1.2, size: [1, 1.3] }
    }
  },
  spiders: {
    label: "Spiders", icon: "fa-solid fa-spider", cls: CrawlerEffect, params: ["scale", "speed", "alpha", "density"],
    styles: {
      small:  { label: "Spiders", colors: ["#1a1614", "#2a221c"], kind: "spider", rate: 0.3, speed: 1, size: [0.3, 0.4], stride: 0.06 },
      swarm:  { label: "Swarm", colors: ["#141010"], kind: "spider", rate: 1.2, speed: 1.4, size: [0.16, 0.22], stride: 0.04, pause: [0.1, 0.5] },
      giant:  { label: "Giant Spider", colors: ["#20181a"], kind: "spider", rate: 0.03, speed: 0.9, size: [1.6, 2], stride: 0.12, run: [0.5, 1.2], pause: [1, 2.5] },
      phase:  { label: "Phase Spiders", colors: ["#6a7aff", "#9aa8ff"], kind: "spider", rate: 0.06, speed: 1.2, size: [0.6, 0.8], stride: 0.08, phase: true, bodyAlpha: 0.85 }
    }
  },
  fish: {
    label: "Fish", icon: "fa-solid fa-fish", cls: SwimmerEffect, params: ["scale", "speed", "alpha", "density"],
    styles: {
      koi:      { label: "Koi", colors: ["#ffffff", "#ff7a2a"], spots: "#e8401a", rate: 0.15, speed: [0.4, 0.7], size: [0.5, 0.7], depth: 0.9, ripples: 0.05 },
      minnows:  { label: "Minnows", colors: ["#8a9aa0", "#a0b0b4"], rate: 1.5, school: 10, speed: [0.9, 1.2], size: [0.15, 0.2], depth: 0.7, turn: 2.5, shadow: 0.12, ripples: 0.005 },
      piranha:  { label: "Piranha", colors: ["#8a4a3a", "#a0503a"], rate: 0.6, school: 6, speed: [0.6, 0.9], size: [0.3, 0.38], depth: 0.75, dart: true, turn: 3 },
      eels:     { label: "Eels", colors: ["#2a3a2a", "#3a4a30"], rate: 0.06, speed: [0.5, 0.8], size: [0.5, 0.6], depth: 0.8, eel: true, turn: 1.5 }
    }
  },
  /* ---- Filters ---- */
  grade: {
    label: "Colour Grade", icon: "fa-solid fa-palette", cls: ShaderEffect, glsl: "grade", backdrop: true, under: true, params: ["alpha"],
    styles: {
      sepia:     { label: "Sepia",      color: "#c39a6a", p: [0, 1.05, 1, 0.85] },
      greyscale: { label: "Greyscale",  color: "#ffffff", p: [0, 1.1, 1, 0] },
      cold:      { label: "Cold",       color: "#7aa8ff", p: [0.75, 1.05, 0.95, 0.3] },
      warm:      { label: "Warm",       color: "#ffb064", p: [1.05, 1.05, 1.03, 0.25] },
      night:     { label: "Night",      color: "#4a68c0", p: [0.45, 1.1, 0.55, 0.4] },
      vivid:     { label: "Vivid",      color: "#ffffff", p: [1.6, 1.15, 1.02, 0] },
      infernal:  { label: "Infernal",   color: "#ff4020", p: [0.9, 1.25, 0.9, 0.45] }
    }
  },
  bloom: {
    label: "Bloom", icon: "fa-solid fa-lightbulb", cls: ShaderEffect, emissive: true, glsl: "bloom", backdrop: true, blend: "add", params: SHADER,
    styles: {
      soft:   { label: "Soft Glow", color: "#ffffff", p: [0.35, 0.55, 1.2, 1.2], scaleP: [0] },
      dreamy: { label: "Dreamy",    color: "#ffe8d0", p: [0.6, 0.35, 1.4, 0.8], scaleP: [0] },
      holy:   { label: "Holy",      color: "#ffd870", p: [0.5, 0.45, 1.8, 1.5], scaleP: [0] },
      arcane: { label: "Arcane",    color: "#b080ff", p: [0.5, 0.45, 1.8, 2], scaleP: [0] }
    }
  },
  underwater: {
    label: "Underwater", icon: "fa-solid fa-water", cls: ShaderEffect, glsl: "underwater", backdrop: true, under: true, params: SHADER,
    styles: {
      shallow: { label: "Shallows", color: "#7ad0e0", color2: "#e8fbff", p: [0.6, 0.25, 1.2, 0.5], scaleP: [2] },
      deep:    { label: "Deep Water", color: "#2a5aa0", color2: "#7ab8e8", p: [0.8, 0.6, 0.9, 0.3], scaleP: [2] },
      murky:   { label: "Murky",   color: "#5a7a3a", color2: "#a8c880", p: [0.5, 0.55, 1, 0.15], scaleP: [2] },
      sewer:   { label: "Sewer",   color: "#6a6a3a", color2: "#c0b880", p: [0.4, 0.5, 1.3, 0.12], scaleP: [2] }
    }
  },
  oldfilm: {
    label: "Old Film", icon: "fa-solid fa-film", cls: ShaderEffect, glsl: "oldfilm", backdrop: true, under: true, params: SHADER,
    styles: {
      silent: { label: "Silent Film", color: "#ffffff", p: [0, 0, 0.12, 0.6] },
      sepia:  { label: "Sepia Reel",  color: "#c8a070", p: [0, 0.85, 0.1, 0.55] },
      faded:  { label: "Faded Colour", color: "#e8d0a0", p: [0.45, 0.3, 0.08, 0.45] }
    }
  },
  sunlight: {
    label: "Sunlight", icon: "fa-solid fa-sun", cls: ShaderEffect, emissive: true, glsl: "sunlight", blend: "add", params: SHADER,
    styles: {
      rays:    { label: "Sunbeams", color: "#ffe6a8", p: [0.6, 0.04, 0.35, 0], scaleP: [0] },
      dappled: { label: "Dappled Light", color: "#fff0b0", p: [0.9, 0.02, 0.35, 1], scaleP: [0] },
      sunset:  { label: "Sunset", color: "#ff9a50", p: [0.45, 0.08, 0.4, 0], scaleP: [0] },
      column:  { label: "Light from Above", color: "#fff4d0", p: [1, 0, 0.6, 2] }
    }
  },
  glitch: {
    label: "Glitch", icon: "fa-solid fa-bug", cls: ShaderEffect, glsl: "glitch", backdrop: true, under: true, params: SHADER,
    styles: {
      digital:   { label: "Digital", color: "#40ffd0", p: [1.5, 0.6, 0.06, 0] },
      rift:      { label: "Arcane Rift", color: "#b060ff", p: [2, 0.8, 0.1, 0.25] },
      corrupted: { label: "Corrupted", color: "#ff3060", p: [4, 1.6, 0.18, 0.15] },
      subtle:    { label: "Subtle", color: "#ffffff", p: [0.6, 0.25, 0.03, 0] }
    }
  },
  /* ---- Surfaces ---- */
  lava: {
    label: "Lava Flow", icon: "fa-solid fa-volcano", cls: ShaderEffect, emissive: true, glsl: "lava", backdrop: true, under: true, lights: true, params: ["scale", "speed", "alpha", "direction"],
    styles: {
      flowing: { label: "Flowing Lava", color: "#ff7a1a", p: [0.8, 0.12, 0.9, 0.5], q: [0.08], light: 2, anim: "fog" },
      crust:   { label: "Cooling Crust", color: "#ff5a10", p: [0.4, 0.08, 0.6, 0.9], q: [0.04], light: 1 },
      magma:   { label: "Magma Glow", color: "#ffb030", p: [0.6, 0.18, 1.4, 0.3], q: [0.06], light: 3, anim: "fog" }
    }
  },
  water: {
    label: "Living Water", icon: "fa-solid fa-droplet", cls: ShaderEffect, glsl: "water", backdrop: true, under: true, params: ["scale", "speed", "alpha", "direction"],
    styles: {
      lake:  { label: "Lake Shimmer", color: "#ffffff", color2: "#ffffff", p: [0.5, 0, 0.25, 0.35], q: [0, 0] },
      river: { label: "River Flow", color: "#ffffff", color2: "#ffffff", p: [0.5, 0.8, 0.25, 0.3], q: [0.12, 0] },
      ocean: { label: "Ocean Swell", color: "#ffffff", color2: "#e8f6ff", p: [0.8, 0, 0.3, 0.3], q: [0, 1] },
      swamp: { label: "Swamp", color: "#d8e8a0", color2: "#ffffff", p: [0.25, 0, -0.15, 0.12], q: [0, 0] }
    }
  },
  haze: {
    label: "Heat Haze", icon: "fa-solid fa-temperature-high", cls: ShaderEffect, glsl: "haze", backdrop: true, under: true, params: SHADER,
    styles: {
      haze:   { label: "Heat Haze", color: "#ffffff", p: [0.35, 1.2, 0, 1.4] },
      mirage: { label: "Mirage", color: "#fff0d0", p: [0.6, 0.8, 0.12, 0.8] },
      forge:  { label: "Forge Heat", color: "#ff9050", p: [0.5, 1.8, 0.1, 2] }
    }
  },
  vortex: {
    label: "Vortex", icon: "fa-solid fa-hurricane", cls: ShaderEffect, glsl: "vortex", backdrop: true, under: true, params: SHADER,
    styles: {
      portal:    { label: "Portal", color: "#b070ff", color2: "#1a0830", p: [3, 0.25, 0.7, 0.8] },
      whirlpool: { label: "Whirlpool", color: "#e8f8ff", color2: "#0a2a40", p: [4, 0.35, 0.5, 0.5] },
      void:      { label: "Void Rift", color: "#ff3a6a", color2: "#000000", p: [5, 0.3, 0.95, 0.6] }
    }
  }
});

/** Groups shown in the effect window, in order. */
export const CATEGORIES = [
  { id: "weather", label: "DXCFX.Category.Weather", effects: ["rain", "snow", "fog", "clouds", "sandstorm", "lightning"] },
  { id: "ambient", label: "DXCFX.Category.Ambient", effects: ["leaves", "embers", "stars", "fireflies", "ghosts", "particles"] },
  { id: "light", label: "DXCFX.Category.Light", effects: ["fire", "glow", "candles", "sunlight"] },
  { id: "animals", label: "DXCFX.Category.Animals", effects: ["birds", "bats", "rats", "spiders", "fish"] },
  { id: "filters", label: "DXCFX.Category.Filters", effects: ["color", "grade", "bloom", "underwater", "oldfilm", "glitch"] },
  { id: "surfaces", label: "DXCFX.Category.Surfaces", effects: ["lava", "water", "haze", "vortex", IMAGE] }
];

export const DEFAULT_EFFECT = "fog";

/**
 * Ready-made effects, shown under "Examples" with the saved effects.
 * Paint the area to fit: the fireplace's firebox, a dot (brush click) per candle, the whole map for rain.
 */
export const EXAMPLES = [
  {
    id: "example-fireplace", name: "Fireplace",
    cfg: { layers: [
      { effect: "fire", style: "hearth" },
      { effect: "particles", style: "embers", density: 0.8, wind: 0.5, direction: 90 }
    ] }
  },
  {
    id: "example-firelight", name: "Firelight (paint the room in front of the fire)",
    cfg: { layers: [{ effect: "glow", style: "firelight", alpha: 0.8 }] }
  },
  {
    id: "example-campfire", name: "Campfire",
    cfg: { layers: [
      { effect: "fire", style: "campfire" },
      { effect: "particles", style: "embers", density: 1.2 }
    ] }
  },
  {
    id: "example-candles", name: "Candles (one brush dot per candle)",
    cfg: { layers: [{ effect: "candles", style: "wax" }] }
  },
  {
    id: "example-ritual", name: "Ritual circle (paint the ring)",
    cfg: { layers: [
      { effect: "glow", style: "arcane", alpha: 0.7, light: false },
      { effect: "candles", style: "ritual", density: 0.8 }
    ] }
  },
  {
    id: "example-rain", name: "Heavy rain",
    cfg: { layers: [
      { effect: "color", style: "wet" },
      { effect: "fog", style: "clouds", scale: 2.5, alpha: 0.8 },
      { effect: "rain", style: "downpour" }
    ] }
  },
  {
    id: "example-thunderstorm", name: "Thunderstorm",
    cfg: { layers: [
      { effect: "color", style: "gloom" },
      { effect: "fog", style: "clouds", scale: 3, wind: 1.4 },
      { effect: "rain", style: "storm" },
      { effect: "lightning", style: "storm" }
    ] }
  }
];

/* ======================================================================== */
/*  Config                                                                  */
/* ======================================================================== */

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** A complete, valid layer (unknown effects and styles fall back to the first). */
export function normalizeLayer(l = {}) {
  const effect = EFFECTS[l.effect] ? l.effect : DEFAULT_EFFECT;
  const def = EFFECTS[effect];
  const style = def.styles[l.style] ? l.style : Object.keys(def.styles)[0];
  const out = { effect, style };
  for (const [k, p] of Object.entries(PARAMS)) out[k] = clamp(num(l[k], p.default), p.min, p.max);
  out.color = /^#[0-9a-f]{6}$/i.test(l.color ?? "") ? l.color.toLowerCase() : null;
  out.blend = BLENDS[l.blend] ? l.blend : null;               // null: the style's own
  if (effect === IMAGE) {
    out.src = typeof l.src === "string" ? l.src.trim() : "";
    out.fit = FITS[l.fit] ? l.fit : "tile";
  }
  if (def.lights) out.light = l.light !== false;
  // Effects that redraw the map stay on the map; any other layer can be drawn above the tokens.
  if (!def.under && !def.backdrop) out.aboveTokens = l.aboveTokens === true;
  if (def.sound) out.sound = typeof l.sound === "string" ? l.sound.trim() : "";
  return out;
}

/** A complete, valid effect: {layers: [...]} (may be empty: no effect). */
export function normalizeEffect(cfg) {
  const layers = Array.isArray(cfg?.layers) ? cfg.layers : [];
  return { layers: layers.slice(0, MAX_LAYERS).map(normalizeLayer) };
}

/** The effect a new area starts with. */
export function defaultEffect() {
  return normalizeEffect({ layers: [{ effect: DEFAULT_EFFECT, style: "mist" }] });
}

export function layerLabel(l) {
  const def = EFFECTS[l.effect];
  if (!def) return "?";
  if (l.effect === IMAGE) {
    const file = String(l.src ?? "").split(/[?#]/)[0].split("/").pop();
    if (file) {
      try { return decodeURIComponent(file); } catch (_) { return file; }
    }
  }
  return `${def.label}: ${def.styles[l.style]?.label ?? ""}`;
}

/** Images of your own an effect needs. */
export function customSources(cfg) {
  return [...new Set((cfg?.layers ?? []).filter(l => l.effect === IMAGE && l.src).map(l => l.src))];
}

/** Key of everything in a layer that needs a rebuild. */
export function structuralKey(cfg) {
  return JSON.stringify((cfg?.layers ?? []).map(l => AreaEffect.STRUCTURAL.map(k => l[k] ?? null)));
}

export function createEffect(layer, ctx) {
  const def = EFFECTS[layer.effect] ?? EFFECTS[DEFAULT_EFFECT];
  return new def.cls(layer, ctx, def);
}
