/**
 * Decorative zeppelins that fly across the map and respawn at random positions.
 * FCB and Real Madrid fire small missiles at each other when within 30 tiles.
 */

const DEFAULT_BANNER_TEXTS = ["Millionaire City", "¡Hazte rico!", "Fortuna", "¡Construye!", "gurgi"];
const FCB_BANNER_TEXTS = ["FCB", "Barça", "Més que un club", "Visca!", "Azulgrana"];
const MADRID_BANNER_TEXTS = ["Real Madrid", "Hala Madrid", "RM", "¡Campeones!", "Blancos"];

/** Tile range that triggers the FCB ↔ Madrid missile duel. */
const RIVAL_RANGE_TILES = 30;
const MISSILE_SPEED = 220;
const MISSILE_FIRE_MS = 320; // was 480 → ×1.5 fire rate
const MISSILE_MAX = 27; // was 18 → ×1.5
const MISSILE_SCALE = 1.5;

/**
 * @typedef {{
 *   x: number, y: number,
 *   vx: number, vy: number,
 *   life: number,
 *   from: 'fcb' | 'madrid',
 *   hit: boolean,
 * }} RivalMissile
 */

export class ZeppelinFlyer {
  /**
   * @param {{ cols: number, rows: number, tile: number }} grid
   * @param {{
   *   spriteUrl?: string,
   *   bannerTexts?: string[],
   *   drawW?: number,
   *   drawH?: number,
   *   initialDelayMs?: number,
   *   lockDir?: -1 | 1,
   *   faction?: 'fcb' | 'madrid' | null,
   * }} [options]
   */
  constructor(grid, options = {}) {
    this.grid = grid;
    this.spriteUrl = options.spriteUrl || "assets/fx/zeppelin.png";
    this.bannerTexts = options.bannerTexts || DEFAULT_BANNER_TEXTS;
    /** @type {HTMLImageElement|null} */
    this.img = null;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.dir = 1;
    this.speed = 48;
    this.waitMs = options.initialDelayMs ?? 800;
    this.bannerText = this.bannerTexts[0];
    this.drawW = options.drawW ?? 160;
    this.drawH = options.drawH ?? 70;
    /** When set, always fly this way so logos on the sprite stay readable (no FlipX). */
    this.lockDir = options.lockDir ?? null;
    /** @type {'fcb' | 'madrid' | null} */
    this.faction = options.faction ?? null;
    this._fireCd = 0;
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

  /** World-space center of the gondola / body for aiming. */
  center() {
    return {
      x: this.x,
      y: this.y + this.drawH * 0.42,
    };
  }

  /** Random side, height, speed and banner text. */
  spawn() {
    const margin = this.drawW + 120;
    this.dir = this.lockDir ?? (Math.random() < 0.5 ? 1 : -1);
    const padY = 50;
    const maxY = Math.max(padY + 10, this.mapH - this.drawH - 40);
    this.y = padY + Math.random() * (maxY - padY);
    this.x = this.dir > 0 ? -margin : this.mapW + margin;
    this.speed = 36 + Math.random() * 40;
    this.bannerText = this.bannerTexts[Math.floor(Math.random() * this.bannerTexts.length)];
    this.active = true;
    this.waitMs = 0;
    this._fireCd = 200 + Math.random() * 400;
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

    this.x += this.dir * this.speed * (dtMs / 1000);
    if (this._fireCd > 0) this._fireCd -= dtMs;

    const margin = this.drawW + 160;
    const gone =
      (this.dir > 0 && this.x > this.mapW + margin) || (this.dir < 0 && this.x < -margin);
    if (gone) {
      this.active = false;
      this.waitMs = 3000 + Math.random() * 10000;
    }
  }

  /**
   * Draw in world space (caller already transformed).
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    if (!this.active) return;

    const w = this.drawW;
    const h = this.drawH;
    const facingRight = this.dir > 0;

    ctx.save();
    ctx.translate(this.x, this.y);

    const bannerW = 110;
    const bannerH = 28;
    const gap = 18;
    const blimpTailX = facingRight ? -w * 0.4 : w * 0.4;
    const bannerX = facingRight ? blimpTailX - gap - bannerW : blimpTailX + gap;
    const bannerY = h * 0.22;
    const cableToX = facingRight ? bannerX + bannerW : bannerX;

    ctx.strokeStyle = "rgba(20,20,20,0.75)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(blimpTailX, h * 0.35);
    ctx.lineTo(cableToX, bannerY);
    ctx.moveTo(blimpTailX, h * 0.55);
    ctx.lineTo(cableToX, bannerY + bannerH);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "rgba(30,60,100,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const br = 4;
    ctx.moveTo(bannerX + br, bannerY);
    ctx.arcTo(bannerX + bannerW, bannerY, bannerX + bannerW, bannerY + bannerH, br);
    ctx.arcTo(bannerX + bannerW, bannerY + bannerH, bannerX, bannerY + bannerH, br);
    ctx.arcTo(bannerX, bannerY + bannerH, bannerX, bannerY, br);
    ctx.arcTo(bannerX, bannerY, bannerX + bannerW, bannerY, br);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#2b6fad";
    ctx.font = "italic 700 13px Fredoka, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.bannerText, bannerX + bannerW / 2, bannerY + bannerH / 2 + 0.5);

    if (this.img) {
      ctx.save();
      if (facingRight) {
        ctx.scale(-1, 1);
        ctx.drawImage(this.img, -w / 2, 0, w, h);
      } else {
        ctx.drawImage(this.img, -w / 2, 0, w, h);
      }
      ctx.restore();
    } else {
      ctx.fillStyle = "#3ecfc4";
      ctx.beginPath();
      ctx.ellipse(0, h * 0.4, w * 0.42, h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

/** Several independent zeppelins sharing the sky. */
export class ZeppelinFleet {
  /** @param {ZeppelinFlyer[]} flyers */
  constructor(flyers) {
    this.flyers = flyers;
    /** @type {RivalMissile[]} */
    this.missiles = [];
    /** @type {{ x: number, y: number, life: number, from: string }[]} */
    this.bursts = [];
  }

  async preload() {
    await Promise.all(this.flyers.map((f) => f.preload()));
  }

  spawn() {
    this.flyers.forEach((f) => f.spawn());
  }

  /** @returns {{ fcb: ZeppelinFlyer|null, madrid: ZeppelinFlyer|null }} */
  _rivals() {
    let fcb = null;
    let madrid = null;
    for (const f of this.flyers) {
      if (f.faction === "fcb") fcb = f;
      if (f.faction === "madrid") madrid = f;
    }
    return { fcb, madrid };
  }

  /**
   * Distance in tiles between two active rival zeppelins, or Infinity.
   * @param {ZeppelinFlyer} a
   * @param {ZeppelinFlyer} b
   */
  _tileDist(a, b) {
    const ca = a.center();
    const cb = b.center();
    const dx = ca.x - cb.x;
    const dy = ca.y - cb.y;
    return Math.hypot(dx, dy) / a.grid.tile;
  }

  /**
   * @param {ZeppelinFlyer} from
   * @param {ZeppelinFlyer} to
   */
  _fireMissile(from, to) {
    if (this.missiles.length >= MISSILE_MAX) return;
    const a = from.center();
    const b = to.center();
    // Aim slightly ahead of target along its flight
    const leadX = b.x + to.dir * to.speed * 0.35;
    const leadY = b.y + (Math.random() - 0.5) * 18;
    const dx = leadX - a.x;
    const dy = leadY - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = MISSILE_SPEED * (0.85 + Math.random() * 0.3);
    this.missiles.push({
      x: a.x + (Math.random() - 0.5) * 10,
      y: a.y + (Math.random() - 0.5) * 8,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      life: 2.4,
      from: /** @type {'fcb'|'madrid'} */ (from.faction),
      hit: false,
    });
  }

  /**
   * @param {number} dtMs
   */
  _updateCombat(dtMs) {
    const { fcb, madrid } = this._rivals();
    if (!fcb || !madrid || !fcb.active || !madrid.active) {
      // Clear stray missiles only when neither rival is up? keep flying missiles
    } else {
      const dist = this._tileDist(fcb, madrid);
      if (dist <= RIVAL_RANGE_TILES) {
        if (fcb._fireCd <= 0) {
          this._fireMissile(fcb, madrid);
          fcb._fireCd = MISSILE_FIRE_MS * (0.75 + Math.random() * 0.5);
        }
        if (madrid._fireCd <= 0) {
          this._fireMissile(madrid, fcb);
          madrid._fireCd = MISSILE_FIRE_MS * (0.75 + Math.random() * 0.5);
        }
      }
    }

    const hitR = 36;
    const dt = dtMs / 1000;
    for (let i = this.missiles.length - 1; i >= 0; i--) {
      const m = this.missiles[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt;

      // Homing nudge toward current rival target
      const target = m.from === "fcb" ? madrid : fcb;
      if (target?.active) {
        const t = target.center();
        const dx = t.x - m.x;
        const dy = t.y - m.y;
        const len = Math.hypot(dx, dy) || 1;
        m.vx += (dx / len) * 90 * dt;
        m.vy += (dy / len) * 90 * dt;
        // Cap speed
        const sp = Math.hypot(m.vx, m.vy);
        if (sp > MISSILE_SPEED * 1.35) {
          m.vx = (m.vx / sp) * MISSILE_SPEED * 1.35;
          m.vy = (m.vy / sp) * MISSILE_SPEED * 1.35;
        }
        if (len < hitR) {
          m.hit = true;
          this.bursts.push({ x: m.x, y: m.y, life: 1, from: m.from });
        }
      }

      if (m.hit || m.life <= 0) this.missiles.splice(i, 1);
    }

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      this.bursts[i].life -= dtMs / 280;
      if (this.bursts[i].life <= 0) this.bursts.splice(i, 1);
    }
  }

  /** @param {number} dtMs */
  update(dtMs) {
    this.flyers.forEach((f) => f.update(dtMs));
    this._updateCombat(dtMs);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawMissiles(ctx) {
    ctx.save();
    for (const m of this.missiles) {
      const ang = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(m.x, m.y);
      ctx.rotate(ang);
      ctx.scale(MISSILE_SCALE, MISSILE_SCALE);

      // Tiny missile body
      const isFcb = m.from === "fcb";
      ctx.fillStyle = isFcb ? "#a50044" : "#ffffff";
      ctx.strokeStyle = isFcb ? "#004d98" : "#febe10";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -2.4);
      ctx.lineTo(-5, 2.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Exhaust spark
      ctx.fillStyle = isFcb ? "rgba(255,160,40,0.85)" : "rgba(255,200,60,0.9)";
      ctx.beginPath();
      ctx.ellipse(-7, 0, 3.5, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    for (const b of this.bursts) {
      const t = Math.max(0, b.life);
      const r = (6 + (1 - t) * 14) * MISSILE_SCALE;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
      if (b.from === "fcb") {
        g.addColorStop(0, `rgba(255,220,120,${0.9 * t})`);
        g.addColorStop(0.4, `rgba(165,0,68,${0.55 * t})`);
        g.addColorStop(1, `rgba(0,77,152,0)`);
      } else {
        g.addColorStop(0, `rgba(255,240,160,${0.9 * t})`);
        g.addColorStop(0.4, `rgba(254,190,16,${0.55 * t})`);
        g.addColorStop(1, `rgba(255,255,255,0)`);
      }
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    this._drawMissiles(ctx);
    this.flyers.forEach((f) => f.draw(ctx));
  }
}

export { DEFAULT_BANNER_TEXTS, FCB_BANNER_TEXTS, MADRID_BANNER_TEXTS, RIVAL_RANGE_TILES };
