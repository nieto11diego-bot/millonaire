/**
 * Grass cover under buildings (above base map grass, under building sprites).
 */
export const GROUND_COLORS = {
  grass: "#6B8E23",
};

export class GroundLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   */
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    /** @type {(null|"grass")[]} */
    this.kinds = new Array(cols * rows).fill(null);
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows;
  }

  has(tx, ty) {
    return this.inBounds(tx, ty) && this.kinds[this.index(tx, ty)] != null;
  }

  kindAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    return this.kinds[this.index(tx, ty)];
  }

  colorAt(tx, ty) {
    const kind = this.kindAt(tx, ty);
    return kind ? GROUND_COLORS[kind] : null;
  }

  /**
   * @param {number} tx
   * @param {number} ty
   * @param {"grass"|null} kind  null clears
   * @returns {boolean} true if changed
   */
  set(tx, ty, kind) {
    if (!this.inBounds(tx, ty)) return false;
    const i = this.index(tx, ty);
    const next = kind === "grass" ? "grass" : null;
    if (this.kinds[i] === next) return false;
    this.kinds[i] = next;
    return true;
  }

  /**
   * @param {number} tx
   * @param {number} ty
   * @param {boolean} value
   * @param {(tx:number,ty:number)=>boolean} [isBlocked]
   * @param {"grass"} [kind]
   */
  paint(tx, ty, value, isBlocked, kind = "grass") {
    if (!this.inBounds(tx, ty)) return false;
    if (isBlocked?.(tx, ty)) return false;
    if (value) return this.set(tx, ty, "grass");
    return this.set(tx, ty, null);
  }
}
