/**
 * Pair of combat jets that cross the map like the zeppelin,
 * perform opposite loopings, and leave a faint exhaust trail.
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
    this.speed = 165;

    /** Lateral half-separation between the two jets (screen Y) */
    this.sep = 48;
    /** First appearance starts stacked; later runs start already separated */
    this.firstSpawn = true;
    this.sepAnim = 0;

    /**
     * Flight clock for scripted maneuvers (ms into this pass).
     * Timeline is rebuilt each spawn.
     */
    this.t = 0;
    /** @type {{ t0: number, t1: number, kind: string, amp?: number, center?: number }[]} */
    this.maneuvers = [];

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

  /** Pick a shared random entry point and script maneuvers for this pass. */
  spawn() {
    const margin = this.drawW + 140;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    const padY = 70;
    const maxY = Math.max(padY + 40, this.mapH - this.drawH - 80);
    this.baseY = padY + Math.random() * (maxY - padY);
    this.x = this.dir > 0 ? -margin : this.mapW + margin;
    this.speed = (95 + Math.random() * 45) * 1.5;
    this.t = 0;
    this.sep = 95 + Math.random() * 35;
    // First time: same point then peel apart; later: already laterally separated
    this.sepAnim = this.firstSpawn ? 0 : 1;
    this.firstSpawn = false;
    this.jets[0].trail = [];
    this.jets[1].trail = [];
    this._trailAcc = 0;
    this._buildManeuvers();
    this.active = true;
    this.waitMs = 0;
  }

  /**
   * Script: three equally spaced loopings across the pass.
   * Times are in ms of flight along the pass.
   */
  _buildManeuvers() {
    const mapSpan = this.mapW + this.drawW * 2 + 280;
    const passMs = (mapSpan / this.speed) * 1000;
    const windowStart = passMs * 0.16;
    const windowEnd = passMs * 0.84;
    const loopDur = 1000 + Math.random() * 280;
    const usable = Math.max(loopDur * 3, windowEnd - windowStart);
    const step = usable / 3;

    /** @type {{ t0: number, t1: number, kind: string, amp?: number }[]} */
    const m = [];
    for (let i = 0; i < 3; i++) {
      const center = windowStart + step * (i + 0.5);
      m.push({
        t0: center - loopDur / 2,
        t1: center + loopDur / 2,
        kind: "loop",
        amp: 88 + Math.random() * 40,
      });
    }

    this.maneuvers = m;
  }

  /**
   * Evaluate offset + bank angle for one jet at flight time t.
   * @param {number} jetIndex 0 | 1
   * @param {number} tMs
   */
  _maneuverOffset(jetIndex, tMs) {
    let ox = 0;
    let oy = 0;
    let angle = 0;
    const sign = jetIndex === 0 ? 1 : -1;

    for (const m of this.maneuvers) {
      if (tMs < m.t0 || tMs > m.t1) continue;
      const u = (tMs - m.t0) / (m.t1 - m.t0); // 0..1
      const amp = m.amp ?? 40;

      if (m.kind === "loop") {
        // Opposite loops: one rolls over the top, the other under
        const theta = u * Math.PI * 2;
        ox += this.dir * amp * Math.sin(theta);
        oy += -sign * amp * (1 - Math.cos(theta));
        angle += -sign * theta * this.dir;
      }
    }

    return { ox, oy, angle };
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

    this.t += dtMs;
    this._updateSep(dtMs);
    this.x += this.dir * this.speed * (dtMs / 1000);

    const sepNow = this.sep * this._easeOutCubic(this.sepAnim);
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? 1 : -1;
      const { ox, oy, angle } = this._maneuverOffset(i, this.t);
      const y = this.baseY + sign * sepNow + oy;
      this._pose[i].x = this.x + ox;
      this._pose[i].y = y;
      this._pose[i].angle = angle;
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
