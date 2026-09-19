/**
 * Millionaire City–style promo flyover.
 *
 * Formation (facing flight direction / across the screen):
 *   1 izquierda | 2 centro-izq | 3 centro | 4 centro-der | 5 derecha
 *
 * All five spawn synchronized (same X). Mid-pass, pairs cross once:
 *   2↔4 and 1↔5 trade lanes (3 stays center) and keep the new order.
 */

const TRAIL_MAX = 96;
const TRAIL_SAMPLE_MS = 18;
/** Extra spacing vs original formation (15% then +30%). */
const SEP_SCALE = 1.15 * 1.3;

/**
 * Lateral lane multipliers for planes 1→5 (left → right).
 * Screen Y: left of formation = toward top when flying right.
 */
const LANE_Y = [-2, -1, 0, 1, 2];

/** 1-based plane pairs that trade lanes mid-pass */
const SWAP_PAIRS = [
  [2, 4],
  [1, 5],
];

/**
 * @typedef {{ x: number, y: number, a: number, life: number }} TrailPoint
 * @typedef {{
 *   x: number,
 *   y: number,
 *   laneY: number,
 *   homeLane: number,
 *   swapLane: number,
 *   angle: number,
 *   trail: TrailPoint[],
 * }} Jet
 */

export class FighterPair {
  /**
   * @param {{ cols: number, rows: number, tile: number }} grid
   * @param {{
   *   spriteUrl?: string,
   *   drawW?: number,
   *   drawH?: number,
   *   initialDelayMs?: number,
   *   count?: number,
   * }} [options]
   */
  constructor(grid, options = {}) {
    this.grid = grid;
    this.spriteUrl = options.spriteUrl || "assets/fx/fighter_jet.png";
    /** @type {HTMLImageElement|null} */
    this.img = null;
    this.drawW = options.drawW ?? 118;
    this.drawH = options.drawH ?? 110;
    this.count = Math.max(2, Math.min(LANE_Y.length, options.count ?? LANE_Y.length));
    this.active = false;
    this.waitMs = options.initialDelayMs ?? 2200;

    /** 1 = right, -1 = left */
    this.dir = 1;
    this.speed = 165;
    this.baseY = 0;
    /** Pixels between adjacent lanes (overwritten each spawn) */
    this.sep = (72 + 8) * 1.25 * SEP_SCALE;

    /** Map X span for this pass (progress-driven double swap) */
    this._spawnX = 0;
    this._exitX = 0;
    /** Shared formation X — all jets lock to this each frame */
    this._formX = 0;

    /** @type {Jet[]} */
    this.jets = Array.from({ length: this.count }, () => ({
      x: 0,
      y: 0,
      laneY: 0,
      homeLane: 0,
      swapLane: 0,
      angle: 0,
      trail: [],
    }));
    this._trailAcc = 0;
  }

  async preload() {
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = this.spriteUrl;
    });
  }

  get mapW() {
    return this.grid.cols * this.grid.tile;
  }

  get mapH() {
    return this.grid.rows * this.grid.tile;
  }

  /** All five enter together; 2↔4 and 1↔5 cross once along the path. */
  spawn() {
    const margin = this.drawW + 220;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    this.speed = (95 + Math.random() * 35) * 1.5 * 1.5 * 1.25;
    this.sep = (72 + Math.random() * 16) * 1.25 * SEP_SCALE;

    const half = this.sep * 2.1;
    const pad = this.drawH + half + 40;
    this.baseY = pad + Math.random() * Math.max(60, this.mapH - pad * 2);

    // Synchronized: same X for every plane
    const spawnX = this.dir > 0 ? -margin : this.mapW + margin;
    this._spawnX = spawnX;
    this._exitX = this.dir > 0 ? this.mapW + margin : -margin;
    this._formX = spawnX;

    /** @type {Map<number, number>} */
    const swapTo = new Map();
    for (const [a, b] of SWAP_PAIRS) {
      swapTo.set(a - 1, b - 1);
      swapTo.set(b - 1, a - 1);
    }

    for (let i = 0; i < this.count; i++) {
      const jet = this.jets[i];
      jet.homeLane = LANE_Y[i];
      const partner = swapTo.get(i);
      jet.swapLane = partner != null ? LANE_Y[partner] : jet.homeLane;

      jet.laneY = jet.homeLane;
      jet.x = spawnX;
      jet.y = this.baseY + jet.laneY * this.sep;
      jet.angle = 0;
      jet.trail = [];
    }

    this._trailAcc = 0;
    this.active = true;
    this.waitMs = 0;
  }

  /** 0..1 progress across the map for this pass. */
  _mapProgress() {
    const span = this._exitX - this._spawnX;
    if (!span) return 0;
    return Math.max(0, Math.min(1, (this._formX - this._spawnX) / span));
  }

  /**
   * One lane exchange mid-path.
   * Returns blend: +1 = home lanes, -1 = swapped lanes (held until exit).
   * @param {number} progress
   */
  _swapBlend(progress) {
    const p0 = 0.28;
    const p1 = 0.48;
    if (progress <= p0) return 1;
    if (progress >= p1) return -1;
    const phase = (progress - p0) / (p1 - p0);
    return Math.cos(phase * Math.PI);
  }

  /**
   * @param {number} dtMs
   */
  update(dtMs) {
    if (!this.active) {
      this.waitMs -= dtMs;
      if (this.waitMs <= 0) this.spawn();
      return;
    }

    const dt = dtMs / 1000;
    const progress = this._mapProgress();
    const blend = this._swapBlend(progress);
    const p0 = 0.28;
    const p1 = 0.48;
    let passLeadWave = 0;
    if (progress > p0 && progress < p1) {
      const phase = (progress - p0) / (p1 - p0);
      passLeadWave = Math.sin(phase * Math.PI);
    }

    // One shared X so every plane keeps identical speed
    this._formX += this.dir * this.speed * dt;

    /** @type {Set<number>} */
    const swapping = new Set();
    for (const [a, b] of SWAP_PAIRS) {
      swapping.add(a - 1);
      swapping.add(b - 1);
    }

    for (let i = 0; i < this.count; i++) {
      const jet = this.jets[i];
      // blend +1 = home, -1 = partner lane
      const mid = (jet.homeLane + jet.swapLane) * 0.5;
      const half = (jet.homeLane - jet.swapLane) * 0.5;
      jet.laneY = mid + half * blend;
      jet.y = this.baseY + jet.laneY * this.sep;
      jet.x = this._formX;

      if (swapping.has(i)) {
        const dy = jet.swapLane - jet.homeLane;
        jet.angle = dy * passLeadWave * 0.14;
      } else {
        jet.angle = 0;
      }
    }

    this._updateTrails(dtMs);

    const margin = this.drawW + 320;
    const gone =
      (this.dir > 0 && this._formX > this.mapW + margin) ||
      (this.dir < 0 && this._formX < -margin);
    if (gone) {
      this.active = false;
      this.waitMs = 5000 + Math.random() * 9000;
      for (const jet of this.jets) jet.trail = [];
    }
  }

  /**
   * @param {number} dtMs
   */
  _updateTrails(dtMs) {
    this._trailAcc += dtMs;
    while (this._trailAcc >= TRAIL_SAMPLE_MS) {
      this._trailAcc -= TRAIL_SAMPLE_MS;
      for (let i = 0; i < this.count; i++) {
        const jet = this.jets[i];
        const rear = this.drawW * 0.42;
        const ex = jet.x - this.dir * Math.cos(jet.angle) * rear;
        const ey = jet.y + this.drawH * 0.5 - Math.sin(jet.angle) * rear * 0.35;
        jet.trail.push({ x: ex, y: ey, a: 0.85, life: 1 });
        if (jet.trail.length > TRAIL_MAX) jet.trail.shift();
      }
    }

    for (const jet of this.jets) {
      for (let i = jet.trail.length - 1; i >= 0; i--) {
        const pt = jet.trail[i];
        pt.life -= dtMs / 1500;
        pt.a = Math.max(0, pt.life * 0.82);
        pt.x -= this.dir * 10 * (dtMs / 1000);
        pt.y -= 3 * (dtMs / 1000);
        if (pt.life <= 0) jet.trail.splice(i, 1);
      }
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.active && this.jets.every((j) => j.trail.length === 0)) return;

    this._drawTrails(ctx);
    if (!this.active) return;

    const order = this.jets
      .map((_j, i) => i)
      .sort((a, b) => this.jets[a].y - this.jets[b].y);
    for (const i of order) {
      this._drawJet(ctx, this.jets[i]);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawTrails(ctx) {
    ctx.save();
    for (const jet of this.jets) {
      if (jet.trail.length >= 2) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < jet.trail.length; i++) {
          const a = jet.trail[i - 1];
          const b = jet.trail[i];
          const life = (a.life + b.life) * 0.5;
          if (life <= 0.02) continue;
          ctx.strokeStyle = `rgba(245,250,255,${life * 0.55})`;
          ctx.lineWidth = 3.2 + (1 - life) * 7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      for (const pt of jet.trail) {
        if (pt.a <= 0.02) continue;
        const r = 5.2 + (1 - pt.life) * 8.5;
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
        g.addColorStop(0, `rgba(255,255,255,${pt.a * 0.9})`);
        g.addColorStop(0.4, `rgba(220,235,250,${pt.a * 0.55})`);
        g.addColorStop(1, `rgba(180,200,220,0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Jet} jet
   */
  _drawJet(ctx, jet) {
    const w = this.drawW;
    const h = this.drawH;
    const facingRight = this.dir > 0;

    ctx.save();
    ctx.translate(jet.x, jet.y + h * 0.5);
    ctx.rotate(facingRight ? jet.angle : -jet.angle);

    if (this.img) {
      ctx.save();
      if (facingRight) {
        ctx.scale(-1, 1);
        ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(this.img, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = "#3ecfc4";
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.42, h * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f5c542";
      ctx.fillRect(-w * 0.05, -h * 0.35, w * 0.28, h * 0.18);
    }

    ctx.restore();
  }
}
