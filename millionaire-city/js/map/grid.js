/** Tile grid occupancy and placement rules. */
export class Grid {
  constructor(cols = 80, rows = 60, tile = 32) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    /** @type {(null|{id:string, def:object, tx:number, ty:number})[]} */
    this.cells = new Array(cols * rows).fill(null);
    /** @type {{id:string, def:object, tx:number, ty:number}[]} */
    this.buildings = [];
    /** @type {import("./river.js").RiverLayer|null} */
    this.river = null;
    /** @type {import("./expansions.js").ExpansionLayer|null} */
    this.expansions = null;
    this._nextId = 1;
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  inBounds(tx, ty, w, h) {
    return tx >= 0 && ty >= 0 && tx + w <= this.cols && ty + h <= this.rows;
  }

  canPlace(tx, ty, w, h, ignoreId = null) {
    if (!this.inBounds(tx, ty, w, h)) return false;
    if (this.expansions && !this.expansions.canBuild(tx, ty, w, h)) return false;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.river?.occupies(x, y)) return false;
        const cell = this.cells[this.index(x, y)];
        if (cell && cell.id !== ignoreId) return false;
      }
    }
    return true;
  }

  place(def, tx, ty) {
    const w = def.gridW;
    const h = def.gridH;
    if (!this.canPlace(tx, ty, w, h)) return null;
    const building = {
      id: `b${this._nextId++}`,
      def,
      tx,
      ty,
      runtime: null, // filled by EconomySim / createRuntime
    };
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        this.cells[this.index(x, y)] = building;
      }
    }
    this.buildings.push(building);
    return building;
  }

  /**
   * Relocate a building in place (keeps id + runtime).
   * @returns {boolean}
   */
  move(building, tx, ty) {
    const w = building.def.gridW;
    const h = building.def.gridH;
    if (!this.canPlace(tx, ty, w, h, building.id)) return false;
    const { tx: ox, ty: oy } = building;
    for (let y = oy; y < oy + h; y++) {
      for (let x = ox; x < ox + w; x++) {
        this.cells[this.index(x, y)] = null;
      }
    }
    building.tx = tx;
    building.ty = ty;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        this.cells[this.index(x, y)] = building;
      }
    }
    return true;
  }

  buildingAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return null;
    return this.cells[this.index(tx, ty)];
  }

  eraseAt(tx, ty) {
    const b = this.buildingAt(tx, ty);
    if (!b) return null;
    const { def, tx: ox, ty: oy } = b;
    for (let y = oy; y < oy + def.gridH; y++) {
      for (let x = ox; x < ox + def.gridW; x++) {
        this.cells[this.index(x, y)] = null;
      }
    }
    this.buildings = this.buildings.filter((x) => x.id !== b.id);
    return b;
  }
}

/** Bottom-centered sprite anchor (from DEX_FINDINGS). */
export function spriteOrigin(def, tileX, tileY, TILE = 32) {
  const footprintW = def.gridW * TILE;
  const footprintH = def.gridH * TILE;
  const ox = def.spriteOffsetX || 0;
  const oy = def.spriteOffsetY || 0;
  const drawX = tileX * TILE + (footprintW - def.width) / 2 + ox;
  const drawY = tileY * TILE + footprintH - def.height + oy;
  return { drawX, drawY };
}
