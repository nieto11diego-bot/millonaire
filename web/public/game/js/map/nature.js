/**
 * Map scenery vegetation (trees) scattered for atmosphere.
 * Occupies tiles like buildings but is not a shop decoration.
 */

/** @typedef {{ id: string, spriteUrl: string, width: number, height: number, gridW: number, gridH: number, name: string }} NatureKind */

/** @type {NatureKind[]} */
export const NATURE_KINDS = [
  { id: "cypress", name: "Ciprés", spriteUrl: "assets/buildings/r1_0634.png", width: 44, height: 75, gridW: 1, gridH: 1 },
  { id: "palm", name: "Palmera", spriteUrl: "assets/buildings/r1_0638.png", width: 45, height: 71, gridW: 1, gridH: 1 },
  { id: "blossom", name: "Cerezo", spriteUrl: "assets/buildings/r1_0640.png", width: 75, height: 52, gridW: 1, gridH: 1 },
  { id: "fruit", name: "Árbol frutal", spriteUrl: "assets/buildings/r1_0642.png", width: 52, height: 58, gridW: 1, gridH: 1 },
  { id: "oak", name: "Roble", spriteUrl: "assets/buildings/r1_0647.png", width: 55, height: 58, gridW: 1, gridH: 1 },
  { id: "silver_maple", name: "Arce plateado", spriteUrl: "assets/buildings/silver_maple.png", width: 60, height: 74, gridW: 1, gridH: 1 },
  { id: "gold_maple", name: "Arce dorado", spriteUrl: "assets/buildings/gold_maple.png", width: 47, height: 61, gridW: 1, gridH: 1 },
];

const KIND_BY_ID = new Map(NATURE_KINDS.map((k) => [k.id, k]));

export function natureKindById(id) {
  return KIND_BY_ID.get(id) || null;
}

export class NatureLayer {
  /**
   * @param {number} cols
   * @param {number} rows
   */
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    /** @type {{ id: string, kindId: string, tx: number, ty: number, kind: NatureKind }[]} */
    this.items = [];
    /** @type {(null|{ id: string })[]} */
    this.cells = new Array(cols * rows).fill(null);
    this._nextId = 1;
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  inBounds(tx, ty, w = 1, h = 1) {
    return tx >= 0 && ty >= 0 && tx + w <= this.cols && ty + h <= this.rows;
  }

  has(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return !!this.cells[this.index(tx, ty)];
  }

  /** True if any cell in the footprint is occupied by vegetation. */
  blocks(tx, ty, w = 1, h = 1) {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.has(x, y)) return true;
      }
    }
    return false;
  }

  at(tx, ty) {
    if (!this.has(tx, ty)) return null;
    const cell = this.cells[this.index(tx, ty)];
    return this.items.find((it) => it.id === cell.id) || null;
  }

  /**
   * @param {object} item
   * @returns {object|null}
   */
  remove(item) {
    if (!item) return null;
    const idx = this.items.findIndex((it) => it.id === item.id);
    if (idx < 0) return null;
    const w = item.kind.gridW;
    const h = item.kind.gridH;
    for (let y = item.ty; y < item.ty + h; y++) {
      for (let x = item.tx; x < item.tx + w; x++) {
        const i = this.index(x, y);
        if (this.cells[i]?.id === item.id) this.cells[i] = null;
      }
    }
    this.items.splice(idx, 1);
    return item;
  }

  /**
   * @param {object} item
   * @param {number} tx
   * @param {number} ty
   * @returns {boolean}
   */
  move(item, tx, ty) {
    if (!item) return false;
    const w = item.kind.gridW;
    const h = item.kind.gridH;
    if (!this.inBounds(tx, ty, w, h)) return false;
    if (item.tx === tx && item.ty === ty) return true;
    // Clear old footprint first so self-overlap is allowed
    for (let y = item.ty; y < item.ty + h; y++) {
      for (let x = item.tx; x < item.tx + w; x++) {
        const i = this.index(x, y);
        if (this.cells[i]?.id === item.id) this.cells[i] = null;
      }
    }
    if (this.blocks(tx, ty, w, h)) {
      // Restore old footprint
      for (let y = item.ty; y < item.ty + h; y++) {
        for (let x = item.tx; x < item.tx + w; x++) {
          this.cells[this.index(x, y)] = item;
        }
      }
      return false;
    }
    item.tx = tx;
    item.ty = ty;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        this.cells[this.index(x, y)] = item;
      }
    }
    return true;
  }

  clear() {
    this.items = [];
    this.cells.fill(null);
    this._nextId = 1;
  }

  /**
   * @param {NatureKind} kind
   * @param {number} tx
   * @param {number} ty
   * @returns {object|null}
   */
  place(kind, tx, ty) {
    const w = kind.gridW;
    const h = kind.gridH;
    if (!this.inBounds(tx, ty, w, h)) return null;
    if (this.blocks(tx, ty, w, h)) return null;
    const item = {
      id: `n${this._nextId++}`,
      kindId: kind.id,
      tx,
      ty,
      kind,
    };
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        this.cells[this.index(x, y)] = item;
      }
    }
    this.items.push(item);
    return item;
  }

  /**
   * Scatter vegetation across free tiles.
   * @param {number} count
   * @param {(tx: number, ty: number, w: number, h: number) => boolean} isBlocked
   * @param {number} [seed]
   * @returns {number} placed count
   */
  seed(count, isBlocked, seed = Date.now()) {
    this.clear();
    const rng = mulberry32(seed >>> 0);
    const kinds = NATURE_KINDS;
    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 80;

    while (placed < count && attempts < maxAttempts) {
      attempts += 1;
      const kind = kinds[Math.floor(rng() * kinds.length)];
      const tx = Math.floor(rng() * (this.cols - kind.gridW + 1));
      const ty = Math.floor(rng() * (this.rows - kind.gridH + 1));
      if (isBlocked(tx, ty, kind.gridW, kind.gridH)) continue;
      if (this.place(kind, tx, ty)) placed += 1;
    }
    return placed;
  }

  /**
   * Restore from save data.
   * @param {{ kindId: string, tx: number, ty: number, id?: string }[]} list
   * @param {(tx: number, ty: number, w: number, h: number) => boolean} [isBlocked]
   */
  load(list, isBlocked) {
    this.clear();
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const row of list) {
      if (!row) continue;
      const kind = natureKindById(row.kindId);
      if (!kind) continue;
      if (isBlocked && isBlocked(row.tx, row.ty, kind.gridW, kind.gridH)) continue;
      const item = this.place(kind, row.tx, row.ty);
      if (!item) continue;
      if (row.id) {
        item.id = row.id;
        const m = /^n(\d+)$/.exec(row.id);
        if (m) this._nextId = Math.max(this._nextId, Number(m[1]) + 1);
        // refresh cell refs to keep id
        for (let y = item.ty; y < item.ty + kind.gridH; y++) {
          for (let x = item.tx; x < item.tx + kind.gridW; x++) {
            this.cells[this.index(x, y)] = item;
          }
        }
      }
      n += 1;
    }
    return n;
  }

  serialize() {
    return this.items.map((it) => ({
      id: it.id,
      kindId: it.kindId,
      tx: it.tx,
      ty: it.ty,
    }));
  }
}

/** @param {number} a */
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
