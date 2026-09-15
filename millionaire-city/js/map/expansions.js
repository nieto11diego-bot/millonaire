/**
 * Equal land parcels (Millionaire City style).
 * Only owned zones are buildable; adjacent locked zones show "For Sale".
 */
export class ExpansionLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {number} [tile=32]
   * @param {{
   *   zoneW?: number,
   *   zoneH?: number,
   *   baseCost?: number,
   *   costGrowth?: number,
   *   startZx?: number,
   *   startZy?: number,
   * }} [opts]
   */
  constructor(cols, rows, tile = 32, opts = {}) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    this.zoneW = opts.zoneW ?? 16;
    this.zoneH = opts.zoneH ?? 16;
    this.zonesX = Math.floor(cols / this.zoneW);
    this.zonesY = Math.floor(rows / this.zoneH);
    this.baseCost = opts.baseCost ?? 50_000;
    this.costGrowth = opts.costGrowth ?? 1.4;
    /** @type {Set<string>} */
    this.owned = new Set();
    this.boughtCount = 0;

    const sx =
      opts.startZx != null
        ? opts.startZx
        : Math.floor((this.zonesX - 1) / 2);
    const sy =
      opts.startZy != null
        ? opts.startZy
        : Math.floor((this.zonesY - 1) / 2);
    this.startZx = Math.max(0, Math.min(this.zonesX - 1, sx));
    this.startZy = Math.max(0, Math.min(this.zonesY - 1, sy));
    this.owned.add(this.key(this.startZx, this.startZy));
  }

  key(zx, zy) {
    return `${zx},${zy}`;
  }

  /** Tile → zone coords (null if outside parcel grid). */
  zoneAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.zonesX * this.zoneW || ty >= this.zonesY * this.zoneH) {
      return null;
    }
    return { zx: Math.floor(tx / this.zoneW), zy: Math.floor(ty / this.zoneH) };
  }

  isOwnedZone(zx, zy) {
    return this.owned.has(this.key(zx, zy));
  }

  isUnlocked(tx, ty) {
    const z = this.zoneAt(tx, ty);
    if (!z) return false;
    return this.isOwnedZone(z.zx, z.zy);
  }

  /** Footprint fully inside owned land. */
  canBuild(tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.isUnlocked(x, y)) return false;
      }
    }
    return true;
  }

  isAdjacentToOwned(zx, zy) {
    const n = [
      [zx + 1, zy],
      [zx - 1, zy],
      [zx, zy + 1],
      [zx, zy - 1],
    ];
    for (const [x, y] of n) {
      if (x < 0 || y < 0 || x >= this.zonesX || y >= this.zonesY) continue;
      if (this.isOwnedZone(x, y)) return true;
    }
    return false;
  }

  isBuyable(zx, zy) {
    if (zx < 0 || zy < 0 || zx >= this.zonesX || zy >= this.zonesY) return false;
    if (this.isOwnedZone(zx, zy)) return false;
    return this.isAdjacentToOwned(zx, zy);
  }

  /** Next purchase price (escalates with each buy). */
  nextCost() {
    return Math.round(this.baseCost * Math.pow(this.costGrowth, this.boughtCount));
  }

  costFor(zx, zy) {
    if (!this.isBuyable(zx, zy)) return null;
    return this.nextCost();
  }

  /**
   * @returns {{ ok: true, cost: number } | { ok: false, reason: string }}
   */
  buy(zx, zy) {
    if (!this.isBuyable(zx, zy)) {
      return { ok: false, reason: "Esta parcela no está a la venta." };
    }
    const cost = this.nextCost();
    this.owned.add(this.key(zx, zy));
    this.boughtCount += 1;
    return { ok: true, cost };
  }

  /** Pixel rect of a zone in world space. */
  zoneRect(zx, zy) {
    return {
      x: zx * this.zoneW * this.tile,
      y: zy * this.zoneH * this.tile,
      w: this.zoneW * this.tile,
      h: this.zoneH * this.tile,
    };
  }

  /** Center tile of the starter parcel (for bungalow). */
  starterTileCenter(footW = 2, footH = 2) {
    const tx = this.startZx * this.zoneW + Math.floor((this.zoneW - footW) / 2);
    const ty = this.startZy * this.zoneH + Math.floor((this.zoneH - footH) / 2);
    return { tx, ty };
  }

  /** Iterate all zones. */
  forEachZone(fn) {
    for (let zy = 0; zy < this.zonesY; zy++) {
      for (let zx = 0; zx < this.zonesX; zx++) {
        fn(zx, zy);
      }
    }
  }
}
