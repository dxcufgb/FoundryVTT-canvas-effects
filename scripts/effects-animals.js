/**
 * Dxcufgb's canvas effects - animals seen from above.
 *
 *  - Flyers (birds, bats): flocks crossing with the wind, birds of prey circling, bats swarming.
 *    They fly high, so their shadow falls down and to the right of them (light from the top left).
 *  - Crawlers (rats, spiders): scurry, stop, look around, turn back at the edge of the area.
 *  - Swimmers (fish, eels): glide toward a point, turn, glide on; a shadow on the bottom, ripples now and then.
 * The painted area is where they live: paint the sewer floor for rats, the pond for fish.
 */

import { AreaEffect, effectTextures, canvasTexture, clamp, rand, pick, hexToNum, LIGHT_DIR, TAU } from "./effect-base.js";

/* ======================================================================== */
/*  Textures (white silhouettes, heading along +x, tinted per style)        */
/* ======================================================================== */

let TEX = null;
function tex() {
  if (TEX) return TEX;
  TEX = {
    bird: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2); c.fillStyle = "#fff";
      // wings, swept back
      c.beginPath(); c.moveTo(4, -2); c.quadraticCurveTo(-4, -18, -14, -30); c.quadraticCurveTo(-6, -14, -8, -2); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(4, 2); c.quadraticCurveTo(-4, 18, -14, 30); c.quadraticCurveTo(-6, 14, -8, 2); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(0, 0, 12, 4, 0, 0, TAU); c.fill();          // body
      c.beginPath(); c.arc(12, 0, 3.5, 0, TAU); c.fill();                  // head
      c.beginPath(); c.moveTo(-10, 0); c.lineTo(-20, -5); c.lineTo(-20, 5); c.closePath(); c.fill();   // tail
    }),
    bat: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2); c.fillStyle = "#fff";
      for (const s of [-1, 1]) {
        c.beginPath(); c.moveTo(4, 2 * s); c.lineTo(8, 22 * s); c.lineTo(2, 30 * s);
        c.quadraticCurveTo(-1, 22 * s, -6, 25 * s); c.quadraticCurveTo(-6, 16 * s, -12, 16 * s); c.quadraticCurveTo(-8, 8 * s, -6, 2 * s);
        c.closePath(); c.fill();
      }
      c.beginPath(); c.ellipse(0, 0, 9, 4, 0, 0, TAU); c.fill();
      c.beginPath(); c.arc(9, 0, 3.5, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(10, -2); c.lineTo(14, -5); c.lineTo(12, -1); c.fill(); c.beginPath(); c.moveTo(10, 2); c.lineTo(14, 5); c.lineTo(12, 1); c.fill();
    }),
    rat: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2); c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(-2, 0, 16, 8.5, 0, 0, TAU); c.fill();          // body
      c.beginPath(); c.moveTo(10, -6); c.quadraticCurveTo(24, 0, 10, 6); c.closePath(); c.fill(); // snout
      c.fillStyle = "rgba(255,255,255,0.85)";
      c.beginPath(); c.arc(9, -6.5, 3.2, 0, TAU); c.fill(); c.beginPath(); c.arc(9, 6.5, 3.2, 0, TAU); c.fill(); // ears
      c.fillStyle = "rgba(0,0,0,0.6)"; c.beginPath(); c.arc(15, -2.4, 1.1, 0, TAU); c.fill(); c.beginPath(); c.arc(15, 2.4, 1.1, 0, TAU); c.fill();
    }),
    tail: canvasTexture(64, (c, n) => {
      const g = c.createLinearGradient(0, 0, n, 0);
      g.addColorStop(0, "rgba(255,255,255,0.15)"); g.addColorStop(1, "rgba(255,255,255,0.95)");
      c.fillStyle = g;
      c.beginPath(); c.moveTo(0, n / 2); c.lineTo(n, n / 2 - 2.5); c.lineTo(n, n / 2 + 2.5); c.closePath(); c.fill();
    }),
    spiderA: canvasTexture(64, (c, n) => spider(c, n, 0)),
    spiderB: canvasTexture(64, (c, n) => spider(c, n, 1)),
    fish: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2); c.fillStyle = "#fff";
      c.beginPath(); c.moveTo(22, 0); c.quadraticCurveTo(14, -9, -4, -8); c.quadraticCurveTo(-16, -5, -22, 0);
      c.quadraticCurveTo(-16, 5, -4, 8); c.quadraticCurveTo(14, 9, 22, 0); c.fill();
      c.fillStyle = "rgba(255,255,255,0.8)";                                 // pectoral fins
      c.beginPath(); c.ellipse(6, -10, 6, 2.5, -0.6, 0, TAU); c.fill(); c.beginPath(); c.ellipse(6, 10, 6, 2.5, 0.6, 0, TAU); c.fill();
    }),
    // Koi patches, drawn over the body in a second colour.
    spots: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2); c.fillStyle = "#fff";
      c.save(); c.beginPath(); c.moveTo(22, 0); c.quadraticCurveTo(14, -9, -4, -8); c.quadraticCurveTo(-16, -5, -22, 0);
      c.quadraticCurveTo(-16, 5, -4, 8); c.quadraticCurveTo(14, 9, 22, 0); c.clip();
      c.beginPath(); c.ellipse(12, -2, 7, 6, 0.3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(-6, 3, 8, 6, -0.4, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(2, -6, 4, 3, 0, 0, TAU); c.fill(); c.restore();
    }),
    fishTail: canvasTexture(64, (c, n) => {
      c.translate(n / 2, n / 2); c.fillStyle = "rgba(255,255,255,0.9)";
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-14, -14, -24, -12); c.quadraticCurveTo(-16, 0, -24, 12); c.quadraticCurveTo(-14, 14, 0, 0); c.fill();
    })
  };
  return TEX;
}

function spider(c, n, frame) {
  c.translate(n / 2, n / 2);
  c.strokeStyle = "#fff"; c.lineWidth = 2.2; c.lineCap = "round"; c.lineJoin = "round";
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const swing = ((i + frame) % 2 ? 0.22 : -0.22) * s;
      const a = (-0.9 + i * 0.6) * s + swing;                 // leg angle from the side
      const bx = 3 - i * 2, kx = bx + Math.sin(a) * 12, ky = s * 13 + Math.cos(a) * 3 * s;
      c.beginPath(); c.moveTo(bx, 3 * s); c.lineTo(kx, ky); c.lineTo(kx + Math.sin(a) * 10 - 2, ky + s * 9); c.stroke();
    }
  }
  c.fillStyle = "#fff";
  c.beginPath(); c.ellipse(-9, 0, 11, 9, 0, 0, TAU); c.fill();                // abdomen
  c.beginPath(); c.ellipse(5, 0, 6.5, 5.5, 0, 0, TAU); c.fill();              // head
}

const colorsOf = st => (st.colors ?? [st.color ?? "#ffffff"]).map(hexToNum);
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/* ======================================================================== */
/*  Flyers                                                                  */
/* ======================================================================== */

export class FlyerEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid;
    const t = tex()[st.texture ?? "bird"];
    const colors = colorsOf(st);
    const total = Math.round(clamp((st.rate ?? 0.15) * this.layer.density * ctx.squares, 2, 160) * ctx.quality);
    const shadows = this.addChild(new PIXI.Container());
    const bodies = this.addChild(new PIXI.Container());
    this.flyers = [];
    this.flocks = [];
    const b = ctx.rawBounds;
    const mode = st.mode ?? "flock";
    let left = total;
    while (left > 0) {
      const size = mode === "flock" ? Math.min(left, Math.round(pick(st.flock ?? [4, 9]))) : left;
      const p = ctx.randomPoint();
      const flock = { x: p.x, y: p.y, turn: rand(-0.25, 0.25), phase: Math.random() * TAU, n: size };
      this.flocks.push(flock);
      for (let i = 0; i < size; i++) {
        const sh = shadows.addChild(new PIXI.Sprite(t));
        sh.anchor.set(0.5); sh.tint = 0x000000;
        const s = bodies.addChild(new PIXI.Sprite(t));
        s.anchor.set(0.5);
        const mid = (size - 1) / 2;
        this.flyers.push({
          s, sh, flock, i,
          // V formation: further back and out to the side the further from the leader.
          back: Math.abs(i - mid) * 0.55 * g, side: (i - mid) * 0.5 * g,
          x: p.x + rand(-1, 1) * g * 2, y: p.y + rand(-1, 1) * g * 2,
          heading: rand(0, TAU), phase: Math.random() * TAU,
          orbit: { r: rand(1.2, 3.5) * g * this.layer.scale, a: rand(0, TAU), w: rand(0.15, 0.35) * (Math.random() < 0.5 ? -1 : 1) },
          color: colors[Math.floor(Math.random() * colors.length)],
          size: (pick(st.size ?? [0.45, 0.6]) * g * this.layer.scale) / 60,     // wingspan in squares
          glide: 0
        });
      }
      left -= size;
      if (mode !== "flock") break;
    }
    this.swarm = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }

  #wrap(o, m) {
    const b = this.ctx.rawBounds;
    if (o.x < b.x - m) o.x += b.width + 2 * m; else if (o.x > b.x + b.width + m) o.x -= b.width + 2 * m;
    if (o.y < b.y - m) o.y += b.height + 2 * m; else if (o.y > b.y + b.height + m) o.y -= b.height + 2 * m;
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid, b = this.ctx.rawBounds;
    const mode = st.mode ?? "flock";
    const w = this.wind;
    const travel = Math.atan2(w.y, w.x);
    const speed = (st.speed ?? 2) * g;
    const height = (st.height ?? 1.5) * g;
    const shx = -LIGHT_DIR.x * height, shy = -LIGHT_DIR.y * height;

    if (mode === "flock") {
      for (const f of this.flocks) {
        f.heading = travel + f.turn + Math.sin(time * 0.3 + f.phase) * 0.25;
        f.x += Math.cos(f.heading) * speed * dt;
        f.y += Math.sin(f.heading) * speed * dt;
        this.#wrap(f, 3 * g);
      }
    } else if (mode === "swarm") {
      // The swarm's middle roams around the area, kept a little downwind.
      const lee = Math.min(0.25, 0.3 * w.s);
      this.swarm.x = b.x + b.width * (0.5 + 0.3 * Math.sin(time * 0.23) + w.x * lee);
      this.swarm.y = b.y + b.height * (0.5 + 0.3 * Math.sin(time * 0.31 + 1) + w.y * lee);
    }

    for (const f of this.flyers) {
      let x, y, heading;
      if (mode === "flock") {
        const fh = f.flock.heading;
        const wob = Math.sin(time * 1.3 + f.phase) * 0.12 * g;
        x = f.flock.x - Math.cos(fh) * f.back - Math.sin(fh) * (f.side + wob);
        y = f.flock.y - Math.sin(fh) * f.back + Math.cos(fh) * (f.side + wob);
        heading = fh;
      } else if (mode === "circle") {
        // Circling on the wind: each orbit is carried downwind and back, slowly.
        f.orbit.a += f.orbit.w * dt * (st.speed ?? 1);
        const carry = (0.5 + 0.5 * Math.sin(time * 0.05 + f.phase)) * Math.min(3, w.s * 4) * g;
        const cx = b.x + b.width / 2 + w.x * carry, cy = b.y + b.height / 2 + w.y * carry;
        x = cx + Math.cos(f.orbit.a) * f.orbit.r;
        y = cy + Math.sin(f.orbit.a) * f.orbit.r;
        heading = f.orbit.a + (f.orbit.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      } else {
        // Swarm: each bat darts about erratically, pulled back toward the middle.
        const want = Math.atan2(this.swarm.y - f.y, this.swarm.x - f.x);
        const dist = Math.hypot(this.swarm.y - f.y, this.swarm.x - f.x);
        f.heading += angleTo(f.heading, want) * Math.min(1, dist / (3 * g)) * 2.5 * dt + Math.sin(time * 7 + f.phase * 3) * 6 * dt
          + angleTo(f.heading, travel) * Math.min(1, w.s) * 3 * dt;        // and they tend to fly downwind
        f.x += Math.cos(f.heading) * speed * dt;
        f.y += Math.sin(f.heading) * speed * dt;
        x = f.x; y = f.y; heading = f.heading;
      }
      // Wings: flap, or glide for a while (birds of prey mostly glide).
      if (f.glide > 0) f.glide -= dt;
      else if (Math.random() < (st.glide ?? 0) * dt) f.glide = rand(1, 3);
      const flapping = f.glide > 0 ? 0.92 : 0.55 + 0.45 * Math.abs(Math.sin(time * (st.flap ?? 9) + f.phase));
      for (const s of [f.s, f.sh]) {
        s.rotation = heading;
        s.scale.set(f.size, f.size * flapping);
      }
      f.s.position.set(x, y);
      f.s.tint = this.hued(f.color);
      f.sh.position.set(x + shx, y + shy);
      f.sh.alpha = st.shadow ?? 0.22;
    }
  }
}

/* ======================================================================== */
/*  Crawlers                                                                */
/* ======================================================================== */

export class CrawlerEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid, T = tex();
    const kind = st.kind ?? "rat";
    const n = Math.round(clamp((st.rate ?? 0.3) * this.layer.density * ctx.squares, 1, 120) * ctx.quality);
    const colors = colorsOf(st);
    const shadowLayer = this.addChild(new PIXI.Container());
    const layer = this.addChild(new PIXI.Container());
    this.crawlers = [];
    for (let i = 0; i < n; i++) {
      const size = (pick(st.size ?? [0.4, 0.55]) * g * this.layer.scale) / (kind === "rat" ? 40 : 50);   // body length
      const sh = shadowLayer.addChild(new PIXI.Sprite(kind === "rat" ? T.rat : T.spiderA));
      sh.anchor.set(0.5); sh.tint = 0x000000; sh.alpha = 0.3;
      let tail = null;
      if (kind === "rat") {
        tail = layer.addChild(new PIXI.Sprite(T.tail));
        tail.anchor.set(1, 0.5);
      }
      const s = layer.addChild(new PIXI.Sprite(kind === "rat" ? T.rat : T.spiderA));
      s.anchor.set(0.5);
      const p = ctx.randomPoint();
      this.crawlers.push({
        s, sh, tail, kind, size, x: p.x, y: p.y, heading: rand(0, TAU), phase: Math.random() * TAU,
        moving: Math.random() < 0.5, timer: rand(0.2, 1.5), step: 0, frame: 0, fade: 1, gone: 0,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid, ctx = this.ctx, T = tex();
    for (const c of this.crawlers) {
      c.timer -= dt;
      if (c.timer <= 0) {
        c.moving = !c.moving || Math.random() < 0.3;
        c.timer = c.moving ? pick(st.run ?? [0.4, 1.6]) : pick(st.pause ?? [0.3, 1.5]);
        if (c.moving) c.heading += rand(-1.6, 1.6);
        // Phase spiders blink out and step in elsewhere.
        if (st.phase && !c.moving && Math.random() < 0.35) c.gone = 0.8;
      }
      if (c.gone > 0) {
        c.gone -= dt;
        c.fade = Math.abs(c.gone - 0.4) / 0.4;
        if (c.gone <= 0.4 && c.gone + dt > 0.4) { const p = ctx.randomPoint(); c.x = p.x; c.y = p.y; }
      } else c.fade = 1;
      if (c.moving) {
        const speed = pick(st.speed ?? 1.4) * g * (0.85 + 0.15 * Math.sin(time * 9 + c.phase));
        const nx = c.x + Math.cos(c.heading) * speed * dt, ny = c.y + Math.sin(c.heading) * speed * dt;
        if (ctx.contains(nx, ny)) { c.x = nx; c.y = ny; } else { c.heading += Math.PI * rand(0.6, 1.4); }
        c.step += dt;
        if (c.step > (st.stride ?? 0.08)) { c.step = 0; c.frame ^= 1; }
      } else if (Math.random() < 0.8 * dt) {
        c.heading += rand(-0.6, 0.6);           // looks around
      }
      const bob = c.moving ? 1 + 0.04 * Math.sin(time * 30 + c.phase) : 1;
      c.s.position.set(c.x, c.y);
      c.s.rotation = c.heading;
      c.s.scale.set(c.size * bob, c.size);
      c.s.tint = this.hued(c.color);
      c.s.alpha = c.fade * (st.bodyAlpha ?? 1);
      if (c.kind === "spider") c.s.texture = c.frame && c.moving ? T.spiderB : T.spiderA;
      c.sh.position.set(c.x + 0.05 * g, c.y + 0.06 * g);
      c.sh.rotation = c.heading;
      c.sh.texture = c.s.texture;
      c.sh.scale.set(c.size * 1.05);
      c.sh.alpha = 0.3 * c.fade;
      if (c.tail) {
        const back = 14 * c.size;
        c.tail.position.set(c.x - Math.cos(c.heading) * back, c.y - Math.sin(c.heading) * back);
        c.tail.rotation = c.heading + Math.sin(time * (c.moving ? 14 : 3) + c.phase) * (c.moving ? 0.35 : 0.15);
        c.tail.scale.set(c.size * 0.9, c.size);
        c.tail.tint = this.hued(c.color);
        c.tail.alpha = c.fade;
      }
    }
  }
}

/* ======================================================================== */
/*  Swimmers                                                                */
/* ======================================================================== */

export class SwimmerEffect extends AreaEffect {
  build() {
    const ctx = this.ctx, st = this.styleDef, g = ctx.grid, T = tex(), dot = effectTextures().dot;
    const n = Math.round(clamp((st.rate ?? 0.3) * this.layer.density * ctx.squares, 1, 150) * ctx.quality);
    const colors = colorsOf(st);
    const spots = st.spots ? hexToNum(st.spots) : null;
    const shadowLayer = this.addChild(new PIXI.Container());
    const rippleLayer = this.addChild(new PIXI.Container());
    const layer = this.addChild(new PIXI.Container());
    this.fish = [];
    this.ripples = [];
    for (let i = 0; i < 12; i++) {
      const r = rippleLayer.addChild(new PIXI.Sprite(effectTextures().ring));
      r.anchor.set(0.5); r.visible = false;
      this.ripples.push({ s: r, age: 0, on: false });
    }
    const school = st.school ?? 1;
    let target = null;
    for (let i = 0; i < n; i++) {
      if (i % school === 0) target = { ...ctx.randomPoint() };
      const size = (pick(st.size ?? [0.4, 0.6]) * g * this.layer.scale) / 44;   // body length
      const p = ctx.randomPoint();
      const f = { size, x: p.x, y: p.y, heading: rand(0, TAU), phase: Math.random() * TAU, target, offset: { x: rand(-1, 1) * g * 0.6, y: rand(-1, 1) * g * 0.6 }, speed: pick(st.speed ?? [0.5, 0.9]), color: colors[Math.floor(Math.random() * colors.length)] };
      if (st.eel) {
        f.segments = [];
        for (let j = 0; j < 14; j++) {
          const seg = layer.addChild(new PIXI.Sprite(dot));
          seg.anchor.set(0.5);
          f.segments.push(seg);
        }
        f.hist = [];
        f.sh = shadowLayer.addChild(new PIXI.Container());
      } else {
        f.sh = shadowLayer.addChild(new PIXI.Sprite(T.fish));
        f.sh.anchor.set(0.5); f.sh.tint = 0x000000;
        f.tail = layer.addChild(new PIXI.Sprite(T.fishTail));
        f.tail.anchor.set(0.5);
        f.body = layer.addChild(new PIXI.Sprite(T.fish));
        f.body.anchor.set(0.5);
        if (spots !== null) {
          f.spots = layer.addChild(new PIXI.Sprite(T.spots));
          f.spots.anchor.set(0.5);
          f.spotColor = Math.random() < 0.7 ? spots : f.color;
        }
      }
      this.fish.push(f);
    }
  }

  #ripple(x, y) {
    const r = this.ripples.find(q => !q.on);
    if (!r) return;
    r.on = true; r.age = 0;
    r.s.position.set(x, y);
    r.s.visible = true;
  }

  animate(dt, time) {
    const st = this.styleDef, g = this.ctx.grid, ctx = this.ctx;
    const depth = st.depth ?? 0.85;
    const shift = (st.shadowOffset ?? 0.25) * g;
    for (const f of this.fish) {
      const tx = f.target.x + f.offset.x, ty = f.target.y + f.offset.y;
      const d = Math.hypot(tx - f.x, ty - f.y);
      if (d < g * 0.5) Object.assign(f.target, ctx.randomPoint());
      const want = Math.atan2(ty - f.y, tx - f.x);
      f.heading += angleTo(f.heading, want) * (st.turn ?? 1.2) * dt + Math.sin(time * 0.8 + f.phase) * 0.3 * dt;
      const burst = st.dart ? (Math.sin(time * 1.3 + f.phase) > 0.6 ? 2.5 : 0.6) : 1;
      const v = f.speed * g * burst;
      const nx = f.x + Math.cos(f.heading) * v * dt, ny = f.y + Math.sin(f.heading) * v * dt;
      if (ctx.contains(nx, ny)) { f.x = nx; f.y = ny; } else { f.heading += Math.PI * 0.6 * dt * 10; Object.assign(f.target, ctx.randomPoint()); }
      const wig = Math.sin(time * (6 + 6 * burst) + f.phase);
      const tint = this.hued(f.color);
      if (f.segments) {
        // Eels: the body follows the head's path.
        f.hist.unshift({ x: f.x + Math.sin(f.heading) * wig * 0.05 * g, y: f.y - Math.cos(f.heading) * wig * 0.05 * g });
        if (f.hist.length > f.segments.length * 3) f.hist.pop();
        f.segments.forEach((seg, j) => {
          const h = f.hist[Math.min(f.hist.length - 1, j * 3)];
          seg.position.set(h.x, h.y);
          seg.scale.set(f.size * (64 / 64) * 0.5 * (1 - j / f.segments.length * 0.7));
          seg.tint = tint;
          seg.alpha = depth;
        });
      } else {
        f.body.position.set(f.x, f.y);
        f.body.rotation = f.heading + wig * 0.08;
        f.body.scale.set(f.size);
        f.body.tint = tint;
        f.body.alpha = depth;
        const back = 20 * f.size;
        f.tail.position.set(f.x - Math.cos(f.heading) * back, f.y - Math.sin(f.heading) * back);
        f.tail.rotation = f.heading + wig * 0.5;
        f.tail.scale.set(f.size);
        f.tail.tint = tint;
        f.tail.alpha = depth;
        if (f.spots) {
          f.spots.position.copyFrom(f.body.position);
          f.spots.rotation = f.body.rotation;
          f.spots.scale.set(f.size);
          f.spots.tint = this.hued(f.spotColor);
          f.spots.alpha = depth;
        }
        f.sh.position.set(f.x + shift, f.y + shift);
        f.sh.rotation = f.body.rotation;
        f.sh.scale.set(f.size);
        f.sh.alpha = st.shadow ?? 0.2;
      }
      if (Math.random() < (st.ripples ?? 0.04) * dt) this.#ripple(f.x, f.y);
    }
    for (const r of this.ripples) {
      if (!r.on) continue;
      r.age += dt;
      const k = r.age / 1.4;
      if (k >= 1) { r.on = false; r.s.visible = false; continue; }
      r.s.scale.set((0.2 + k * 0.9) * g / 32);
      r.s.alpha = 0.35 * (1 - k);
    }
  }
}
