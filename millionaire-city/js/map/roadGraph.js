/**
 * Road connectivity graph: flood-fill components for HQ-rooted gameplay gates.
 */

const N4 = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export class RoadGraph {
  /**
   * @param {{
   *   cols: number,
   *   rows: number,
   *   roads: { has(tx:number, ty:number): boolean },
   *   grid: { buildings: object[] },
   * }} opts
   */
  constructor({ cols, rows, roads, grid }) {
    this.cols = cols;
    this.rows = rows;
    this.roads = roads;
    this.grid = grid;
    /** @type {Int32Array} component id per cell; 0 = none */
    this.components = new Int32Array(cols * rows);
    this._dirty = true;
    this._nextComponent = 1;
  }

  index(tx, ty) {
    return ty * this.cols + tx;
  }

  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < this.cols && ty < this.rows;
  }

  invalidate() {
    this._dirty = true;
  }

  ensureBuilt() {
    if (this._dirty) this.rebuild();
  }

  rebuild() {
    const { cols, rows, roads } = this;
    const n = cols * rows;
    this.components.fill(0);
    this._nextComponent = 1;
    const stack = [];

    for (let i = 0; i < n; i++) {
      const tx = i % cols;
      const ty = (i / cols) | 0;
      if (!roads.has(tx, ty) || this.components[i] !== 0) continue;
      const cid = this._nextComponent++;
      stack.length = 0;
      stack.push(tx, ty);
      this.components[i] = cid;
      while (stack.length) {
        const cy = stack.pop();
        const cx = stack.pop();
        for (const [dx, dy] of N4) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (!this.inBounds(nx, ny)) continue;
          if (!roads.has(nx, ny)) continue;
          const ni = this.index(nx, ny);
          if (this.components[ni] !== 0) continue;
          this.components[ni] = cid;
          stack.push(nx, ny);
        }
      }
    }
    this._dirty = false;
  }

  componentAt(tx, ty) {
    this.ensureBuilt();
    if (!this.inBounds(tx, ty)) return 0;
    return this.components[this.index(tx, ty)];
  }

  /**
   * Road tiles within 8-neighbourhood of the building footprint.
   * @param {{ tx: number, ty: number, def: { gridW: number, gridH: number } }} building
   * @returns {{ tx: number, ty: number }[]}
   */
  accessTiles(building) {
    const out = [];
    if (!building?.def) return out;
    const { tx, ty, def } = building;
    const seen = new Set();
    for (let y = ty; y < ty + def.gridH; y++) {
      for (let x = tx; x < tx + def.gridW; x++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const rx = x + dx;
            const ry = y + dy;
            if (!this.roads.has(rx, ry)) continue;
            const key = `${rx},${ry}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({ tx: rx, ty: ry });
          }
        }
      }
    }
    return out;
  }

  /** @returns {object|null} */
  findHQ() {
    for (const b of this.grid.buildings) {
      if (b?.def?.category === "hq" || b?.def?.constant === "HQ") return b;
    }
    return null;
  }

  /**
   * True if building shares a road component with the HQ.
   * @param {object} building
   * @param {object} [hqBuilding]
   */
  isConnectedToHQ(building, hqBuilding = null) {
    this.ensureBuilt();
    const hq = hqBuilding || this.findHQ();
    if (!hq) return false;
    const hqAccess = this.accessTiles(hq);
    if (!hqAccess.length) return false;
    const hqComps = new Set();
    for (const t of hqAccess) {
      const c = this.componentAt(t.tx, t.ty);
      if (c) hqComps.add(c);
    }
    if (!hqComps.size) return false;
    for (const t of this.accessTiles(building)) {
      const c = this.componentAt(t.tx, t.ty);
      if (c && hqComps.has(c)) return true;
    }
    return false;
  }
}
