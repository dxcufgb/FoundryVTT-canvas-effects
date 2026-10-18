/**
 * Dxcufgb's canvas effects - filters and surfaces: shader effects that work on the map itself.
 *
 * Each effect is one quad with a fragment shader over the painted area. Effects marked `backdrop`
 * read the scene's background image under the area (ctx.backdrop) and draw it again changed:
 * graded, warped (underwater, heat haze, vortex), flowing (lava, rivers), glitched, aged.
 * Those are drawn just above the map and below tiles (AreaMesh "under"), so tiles stay on top.
 * Bloom and sunlight only add light and are drawn with the other effects.
 *
 * The noise in the shaders is anchored to the scene (vWorld), so it doesn't swim when you pan.
 */

import { AreaEffect, hexToNum, clamp } from "./effect-base.js";

const VERT = `
precision highp float;
attribute vec2 aVertexPosition;
attribute vec2 aUV;
uniform mat3 projectionMatrix;
uniform mat3 translationMatrix;
uniform vec4 uBounds;
varying vec2 vUV;
varying vec2 vWorld;
varying vec2 vLocal;
void main() {
  vUV = aUV;
  vWorld = aVertexPosition;
  vLocal = (aVertexPosition - uBounds.xy) / uBounds.zw;
  gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);
}`;

const COMMON = `
precision highp float;
varying vec2 vUV;
varying vec2 vWorld;
varying vec2 vLocal;
uniform sampler2D uBackdrop;
uniform float uHas;
uniform vec2 uUVPerPx;
uniform vec4 uClamp;
uniform vec4 uBounds;
uniform float uTime;
uniform float uGrid;
uniform float uAlpha;
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uWind;
uniform vec4 uP;
uniform vec4 uQ;
const float PI = 3.14159265;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
// The map under this point, shifted by a number of scene pixels.
vec4 bd(vec2 offPx) {
  vec2 uv = clamp(vUV + offPx * uUVPerPx, uClamp.xy, uClamp.zw);
  return texture2D(uBackdrop, uv) * uHas;
}
// The map sliding along dirPx: two phases blended, so it moves on forever without jumping back.
vec3 flowed(vec2 offPx, vec2 dirPx, float speed) {
  float p1 = fract(uTime * speed), p2 = fract(uTime * speed + 0.5);
  vec3 a = bd(offPx - dirPx * (p1 - 0.5)).rgb;
  vec3 b = bd(offPx - dirPx * (p2 - 0.5)).rgb;
  float wa = 1.0 - abs(2.0 * p1 - 1.0);
  return mix(b, a, wa);
}
vec4 effect();
void main() { gl_FragColor = effect(); }
`;

/** The fragment shaders. Each returns a premultiplied colour; uP/uQ are the style's numbers. */
const GLSL = {
  // uP: saturation, contrast, brightness, tint amount (by brightness)
  grade: `
vec4 effect() {
  vec3 c = bd(vec2(0.0)).rgb;
  float l = lum(c);
  c = mix(vec3(l), c, uP.x);
  c = (c - 0.5) * uP.y + 0.5;
  c *= uP.z;
  c = mix(c, l * uColor * 1.6, uP.w);
  return vec4(clamp(c, 0.0, 1.0), 1.0) * uAlpha;
}`,
  // uP: radius (squares), threshold, strength, shimmer speed
  bloom: `
vec4 effect() {
  vec3 acc = vec3(0.0);
  float r = uP.x * uGrid;
  for (int i = 0; i < 12; i++) {
    float a = float(i) / 12.0 * 6.2831853;
    float rr = (mod(float(i), 2.0) < 0.5 ? 0.45 : 1.0) * r;
    vec3 s = bd(vec2(cos(a), sin(a)) * rr).rgb;
    acc += s * max(0.0, lum(s) - uP.y) / (1.0 - uP.y);
  }
  vec3 c0 = bd(vec2(0.0)).rgb;
  acc = (acc / 12.0 + c0 * max(0.0, lum(c0) - uP.y) * 0.5) * uColor * uP.z;
  acc *= 0.85 + 0.15 * sin(uTime * uP.w + fbm(vWorld / uGrid) * 6.0);
  return vec4(acc * uAlpha, 0.0);
}`,
  // uP: wobble, depth tint, caustic scale, caustic strength
  underwater: `
// Caustics: thin bright ridges where two drifting noise fields cross.
float caustic(vec2 p) {
  float t = uTime * 0.35;
  float a = noise(p + vec2(t, t * 0.7));
  float b = noise(p * 1.35 - vec2(t * 0.8, -t * 0.6) + 7.0);
  return pow(1.0 - abs(a - b), 26.0);
}
vec4 effect() {
  vec2 p = vWorld / uGrid; float t = uTime;
  vec2 off = vec2(sin(p.y * 1.7 + t * 1.3) + sin(p.x * 0.9 + t * 0.7), cos(p.x * 1.5 + t * 1.1) + cos(p.y * 1.1 - t * 0.8)) * uP.x * uGrid * 0.04;
  vec3 c = bd(off).rgb;
  c = mix(c, c * uColor * 1.4, uP.y);
  c = mix(c, uColor * 0.3, uP.y * 0.35);
  c += uColor2 * caustic(p * uP.z * 1.6 + 23.0) * uP.w;
  return vec4(clamp(c, 0.0, 1.0), 1.0) * uAlpha;
}`,
  // uP: saturation, sepia, grain, vignette
  oldfilm: `
vec4 effect() {
  float t = uTime;
  vec2 jit = vec2(0.0, (hash(vec2(floor(t * 12.0), 4.0)) - 0.5) * uGrid * 0.03);
  vec3 c = bd(jit).rgb;
  float l = lum(c);
  c = mix(vec3(l), c, uP.x);
  c = mix(c, l * uColor * 1.45, uP.y);
  c *= 0.9 + 0.1 * hash(vec2(floor(t * 18.0), 1.0));
  c += (hash(floor(vWorld / (uGrid * 0.025)) + floor(t * 24.0) * 3.1) - 0.5) * uP.z;
  float seg = floor(t * 3.0);
  for (int k = 0; k < 2; k++) {
    float sx = hash(vec2(seg, 3.0 + float(k)));
    float on = step(0.45, hash(vec2(seg, 7.0 + float(k))));
    c = mix(c, vec3(0.92), smoothstep(0.0025, 0.0, abs(vLocal.x - sx - sin(vLocal.y * 9.0 + seg) * 0.003)) * on * 0.6);
  }
  float d = step(0.9988, hash(floor(vWorld / (uGrid * 0.05)) + floor(t * 10.0) * 1.7));
  c = mix(c, vec3(0.05), d * 0.8);
  vec2 q = vLocal - 0.5;
  c *= 1.0 - dot(q, q) * uP.w * 2.2;
  return vec4(clamp(c, 0.0, 1.0), 1.0) * uAlpha;
}`,
  // uP: ray scale, warm wash, strength, mode (0 rays, 1 dappled, 2 a column from above)
  sunlight: `
vec4 effect() {
  vec2 p = vWorld / uGrid; float t = uTime;
  float m;
  if (uP.w < 0.5) {
    float s = dot(p, vec2(-0.7071, 0.7071));
    float along = dot(p, vec2(0.7071, 0.7071));
    m = pow(fbm(vec2(s * uP.x, t * 0.05)), 2.2) * 2.4;
    m *= 0.7 + 0.3 * noise(vec2(along * 0.15, t * 0.1));
  } else if (uP.w < 1.5) {
    vec2 sway = vec2(sin(t * 0.6), cos(t * 0.45)) * 0.3;
    float n = fbm(p * uP.x + sway + t * 0.03);
    m = smoothstep(0.5, 0.72, n) * 1.4;
  } else {
    vec2 q = vLocal - 0.5;
    float r = length(q * vec2(1.0, uBounds.w / uBounds.z)) * 2.0;
    float a = atan(q.y, q.x);
    m = smoothstep(1.0, 0.0, r) * (0.75 + 0.25 * fbm(vec2(a * 3.0 + t * 0.2, r * 2.0 - t * 0.3)));
  }
  vec3 c = uColor * (m * uP.z + uP.y);
  return vec4(c * uAlpha, 0.0);
}`,
  // uP: burst rate, slice shift (squares), colour split (squares), tint
  glitch: `
vec4 effect() {
  float t = uTime;
  float burst = step(0.7, hash(vec2(floor(t * uP.x), 5.0)));
  float row = floor(vLocal.y * 28.0);
  float sh = (hash(vec2(row, floor(t * 14.0))) - 0.5) * burst * uP.y * uGrid;
  vec2 o = vec2(sh, 0.0);
  float split = uP.z * uGrid * (0.25 + burst);
  float r = bd(o + vec2(split, 0.0)).r, g = bd(o).g, b = bd(o - vec2(split, 0.0)).b;
  vec3 c = vec3(r, g, b);
  c *= 0.9 + 0.1 * sin(vWorld.y * PI / (uGrid * 0.05));
  float blk = step(0.988, hash(floor(vWorld / (uGrid * 0.4)) + floor(t * 9.0))) * burst;
  c = mix(c, uColor, blk * 0.8);
  c = mix(c, c * uColor * 1.4, uP.w);
  return vec4(clamp(c, 0.0, 1.0), 1.0) * uAlpha;
}`,
  // uP: flow distance (squares), churn, glow, crust;  uQ.x flow speed
  lava: `
vec4 effect() {
  vec2 p = vWorld / uGrid; float t = uTime;
  vec2 warp = (vec2(fbm(p * 0.7 + t * 0.06), fbm(p * 0.7 + 4.0 - t * 0.05)) - 0.5) * uP.y * uGrid;
  vec2 dir = uWind.xy * uP.x * uGrid;
  vec3 c = flowed(warp, dir, uQ.x);
  float heat = clamp(lum(c) * 1.1 + (c.r - c.b) * 0.7 - 0.25, 0.0, 1.0);
  float n = fbm(p * 1.3 - uWind.xy * t * uQ.x * uP.x - t * 0.15);
  float pulse = 0.5 + 0.5 * sin(t * 1.4 + n * 6.2831);
  c += uColor * pow(heat, 1.6) * (0.2 + 0.6 * n * pulse) * uP.z;
  float crust = smoothstep(0.58, 0.78, fbm(p * 1.6 - uWind.xy * t * uQ.x * uP.x * 0.8 + 10.0));
  c = mix(c, c * vec3(0.3, 0.22, 0.2), crust * uP.w * heat);
  return vec4(clamp(c, 0.0, 1.0), 1.0) * uAlpha;
}`,
  // uP: ripple, flow distance (squares), vividness, glints;  uQ.x flow speed, uQ.y swell
  water: `
vec4 effect() {
  vec2 p = vWorld / uGrid; float t = uTime;
  // Ripples, glints and swell are laid out along the Wind direction (fw) and across it (fs), so
  // still water turns with the direction too. At direction 0, q is simply p.
  vec2 fw = uWind.xy, fs = vec2(-fw.y, fw.x);
  vec2 q = vec2(dot(p, fw), dot(p, fs));
  vec2 w1 = vec2(sin(q.x * 2.1 + t * 1.2 + sin(q.y * 1.3)), cos(q.y * 1.9 + t * 0.9 + sin(q.x * 1.7)));
  vec2 w2 = vec2(sin(q.y * 0.6 + t * 0.5), cos(q.x * 0.5 + t * 0.4)) * uQ.y;
  vec2 o = (w1 * 0.03 + w2 * 0.08) * uP.x * uGrid;
  vec2 off = fw * o.x + fs * o.y;
  vec3 c = uQ.x > 0.0 ? flowed(off, uWind.xy * uP.y * uGrid, uQ.x) : bd(off).rgb;
  float l = lum(c);
  c = clamp(mix(vec3(l), c, 1.0 + uP.z), 0.0, 1.0);
  c *= 0.95 + 0.1 * (w1.x * 0.5 + 0.5) * uP.x;
  vec2 drift = vec2(t * uQ.x * 2.0, 0.0);
  float g = noise(q * 5.0 + vec2(t * 0.7, -t * 0.5) - drift) * noise(q * 4.3 - vec2(t * 0.4, t * 0.8) - drift);
  c += uColor * smoothstep(0.55, 0.8, g) * uP.w;
  if (uQ.y > 0.5) c += uColor2 * smoothstep(0.82, 0.95, sin(q.x * 0.8 + q.y * 0.6 - t * 1.1 + fbm(p) * 3.0)) * 0.25;
  return vec4(c, 1.0) * uAlpha;
}`,
  // uP: strength, speed, brighten, scale
  haze: `
vec4 effect() {
  vec2 p = vWorld / uGrid; float t = uTime * uP.y;
  vec2 off = (vec2(noise(p * uP.w + vec2(0.0, t)), noise(p * uP.w + vec2(5.2, t * 1.3))) - 0.5) * uP.x * uGrid * 0.12;
  vec3 c = bd(off).rgb;
  c += uColor * uP.z * (noise(p * 0.7 + t * 0.2) - 0.3);
  return vec4(clamp(c, 0.0, 1.0), 1.0) * uAlpha;
}`,
  // uP: twist, speed, dark centre, rim glow
  vortex: `
vec4 effect() {
  vec2 q = (vLocal - 0.5) * uBounds.zw;
  float R = min(uBounds.z, uBounds.w) * 0.5;
  float r = length(q) / R;
  if (r > 1.0) return vec4(0.0);
  float fall = pow(1.0 - r, 1.6);
  float p1 = fract(uTime * uP.y), p2 = fract(uTime * uP.y + 0.5);
  float tw = uP.x * fall;
  vec2 a = rot(tw + p1 * 1.2 * fall) * q - q;
  vec2 b = rot(tw + p2 * 1.2 * fall) * q - q;
  float wa = 1.0 - abs(2.0 * p1 - 1.0);
  vec3 c = mix(bd(b).rgb, bd(a).rgb, wa);
  c = mix(c, uColor2, smoothstep(0.45, 0.0, r) * uP.z);
  c += uColor * smoothstep(0.25, 0.0, abs(r - 0.78)) * uP.w * (0.7 + 0.3 * sin(uTime * 3.0 + atan(q.y, q.x) * 5.0));
  float edge = smoothstep(1.0, 0.8, r);
  return vec4(c, 1.0) * edge * uAlpha;
}`
};

const PROGRAMS = new Map();
function program(id) {
  if (!PROGRAMS.has(id)) PROGRAMS.set(id, PIXI.Program.from(VERT, COMMON + GLSL[id], `dxcfx-${id}`));
  return PROGRAMS.get(id);
}

const rgb = n => new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
const vec4 = (a, d) => new Float32Array([0, 1, 2, 3].map(i => a?.[i] ?? d[i]));

export class ShaderEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, b = ctx.bounds, st = this.styleDef, def = this.def;
    const bd = ctx.backdrop ?? null;
    if (def.backdrop && !bd?.texture?.valid) return;      // no map image: nothing to change
    // Where the area's corners are in the map image.
    let uv = [0, 0, 0, 0, 0, 0, 0, 0], perPx = [0, 0], clampUV = [0, 0, 1, 1];
    let texture = PIXI.Texture.WHITE;
    if (bd?.texture?.valid) {
      texture = bd.texture;
      const base = texture.baseTexture, f = texture.frame, r = bd.rect;
      const U = x => (f.x + ((x - r.x) / r.width) * f.width) / base.width;
      const V = y => (f.y + ((y - r.y) / r.height) * f.height) / base.height;
      uv = [U(b.x), V(b.y), U(b.x + b.width), V(b.y), U(b.x + b.width), V(b.y + b.height), U(b.x), V(b.y + b.height)];
      perPx = [f.width / r.width / base.width, f.height / r.height / base.height];
      const px = 0.5 / base.width, py = 0.5 / base.height;
      clampUV = [f.x / base.width + px, f.y / base.height + py, (f.x + f.width) / base.width - px, (f.y + f.height) / base.height - py];
    }
    const x0 = b.x, y0 = b.y, x1 = b.x + b.width, y1 = b.y + b.height;
    const geometry = new PIXI.Geometry()
      .addAttribute("aVertexPosition", [x0, y0, x1, y0, x1, y1, x0, y1], 2)
      .addAttribute("aUV", uv, 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
    this.uniforms = {
      uBackdrop: texture, uHas: bd?.texture?.valid ? 1 : 0,
      uUVPerPx: new Float32Array(perPx), uClamp: new Float32Array(clampUV),
      uBounds: new Float32Array([b.x, b.y, b.width, b.height]),
      uTime: 0, uGrid: ctx.grid, uAlpha: 1,
      uColor: rgb(this.baseColor), uColor2: rgb(hexToNum(st.color2 ?? "#000000")),
      uWind: new Float32Array([1, 0, 0]),
      uP: vec4(st.p, [1, 1, 1, 0]), uQ: vec4(st.q, [0, 0, 0, 0])
    };
    this.applyScale();
    const shader = new PIXI.Shader(program(def.glsl), this.uniforms);
    this.mesh = this.addChild(new PIXI.Mesh(geometry, shader));
    this.mesh.blendMode = this.blend;
  }

  /** The Size slider scales the effect's patterns (where a style has a size-like number). */
  applyScale() {
    const st = this.styleDef, k = this.layer.scale, d = this.layer.density;
    const p = vec4(st.p, [1, 1, 1, 0]);
    for (const i of st.scaleP ?? []) p[i] *= k;
    for (const i of st.densityP ?? []) p[i] *= d;
    this.uniforms.uP = p;
  }

  animate(dt, time) {
    if (!this.mesh) return;
    const u = this.mesh.shader.uniforms;
    const w = this.wind;
    u.uTime = time;
    u.uAlpha = clamp(this.worldAlpha, 0, 1);
    u.uColor = rgb(this.hued(this.baseColor));
    u.uWind = new Float32Array([w.x, w.y, w.s]);
  }

  lights() {
    const st = this.styleDef;
    if (!st.light) return [];
    const b = this.ctx.rawBounds, g = this.ctx.grid;
    const r = Math.max(b.width, b.height) / 2;
    return [{
      x: b.x + b.width / 2, y: b.y + b.height / 2, bright: r * 0.6, dim: r + st.light * g,
      color: this.baseColor, alpha: 0.5, animation: st.anim ? { type: st.anim, speed: 2, intensity: 3 } : {}, walls: true
    }];
  }
}

export const SHADERS = Object.keys(GLSL);
