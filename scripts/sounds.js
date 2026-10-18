/**
 * Dxcufgb's canvas effects - the sounds effects can make.
 *
 * A layer can make a sound: one of the built-in sounds offered for its effect, a sound file of your
 * own, or none. Most are loops that play while the area is on the map, louder the closer the area
 * is to what you are looking at, and louder the stronger the layer (its opacity and density).
 * Lightning plays thunder on each strike instead (see LightningEffect in effects-ambience.js).
 * Everything plays on the Ambient channel, so Foundry's Ambient volume slider applies.
 *
 * The built-in sounds are CC0 or public domain; where each comes from is in sounds/CREDITS.md.
 *
 * Layer fields: sound ("" none, a SOUNDS id, or CUSTOM), soundSrc (your own file), soundVolume (0..1).
 */

import { MODULE_ID } from "./constants.js";
import { areaBounds } from "./geometry.js";

/** A sound file of your own. */
export const CUSTOM = "custom";

const dir = `modules/${MODULE_ID}/sounds`;

/**
 * The built-in sounds. `thunder` is a set (a close crack, a rumble or a distant roll, picked by how
 * bright each strike is); `once` sounds play once per lightning strike; the others loop.
 */
export const SOUNDS = {
  thunder:       { label: "DXCFX.Sound.Thunder", set: "thunder", dir: `${dir}/thunder/` },
  thunderclap:   { label: "DXCFX.Sound.Thunderclap", src: `${dir}/thunder/thunderclap.ogg`, once: true },
  hearth:        { label: "DXCFX.Sound.Hearth", src: `${dir}/ambience/hearth.ogg`, gain: 1 },
  "rain-steady": { label: "DXCFX.Sound.RainSteady", src: `${dir}/ambience/rain-steady.ogg`, gain: 0.9 },
  "rain-patter": { label: "DXCFX.Sound.RainPatter", src: `${dir}/ambience/rain-pattering.ogg`, gain: 0.85 },
  "rain-heavy":  { label: "DXCFX.Sound.RainHeavy", src: `${dir}/ambience/rain-heavy.ogg`, gain: 0.9 },
  "rain-thunder": { label: "DXCFX.Sound.RainThunder", src: `${dir}/ambience/rain-thunder.ogg`, gain: 0.9 },
  wind:          { label: "DXCFX.Sound.Wind", src: `${dir}/ambience/wind.ogg`, gain: 0.85 },
  "wind-howl":   { label: "DXCFX.Sound.WindHowl", src: `${dir}/ambience/wind-howl.ogg`, gain: 0.85 },
  birdsong:      { label: "DXCFX.Sound.Birdsong", src: `${dir}/ambience/birdsong.ogg`, gain: 0.8 },
  forest:        { label: "DXCFX.Sound.Forest", src: `${dir}/ambience/forest.ogg`, gain: 0.8 },
  crickets:      { label: "DXCFX.Sound.Crickets", src: `${dir}/ambience/night-crickets.ogg`, gain: 0.8 },
  stream:        { label: "DXCFX.Sound.Stream", src: `${dir}/ambience/stream.ogg`, gain: 0.85 },
  lapping:       { label: "DXCFX.Sound.Lapping", src: `${dir}/ambience/water-lapping.ogg`, gain: 0.85 },
  bubbles:       { label: "DXCFX.Sound.Bubbles", src: `${dir}/ambience/bubbles.ogg`, gain: 0.8 },
  boiling:       { label: "DXCFX.Sound.Boiling", src: `${dir}/ambience/boiling.ogg`, gain: 0.85 },
  "drone-dark":  { label: "DXCFX.Sound.DroneDark", src: `${dir}/ambience/drone-dark.ogg`, gain: 0.8 },
  "drone-low":   { label: "DXCFX.Sound.DroneLow", src: `${dir}/ambience/drone-low.ogg`, gain: 0.8 },
  cave:          { label: "DXCFX.Sound.Cave", src: `${dir}/ambience/cave.ogg`, gain: 0.85 },
  dungeon:       { label: "DXCFX.Sound.Dungeon", src: `${dir}/ambience/dungeon.ogg`, gain: 0.85 },
  whispers:      { label: "DXCFX.Sound.Whispers", src: `${dir}/ambience/whispers.ogg`, gain: 0.75 },
  arcane:        { label: "DXCFX.Sound.Arcane", src: `${dir}/ambience/arcane-sweep.ogg`, gain: 0.7 },
  "arcane-hum":  { label: "DXCFX.Sound.ArcaneHum", src: `${dir}/ambience/arcane-hum.ogg`, gain: 0.6 },
  static:        { label: "DXCFX.Sound.Static", src: `${dir}/ambience/static.ogg`, gain: 0.7 },
  projector:     { label: "DXCFX.Sound.Projector", src: `${dir}/ambience/projector.ogg`, gain: 0.6 },
  bats:          { label: "DXCFX.Sound.Bats", src: `${dir}/ambience/bats.ogg`, gain: 0.9 },
  rats:          { label: "DXCFX.Sound.Rats", src: `${dir}/ambience/rats.ogg`, gain: 1 },
  spiders:       { label: "DXCFX.Sound.Spiders", src: `${dir}/ambience/spiders.ogg`, gain: 1 },
  "morning-birds": { label: "DXCFX.Sound.MorningBirds", src: `${dir}/ambience/morning-birds.ogg`, gain: 0.8 },
  "birds-chirp": { label: "DXCFX.Sound.BirdsChirp", src: `${dir}/ambience/birds-chirp.ogg`, gain: 0.8 },
  seagulls: { label: "DXCFX.Sound.Seagulls", src: `${dir}/ambience/seagulls.ogg`, gain: 0.9 },
  shore: { label: "DXCFX.Sound.Shore", src: `${dir}/ambience/shore.ogg`, gain: 0.85 },
  river: { label: "DXCFX.Sound.River", src: `${dir}/ambience/river.ogg`, gain: 0.85 },
  breeze: { label: "DXCFX.Sound.Breeze", src: `${dir}/ambience/breeze.ogg`, gain: 0.85 },
  "eerie-wind": { label: "DXCFX.Sound.EerieWind", src: `${dir}/ambience/eerie-wind.ogg`, gain: 0.75 },
  "rain-roof": { label: "DXCFX.Sound.RainRoof", src: `${dir}/ambience/rain-roof.ogg`, gain: 0.9 },
  "rain-forest": { label: "DXCFX.Sound.RainForest", src: `${dir}/ambience/rain-forest.ogg`, gain: 0.9 },
  "rain-storm": { label: "DXCFX.Sound.RainStorm", src: `${dir}/ambience/rain-storm.ogg`, gain: 0.9 },
  fireplace: { label: "DXCFX.Sound.Fireplace", src: `${dir}/ambience/fireplace.ogg`, gain: 1 },
  swamp: { label: "DXCFX.Sound.Swamp", src: `${dir}/ambience/swamp.ogg`, gain: 0.85 },
  frogs: { label: "DXCFX.Sound.Frogs", src: `${dir}/ambience/frogs.ogg`, gain: 0.9 },
  flies: { label: "DXCFX.Sound.Flies", src: `${dir}/ambience/flies.ogg`, gain: 0.8 },
  owls: { label: "DXCFX.Sound.Owls", src: `${dir}/ambience/owls.ogg`, gain: 0.9 },
  wolf: { label: "DXCFX.Sound.Wolf", src: `${dir}/ambience/wolf.ogg`, gain: 0.9 },
  "ice-creak": { label: "DXCFX.Sound.IceCreak", src: `${dir}/ambience/ice-creak.ogg`, gain: 0.85 },
  "singing-ice": { label: "DXCFX.Sound.SingingIce", src: `${dir}/ambience/singing-ice.ogg`, gain: 0.8 },
  horror: { label: "DXCFX.Sound.Horror", src: `${dir}/ambience/horror.ogg`, gain: 0.7 },
  drips: { label: "DXCFX.Sound.Drips", src: `${dir}/ambience/drips.ogg`, gain: 1 },
  "deep-rumble": { label: "DXCFX.Sound.DeepRumble", src: `${dir}/ambience/deep-rumble.ogg`, gain: 0.8 },
  "creaking-trees": { label: "DXCFX.Sound.CreakingTrees", src: `${dir}/ambience/creaking-trees.ogg`, gain: 0.9 },
  "desert-night": { label: "DXCFX.Sound.DesertNight", src: `${dir}/ambience/desert-night.ogg`, gain: 0.85 }
};

/**
 * The sounds offered for each effect, best first. `standard` is the one a new layer gets (when the
 * "Standard sounds" setting is on), at `volume`. Effects not listed only offer a file of your own.
 */
export const EFFECT_SOUNDS = {
  lightning:  { options: ["thunder", "thunderclap"], standard: "thunder" },
  rain:       { options: ["rain-steady", "rain-patter", "rain-heavy", "rain-thunder", "rain-storm", "rain-roof", "rain-forest"], standard: "rain-steady" },
  snow:       { options: ["wind", "wind-howl", "breeze", "ice-creak", "singing-ice", "wolf"], standard: "wind", volume: 0.4 },
  sandstorm:  { options: ["wind", "wind-howl", "desert-night"], standard: "wind" },
  clouds:     { options: ["wind", "wind-howl", "breeze"], standard: null },
  fog:        { options: ["drone-dark", "drone-low", "cave", "whispers", "horror", "swamp", "eerie-wind", "wolf", "wind"], standard: null },
  fire:       { options: ["hearth", "fireplace"], standard: "hearth" },
  candles:    { options: ["hearth", "fireplace"], standard: null, volume: 0.3 },
  embers:     { options: ["hearth", "fireplace"], standard: null, volume: 0.4 },
  glow:       { options: ["hearth", "drone-low", "arcane-hum"], standard: null, volume: 0.5 },
  leaves:     { options: ["wind", "breeze", "forest", "birdsong", "creaking-trees", "rain-forest"], standard: null, volume: 0.5 },
  stars:      { options: ["crickets", "owls", "wolf", "desert-night"], standard: null },
  fireflies:  { options: ["crickets", "owls", "forest"], standard: "crickets", volume: 0.6 },
  ghosts:     { options: ["whispers", "horror", "drone-dark", "drone-low", "arcane"], standard: "whispers", volume: 0.6 },
  birds:      { options: ["birdsong", "morning-birds", "birds-chirp", "seagulls", "forest"], standard: "birdsong" },
  bats:       { options: ["bats", "cave", "drips", "owls", "drone-low"], standard: "bats", volume: 0.6 },
  rats:       { options: ["rats", "dungeon", "cave", "drips", "flies"], standard: null, volume: 0.6 },
  spiders:    { options: ["spiders", "cave", "dungeon", "drips"], standard: null, volume: 0.6 },
  fish:       { options: ["stream", "river", "lapping", "shore", "bubbles", "frogs"], standard: null },
  water:      { options: ["stream", "river", "lapping", "shore", "seagulls", "frogs", "swamp", "bubbles"], standard: "lapping" },
  underwater: { options: ["bubbles", "drips", "drone-low"], standard: "bubbles", volume: 0.6 },
  oldfilm:    { options: ["projector"], standard: null, volume: 0.4 },
  sunlight:   { options: ["morning-birds", "birds-chirp", "breeze"], standard: null, volume: 0.5 },
  lava:       { options: ["boiling", "bubbles", "deep-rumble", "hearth"], standard: "boiling" },
  vortex:     { options: ["arcane-hum", "arcane", "eerie-wind", "horror", "deep-rumble", "drone-dark", "lapping"], standard: "arcane-hum", volume: 0.6 },
  glitch:     { options: ["static"], standard: null, volume: 0.5 },
  haze:       { options: ["wind", "breeze", "eerie-wind", "drone-low"], standard: null }
};

const DEFAULT_VOLUME = 0.8;

/** The built-in sounds a layer of this effect can choose. */
export function soundOptions(effect) {
  return (EFFECT_SOUNDS[effect]?.options ?? []).filter(id => SOUNDS[id]);
}

/** Thunder (one sound per strike) or a loop. */
export function isStrikeSound(effect) {
  return effect === "lightning";
}

/** Sound fields of a normalized layer. A sound the effect doesn't offer is dropped. */
export function normalizeSound(l, effect) {
  let sound = typeof l.sound === "string" ? l.sound.trim() : "";
  let soundSrc = typeof l.soundSrc === "string" ? l.soundSrc.trim() : "";
  // Older layers kept the path of their own file in `sound`.
  if (sound && sound !== CUSTOM && !SOUNDS[sound] && /[./]/.test(sound)) { soundSrc = sound; sound = CUSTOM; }
  if (sound !== CUSTOM && !soundOptions(effect).includes(sound)) sound = "";
  const v = Number(l.soundVolume);
  const soundVolume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : (EFFECT_SOUNDS[effect]?.volume ?? DEFAULT_VOLUME);
  return { sound, soundSrc, soundVolume };
}

/** Give a new layer its effect's standard sound (or none), at the standard volume. Returns the layer. */
export function withStandardSound(layer, on = true) {
  const s = EFFECT_SOUNDS[layer.effect];
  layer.sound = on && s?.standard && SOUNDS[s.standard] ? s.standard : "";
  layer.soundVolume = s?.volume ?? DEFAULT_VOLUME;
  return layer;
}

/** Whether new layers get their standard sound (world setting). */
export function standardSoundsOn() {
  try { return game.settings.get(MODULE_ID, "standardSounds") !== false; } catch (_) { return true; }
}

/** The file a layer loops, with its built-in loudness, or null. */
function loopOf(layer) {
  if (!layer.sound || isStrikeSound(layer.effect)) return null;
  if (layer.sound === CUSTOM) return layer.soundSrc ? { src: layer.soundSrc, gain: 1 } : null;
  const s = SOUNDS[layer.sound];
  return s?.src && !s.once && !s.set ? { src: s.src, gain: s.gain ?? 1 } : null;
}

/** How strong a layer looks, for its loudness: opacity, and density where the effect has it. */
function strength(layer) {
  const density = Number.isFinite(layer.density) ? Math.min(1.3, 0.55 + 0.45 * layer.density) : 1;
  return (layer.alpha ?? 1) * density;
}

/* -------------------------------------------- */
/*  Playback                                    */
/* -------------------------------------------- */

const loops = new Map();   // src -> {sound: Promise<Sound|null>, volume, target}
let sources = [];          // [{src, level, bounds}] from the shown areas
let lastTick = -Infinity;

/** Play the loops of these areas ([{area, faded}]); stop the ones no area needs any more. */
export function syncSounds(list) {
  sources = [];
  for (const { area, faded } of list) {
    const bounds = areaBounds(area.shapes);
    if (!bounds) continue;
    for (const layer of area.effect?.layers ?? []) {
      const loop = loopOf(layer);
      if (!loop) continue;
      const level = loop.gain * layer.soundVolume * strength(layer) * (faded ? 0.5 : 1);
      if (level > 0.001) sources.push({ src: loop.src, level, bounds });
    }
  }
  const wanted = new Set(sources.map(s => s.src));
  for (const src of wanted) if (!loops.has(src)) loops.set(src, { sound: start(src), volume: 0, target: 0 });
  for (const [src, l] of loops) if (!wanted.has(src)) stop(src, l);
  lastTick = -Infinity;
  tickSounds();
}

export function stopSounds() {
  sources = [];
  for (const [src, l] of loops) stop(src, l);
}

async function start(src) {
  try {
    await game.audio.unlock;
    return await game.audio.play(src, { context: game.audio.environment, loop: true, volume: 0 });
  } catch (err) {
    console.warn(`${MODULE_ID} | could not play ${src}`, err);
    return null;
  }
}

function stop(src, l) {
  loops.delete(src);
  l.sound.then(sound => {
    if (!sound) return;
    sound.fade(0, { duration: 600 }).then(() => sound.stop()).catch(() => sound.stop());
  });
}

/** How much of an area's sound reaches the camera: all of it on screen, fading out over a screen beyond. */
function nearness(b) {
  const stage = canvas?.stage;
  if (!stage) return 0;
  const zoom = stage.scale.x || 1;
  const [w, h] = canvas.screenDimensions ?? [window.innerWidth, window.innerHeight];
  const hw = w / 2 / zoom, hh = h / 2 / zoom;
  const cx = stage.pivot.x, cy = stage.pivot.y;
  const dx = Math.max(0, Math.abs(cx - (b.x + b.width / 2)) - (b.width / 2 + hw));
  const dy = Math.max(0, Math.abs(cy - (b.y + b.height / 2)) - (b.height / 2 + hh));
  const t = Math.max(0, 1 - Math.hypot(dx, dy) / Math.max(hw, hh));
  // Zoomed far out the whole map is "near": keep a little distance by the zoom too.
  return t * t * Math.min(1, 0.55 + 0.45 * zoom);
}

/** Every few frames: follow the camera. Several areas with the same sound play it once, louder. */
export function tickSounds() {
  const now = performance.now();
  if (now - lastTick < 250) return;
  lastTick = now;
  const quiet = new Map();
  for (const s of sources) {
    const v = Math.min(1, s.level * nearness(s.bounds));
    quiet.set(s.src, (quiet.get(s.src) ?? 1) * (1 - v));
  }
  for (const [src, l] of loops) {
    const target = 1 - (quiet.get(src) ?? 1);
    if (Math.abs(target - l.target) < 0.01) continue;
    l.target = target;
    l.sound.then(sound => {
      if (sound && loops.get(src) === l) sound.fade(target, { duration: 300 });
    });
  }
}

/** Play a sound once (thunder), after a delay. */
export function playOnce(src, delay = 0, volume = 1) {
  if (!src) return;
  setTimeout(async () => {
    try {
      await game.audio.unlock;
      await game.audio.play(src, { context: game.audio.environment, volume, loop: false });
    } catch (err) {
      console.warn(`${MODULE_ID} | could not play ${src}`, err);
    }
  }, delay);
}
