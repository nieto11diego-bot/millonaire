/**

 * Road layer autotile.

 * - Straight NS/EW for line, ends, isolated

 * - Curve sprites only for L-bends

 * - Tee sprites for 3-way

 * - Cross sprite only when all 4 neighbours (mask 15)

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



  set(tx, ty, value) {

    if (!this.inBounds(tx, ty)) return false;

    const i = this.index(tx, ty);

    if (this.cells[i] === value) return false;

    this.cells[i] = value;

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

    // Horizontal line / E or W stub

    const ew = mask & 10; // E|W

    const ns = mask & 5; // N|S

    if (ew && !ns) return c.straightEW;

    return c.straightNS;

  }



  spriteFor(tx, ty) {

    return this.config.spritesPath + this.fileForMask(this.maskAt(tx, ty));

  }



  async preload() {

    const c = this.config;

    const files = [

      c.straightNS,

      c.straightEW,

      c.cross,

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

   */

  paint(tx, ty, place, blocked) {

    if (!this.inBounds(tx, ty)) return false;

    if (place && blocked && blocked(tx, ty)) return false;

    return this.set(tx, ty, place);

  }

}

