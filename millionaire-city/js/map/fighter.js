/**
 * Pair of combat jets that cross the map like the zeppelin,
 * swap lanes along the pass, and leave a faint exhaust trail.
 */

const TRAIL_MAX = 56;
const TRAIL_SAMPLE_MS = 22;

/**
 * @typedef {{ x: number, y: number, a: number, life: number }} TrailPoint
 */

export class FighterPair {
  /**
   * @param {{ cols: number, rows: number, tile: number }} grid
   * @param {{
   *   spriteUrl?: string,
   *   drawW?: number,
   *   drawH?: number,
   *   initialDelayMs?: number,
   * }} [options]
   */
  constructor(grid, options = {}) {
    this.grid = grid;
    this.spriteUrl = options.spriteUrl || "assets/fx/fighter_jet.png";
    /** @type {HTMLImageElement|null} */
    this.img = null;
    this.drawW = options.drawW ?? 132.5;
    this.drawH = options.drawH ?? 123.3;
    this.active = false;
    this.waitMs = options.initialDelayMs ?? 2200;

    /** Shared flight direction: 1 = right, -1 = left */
    this.dir = 1;
    /** Base path progress along X (nose of the pair) */
    this.x = 0;
    this.baseY = 0;
    this.speed = 330;

    /** Lateral half-separation between the two jets (screen Y) */
    this.sep = 48;
    /** First appearance starts stacked; later runs start already separated */
    this.firstSpawn = true;
    this.sepAnim = 0;

    /** How many lane swaps during the mid stretch of each pass */
    this.swapCount = 2;
    /** Map-progress window where swaps happen (0..1) */
    this.swapT0 = 0.18;
    this.swapT1 = 0.82;

    /** Spawn X used to measure progress across the map */
    this._spawnX = 0;
    this._exitX = 0;

    /** @type {[{ trail: TrailPoint[] }, { trail: TrailPoint[] }]} */
    this.jets = [{ trail: [] }, { trail: [] }];
    this._trailAcc = 0;

    /** Cached draw poses for this frame */
    this._pose = [
      { x: 0, y: 0, angle: 0 },
      { x: 0, y: 0, angle: 0 },
    ];
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

  /** Pick a shared random entry point for this pass. */
  spawn() {
    const margin = this.drawW + 140;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    const padY = 70;
    const maxY = Math.max(padY + 40, this.mapH - this.drawH - 80);
    this.baseY = padY + Math.random() * (maxY - padY);
    this._spawnX = this.dir > 0 ? -margin : this.mapW + margin;
    this._exitX = this.dir > 0 ? this.mapW + margin : -margin;
    this.x = this._spawnX;
    this.speed = (95 + Math.random() * 45) * 3;
    this.sep = 95 + Math.random() * 35;
    this.swapCount = 2;
    this.swapT0 = 0.16 + Math.random() * 0.06;
    this.swapT1 = 0.78 + Math.random() * 0.08;
    // First time: same point then peel apart; later: already laterally separated
    this.sepAnim = this.firstSpawn ? 0 : 1;
    this.firstSpawn = false;
    this.jets[0].trail = [];
    this.jets[1].trail = [];
    this._trailAcc = 0;
    this.active = true;
    this.waitMs = 0;
  }

  /** 0..1 progress from spawn X to exit X. */
  _progress() {
    const span = this._exitX - this._spawnX;
    if (!span) return 0;
    return Math.max(0, Math.min(1, (this.x - this._spawnX) / span));
  }

  /**
   * Lane blend: +1 = initial lanes, 0 = crossing, -1 = swapped (and so on).
   * @param {number} progress
   */
  _laneBlend(progress) {
    const t0 = this.swapT0;
    const t1 = this.swapT1;
    const n = this.swapCount;
    let phase = 0;
    if (progress <= t0) phase = 0;
    else if (progress >= t1) phase = n;
    else phase = ((progress - t0) / (t1 - t0)) * n;
    // cos(kπ): +1 → -1 → +1 … for each completed swap
    return Math.cos(phase * Math.PI);
  }

  /**
   * Soft ease for first-spawn lateral peel-apart.
   * @param {number} dtMs
   */
  _updateSep(dtMs) {
    if (this.sepAnim >= 1) {
      this.sepAnim = 1;
      return;
    }
    this.sepAnim = Math.min(1, this.sepAnim + dtMs / 1400);
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

    this._updateSep(dtMs);
    this.x += this.dir * this.speed * (dtMs / 1000);

    const sepNow = this.sep * this._easeOutCubic(this.sepAnim);
    const progress = this._progress();
    const lane = this._laneBlend(progress);
    // Peak stagger / bank in the middle of each swap
    const t0 = this.swapT0;
    const t1 = this.swapT1;
    const n = this.swapCount;
    let swapWave = 0;
    if (progress > t0 && progress < t1) {
      const phase = ((progress - t0) / (t1 - t0)) * n;
      swapWave = Math.sin(phase * Math.PI);
    }

    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      const ox = -sign * swapWave * 26 * this.dir;
      const bank = -sign * swapWave * 0.32 * this.dir;
      this._pose[i].x = this.x + ox;
      this._pose[i].y = this.baseY + sign * sepNow * lane;
      this._pose[i].angle = bank;
    }

    this._updateTrails(dtMs);

    const margin = this.drawW + 200;
    const gone =
      (this.dir > 0 && this.x > this.mapW + margin) || (this.dir < 0 && this.x < -margin);
    if (gone) {
      this.active = false;
      this.waitMs = 5000 + Math.random() * 9000;
      this.jets[0].trail = [];
      this.jets[1].trail = [];
    }
  }

  /** @param {number} x */
  _easeOutCubic(x) {
    return 1 - Math.pow(1 - x, 3);
  }

  /**
   * Sample faint exhaust points behind each jet.
   * @param {number} dtMs
   */
  _updateTrails(dtMs) {
    this._trailAcc += dtMs;
    while (this._trailAcc >= TRAIL_SAMPLE_MS) {
      this._trailAcc -= TRAIL_SAMPLE_MS;
      for (let i = 0; i < 2; i++) {
        const p = this._pose[i];
        // Exhaust exits rear of fuselage (sprite: nose left, engine right)
        const rear = this.drawW * 0.42;
        const ex = p.x - Math.cos(p.angle) * this.dir * rear;
        const ey = p.y + this.drawH * 0.5 - Math.sin(p.angle) * rear * 0.25;
        const trail = this.jets[i].trail;
        trail.push({ x: ex, y: ey, a: 0.72, life: 1 });
        if (trail.length > TRAIL_MAX) trail.shift();
      }
    }

    for (const jet of this.jets) {
      for (let i = jet.trail.length - 1; i >= 0; i--) {
        const pt = jet.trail[i];
        pt.life -= dtMs / 1100;
        pt.a = Math.max(0, pt.life * 0.7);
        // Drift slightly opposite to flight + soft rise
        pt.x -= this.dir * 12 * (dtMs / 1000);
        pt.y -= 6 * (dtMs / 1000);
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

    for (let i = 0; i < 2; i++) {
      this._drawJet(ctx, this._pose[i]);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawTrails(ctx) {
    ctx.save();
    for (const jet of this.jets) {
      for (const pt of jet.trail) {
        if (pt.a <= 0.02) continue;
        const r = 4.2 + (1 - pt.life) * 6.5;
        const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, r);
        g.addColorStop(0, `rgba(245,250,255,${pt.a * 0.95})`);
        g.addColorStop(0.35, `rgba(200,220,240,${pt.a * 0.65})`);
        g.addColorStop(0.7, `rgba(160,185,210,${pt.a * 0.28})`);
        g.addColorStop(1, `rgba(140,160,180,0)`);
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
   * @param {{ x: number, y: number, angle: number }} pose
   */
  _drawJet(ctx, pose) {
    const w = this.drawW;
    const h = this.drawH;
    const facingRight = this.dir > 0;

    ctx.save();
    ctx.translate(pose.x, pose.y + h * 0.5);
    ctx.rotate(pose.angle);

    if (this.img) {
      ctx.save();
      if (facingRight) {
        // Sprite faces left by default (same as zeppelin)
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
