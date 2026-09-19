/**
 * Daily loot chests on the map (Clash-style).
 * Exactly one roll per calendar day; lower tiers are more common.
 * At most one chest on the map at a time.
 */

/** @typedef {{
 *   level: 1|2|3|4,
 *   name: string,
 *   cash: number,
 *   gold: number,
 *   diamonds: number,
 *   xp: number,
 *   color: string,
 *   colorDark: string,
 *   colorLight: string,
 *   weight: number,
 * }} ChestTier */

/** @type {ChestTier[]} */
export const CHEST_TIERS = [
  {
    level: 1,
    name: "Caja verde",
    cash: 35_000,
    gold: 0,
    diamonds: 0,
    xp: 200,
    color: "#3ecf5a",
    colorDark: "#1f8a34",
    colorLight: "#9af0a8",
    weight: 50,
  },
  {
    level: 2,
    name: "Caja azul",
    cash: 120_000,
    gold: 0,
    diamonds: 0,
    xp: 500,
    color: "#3b8cff",
    colorDark: "#1a4fbf",
    colorLight: "#9ec5ff",
    weight: 30,
  },
  {
    level: 3,
    name: "Caja dorada",
    cash: 300_000,
    gold: 4,
    diamonds: 0,
    xp: 1500,
    color: "#ffd24a",
    colorDark: "#c48a08",
    colorLight: "#fff0a8",
    weight: 15,
  },
  {
    level: 4,
    name: "Caja diamante",
    cash: 500_000,
    gold: 0,
    diamonds: 1,
    xp: 3000,
    color: "#5b6dff",
    colorDark: "#2a2f9a",
    colorLight: "#c4cbff",
    weight: 5,
  },
];

const TIER_BY_LEVEL = new Map(CHEST_TIERS.map((t) => [t.level, t]));

export function chestTierByLevel(level) {
  return TIER_BY_LEVEL.get(level) || null;
}

/** Local calendar day key YYYY-MM-DD */
export function calendarDayKey(ms = Date.now()) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Weighted pick — lower levels more likely (weights sum 100).
 * @param {() => number} [rng] 0..1
 */
export function rollChestTier(rng = Math.random) {
  const total = CHEST_TIERS.reduce((s, t) => s + t.weight, 0);
  let r = rng() * total;
  for (const t of CHEST_TIERS) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return CHEST_TIERS[0];
}

export class DailyChestLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   */
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    /** @type {{ level: number, tx: number, ty: number, spawnedDay: string } | null} */
    this.active = null;
    /** Last day a chest was spawned (collected or still active). */
    this.spawnedDay = null;
  }

  has(tx, ty) {
    return !!(this.active && this.active.tx === tx && this.active.ty === ty);
  }

  at(tx, ty) {
    if (!this.has(tx, ty)) return null;
    return this.active;
  }

  /** True if footprint overlaps the chest tile. */
  blocks(tx, ty, w = 1, h = 1) {
    if (!this.active) return false;
    const cx = this.active.tx;
    const cy = this.active.ty;
    return cx >= tx && cy >= ty && cx < tx + w && cy < ty + h;
  }

  clear() {
    this.active = null;
  }

  /**
   * @param {(tx: number, ty: number) => boolean} isFree
   * @param {number} [now]
   * @returns {{ spawned: boolean, chest?: object, reason?: string }}
   */
  ensureDaily(isFree, now = Date.now()) {
    const day = calendarDayKey(now);
    if (this.active) return { spawned: false, reason: "already_active", chest: this.active };
    if (this.spawnedDay === day) return { spawned: false, reason: "already_today" };

    const tier = rollChestTier();
    const spot = this._findSpot(isFree);
    if (!spot) return { spawned: false, reason: "no_space" };

    this.active = {
      level: tier.level,
      tx: spot.tx,
      ty: spot.ty,
      spawnedDay: day,
    };
    this.spawnedDay = day;
    return { spawned: true, chest: this.active };
  }

  /**
   * @param {(tx: number, ty: number) => boolean} isFree
   */
  _findSpot(isFree) {
    const candidates = [];
    for (let ty = 0; ty < this.rows; ty++) {
      for (let tx = 0; tx < this.cols; tx++) {
        if (isFree(tx, ty)) candidates.push({ tx, ty });
      }
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /**
   * Collect and clear the active chest.
   * @returns {{ tier: ChestTier, tx: number, ty: number } | null}
   */
  collect() {
    if (!this.active) return null;
    const tier = chestTierByLevel(this.active.level);
    if (!tier) {
      this.active = null;
      return null;
    }
    const { tx, ty } = this.active;
    this.active = null;
    return { tier, tx, ty };
  }

  serialize() {
    return {
      spawnedDay: this.spawnedDay,
      active: this.active
        ? {
            level: this.active.level,
            tx: this.active.tx,
            ty: this.active.ty,
            spawnedDay: this.active.spawnedDay,
          }
        : null,
    };
  }

  /**
   * @param {object|null} data
   * @param {(tx: number, ty: number) => boolean} [isFree]
   */
  load(data, isFree = null) {
    this.active = null;
    this.spawnedDay = data?.spawnedDay ?? null;
    const a = data?.active;
    if (a && Number(a.level) >= 1 && Number(a.level) <= 4) {
      const tx = Number(a.tx);
      const ty = Number(a.ty);
      if (
        Number.isFinite(tx) &&
        Number.isFinite(ty) &&
        tx >= 0 &&
        ty >= 0 &&
        tx < this.cols &&
        ty < this.rows &&
        (!isFree || isFree(tx, ty))
      ) {
        this.active = {
          level: Number(a.level),
          tx,
          ty,
          spawnedDay: a.spawnedDay || this.spawnedDay,
        };
      }
    }
  }
}
