/**
 * Dxcufgb's canvas effects - the basic effects: colour wash, fog, particles, your own image.
 */

import { AreaEffect, effectTextures, clamp, rand, pick, rad, hexToNum, TAU } from "./effect-base.js";

/** An even wash of colour over the whole area. */
export class ColorEffect extends AreaEffect {
  build() {
    const b = this.ctx.bounds;
    const s = this.tintable(new PIXI.Sprite(PIXI.Texture.WHITE));
    s.position.set(b.x, b.y);
    s.width = b.width;
    s.height = b.height;
    s.alpha = this.styleDef.alpha ?? 0.5;
    this.addChild(s);
  }
}

/** Two sheets of noise drifting through each other: fog, smoke, gas. */
export class FogEffect extends AreaEffect {
  build() {
    const b = this.ctx.bounds;
    const tex = effectTextures();
    const st = this.styleDef;
    const tile = (this.ctx.grid * 4 * this.layer.scale) / 256;      // one noise tile spans 4 squares
    const strength = clamp((st.alpha ?? 0.7) * this.layer.density, 0, 1);
    const sheet = (t, scale, alpha) => {
      const s = this.tintable(new PIXI.TilingSprite(t, b.width, b.height));
      s.position.set(b.x, b.y);
      s.tileScale.set(scale);
      s.tilePosition.set(Math.random() * 256 * scale, Math.random() * 256 * scale);
      s.alpha = alpha;
      return this.addChild(s);
    };
    this.sheets = [
      sheet(tex.noise2, tile * 1.8, strength * 0.7),
      sheet(tex.noise, tile, strength)
    ];
  }

  animate(dt) {
    const st = this.styleDef;
    const dir = rad((st.drift ?? 0) + this.layer.direction);
    const v = (st.flow ?? 0.25) * (this.layer.wind ?? 1) * this.ctx.grid * dt;   // squares per second
    const [a, b] = this.sheets;
    a.tilePosition.x += Math.cos(dir + 0.6) * v * 0.6;
    a.tilePosition.y += Math.sin(dir + 0.6) * v * 0.6;
    b.tilePosition.x += Math.cos(dir) * v;
    b.tilePosition.y += Math.sin(dir) * v;
  }
}

/** Small sprites that are born somewhere in the area, drift and fade away. */
export class ParticleEffect extends AreaEffect {
  build() {
    const st = this.styleDef;
    const tex = effectTextures()[st.texture ?? "dot"];
    const ctx = this.ctx;
    const count = Math.round(clamp((st.rate ?? 2) * this.layer.density * ctx.squares, 1, 800) * ctx.quality);
    this.parts = [];
    for (let i = 0; i < Math.max(1, count); i++) {
      const s = this.tintable(new PIXI.Sprite(tex));
      s.anchor.set(0.5);
      const p = { s, age: 0, life: 1, vx: 0, vy: 0, phase: Math.random() * TAU, size: 1 };
      this.spawn(p, true);
      this.parts.push(p);
      this.addChild(s);
    }
  }

  spawn(p, first = false) {
    const st = this.styleDef;
    const g = this.ctx.grid;
    const pt = this.ctx.randomPoint();
    const dir = rad((st.dir ?? -90) + this.layer.direction + rand(-1, 1) * (st.spread ?? 20));
    const speed = pick(st.speed ?? [0.2, 0.5]) * g * (st.windy ? (this.layer.wind ?? 1) : 1);
    p.x = pt.x; p.y = pt.y;
    p.vx = Math.cos(dir) * speed;
    p.vy = Math.sin(dir) * speed;
    p.life = pick(st.life ?? [2, 4]);
    p.age = first ? Math.random() * p.life : 0;
    p.size = (pick(st.size ?? [0.08, 0.16]) * g * this.layer.scale) / p.s.texture.width;
    p.s.scale.set(p.size);
    p.s.rotation = Math.random() * TAU;
  }

  animate(dt, time) {
    const st = this.styleDef;
    const wander = (st.wander ?? 0.2) * this.ctx.grid;
    for (const p of this.parts) {
      p.age += dt;
      if (p.age >= p.life) this.spawn(p);
      const k = p.age / p.life;
      p.x += p.vx * dt + Math.sin(time * 1.7 + p.phase) * wander * dt;
      p.y += p.vy * dt + Math.cos(time * 1.3 + p.phase) * wander * dt;
      p.s.position.set(p.x, p.y);
      let a = Math.sin(Math.PI * k);                                // fade in and out
      if (st.flicker) a *= 0.65 + 0.35 * Math.sin(time * 14 + p.phase * 5);
      if (st.blink) {
        // Fireflies: dark most of the time, then a slow glow on and off.
        const b = Math.sin(time * (st.blinkRate ?? 1.3) + p.phase * 7);
        a = Math.max(0, (b - 0.35) / 0.65) ** 1.5 * (0.6 + 0.4 * Math.sin(Math.PI * k));
      }
      p.s.alpha = a;
      if (st.shrink) p.s.scale.set(p.size * (1 - 0.6 * k));
      else if (st.grow) p.s.scale.set(p.size * (0.7 + 0.6 * k));       // rising toward the camera
    }
  }
}

/** An image of your own: tiled over the area or stretched to fill it, optionally drifting. */
export class ImageEffect extends AreaEffect {
  build() {
    const b = this.ctx.bounds;
    const tex = this.ctx.textures?.custom?.[this.layer.src];
    if (!tex) return;
    if (this.layer.fit === "stretch") {
      const s = this.tintable(new PIXI.Sprite(tex));
      s.anchor.set(0.5);
      const k = Math.max(b.width / tex.width, b.height / tex.height) * Math.max(1, this.layer.scale);
      s.scale.set(k);
      s.position.set(b.x + b.width / 2, b.y + b.height / 2);
      this.sprite = this.addChild(s);
    } else {
      const s = this.tintable(new PIXI.TilingSprite(tex, b.width, b.height));
      s.position.set(b.x, b.y);
      s.tileScale.set(this.layer.scale);
      this.sprite = this.addChild(s);
    }
  }

  refresh() {
    // An image keeps its own colours unless a colour is chosen.
    if (!this.layer.color && !this.layer.rainbow) {
      for (const s of this.tinted) s.tint = 0xffffff;
      return;
    }
    super.refresh();
  }

  get baseColor() {
    return hexToNum(this.layer.color ?? "#ffffff");
  }

  animate(dt, time) {
    const s = this.sprite;
    if (!s) return;
    const st = this.styleDef;
    const g = this.ctx.grid;
    const dir = rad(this.layer.direction);
    if (s instanceof PIXI.TilingSprite) {
      if (st.flow) {
        s.tilePosition.x += Math.cos(dir) * st.flow * g * dt;
        s.tilePosition.y += Math.sin(dir) * st.flow * g * dt;
      }
      if (st.sway) {
        s.tilePosition.x += Math.cos(time * 0.8) * st.sway * g * dt;
        s.tilePosition.y += Math.sin(time * 0.6) * st.sway * g * dt * 0.6;
      }
    } else if (st.sway) {
      s.rotation = Math.sin(time * 0.5) * 0.02 * st.sway * 4;
    }
  }
}

