/**
 * Equal land parcels (Millionaire City style).
 * Only owned zones are buildable; adjacent locked zones show "For Sale".
 * Purchase price is fixed by distance from the starter parcel (not by buy order).
 */
export class ExpansionLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   * @param {number} [tile=32]
   * @param {{
   *   zoneW?: number,
   *   zoneH?: number,
   *   startZx?: number,
   *   startZy?: number,
   *   costsByOffset?: Record<string, number>,
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
    /** @type {Record<string, number>} */
    this.costsByOffset = { ...DEFAULT_COSTS_BY_OFFSET, ...(opts.costsByOffset || {}) };
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

  /** World-space center of the "EN VENTA" sign for a zone. */
  signCenter(zx, zy) {
    const r = this.zoneRect(zx, zy);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  /**
   * Hit-test the for-sale sign (board + post), not the whole parcel.
   * Generous padding so fingers can tap it on mobile.
   * @returns {{ zx: number, zy: number } | null}
   */
  hitTestSign(wx, wy) {
    /** @type {{ zx: number, zy: number } | null} */
    let hit = null;
    this.forEachZone((zx, zy) => {
      if (!this.isBuyable(zx, zy)) return;
      const { x: cx, y: cy } = this.signCenter(zx, zy);
      // Matches renderer._drawForSaleSign geometry (bw=102, bh=52, by=-56, post to ~52)
      const pad = 20;
      const left = cx - 51 - pad;
      const right = cx + 51 + pad;
      const top = cy - 56 - pad;
      const bottom = cy + 52 + pad;
      if (wx >= left && wx <= right && wy >= top && wy <= bottom) {
        hit = { zx, zy };
      }
    });
    return hit;
  }

  /**
   * Fixed price from Chebyshev offset to starter: key = `${max},${min}` of (|dx|,|dy|).
   * Center (0,0) is free (starter). Unknown offsets return null.
   */
  priceAt(zx, zy) {
    const dx = Math.abs(zx - this.startZx);
    const dy = Math.abs(zy - this.startZy);
    const a = Math.max(dx, dy);
    const b = Math.min(dx, dy);
    if (a === 0) return 0;
    const price = this.costsByOffset[`${a},${b}`];
    return price != null ? Number(price) : null;
  }

  costFor(zx, zy) {
    if (!this.isBuyable(zx, zy)) return null;
    return this.priceAt(zx, zy);
  }

  /**
   * @returns {{ ok: true, cost: number } | { ok: false, reason: string }}
   */
  buy(zx, zy) {
    if (!this.isBuyable(zx, zy)) {
      return { ok: false, reason: "Esta parcela no está a la venta." };
    }
    const cost = this.priceAt(zx, zy);
    if (cost == null || cost < 0) {
      return { ok: false, reason: "Precio de expansión no definido." };
    }
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

  /** Center tile of the starter parcel (for the first house). */
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

/** Default 5×5 ring prices keyed by `${maxOffset},${minOffset}` from starter. */
const DEFAULT_COSTS_BY_OFFSET = {
  "1,0": 500_000, // orthogonal ring 1
  "1,1": 750_000, // diagonal ring 1
  "2,0": 1_000_000, // axis mid-edge
  "2,1": 1_500_000, // near-corner edge
  "2,2": 2_000_000, // corners
};
