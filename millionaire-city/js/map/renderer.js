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

  /** Soft mottled grass matching Millionaire City reference (~#5A7917). */
  _ensureGrassPattern() {
    if (this.grassPattern) return this.grassPattern;
    const size = 128;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    const d = img.data;
    // Base / light / dark from reference screenshot samples
    const base = [90, 121, 23]; // #5A7917
    const light = [100, 132, 20]; // #648414
    const dark = [80, 110, 18]; // #506E12
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Layered value noise for soft lawn grain (not a hard checker)
        const n1 =
          Math.sin(x * 0.37 + y * 0.19) * 0.35 +
          Math.sin(x * 0.11 - y * 0.29) * 0.25 +
          Math.sin((x + y) * 0.08) * 0.2 +
          Math.sin(x * 0.73) * Math.cos(y * 0.61) * 0.2;
        const n2 = ((x * 374761393 + y * 668265263) >>> 0) % 1000 / 1000 - 0.5;
        const t = Math.max(-1, Math.min(1, n1 + n2 * 0.35));
        const src = t > 0 ? light : dark;
        const a = Math.abs(t);
        const i = (y * size + x) * 4;
        d[i] = Math.round(base[0] + (src[0] - base[0]) * a);
        d[i + 1] = Math.round(base[1] + (src[1] - base[1]) * a);
        d[i + 2] = Math.round(base[2] + (src[2] - base[2]) * a);
        d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this.grassPattern = this.ctx.createPattern(c, "repeat");
    return this.grassPattern;
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
    // Canvas resize resets context; rebuild grass pattern next draw
    this.grassPattern = null;
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

  /** World coords → canvas CSS pixel position. */
  worldToScreen(wx, wy) {
    const z = this.camera.zoom;
    const mapW = this.grid.cols * this.grid.tile;
    const mapH = this.grid.rows * this.grid.tile;
    return {
      x: (wx - mapW / 2 - this.camera.x) * z + this.cssWidth / 2,
      y: (wy - mapH / 2 - this.camera.y) * z + this.cssHeight / 2,
    };
  }

  /** Top-center of a building footprint in canvas CSS pixels. */
  buildingAnchorScreen(building) {
    const tile = this.grid.tile;
    const wx = (building.tx + building.def.gridW / 2) * tile;
    const wy = building.ty * tile;
    return this.worldToScreen(wx, wy);
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

    // Ground — vibrant MC grass (color matched to reference screenshot)
    ctx.fillStyle = this._ensureGrassPattern() || "#5A7917";
    ctx.fillRect(0, 0, mapW, mapH);
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
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
            // Fill cell exactly (32x32) to avoid seams from centering smaller assets
            ctx.drawImage(img, tx * tile, ty * tile, tile, tile);
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

    // Buildings Y-sorted by bottom of footprint (skip one being dragged)
    const hideId = this.hover?.hideId || null;
    const sorted = [...this.grid.buildings].sort((a, b) => {
      const ay = a.ty + a.def.gridH;
      const by = b.ty + b.def.gridH;
      return ay - by || a.tx - b.tx;
    });

    for (const b of sorted) {
      if (hideId && b.id === hideId) continue;
      this._drawBuilding(b.def, b.tx, b.ty, 1);
      this._drawStatus(b);
    }

    // Ghost sprite on top (also when invalid, so relocate preview stays visible)
    if (this.hover && this.hover.def) {
      this._drawBuilding(this.hover.def, this.hover.tx, this.hover.ty, this.hover.valid ? 0.55 : 0.35);
    }

    ctx.restore();
  }

  _drawStatus(b) {
    const rt = b.runtime;
    if (!rt) return;
    const ctx = this.ctx;
    const tile = this.grid.tile;
    const cx = (b.tx + b.def.gridW / 2) * tile;
    const top = b.ty * tile - 4;
    const st = rt.status;

    // Progress bar while waiting
    if (st === "waiting" && rt.durationMs > 0) {
      const pct = 1 - Math.max(0, rt.remainingMs) / rt.durationMs;
      const bw = Math.max(24, b.def.gridW * tile * 0.7);
      const bh = 5;
      const bx = cx - bw / 2;
      const by = top - 8;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = "#1a2329";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = b.def.category === "commercial" ? "#e0b15f" : "#3db89a";
      ctx.fillRect(bx, by, bw * pct, bh);
    }

    // Status badge
    let label = null;
    let color = "#3db89a";
    if (st === "idle" && b.def.category === "house") {
      label = "📋";
      color = "#6a8aa8";
    } else if (st === "ready") {
      label = "$";
      color = "#3db89a";
    } else if (st === "lost") {
      label = "!";
      color = "#e07a5f";
    } else if (st === "waiting" && b.def.category === "commercial" && (rt.customers || 0) === 0) {
      label = "0";
      color = "#9ab0b8";
    }

    if (label) {
      const r = 10;
      const by = top - (st === "waiting" ? 22 : 6);
      ctx.beginPath();
      ctx.arc(cx, by, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, by + 0.5);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    // Customer count on commerces
    if (b.def.category === "commercial" && (rt.customers || 0) > 0) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.font = "10px sans-serif";
      const text = `${rt.customers}👤`;
      const tw = ctx.measureText(text).width;
      const tx = cx - tw / 2 - 3;
      const ty = (b.ty + b.def.gridH) * tile + 2;
      ctx.fillRect(tx, ty, tw + 6, 12);
      ctx.fillStyle = "#e0b15f";
      ctx.fillText(text, tx + 3, ty + 10);
    }
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
