import { spriteOrigin } from "./grid.js";
import { FloatingRewards } from "./floatingRewards.js";

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
    /** @type {{ tx: number, ty: number, def: object } | null} */
    this.radiusFocus = null;
    /** @type {import("./zeppelin.js").ZeppelinFlyer|null} */
    this.zeppelin = null;
    /** @type {import("./fighter.js").FighterPair|null} */
    this.fighters = null;
    /** @type {import("./river.js").RiverLayer|null} */
    this.river = null;
    /** @type {import("./expansions.js").ExpansionLayer|null} */
    this.expansions = null;
    /** Show tile grid only while placing / moving. */
    this.showGrid = false;
    this.grassPattern = null;
    /** @type {{ zx: number, zy: number } | null} */
    this.expandHover = null;
    this.floatingRewards = new FloatingRewards();
    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  /** Soft mottled grass (#7BA73B). */
  _ensureGrassPattern() {
    if (this.grassPattern) return this.grassPattern;
    const size = 128;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    const img = g.createImageData(size, size);
    const d = img.data;
    // Base / light / dark around #7BA73B
    const base = [123, 167, 59]; // #7BA73B
    const light = [138, 182, 72]; // #8AB648
    const dark = [108, 150, 48]; // #6C9630
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
    const urls = [
      ...new Set(defs.map((d) => d.spriteUrl).filter(Boolean)),
      "assets/ui/icon_cash.png",
      "assets/ui/icon_gold.svg",
      "assets/ui/icon_diamond.svg",
    ];
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

  /** Show floating cash / XP popup above a building. */
  spawnCollectPopup(building, cash, xp = 0) {
    this.floatingRewards.spawn(building, this.grid.tile, { cash, xp });
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

    // Ground
    ctx.fillStyle = this._ensureGrassPattern() || "#7BA73B";
    ctx.fillRect(0, 0, mapW, mapH);

    // River (right edge), over grass, under roads
    this._drawRiver();

    // Locked expansion parcels + for-sale signs
    this._drawExpansions();

    if (this.showGrid) {
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
    }

    // Roads under buildings (autotiled)
    if (this.roads) {
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (!this.roads.has(tx, ty)) continue;
          if (this.river?.has(tx, ty)) continue;
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

      if (valid) this._drawInfluenceRadius(tx, ty, def);
    }

    // Hover influence for placed commerces / decorations
    if (this.radiusFocus) {
      const { tx, ty, def } = this.radiusFocus;
      this._drawInfluenceRadius(tx, ty, def);
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

    this.floatingRewards.draw(ctx);

    // Ghost sprite on top (also when invalid, so relocate preview stays visible)
    if (this.hover && this.hover.def) {
      this._drawBuilding(this.hover.def, this.hover.tx, this.hover.ty, this.hover.valid ? 0.55 : 0.35);
    }

    // Zeppelin flies above the city
    this.zeppelin?.draw(ctx);
    // Combat jets above the city
    this.fighters?.draw(ctx);

    ctx.restore();
  }

  _drawRiver() {
    const river = this.river;
    const layer = river?.layerCanvas;
    if (!layer) return;
    const ctx = this.ctx;
    const mapW = this.grid.cols * this.grid.tile;
    const mapH = this.grid.rows * this.grid.tile;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(layer, 0, 0, mapW, mapH);
  }

  /** Locked parcels (fog) + adjacent For Sale signs. */
  _drawExpansions() {
    const exp = this.expansions;
    if (!exp) return;
    const ctx = this.ctx;
    const hover = this.expandHover;

    exp.forEachZone((zx, zy) => {
      if (exp.isOwnedZone(zx, zy)) return;
      const r = exp.zoneRect(zx, zy);
      const buyable = exp.isBuyable(zx, zy);
      const hovered = hover && hover.zx === zx && hover.zy === zy;

      ctx.fillStyle = buyable
        ? hovered
          ? "rgba(40, 90, 30, 0.42)"
          : "rgba(35, 75, 28, 0.38)"
        : "rgba(20, 45, 18, 0.55)";
      ctx.fillRect(r.x, r.y, r.w, r.h);

      ctx.strokeStyle = buyable ? "rgba(255, 245, 180, 0.55)" : "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = buyable ? 2 : 1;
      ctx.setLineDash(buyable ? [8, 6] : []);
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.setLineDash([]);
    });

    exp.forEachZone((zx, zy) => {
      if (!exp.isBuyable(zx, zy)) return;
      const cost = exp.costFor(zx, zy);
      const r = exp.zoneRect(zx, zy);
      const hovered = hover && hover.zx === zx && hover.zy === zy;
      this._drawForSaleSign(r.x + r.w / 2, r.y + r.h / 2, cost, hovered);
    });
  }

  /**
   * Wooden "EN VENTA" sign with price (MC-style).
   * @param {number} cx
   * @param {number} cy
   * @param {number} cost
   * @param {boolean} [hovered]
   */
  _drawForSaleSign(cx, cy, cost, hovered = false) {
    const ctx = this.ctx;
    const scale = hovered ? 1.08 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Post
    ctx.fillStyle = "#6b4a28";
    ctx.fillRect(-4, -8, 8, 52);
    ctx.fillStyle = "#4a3218";
    ctx.fillRect(-4, 40, 8, 6);

    // Board
    const bw = 92;
    const bh = 48;
    const bx = -bw / 2;
    const by = -52;
    ctx.fillStyle = "#c4a35a";
    ctx.strokeStyle = "#5a3e1c";
    ctx.lineWidth = 2;
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeRect(bx, by, bw, bh);

    // Inner border
    ctx.strokeStyle = "rgba(90, 50, 20, 0.35)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 4, by + 4, bw - 8, bh - 8);

    ctx.fillStyle = "#7a1f1a";
    ctx.font = "bold 11px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("EN VENTA", 0, by + 16);

    ctx.fillStyle = "#1a4a20";
    ctx.font = "bold 13px Fredoka, sans-serif";
    const price = Number(cost).toLocaleString("en-US");
    const cashImg = this.images.get("assets/ui/icon_cash.png");
    if (cashImg) {
      const ih = 14;
      const iw = (cashImg.width / cashImg.height) * ih;
      const tw = ctx.measureText(price).width;
      const gap = 4;
      const total = iw + gap + tw;
      const x0 = -total / 2;
      ctx.drawImage(cashImg, x0, by + 34 - ih / 2, iw, ih);
      ctx.textAlign = "left";
      ctx.fillText(price, x0 + iw + gap, by + 34);
      ctx.textAlign = "center";
    } else {
      ctx.fillText(price, 0, by + 34);
    }

    ctx.restore();
  }

  /**
   * Commerce client radius / decoration influence radius.
   * @param {number} tx
   * @param {number} ty
   * @param {object} def
   */
  _drawInfluenceRadius(tx, ty, def) {
    const base =
      def.clientRadiusTiles != null
        ? def.clientRadiusTiles
        : def.influenceRadiusTiles != null
          ? def.influenceRadiusTiles
          : null;
    if (base == null || base < 0) return;
    const radiusTiles = base + Math.max(def.gridW, def.gridH) / 2;

    const ctx = this.ctx;
    const tile = this.grid.tile;
    const cx = (tx + def.gridW / 2) * tile;
    const cy = (ty + def.gridH / 2) * tile;
    const r = radiusTiles * tile;
    const isCommerce = def.clientRadiusTiles != null;
    const isWonder = def.category === "wonder" || def.cityBonusScaled != null;
    const fill = isCommerce
      ? "rgba(224,177,95,0.16)"
      : isWonder
        ? "rgba(212,168,72,0.16)"
        : "rgba(138,154,91,0.18)";
    const stroke = isCommerce
      ? "rgba(224,177,95,0.9)"
      : isWonder
        ? "rgba(196,140,40,0.95)"
        : "rgba(138,154,91,0.95)";

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawStatus(b) {
    const rt = b.runtime;
    if (!rt) return;
    const ctx = this.ctx;
    const tile = this.grid.tile;
    const cx = (b.tx + b.def.gridW / 2) * tile;
    // Anchor to sprite top so badges float above the roof, not mid-building.
    const { drawY: spriteTop } = spriteOrigin(b.def, b.tx, b.ty, tile);
    const st = rt.status;

    // Wonder premium collect badges (gold / diamond can both be ready)
    if (b.def.category === "wonder") {
      const now = Date.now();
      const icons = [];
      if (now >= (rt.goldReadyAt || 0)) icons.push("assets/ui/icon_gold.svg");
      if (now >= (rt.diamondReadyAt || 0)) icons.push("assets/ui/icon_diamond.svg");
      if (!icons.length) return;

      const iconScale = 1.35;
      const bob = Math.sin(performance.now() / 280) * 3.5;
      const gap = 6;
      let totalW = 0;
      const sizes = icons.map((url) => {
        const img = this.images.get(url);
        if (!img) return null;
        const w = (url.includes("gold") ? 22 : 24) * iconScale;
        const h = (img.height / Math.max(1, img.width)) * w;
        totalW += w;
        return { img, w, h };
      });
      totalW += gap * (icons.length - 1);
      let x = cx - totalW / 2;
      for (const sz of sizes) {
        if (!sz) continue;
        ctx.drawImage(sz.img, x, spriteTop - 8 - sz.h + bob, sz.w, sz.h);
        x += sz.w + gap;
      }
      return;
    }

    // Progress bar while waiting
    if (st === "waiting" && rt.durationMs > 0) {
      const pct = 1 - Math.max(0, rt.remainingMs) / rt.durationMs;
      const bw = Math.max(24, b.def.gridW * tile * 0.7);
      const bh = 5;
      const bx = cx - bw / 2;
      const by = spriteTop - 10;
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
    let spriteUrl = null;
    if (st === "idle" && b.def.category === "house") {
      label = "📋";
      color = "#6a8aa8";
    } else if (st === "ready") {
      spriteUrl = "assets/ui/icon_cash.png";
    } else if (st === "lost") {
      label = "!";
      color = "#e07a5f";
    } else if (st === "waiting" && b.def.category === "commercial" && (rt.customers || 0) === 0) {
      label = "0";
      color = "#9ab0b8";
    }

    const iconScale = 1.4;
    const badgeY =
      spriteTop - (st === "waiting" ? 22 : st === "ready" ? 6 : 14) * iconScale;

    if (spriteUrl) {
      const img = this.images.get(spriteUrl);
      if (img) {
        const w = 30 * iconScale * 2;
        const h = (img.height / img.width) * w;
        // Soft bob so the collect cue reads like the original game
        const bob = Math.sin(performance.now() / 280) * 3.5;
        ctx.drawImage(img, cx - w / 2, badgeY - h + bob, w, h);
      }
    } else if (label) {
      const r = 10 * iconScale;
      ctx.beginPath();
      ctx.arc(cx, badgeY, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1 * iconScale;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${11 * iconScale}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, badgeY + 0.5 * iconScale);
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
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, drawX, drawY, def.width, def.height);
    } else {
      // Placeholder block
      const colors = {
        house: "#6b8f71",
        commercial: "#6a8aa8",
        decoration: "#8a9a5b",
        wonder: "#c4a35a",
        service: "#c45c4a",
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
