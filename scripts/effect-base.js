/**
 * Dxcufgb's canvas effects - what every effect shares: helpers, runtime textures, the AreaEffect base class.
 * Only needs the global PIXI (v7).
 */

export const BLEND_MODE = () => ({
  normal: PIXI.BLEND_MODES.NORMAL, add: PIXI.BLEND_MODES.ADD,
  screen: PIXI.BLEND_MODES.SCREEN, multiply: PIXI.BLEND_MODES.MULTIPLY
});

/* ======================================================================== */
/*  Small helpers                                                           */
/* ======================================================================== */

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = range => (Array.isArray(range) ? rand(range[0], range[1]) : range);
export const rad = deg => (deg * Math.PI) / 180;

export function hexToNum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ""));
  return m ? parseInt(m[1], 16) : 0xffffff;
}

export function rgbToHsv(n) {
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max ? d / max : 0, max];
}

export function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6];
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

/** Rotate a colour's hue; a grey colour is first given some saturation so the rainbow shows. */
/** Mix two colours (t = 0: a, 1: b). */
export function mixColor(a, b, t) {
  const ch = (n, k) => (n >> k) & 255;
  const m = k => Math.round(ch(a, k) + (ch(b, k) - ch(a, k)) * t);
  return (m(16) << 16) | (m(8) << 8) | m(0);
}

/** A number from 0 to 1 that is the same on every computer for the same inputs. */
export function hash01(a, b = 0) {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be59b, 0xc2b2ae35);
  h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2d); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Light comes from the top left: things high above the ground are drawn shifted that way. */
export const LIGHT_DIR = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };

export function shiftHue(n, turns) {
  const [h, s, v] = rgbToHsv(n);
  return hsvToRgb((h + turns) % 1, Math.max(s, 0.6), Math.max(v, 0.6));
}

/* ======================================================================== */
/*  Textures drawn at runtime                                               */
/* ======================================================================== */

let TEXTURES = null;

export function canvasTexture(size, draw, { repeat = false } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const tex = PIXI.Texture.from(c);
  if (repeat) tex.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
  return tex;
}

/** Tileable fractal noise (white, the noise in the alpha channel). */
function drawNoise(ctx, size, { octaves = 5, base = 4, contrast = 1.6, seed = 1 } = {}) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const grids = [];
  for (let o = 0; o < octaves; o++) {
    const n = base << o;
    grids.push({ n, v: Float32Array.from({ length: n * n }, rnd) });
  }
  const img = ctx.createImageData(size, size);
  const fade = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0, amp = 0.5, total = 0;
      for (const { n, v: g } of grids) {
        const fx = (x / size) * n, fy = (y / size) * n;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fade(fx - x0), ty = fade(fy - y0);
        const x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
        const a = g[y0 * n + x0], b = g[y0 * n + x1], c = g[y1 * n + x0], d = g[y1 * n + x1];
        v += amp * ((a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty);
        total += amp;
        amp *= 0.5;
      }
      v = clamp(((v / total) - 0.5) * contrast + 0.5, 0, 1);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(v * v * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** The textures the built-in effects use (made once, shared by the canvas and the preview). */
export function effectTextures() {
  if (TEXTURES) return TEXTURES;
  TEXTURES = {
    noise: canvasTexture(256, (c, n) => drawNoise(c, n, { seed: 3 }), { repeat: true }),
    noise2: canvasTexture(256, (c, n) => drawNoise(c, n, { seed: 11, base: 2, contrast: 2 }), { repeat: true }),
    dot: canvasTexture(64, (c, n) => {
      const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.8)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, n, n);
    }),
    flake: canvasTexture(32, (c, n) => {
      const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.45, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, n, n);
    }),
    // A raindrop streak: thin, fading in from the top, bright at the bottom (the leading end).
    streak: canvasTexture(64, (c, n) => {
      const g = c.createLinearGradient(0, 0, 0, n);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.75, "rgba(255,255,255,0.7)");
      g.addColorStop(1, "rgba(255,255,255,1)");
      c.fillStyle = g;
      c.fillRect(n / 2 - 3, 0, 6, n);
    }),
    // A splash ring.
    ring: canvasTexture(64, (c, n) => {
      const g = c.createRadialGradient(n / 2, n / 2, n * 0.28, n / 2, n / 2, n / 2);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.6, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, n, n);
    }),
    // A wide, smooth light falloff.
    glow: canvasTexture(128, (c, n) => {
      const img = c.createImageData(n, n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = Math.min(1, Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2));
        const v = (1 - d) * (1 - d) * (1 - d * 0.5);
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(v * 255);
      }
      c.putImageData(img, 0, 0);
    }),
    // A flame tongue seen from above: a soft teardrop pointing along +x.
    flame: canvasTexture(64, (c, n) => {
      const img = c.createImageData(n, n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;     // -1..1
        const w = 0.55 * (1 - (u + 1) / 2) ** 0.7 + 0.05;                  // wide at the back, thin at the tip
        const d = Math.hypot((u + 0.15) / 0.95, v / Math.max(0.05, w));
        const a = Math.max(0, 1 - d) ** 1.4;
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
      c.putImageData(img, 0, 0);
    }),
    bubble: canvasTexture(64, (c, n) => {
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.lineWidth = n * 0.06;
      c.beginPath(); c.arc(n / 2, n / 2, n * 0.42, 0, TAU); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fill();
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath(); c.arc(n * 0.36, n * 0.34, n * 0.07, 0, TAU); c.fill();
    })
  };
  return TEXTURES;
}

/* ======================================================================== */
/*  Base class                                                              */
/* ======================================================================== */

export class AreaEffect extends PIXI.Container {

  /** Layer options that need the effect to be built again when they change (the rest update live). */
  static STRUCTURAL = ["effect", "style", "scale", "density", "src", "fit", "blend", "light"];

  /**
   * @param {object} layer   a normalized layer
   * @param {object} ctx     see the top of effects.js
   * @param {object} def     the effect's entry in EFFECTS
   */
  constructor(layer, ctx, def) {
    super();
    this.layer = layer;
    this.ctx = ctx;
    this.def = def;
    this.styleDef = this.def.styles?.[layer.style] ?? {};
    this.time = Math.random() * 100;
    this.realTime = 0;
    this.tinted = [];
    /** Glows by itself: also drawn into Foundry's lighting, so it stays bright in the dark. */
    this.emissive = (this.styleDef.emissive ?? def?.emissive) === true;
    this.build();
    this.refresh();
  }

  /** The layer's colour as a number. */
  get baseColor() {
    return hexToNum(this.layer.color ?? this.styleDef.color ?? "#ffffff");
  }

  /** The PIXI blend mode chosen for the layer (or the style's default). */
  get blend() {
    const id = this.layer.blend ?? this.styleDef.blend ?? this.def.blend ?? "normal";
    return BLEND_MODE()[id] ?? PIXI.BLEND_MODES.NORMAL;
  }

  /** Let a sprite take the layer's colour and blend mode. */
  tintable(obj) {
    obj.blendMode = this.blend;
    this.tinted.push(obj);
    return obj;
  }

  /** Build the display objects. */
  build() {}

  /**
   * Foundry light sources this layer casts (only used when the layer's "Casts light" is on):
   * [{x, y, bright, dim (pixels), color, alpha, animation, walls, dynamic}]. A `dynamic` light is
   * read every frame (its `alpha`), e.g. a lightning flash.
   */
  lights() {
    return [];
  }

  /** The wind on this layer: a unit direction (layer's direction) times the style's strength times the Wind slider. */
  get wind() {
    const a = rad(this.layer.direction);
    const strength = (this.styleDef.wind ?? 0.5) * (this.layer.wind ?? 1);
    return { x: Math.cos(a), y: Math.sin(a), s: strength };
  }

  /** A colour of the style shifted along the rainbow, like the tinted sprites. */
  hued(n) {
    return this.rainbowTurns ? shiftHue(n, this.rainbowTurns) : n;
  }

  /**
   * Move them.
   * @param {number} dt     seconds since the last frame, times the layer's speed
   * @param {number} time   running time, times the layer's speed
   */
  animate(dt, time) {}

  /** Take over options that don't need a rebuild (colour, opacity, speed, pulse, rainbow, direction). */
  setLayer(layer) {
    this.layer = layer;
    this.refresh();
  }

  refresh() {
    const tint = this.baseColor;
    for (const s of this.tinted) s.tint = tint;
  }

  #rainbow = false;

  update(dt) {
    const l = this.layer;
    this.realTime += dt;
    const step = dt * l.speed;
    this.time += step;
    this.rainbowTurns = l.rainbow > 0 ? (this.realTime * 0.12 * l.rainbow) % 1 : 0;
    this.animate(step, this.time);
    // Pulse: breathe between full and faint, about every 2.5 seconds.
    const pulse = l.pulse ? 1 - l.pulse * 0.5 * (1 - Math.cos(this.realTime * 2.5)) : 1;
    this.alpha = l.alpha * pulse;
    if (l.rainbow > 0) {
      const tint = shiftHue(this.baseColor, this.rainbowTurns);
      for (const s of this.tinted) s.tint = tint;
      this.#rainbow = true;
    } else if (this.#rainbow) {
      this.#rainbow = false;
      this.refresh();
    }
  }
}

