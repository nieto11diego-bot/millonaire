import { spriteOrigin } from "./grid.js";

/**
 * Canvas renderer: grass grid + buildings with Y-sort.
 */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import("./grid.js").Grid} grid
   */
  constructor(canvas, grid, roads = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.grid = grid;
    /** @type {import("./roads.js").RoadLayer|null} */
    this.roads = roads;
    this.camera = { x: 0, y: 0, zoom: 1 };
    /** @type {Map<string, HTMLImageElement>} */
    this.images = new Map();
    this.hover = null; // { tx, ty, def, valid } | { tx, ty, road: true, valid }
    this.grassPattern = null;
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cssWidth = w;
    this.cssHeight = h;
  }

  async preload(defs) {
    const urls = [...new Set(defs.map((d) => d.spriteUrl).filter(Boolean))];
    await Promise.all(
      urls.map(
        (url) =>
          new Promise((resolve) => {
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

  screenToWorld(sx, sy) {
    const z = this.camera.zoom;
    return {
      x: (sx - this.cssWidth / 2) / z + this.camera.x + (this.grid.cols * this.grid.tile) / 2,
      y: (sy - this.cssHeight / 2) / z + this.camera.y + (this.grid.rows * this.grid.tile) / 2,
    };
  }

  worldToTile(wx, wy) {
    return {
      tx: Math.floor(wx / this.grid.tile),
      ty: Math.floor(wy / this.grid.tile),
    };
  }

  draw() {
    const ctx = this.ctx;
    const { tile, cols, rows } = this.grid;
    const z = this.camera.zoom;
    const mapW = cols * tile;
    const mapH = rows * tile;

    ctx.clearRect(0, 0, this.cssWidth, this.cssHeight);
    ctx.save();
    ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
    ctx.scale(z, z);
    ctx.translate(-mapW / 2 - this.camera.x, -mapH / 2 - this.camera.y);

    // Ground
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const shade = (tx + ty) % 2 === 0 ? "#3d5246" : "#364a3f";
        ctx.fillStyle = shade;
        ctx.fillRect(tx * tile, ty * tile, tile, tile);
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tile, 0);
      ctx.lineTo(x * tile, mapH);
      ctx.stroke();
    }
    for (let y = 0; y <= rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * tile);
      ctx.lineTo(mapW, y * tile);
      ctx.stroke();
    }

    // Roads under buildings (autotiled)
    if (this.roads) {
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (!this.roads.has(tx, ty)) continue;
          const url = this.roads.spriteFor(tx, ty);
          const img = this.roads.images.get(url) || this.images.get(url);
          if (img) {
            // Center non-32px tiles within the cell
            const dx = tx * tile + (tile - img.width) / 2;
            const dy = ty * tile + (tile - img.height) / 2;
            ctx.drawImage(img, dx, dy);
          } else {
            ctx.fillStyle = "#555";
            ctx.fillRect(tx * tile + 2, ty * tile + 2, tile - 4, tile - 4);
          }
        }
      }
    }

    // Ghost placement
    if (this.hover && this.hover.road) {
      const { tx, ty, valid } = this.hover;
      ctx.fillStyle = valid ? "rgba(80,80,80,0.45)" : "rgba(224,122,95,0.4)";
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
      ctx.strokeStyle = valid ? "#c0c0c0" : "#e07a5f";
      ctx.lineWidth = 2;
      ctx.strokeRect(tx * tile + 1, ty * tile + 1, tile - 2, tile - 2);
    } else if (this.hover && this.hover.def) {
      const { tx, ty, def, valid } = this.hover;
      ctx.fillStyle = valid ? "rgba(61,184,154,0.35)" : "rgba(224,122,95,0.4)";
      ctx.fillRect(tx * tile, ty * tile, def.gridW * tile, def.gridH * tile);
      ctx.strokeStyle = valid ? "#3db89a" : "#e07a5f";
      ctx.lineWidth = 2;
      ctx.strokeRect(tx * tile + 1, ty * tile + 1, def.gridW * tile - 2, def.gridH * tile - 2);

      // Commerce customer radius / deco influence radius
      const radiusTiles =
        def.clientRadiusTiles != null
          ? def.clientRadiusTiles + Math.max(def.gridW, def.gridH) / 2
          : def.influenceRadiusTiles != null
            ? def.influenceRadiusTiles + Math.max(def.gridW, def.gridH) / 2
            : null;
      if (radiusTiles != null && valid) {
        const cx = tx + def.gridW / 2;
        const cy = ty + def.gridH / 2;
        ctx.beginPath();
        ctx.arc(cx * tile, cy * tile, radiusTiles * tile, 0, Math.PI * 2);
        ctx.strokeStyle =
          def.clientRadiusTiles != null ? "rgba(224,177,95,0.7)" : "rgba(138,154,91,0.75)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Buildings Y-sorted by bottom of footprint
    const sorted = [...this.grid.buildings].sort((a, b) => {
      const ay = a.ty + a.def.gridH;
      const by = b.ty + b.def.gridH;
      return ay - by || a.tx - b.tx;
    });

    for (const b of sorted) {
      this._drawBuilding(b.def, b.tx, b.ty, 1);
    }

    // Ghost sprite on top
    if (this.hover && this.hover.def && this.hover.valid) {
      this._drawBuilding(this.hover.def, this.hover.tx, this.hover.ty, 0.55);
    }

    ctx.restore();
  }

  _drawBuilding(def, tx, ty, alpha) {
    const ctx = this.ctx;
    const { drawX, drawY } = spriteOrigin(def, tx, ty, this.grid.tile);
    const img = def.spriteUrl ? this.images.get(def.spriteUrl) : null;
    ctx.globalAlpha = alpha;
    if (img) {
      ctx.drawImage(img, drawX, drawY);
    } else {
      // Placeholder block
      const colors = {
        house: "#6b8f71",
        commercial: "#6a8aa8",
        decoration: "#8a9a5b",
        wonder: "#c4a35a",
      };
      ctx.fillStyle = colors[def.category] || "#708090";
      ctx.fillRect(
        tx * this.grid.tile + 2,
        ty * this.grid.tile + 2,
        def.gridW * this.grid.tile - 4,
        def.gridH * this.grid.tile - 4
      );
      ctx.fillStyle = "#fff";
      ctx.font = "10px sans-serif";
      ctx.fillText(def.name || "?", tx * this.grid.tile + 4, ty * this.grid.tile + 14);
    }
    ctx.globalAlpha = 1;
  }
}
