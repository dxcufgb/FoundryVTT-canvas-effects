/**
 * Dxcufgb's canvas effects - the shapes an effect area is painted with.
 *
 * An area is a list of shapes, drawn in order. Each shape adds to the area, or cuts it away
 * again when it has `erase: true`, so later strokes of the eraser remove earlier paint.
 *
 *   {type: "stroke",  points: [x0, y0, x1, y1, ...], width}   a brush stroke or a wall line (round ends)
 *   {type: "rect",    x, y, width, height}
 *   {type: "ellipse", x, y, width, height}                     x, y = top left of the bounding box
 *   {type: "polygon", points: [x0, y0, x1, y1, ...]}
 *
 * All coordinates are scene (world) pixels. This file only needs the global PIXI (v7).
 */

export const SHAPE_TYPES = ["stroke", "rect", "ellipse", "polygon"];

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const round = v => Math.round(v * 10) / 10;

/** A clean copy of a shape, or null if it isn't one. */
export function normalizeShape(s) {
  if (!s || !SHAPE_TYPES.includes(s.type)) return null;
  const out = { type: s.type };
  if (s.erase) out.erase = true;
  if (s.type === "stroke" || s.type === "polygon") {
    const pts = Array.isArray(s.points) ? s.points.map(v => round(num(v))) : [];
    if (pts.length % 2) pts.pop();
    if (s.type === "stroke" && pts.length < 2) return null;
    if (s.type === "polygon" && pts.length < 6) return null;
    out.points = pts;
    if (s.type === "stroke") out.width = Math.max(1, round(num(s.width, 50)));
  } else {
    let { x, y, width, height } = s;
    x = num(x); y = num(y); width = num(width); height = num(height);
    if (width < 0) { x += width; width = -width; }
    if (height < 0) { y += height; height = -height; }
    if (width < 1 || height < 1) return null;
    Object.assign(out, { x: round(x), y: round(y), width: round(width), height: round(height) });
  }
  return out;
}

export function normalizeShapes(list) {
  return (Array.isArray(list) ? list : []).map(normalizeShape).filter(Boolean);
}

/** Bounding box of one shape: {x, y, width, height}. */
export function shapeBounds(s) {
  if (s.type === "rect" || s.type === "ellipse") return { x: s.x, y: s.y, width: s.width, height: s.height };
  const p = s.points;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) {
    x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]);
    y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]);
  }
  const r = s.type === "stroke" ? s.width / 2 : 0;
  return { x: x0 - r, y: y0 - r, width: x1 - x0 + 2 * r, height: y1 - y0 + 2 * r };
}

/** Bounding box of everything an area paints (erased parts don't grow it), or null when it paints nothing. */
export function areaBounds(shapes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of shapes ?? []) {
    if (s.erase) continue;
    const b = shapeBounds(s);
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
  }
  if (!Number.isFinite(x0)) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The shapes moved by dx, dy. */
export function translateShapes(shapes, dx, dy) {
  return shapes.map(s => {
    const t = { ...s };
    if (s.points) t.points = s.points.map((v, i) => Math.round((v + (i % 2 ? dy : dx)) * 10) / 10);
    else { t.x = Math.round((s.x + dx) * 10) / 10; t.y = Math.round((s.y + dy) * 10) / 10; }
    return t;
  });
}

/* -------------------------------------------- */
/*  Hit tests                                   */
/* -------------------------------------------- */

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx - px, cy = ay + t * dy - py;
  return cx * cx + cy * cy;
}

function inPolygon(p, x, y) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

export function shapeContains(s, x, y) {
  switch (s.type) {
    case "rect": return x >= s.x && x <= s.x + s.width && y >= s.y && y <= s.y + s.height;
    case "ellipse": {
      const rx = s.width / 2, ry = s.height / 2;
      const dx = (x - s.x - rx) / rx, dy = (y - s.y - ry) / ry;
      return dx * dx + dy * dy <= 1;
    }
    case "polygon": return inPolygon(s.points, x, y);
    case "stroke": {
      const p = s.points, r2 = (s.width / 2) ** 2;
      if (p.length === 2) return (x - p[0]) ** 2 + (y - p[1]) ** 2 <= r2;
      for (let i = 0; i + 3 < p.length; i += 2) {
        if (segDist2(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= r2) return true;
      }
      return false;
    }
  }
  return false;
}

/** Is the point painted in this area (taking the eraser into account)? */
export function areaContains(shapes, x, y) {
  let inside = false;
  for (const s of shapes ?? []) {
    if (s.erase ? !inside : inside) continue;   // an eraser only matters inside, paint only outside
    if (shapeContains(s, x, y)) inside = !s.erase;
  }
  return inside;
}

/** Do two boxes overlap? */
export function boxesTouch(a, b) {
  return a && b && a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
}

/* -------------------------------------------- */
/*  Drawing                                     */
/* -------------------------------------------- */

/** Foundry replaces PIXI.Graphics with its smooth graphics; the plain one also works in other renderers. */
export const Graphics = () => new (PIXI.LegacyGraphics ?? PIXI.Graphics)();

/**
 * Draw one shape into a Graphics, filled (and for strokes: stroked) in the given colour.
 * @param {PIXI.Graphics} g
 * @param {object} s            a normalized shape
 * @param {object} [o]
 * @param {number} [o.color]    fill colour
 * @param {number} [o.alpha]    fill alpha
 * @param {number} [o.line]     outline width (0: none)
 * @param {number} [o.lineColor]
 * @param {number} [o.lineAlpha]
 */
export function drawShape(g, s, { color = 0xffffff, alpha = 1, line = 0, lineColor = 0xffffff, lineAlpha = 1 } = {}) {
  const outline = () => (line ? g.lineStyle({ width: line, color: lineColor, alpha: lineAlpha }) : g.lineStyle(0));
  if (s.type === "stroke") {
    const p = s.points;
    const r = s.width / 2;
    if (line) {
      // Outline of a stroke: its centre line, thin.
      g.lineStyle({ width: line, color: lineColor, alpha: lineAlpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
      g.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
    }
    if (alpha > 0) {
      if (p.length === 2) {
        g.lineStyle(0).beginFill(color, alpha).drawCircle(p[0], p[1], r).endFill();
      } else {
        g.lineStyle({ width: s.width, color, alpha, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
        g.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
      }
    }
    g.lineStyle(0);
    return g;
  }
  outline();
  g.beginFill(color, alpha);
  if (s.type === "rect") g.drawRect(s.x, s.y, s.width, s.height);
  else if (s.type === "ellipse") g.drawEllipse(s.x + s.width / 2, s.y + s.height / 2, s.width / 2, s.height / 2);
  else if (s.type === "polygon") g.drawPolygon(s.points);
  g.endFill();
  g.lineStyle(0);
  return g;
}

/**
 * Build the display objects that paint an area's mask: white where painted, cut away by erasers.
 * Consecutive shapes of the same kind share one Graphics.
 * @returns {PIXI.Container}
 */
export function buildMaskGraphics(shapes) {
  const root = new PIXI.Container();
  let g = null;
  let erase = null;
  for (const s of shapes) {
    const e = !!s.erase;
    if (!g || e !== erase) {
      g = root.addChild(Graphics());
      g.blendMode = e ? PIXI.BLEND_MODES.ERASE : PIXI.BLEND_MODES.NORMAL;
      erase = e;
    }
    drawShape(g, s);
  }
  return root;
}

/**
 * Thin out a freehand path: keep a point only once it is `step` away from the last one kept.
 * The last point is always kept.
 */
export function thinPoints(points, step) {
  if (points.length <= 4) return points.slice();
  const out = [points[0], points[1]];
  const s2 = step * step;
  for (let i = 2; i < points.length - 2; i += 2) {
    const dx = points[i] - out[out.length - 2], dy = points[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= s2) out.push(points[i], points[i + 1]);
  }
  out.push(points[points.length - 2], points[points.length - 1]);
  return out;
}
