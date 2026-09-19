/**
 * Road layer autotile.
 * - Straight NS/EW for line, ends, isolated
 * - Curve sprites only for L-bends
 * - Tee sprites for 3-way
 * - Cross sprite only when all 4 neighbours (mask 15)
 * - Optional per-tile kind override (e.g. zebra crossing)
 * Bitmask: N=1, E=2, S=4, W=8
 */
export class RoadLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {object} config
   */
  constructor(cols, rows, config) {
    this.cols = cols;
    this.rows = rows;
    this.config = config;
    /** @type {boolean[]} */
    this.cells = new Array(cols * rows).fill(false);
    /** @type {(null|"road"|"zebra")[]} */
    this.kinds = new Array(cols * rows).fill(null);
    /** @type {Map<string, HTMLImageElement>} */
    this.images = new Map();
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows;
  }

  has(tx, ty) {
    return this.inBounds(tx, ty) && this.cells[this.index(tx, ty)];
  }

  kindAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    return this.kinds[this.index(tx, ty)];
  }

  set(tx, ty, value, kind = "road") {
    if (!this.inBounds(tx, ty)) return false;
    const i = this.index(tx, ty);
    if (value) {
      const nextKind = kind === "zebra" ? "zebra" : "road";
      if (this.cells[i] && this.kinds[i] === nextKind) return false;
      this.cells[i] = true;
      this.kinds[i] = nextKind;
      return true;
    }
    if (!this.cells[i]) return false;
    this.cells[i] = false;
    this.kinds[i] = null;
    return true;
  }

  maskAt(tx, ty) {
    let m = 0;
    if (this.has(tx, ty - 1)) m |= 1;
    if (this.has(tx + 1, ty)) m |= 2;
    if (this.has(tx, ty + 1)) m |= 4;
    if (this.has(tx - 1, ty)) m |= 8;
    return m;
  }

  /** @param {number} mask */
  fileForMask(mask) {
    const c = this.config;
    if (mask === 15) return c.cross;
    if (c.curves && c.curves[String(mask)]) return c.curves[String(mask)];
    if (c.tees && c.tees[String(mask)]) return c.tees[String(mask)];
    const ew = mask & 10; // E|W
    const ns = mask & 5; // N|S
    if (ew && !ns) return c.straightEW;
    return c.straightNS;
  }

  spriteFor(tx, ty) {
    const kind = this.kindAt(tx, ty);
    if (kind === "zebra" && this.config.zebra) {
      return this.config.spritesPath + this.config.zebra;
    }
    return this.config.spritesPath + this.fileForMask(this.maskAt(tx, ty));
  }

  async preload() {
    const c = this.config;
    const files = [
      c.straightNS,
      c.straightEW,
      c.cross,
      c.zebra,
      ...Object.values(c.curves || {}),
      ...Object.values(c.tees || {}),
    ].filter(Boolean);
    await Promise.all(
      [...new Set(files)].map(
        (file) =>
          new Promise((resolve) => {
            const url = this.config.spritesPath + file;
            const img = new Image();
            img.onload = () => {
              this.images.set(url, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = url;
          })
      )
    );
  }

  /**
   * @param {number} tx
   * @param {number} ty
   * @param {boolean} place
   * @param {(tx:number,ty:number)=>boolean} [blocked]
   * @param {"road"|"zebra"} [kind]
   */
  paint(tx, ty, place, blocked, kind = "road") {
    if (!this.inBounds(tx, ty)) return false;
    if (place && blocked && blocked(tx, ty)) return false;
    return this.set(tx, ty, place, kind);
  }

  /**
   * Remove any road tiles under a building footprint (hard exclusion).
   * @param {number} tx
   * @param {number} ty
   * @param {number} w
   * @param {number} h
   * @returns {number} tiles cleared
   */
  clearFootprint(tx, ty, w, h) {
    let n = 0;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.set(x, y, false)) n += 1;
      }
    }
    return n;
  }
}
