/**
 * Decorative zeppelin that flies across the map and respawns at a random position.
 */
const SPRITE_URL = "assets/fx/zeppelin.png";
const BANNER_TEXTS = ["Millionaire City", "¡Hazte rico!", "Fortuna", "¡Construye!", "gurgi"];

export class ZeppelinFlyer {
  /**
   * @param {{ cols: number, rows: number, tile: number }} grid
   */
  constructor(grid) {
    this.grid = grid;
    /** @type {HTMLImageElement|null} */
    this.img = null;
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.dir = 1;
    this.speed = 48;
    this.waitMs = 800;
    this.bannerText = BANNER_TEXTS[0];
    this.drawW = 160;
    this.drawH = 70;
  }

  async preload() {
    await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.img = img;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = SPRITE_URL;
    });
  }

  get mapW() {
    return this.grid.cols * this.grid.tile;
  }

  get mapH() {
    return this.grid.rows * this.grid.tile;
  }

  /** Random side, height, speed and banner text. */
  spawn() {
    const margin = this.drawW + 120;
    this.dir = Math.random() < 0.5 ? 1 : -1;
    const padY = 50;
    const maxY = Math.max(padY + 10, this.mapH - this.drawH - 40);
    this.y = padY + Math.random() * (maxY - padY);
    this.x = this.dir > 0 ? -margin : this.mapW + margin;
    this.speed = 36 + Math.random() * 40;
    this.bannerText = BANNER_TEXTS[Math.floor(Math.random() * BANNER_TEXTS.length)];
    this.active = true;
    this.waitMs = 0;
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
    const margin = this.drawW + 160;
    const gone =
      (this.dir > 0 && this.x > this.mapW + margin) || (this.dir < 0 && this.x < -margin);
    if (gone) {
      this.active = false;
      // Random delay before next flyby
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

    // Banner trails behind the zeppelin (opposite of travel direction)
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

    // Sprite faces left by default — flip when flying right
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
