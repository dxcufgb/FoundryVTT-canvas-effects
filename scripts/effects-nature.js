/**
 * Dxcufgb's canvas effects - weather and ambience seen from above:
 * falling things (snow, ash, leaves, petals), clouds, sandstorms, stars and ghosts.
 *
 * Top-down rules used here:
 *  - things falling have a height z (1 = high, 0 = ground) and a shadow on their landing spot;
 *    while high they are drawn bigger and shifted toward the light (top left) and upwind, so they
 *    shrink onto their shadow and land, then settle (melt, fade, skitter along the ground);
 *  - clouds are seen as their shadows sweeping over the ground, with the cloud tops above them
 *    shifted toward the light;
 *  - drifting things move across the ground with the wind, each with its own wobble.
 */

import { AreaEffect, effectTextures, canvasTexture, clamp, rand, pick, hexToNum, LIGHT_DIR, TAU } from "./effect-base.js";

/* ======================================================================== */
/*  Textures                                                                */
/* ======================================================================== */

let TEX = null;
function tex() {
  if (TEX) return TEX;
  TEX = {
    // A leaf seen from above: pointed oval with a midrib, pointing along +x.
    leaf: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2);
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(-n * 0.42, 0);
      c.quadraticCurveTo(-n * 0.1, -n * 0.3, n * 0.42, 0);
      c.quadraticCurveTo(-n * 0.1, n * 0.3, -n * 0.42, 0);
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.35)"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-n * 0.46, 0); c.lineTo(n * 0.36, 0); c.stroke();
    }),
    petal: canvasTexture(32, (c, n) => {
      c.translate(n / 2, n / 2);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, n * 0.45);
      g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0.75)");
      c.fillStyle = g;
      c.beginPath(); c.ellipse(0, 0, n * 0.42, n * 0.26, 0, 0, TAU); c.fill();
      c.globalCompositeOperation = "destination-out";
      c.beginPath(); c.arc(n * 0.48, 0, n * 0.1, 0, TAU); c.fill();
    }),
    ash: canvasTexture(32, (c, n) => {
      c.translate(n / 2, n / 2);
      c.fillStyle = "#ffffff";
      c.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU, r = n * (0.25 + 0.18 * Math.abs(Math.sin(i * 2.3)));
        if (i) c.lineTo(Math.cos(a) * r, Math.sin(a) * r); else c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath(); c.fill();
    }),
    // A ghost seen from above: a soft head trailing into a wispy tail, pointing along +x.
    ghost: canvasTexture(128, (c, n) => {
      const img = c.createImageData(n, n);
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
        const head = Math.max(0, 1 - Math.hypot((u - 0.45) / 0.42, v / 0.42));
        const t = (0.55 - u) / 1.5;                                       // 0 at the head, 1 at the tail end
        const width = 0.36 * (1 - t) + 0.04;
        const wave = 0.12 * Math.sin(t * 9) * t;
        const tail = u < 0.5 && t <= 1 ? Math.max(0, 1 - Math.abs(v - wave) / width) * (1 - t) : 0;
        const a = Math.min(1, head ** 0.7 + tail ** 1.2 * 0.8);
        const i = (y * n + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
      c.putImageData(img, 0, 0);
    })
  };
  return TEX;
}

const palette = st => (st.colors ?? [st.color ?? "#ffffff"]).map(hexToNum);

/* ======================================================================== */
/*  Falling: snow, ash, leaves, petals                                      */
/* ======================================================================== */

export class FallEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef;
    const t = { ...effectTextures(), ...tex() }[st.texture ?? "flake"];
    const n = Math.round(clamp((st.rate ?? 3) * this.layer.density * ctx.squares, 6, 900) * ctx.quality);
    const shadows = this.addChild(new PIXI.Container());
    const items = this.addChild(new PIXI.Container());
    this.colors = palette(st);
    this.parts = [];
    for (let i = 0; i < n; i++) {
      const s = items.addChild(new PIXI.Sprite(t));
      s.anchor.set(0.5);
      s.blendMode = this.blend;
      const sh = shadows.addChild(new PIXI.Sprite(effectTextures().dot));
      sh.anchor.set(0.5);
      sh.tint = 0x000000;
      const p = { s, sh, phase: Math.random() * TAU, spin: rand(-1, 1) };
      this._spawn(p, true);
      this.parts.push(p);
    }
  }

  _spawn(p, first = false) {
    const st = this.styleDef, g = this.ctx.grid;
    const pt = this.ctx.randomPoint();
    p.x = pt.x; p.y = pt.y;
    p.fall = pick(st.fall ?? [3, 6]);
    p.z = first ? Math.random() : 1;
    p.rest = 0;
    p.restFor = pick(st.rest ?? [0.5, 1.5]);
    p.size = (pick(st.size ?? [0.05, 0.1]) * g * this.layer.scale) / p.s.texture.width;
    p.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    p.s.rotation = Math.random() * TAU;
    if (first && Math.random() < 0.15) { p.z = 0; p.rest = Math.random() * p.restFor; }
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid;
    const w = this.wind;
    // While high, a flake is shifted a little toward the light and more upwind, so what falls
    // clearly drifts with the Wind direction. The wind's share grows with its square root, so
    // light snow still shows the direction and a blizzard doesn't start too far off its spot.
    const height = (st.height ?? 0.5) * g;
    const slant = Math.sqrt(Math.min(2, w.s)) * (st.slant ?? 1.4) * g;
    const ox = LIGHT_DIR.x * height - w.x * slant, oy = LIGHT_DIR.y * height - w.y * slant;
    const flutter = (st.flutter ?? 0.25) * g;
    for (const p of this.parts) {
      let a = 1;
      if (p.z > 0) {
        p.z -= dt / p.fall;
        if (p.z < 0) p.z = 0;
      } else {
        // Landed: settle, maybe skitter along with the wind, then melt or fade away.
        p.rest += dt;
        if (st.skitter) { p.x += w.x * w.s * st.skitter * g * dt; p.y += w.y * w.s * st.skitter * g * dt; }
        a = 1 - p.rest / p.restFor;
        if (a <= 0) { this._spawn(p); a = 1; }
      }
      const z = p.z;
      const wob = Math.sin(time * 1.7 + p.phase) * flutter * z, wob2 = Math.cos(time * 1.3 + p.phase) * flutter * z;
      p.s.position.set(p.x + ox * z + wob, p.y + oy * z + wob2);
      const k = p.size * (1 + z * (st.grow ?? 0.9));
      // Leaves and petals tumble: their width flips as they turn over.
      const tumble = st.tumble ? Math.abs(Math.cos(time * st.tumble + p.phase)) * 0.8 + 0.2 : 1;
      p.s.scale.set(k, k * (z > 0 ? tumble : 1));
      if (z > 0) p.s.rotation += p.spin * (st.spin ?? 1) * dt;
      p.s.tint = this.hued(p.color);
      p.s.alpha = a * (st.itemAlpha ?? 1) * (z > 0.92 ? (1 - z) / 0.08 : 1);
      // Shadow on the landing spot: sharper and darker the lower it is.
      p.sh.position.set(p.x + 0.04 * g, p.y + 0.04 * g);
      p.sh.scale.set(p.size * (1.2 + z * 1.5) * (p.s.texture.width / 64));
      p.sh.alpha = (st.shadow ?? 0.3) * (1 - z * 0.8) * a;
    }
  }
}

/* ======================================================================== */
/*  Clouds: shadows sweeping over the ground, tops above them               */
/* ======================================================================== */

export class CloudEffect extends AreaEffect {
  build() {
    const b = this.ctx.bounds, st = this.styleDef, g = this.ctx.grid;
    const t = effectTextures();
    const tile = (g * 7 * this.layer.scale) / 256;
    this.height = (st.height ?? 2) * g;
    const sheet = (texture, scale, tint, alpha, blend) => {
      const s = new PIXI.TilingSprite(texture, b.width, b.height);
      s.position.set(b.x, b.y);
      s.tileScale.set(scale);
      s.tint = hexToNum(tint);
      s.alpha = alpha;
      s.blendMode = blend;
      return this.addChild(s);
    };
    const density = clamp(this.layer.density, 0.1, 3);
    this.shadow = sheet(t.noise2, tile, st.shadowColor ?? "#000000", (st.shadow ?? 0.45) * Math.min(1, density), PIXI.BLEND_MODES.NORMAL);
    this.tops = st.tops ? sheet(t.noise2, tile, st.color ?? "#ffffff", st.tops * Math.min(1, density), PIXI.BLEND_MODES.NORMAL) : null;
    this.offset = { x: Math.random() * 256 * tile, y: Math.random() * 256 * tile };
    this.tile = tile;
  }

  animate(dt) {
    const st = this.styleDef, g = this.ctx.grid;
    const w = this.wind;
    const v = (st.speed ?? 0.5) * Math.max(0.15, w.s) * g * dt;
    this.offset.x += w.x * v;
    this.offset.y += w.y * v;
    this.shadow.tilePosition.set(this.offset.x, this.offset.y);
    // The cloud tops are the same clouds, seen higher up: shifted toward the light.
    if (this.tops) {
      this.tops.tilePosition.set(this.offset.x + LIGHT_DIR.x * this.height, this.offset.y + LIGHT_DIR.y * this.height);
      this.tops.tint = this.hued(hexToNum(st.color ?? "#ffffff"));
    }
  }
}

/* ======================================================================== */
/*  Sandstorm: a streaming haze, gusts and flying grains                    */
/* ======================================================================== */

export class SandstormEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, b = ctx.bounds, st = this.styleDef, g = ctx.grid, t = effectTextures();
    const tile = (g * 5 * this.layer.scale) / 256;
    const haze = (texture, scale, alpha) => {
      const s = this.tintable(new PIXI.TilingSprite(texture, b.width, b.height));
      s.position.set(b.x, b.y);
      s.tileScale.set(scale);
      s.alpha = alpha;
      return this.addChild(s);
    };
    const dens = clamp(this.layer.density, 0.1, 3);
    this.wash = this.tintable(new PIXI.Sprite(PIXI.Texture.WHITE));
    this.wash.position.set(b.x, b.y);
    this.wash.width = b.width; this.wash.height = b.height;
    this.wash.alpha = (st.wash ?? 0.25) * Math.min(1.5, dens);
    this.addChild(this.wash);
    this.sheets = [haze(t.noise2, tile * 1.6, 0.55 * Math.min(1, dens)), haze(t.noise, tile, 0.7 * Math.min(1, dens))];
    // Grains: short streaks blowing along with the wind.
    const n = Math.round(clamp((st.grains ?? 6) * dens * ctx.squares, 10, 900) * ctx.quality);
    this.grains = [];
    for (let i = 0; i < n; i++) {
      const s = new PIXI.Sprite(t.streak);
      s.anchor.set(0.5, 1);
      s.tint = hexToNum(st.grainColor ?? "#ffffff");
      const p = this.ctx.randomPoint();
      this.grains.push({ s, x: p.x, y: p.y, speed: rand(0.7, 1.3), phase: Math.random() * TAU, a: rand(0.3, 0.9) });
      this.addChild(s);
    }
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid, b = this.ctx.rawBounds;
    const w = this.wind;
    const strength = Math.max(0.3, w.s);
    const v = (st.flow ?? 2) * strength * g * dt;
    const [a, c] = this.sheets;
    a.tilePosition.x += w.x * v * 0.6; a.tilePosition.y += w.y * v * 0.6;
    c.tilePosition.x += w.x * v; c.tilePosition.y += w.y * v;
    // Gusts: the haze thickens and thins in waves.
    const gust = 0.75 + 0.25 * Math.sin(time * 0.9) * Math.sin(time * 0.37 + 1);
    c.alpha = 0.85 * Math.min(1, this.layer.density) * gust;
    this.wash.alpha = (st.wash ?? 0.25) * Math.min(1.5, this.layer.density) * (0.8 + 0.2 * gust);
    const rot = Math.atan2(w.y, w.x) - Math.PI / 2 + Math.PI;
    const len = (0.15 + 0.25 * strength) * g * this.layer.scale;
    for (const p of this.grains) {
      p.x += w.x * v * 2.2 * p.speed + Math.sin(time * 3 + p.phase) * g * 0.2 * dt;
      p.y += w.y * v * 2.2 * p.speed + Math.cos(time * 2.6 + p.phase) * g * 0.2 * dt;
      if (p.x < b.x - g) p.x += b.width + 2 * g; else if (p.x > b.x + b.width + g) p.x -= b.width + 2 * g;
      if (p.y < b.y - g) p.y += b.height + 2 * g; else if (p.y > b.y + b.height + g) p.y -= b.height + 2 * g;
      p.s.position.set(p.x, p.y);
      p.s.rotation = rot;
      p.s.scale.set((2.4 * g / 100) / 6, len / 64);
      p.s.alpha = p.a * gust;
    }
  }
}

/* ======================================================================== */
/*  Stars: a twinkling sky, now and then a shooting star                    */
/* ======================================================================== */

export class StarEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid, t = effectTextures();
    const b = ctx.bounds;
    if (st.nebula) {
      const neb = new PIXI.TilingSprite(t.noise2, b.width, b.height);
      neb.position.set(b.x, b.y);
      neb.tileScale.set((g * 8 * this.layer.scale) / 256);
      neb.blendMode = PIXI.BLEND_MODES.ADD;
      neb.tint = hexToNum(st.nebula);
      neb.alpha = 0.35;
      this.nebula = this.addChild(neb);
    }
    const n = Math.round(clamp((st.rate ?? 8) * this.layer.density * ctx.squares, 10, 1200) * ctx.quality);
    const colors = palette(st);
    this.stars = [];
    const lines = st.lines ? this.addChild(new (PIXI.LegacyGraphics ?? PIXI.Graphics)()) : null;
    const layer = this.addChild(new PIXI.Container());
    for (let i = 0; i < n; i++) {
      const s = layer.addChild(new PIXI.Sprite(t.flake));
      s.anchor.set(0.5);
      s.blendMode = PIXI.BLEND_MODES.ADD;
      const p = ctx.randomPoint();
      s.position.set(p.x, p.y);
      const big = Math.random() < 0.08;
      const size = (big ? rand(0.1, 0.18) : rand(0.03, 0.08)) * g * this.layer.scale / s.texture.width;
      s.scale.set(size);
      this.stars.push({ s, x: p.x, y: p.y, size, color: colors[Math.floor(Math.random() * colors.length)], rate: rand(0.5, 3), phase: Math.random() * TAU, base: big ? 1 : rand(0.4, 0.9) });
    }
    // Faint lines between a few close bright stars.
    if (lines) {
      lines.lineStyle({ width: 0.02 * g, color: hexToNum(st.lines), alpha: 0.35 });
      const bright = this.stars.filter(s => s.base === 1);
      for (const a of bright) {
        const near = bright.filter(o => o !== a).sort((p, q) => Math.hypot(p.x - a.x, p.y - a.y) - Math.hypot(q.x - a.x, q.y - a.y))[0];
        if (near && Math.hypot(near.x - a.x, near.y - a.y) < 4 * g) lines.moveTo(a.x, a.y).lineTo(near.x, near.y);
      }
    }
    this.shooter = this.addChild(new PIXI.Sprite(t.streak));
    this.shooter.anchor.set(0.5, 1);
    this.shooter.blendMode = PIXI.BLEND_MODES.ADD;
    this.shooter.visible = false;
    this.nextShot = rand(2, 8);
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid;
    for (const s of this.stars) {
      s.s.alpha = s.base * (0.55 + 0.45 * Math.sin(time * s.rate + s.phase) * Math.sin(time * s.rate * 0.37 + s.phase * 2));
      s.s.tint = this.hued(s.color);
      if (st.drift) { s.x += st.drift * g * dt * 0.1; s.s.x = s.x; }
    }
    if (this.nebula) {
      this.nebula.tilePosition.x += g * 0.05 * dt;
      this.nebula.tint = this.hued(hexToNum(st.nebula));
    }
    // A shooting star now and then: a bright streak racing across.
    this.nextShot -= dt;
    const sh = this.shooter;
    if (this.nextShot <= 0 && !sh.visible && (st.shooting ?? 1) > 0) {
      const b = this.ctx.rawBounds;
      const a = rand(0, TAU);
      sh.visible = true;
      this.shot = { x: b.x + Math.random() * b.width, y: b.y + Math.random() * b.height, vx: Math.cos(a) * 9 * g, vy: Math.sin(a) * 9 * g, age: 0, life: rand(0.5, 0.9) };
    }
    if (sh.visible) {
      const s = this.shot;
      s.age += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      const k = s.age / s.life;
      sh.position.set(s.x, s.y);
      sh.rotation = Math.atan2(s.vy, s.vx) - Math.PI / 2;
      sh.scale.set(0.04 * g / 6, 1.6 * g / 64);
      sh.alpha = Math.sin(Math.PI * Math.min(1, k));
      sh.tint = this.hued(hexToNum(st.color ?? "#ffffff"));
      if (k >= 1) { sh.visible = false; this.nextShot = rand(3, 10) / Math.max(0.2, st.shooting ?? 1); }
    }
  }
}

/* ======================================================================== */
/*  Ghosts: translucent spirits drifting through, fading in and out         */
/* ======================================================================== */

export class GhostEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid;
    const n = Math.round(clamp((st.rate ?? 0.25) * this.layer.density * ctx.squares, 1, 60));
    const t = st.orb ? effectTextures().dot : tex().ghost;
    this.ghosts = [];
    for (let i = 0; i < n; i++) {
      const trail = [];
      for (let j = 0; j < (st.trail ?? 0); j++) {
        const ts = this.addChild(new PIXI.Sprite(effectTextures().dot));
        ts.anchor.set(0.5);
        ts.blendMode = this.blend;
        trail.push(ts);
      }
      const s = this.addChild(new PIXI.Sprite(t));
      s.anchor.set(0.5);
      s.blendMode = this.blend;
      const p = ctx.randomPoint();
      const gh = { s, trail, hist: [], x: p.x, y: p.y, heading: rand(0, TAU), phase: Math.random() * TAU, age: 0, life: rand(st.life?.[0] ?? 6, st.life?.[1] ?? 12) };
      gh.age = Math.random() * gh.life;
      gh.size = (pick(st.size ?? [0.7, 1.1]) * g * this.layer.scale) / t.width;
      this.ghosts.push(gh);
    }
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid, ctx = this.ctx;
    const color = this.hued(hexToNum(st.color ?? "#cfefff"));
    const w = this.wind;
    for (const gh of this.ghosts) {
      gh.age += dt;
      if (gh.age > gh.life) {
        const p = ctx.randomPoint();
        Object.assign(gh, { x: p.x, y: p.y, age: 0, heading: rand(0, TAU), hist: [] });
      }
      // Wander: the heading turns slowly and smoothly; outside the area they turn back.
      gh.heading += Math.sin(time * 0.5 + gh.phase) * 0.9 * dt;
      const inside = ctx.contains(gh.x, gh.y);
      if (!inside) {
        const b = ctx.rawBounds;
        const want = Math.atan2(b.y + b.height / 2 - gh.y, b.x + b.width / 2 - gh.x);
        gh.heading += Math.sin(want - gh.heading) * 2 * dt;
      }
      // They drift with the wind, but not out of the area: outside it they only turn back.
      const speed = (st.speed ?? 0.45) * g;
      const drift = inside ? w.s * g * 0.6 : 0;
      const vx = Math.cos(gh.heading) * speed + w.x * drift, vy = Math.sin(gh.heading) * speed + w.y * drift;
      gh.x += vx * dt; gh.y += vy * dt;
      const k = gh.age / gh.life;
      const fade = Math.min(1, k / 0.2, (1 - k) / 0.25);
      const flick = 0.85 + 0.15 * Math.sin(time * 3 + gh.phase);
      gh.s.position.set(gh.x, gh.y + Math.sin(time * 1.4 + gh.phase) * 0.06 * g);
      gh.s.rotation = Math.atan2(vy, vx);
      const breathe = 1 + 0.06 * Math.sin(time * 2 + gh.phase);
      gh.s.scale.set(gh.size * breathe, gh.size * (1 / breathe));
      gh.s.tint = color;
      gh.s.alpha = (st.ghostAlpha ?? 0.55) * fade * flick;
      // Trail of fading motes behind (wisps).
      if (gh.trail.length) {
        gh.hist.unshift({ x: gh.s.x, y: gh.s.y });
        if (gh.hist.length > gh.trail.length * 3) gh.hist.pop();
        gh.trail.forEach((ts, j) => {
          const h = gh.hist[Math.min(gh.hist.length - 1, (j + 1) * 3)] ?? gh.hist.at(-1);
          ts.position.set(h.x, h.y);
          ts.scale.set(gh.size * (gh.s.texture.width / 64) * (0.7 - j * 0.12));
          ts.tint = color;
          ts.alpha = gh.s.alpha * (0.5 - j * 0.08);
        });
      }
    }
  }
}

