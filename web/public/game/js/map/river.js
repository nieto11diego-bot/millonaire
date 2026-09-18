/**
 * Meandering river along the right side of the map (Millionaire City style).
 * Tile mask for collision + high-res baked visual layer.
 */
export class RiverLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {number} [tile=32]
   */
  constructor(cols, rows, tile = 32) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    /** @type {Uint8Array} 0=land, 1=water, 2=bridge */
    this.cells = new Uint8Array(cols * rows);
    this.pixelScale = 2;
    /** @type {HTMLCanvasElement|null} */
    this.layerCanvas = null;
    this._seed = 1;
    /** Centerline samples {x,y,halfW} in tile space (float) */
    this._path = [];
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  /** Water (not bridge) — blocks buildings. */
  has(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.cells[this.index(tx, ty)] === 1;
  }

  /** Water or bridge — blocks buildings / roads. */
  occupies(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.cells[this.index(tx, ty)] !== 0;
  }

  isBridge(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.cells[this.index(tx, ty)] === 2;
  }

  clear() {
    this.cells.fill(0);
    this.layerCanvas = null;
    this._path = [];
  }

  /**
   * Always anchors near the right edge, flowing top → bottom.
   * @param {{ seed?: number, marginRight?: number, bridgeEvery?: number }} [opts]
   */
  generate(opts = {}) {
    if (opts.seed != null) this._seed = opts.seed >>> 0;
    else this._seed = (Math.random() * 0xffffffff) >>> 0;

    this.clear();

    const marginRight = opts.marginRight ?? 5;
    const baseX = this.cols - marginRight - 4; // city ends left of river; land strip on far right
    const minHalf = 1.15;
    const maxHalf = 2.6;

    let x = baseX + (this._rand() - 0.5) * 1.5;
    let halfW = 1.6 + this._rand() * 0.6;
    let vx = (this._rand() - 0.5) * 0.15;

    const path = [];
    for (let y = 0; y <= this.rows; y += 0.5) {
      // Meander: soft noise + occasional bay (widen) on the city (left) side
      vx += (this._rand() - 0.5) * 0.08;
      vx *= 0.92;
      x += vx + Math.sin(y * 0.22 + this._seed) * 0.12 + Math.sin(y * 0.07) * 0.18;

      // Keep river in the right corridor
      const xMin = this.cols - marginRight - 9;
      const xMax = this.cols - marginRight - 1.5;
      if (x < xMin) {
        x = xMin;
        vx = Math.abs(vx) * 0.5;
      }
      if (x > xMax) {
        x = xMax;
        vx = -Math.abs(vx) * 0.5;
      }

      // Width: pulse + random bays
      halfW += (this._rand() - 0.5) * 0.12;
      if (this._rand() < 0.04) halfW += 0.55 + this._rand() * 0.7; // bay
      halfW = Math.max(minHalf, Math.min(maxHalf, halfW * 0.985 + 1.55 * 0.015));

      path.push({ x, y, halfW });
    }
    this._path = path;

    // Rasterize water tiles
    for (const p of path) {
      const y0 = Math.floor(p.y);
      const y1 = Math.min(this.rows - 1, Math.ceil(p.y));
      for (let ty = y0; ty <= y1; ty++) {
        if (ty < 0 || ty >= this.rows) continue;
        const left = Math.floor(p.x - p.halfW);
        const right = Math.ceil(p.x + p.halfW);
        for (let tx = left; tx <= right; tx++) {
          if (tx < 0 || tx >= this.cols) continue;
          // Soft edge: only fill if inside ellipse-ish band
          const dx = tx + 0.5 - p.x;
          const dy = ty + 0.5 - p.y;
          if (Math.abs(dy) > 0.85) continue;
          if (Math.abs(dx) <= p.halfW + 0.15) this.cells[this.index(tx, ty)] = 1;
        }
      }
    }

    // Bridges every N rows — carve a 1-tile-thick road span across the river
    const bridgeEvery = opts.bridgeEvery ?? 12;
    const bridgeStart = 6 + Math.floor(this._rand() * 4);
    for (let by = bridgeStart; by < this.rows - 2; by += bridgeEvery) {
      this._placeBridge(by);
    }

    this.bake();
  }

  /** @private */
  _placeBridge(ty) {
    // Find water span at this row
    let left = -1;
    let right = -1;
    for (let tx = 0; tx < this.cols; tx++) {
      if (this.cells[this.index(tx, ty)] === 1) {
        if (left < 0) left = tx;
        right = tx;
      }
    }
    if (left < 0) return;
    // Extend one tile onto banks for abutment
    left = Math.max(0, left - 1);
    right = Math.min(this.cols - 1, right + 1);
    for (let tx = left; tx <= right; tx++) {
      this.cells[this.index(tx, ty)] = 2;
    }
    // Also mark adjacent row slightly for thicker deck look in bake (optional single row is fine)
  }

  /**
   * High-res cyan water + banks + beaches + bridges.
   */
  bake() {
    const s = this.pixelScale;
    const tile = this.tile;
    const mapW = this.cols * tile;
    const mapH = this.rows * tile;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(mapW * s);
    canvas.height = Math.ceil(mapH * s);
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(s, 0, 0, s, 0, 0);

    // Build smooth left/right bank polylines from path
    if (this._path.length >= 2) {
      this._fillRiverBody(ctx);
      this._paintBanksAndBeaches(ctx);
      this._paintRipples(ctx);
    }

    // Bridges on top of water
    this._paintBridges(ctx);

    this.layerCanvas = canvas;
  }

  _fillRiverBody(ctx) {
    const path = this._path;
    const tile = this.tile;

    ctx.beginPath();
    // Left bank top→bottom
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const px = (p.x - p.halfW) * tile;
      const py = p.y * tile;
      const wobble = Math.sin(p.y * 1.3 + i * 0.2) * 2.2;
      if (i === 0) ctx.moveTo(px + wobble, py);
      else ctx.lineTo(px + wobble, py);
    }
    // Right bank bottom→top
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i];
      const px = (p.x + p.halfW) * tile;
      const py = p.y * tile;
      const wobble = Math.sin(p.y * 1.1 + i * 0.15) * 1.8;
      ctx.lineTo(px + wobble, py);
    }
    ctx.closePath();

    const g = ctx.createLinearGradient(0, 0, 0, this.rows * tile);
    g.addColorStop(0, "#4eb8e8");
    g.addColorStop(0.35, "#3aa8dc");
    g.addColorStop(0.7, "#2f9fd4");
    g.addColorStop(1, "#3aade0");
    ctx.fillStyle = g;
    ctx.fill();

    // Inner highlight streak
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "#9fdfff";
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const px = (p.x - p.halfW * 0.25) * tile;
      const py = p.y * tile;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i];
      const px = (p.x + p.halfW * 0.15) * tile;
      const py = p.y * tile;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  _paintBanksAndBeaches(ctx) {
    const path = this._path;
    const tile = this.tile;

    // Dark embankment on city (left) side
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(45, 55, 20, 0.55)";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const px = (p.x - p.halfW) * tile + Math.sin(p.y * 1.3) * 2;
      const py = p.y * tile;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Softer right bank
    ctx.strokeStyle = "rgba(40, 60, 18, 0.28)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const px = (p.x + p.halfW) * tile;
      const py = p.y * tile;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Occasional sandy beaches on left bank
    for (let i = 8; i < path.length - 8; i += 14) {
      if (this._hash(i * 91) < 0.45) continue;
      const p = path[i];
      const p2 = path[Math.min(path.length - 1, i + 6)];
      const x0 = (p.x - p.halfW) * tile;
      const y0 = p.y * tile;
      const x1 = (p2.x - p2.halfW) * tile;
      const y1 = p2.y * tile;
      ctx.beginPath();
      ctx.moveTo(x0 - 1, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 - 10 - this._hash(i) * 8, (y0 + y1) / 2, x1 - 1, y1);
      ctx.quadraticCurveTo((x0 + x1) / 2 - 2, (y0 + y1) / 2, x0 - 1, y0);
      ctx.closePath();
      const sand = ctx.createLinearGradient(x0 - 12, y0, x0, y0);
      sand.addColorStop(0, "#e8d59a");
      sand.addColorStop(1, "#d4c078");
      ctx.fillStyle = sand;
      ctx.globalAlpha = 0.9;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _paintRipples(ctx) {
    const path = this._path;
    const tile = this.tile;
    ctx.save();
    // Clip to river roughly via water tiles bounding — use path fill clip
    ctx.beginPath();
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const px = (p.x - p.halfW * 0.85) * tile;
      const py = p.y * tile;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    for (let i = path.length - 1; i >= 0; i--) {
      const p = path[i];
      const px = (p.x + p.halfW * 0.85) * tile;
      const py = p.y * tile;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();

    for (let i = 0; i < path.length; i += 2) {
      const p = path[i];
      const cy = p.y * tile;
      const cx = p.x * tile;
      const w = p.halfW * tile * 0.7;
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + this._hash(i) * 0.18})`;
      ctx.lineWidth = 1 + this._hash(i + 3) * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - w, cy + Math.sin(i * 0.4) * 2);
      ctx.quadraticCurveTo(cx, cy + 3 + this._hash(i) * 4, cx + w * 0.8, cy + Math.sin(i * 0.55) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _paintBridges(ctx) {
    const tile = this.tile;
    for (let ty = 0; ty < this.rows; ty++) {
      let left = -1;
      let right = -1;
      for (let tx = 0; tx < this.cols; tx++) {
        if (this.cells[this.index(tx, ty)] === 2) {
          if (left < 0) left = tx;
          right = tx;
        }
      }
      if (left < 0) continue;
      const x = left * tile;
      const y = ty * tile + 6;
      const w = (right - left + 1) * tile;
      const h = tile - 12;

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.fillRect(x, y + h - 2, w, 4);

      // Deck
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, "#9a9a9a");
      g.addColorStop(0.4, "#7e7e7e");
      g.addColorStop(1, "#5c5c5c");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);

      // Rails
      ctx.fillStyle = "#4a4a4a";
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y + h - 3, w, 3);

      // Plank lines
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 1;
      for (let px = x + 8; px < x + w; px += 10) {
        ctx.beginPath();
        ctx.moveTo(px, y + 2);
        ctx.lineTo(px, y + h - 2);
        ctx.stroke();
      }
    }
  }

  _rand() {
    let t = (this._seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  _hash(n) {
    let t = (n + this._seed) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
