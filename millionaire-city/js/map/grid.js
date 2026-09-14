/** Tile grid occupancy and placement rules. */
export class Grid {
  constructor(cols = 40, rows = 30, tile = 32) {
    this.cols = cols;
    this.rows = rows;
    this.tile = tile;
    /** @type {(null|{id:string, def:object, tx:number, ty:number})[]} */
    this.cells = new Array(cols * rows).fill(null);
    /** @type {{id:string, def:object, tx:number, ty:number}[]} */
    this.buildings = [];
    this._nextId = 1;
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  inBounds(tx, ty, w, h) {
    return tx >= 0 && ty >= 0 && tx + w <= this.cols && ty + h <= this.rows;
  }

  canPlace(tx, ty, w, h) {
    if (!this.inBounds(tx, ty, w, h)) return false;
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.cells[this.index(x, y)]) return false;
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
    };
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        this.cells[this.index(x, y)] = building;
      }
    }
    this.buildings.push(building);
    return building;
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
  const drawX = tileX * TILE + (footprintW - def.width) / 2;
  const drawY = tileY * TILE + footprintH - def.height;
  return { drawX, drawY };
}
