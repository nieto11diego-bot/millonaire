import { spriteOrigin } from "./grid.js";

const FLOAT_TEXT_SCALE = 1.3;

/**
 * Floating "+$cash / +XP" popups above buildings (Millionaire City style).
 */
export class FloatingRewards {
  constructor() {
    /** @type {{ wx: number, wy: number, cash: number, xp: number, age: number, duration: number }[]} */
    this.items = [];
  }

  /**
   * @param {{ tx: number, ty: number, def: object }} building
   * @param {number} tile
   * @param {{ cash: number, xp?: number }} rewards
   */
  spawn(building, tile, { cash, xp = 0 }) {
    const { drawY: spriteTop } = spriteOrigin(building.def, building.tx, building.ty, tile);
    this.items.push({
      wx: (building.tx + building.def.gridW / 2) * tile,
      wy: spriteTop - 10,
      cash: Math.max(0, Math.round(cash)),
      xp: Math.max(0, Math.round(xp)),
      age: 0,
      duration: 1800,
    });
  }

  /** @param {number} dt ms */
  update(dt) {
    this.items = this.items.filter((it) => {
      it.age += dt;
      return it.age < it.duration;
    });
  }

  /** @param {CanvasRenderingContext2D} ctx world-space context */
  draw(ctx) {
    for (const it of this.items) {
      const t = it.age / it.duration;
      const floatY = it.wy - t * 32;
      const alpha = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
      const hasXp = it.xp > 0;
      const lineGap = 16 * FLOAT_TEXT_SCALE;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";

      const cashText = `$${it.cash.toLocaleString("en-US")}`;
      ctx.font = `bold ${Math.round(15 * FLOAT_TEXT_SCALE)}px Fredoka, Segoe UI, sans-serif`;
      ctx.lineWidth = 3.5 * FLOAT_TEXT_SCALE;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.fillStyle = "#7ef07a";
      const cashY = floatY - (hasXp ? lineGap / 2 : 0);
      ctx.strokeText(cashText, it.wx, cashY);
      ctx.fillText(cashText, it.wx, cashY);

      if (hasXp) {
        const xpText = `${it.xp} XP`;
        ctx.font = `bold ${Math.round(17 * FLOAT_TEXT_SCALE)}px Fredoka, Segoe UI, sans-serif`;
        ctx.fillStyle = "#ffd84a";
        const xpY = floatY + lineGap / 2 + 2 * FLOAT_TEXT_SCALE;
        ctx.strokeText(xpText, it.wx, xpY);
        ctx.fillText(xpText, it.wx, xpY);
      }

      ctx.restore();
    }
  }
}
