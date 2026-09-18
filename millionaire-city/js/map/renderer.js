import { spriteOrigin } from "./grid.js";
import { FloatingRewards } from "./floatingRewards.js";
import { TIME_SCALE, formatDuration, usesLootEconomy, lootIntervalMs } from "../economy.js";

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
    /** Footprint perimeter highlight for move / erase hover. */
    /** @type {{ tx: number, ty: number, gridW: number, gridH: number, kind: "move"|"erase" } | null} */
    this.highlight = null;
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
    /** Flat base grass color. */
    this.grassColor = "#7BA73B";
    /** @type {{ zx: number, zy: number } | null} */
    this.expandHover = null;
    this.floatingRewards = new FloatingRewards();
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

    // Base grass (suelo liso)
    ctx.fillStyle = this.grassColor;
    ctx.fillRect(0, 0, mapW, mapH);

    // River (right edge), over grass, under roads
    this._drawRiver();

    // Locked expansion parcels + for-sale signs
    this._drawExpansions();

    // Picket fences along every expansion parcel perimeter
    this._drawExpansionFences();

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

    // Ghost placement (previews under building sprites when applicable)
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

    // Hover influence for placed decorations / wonders
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
      const constructing = b.runtime?.status === "building";
      this._drawBuilding(b.def, b.tx, b.ty, constructing ? 0.72 : 1);
      this._drawStatus(b);
    }

    this._drawHighlight();

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

  /** Perimeter outline for the building under Move / Destroy tools. */
  _drawHighlight() {
    const h = this.highlight;
    if (!h) return;
    const ctx = this.ctx;
    const tile = this.grid.tile;
    const x = h.tx * tile;
    const y = h.ty * tile;
    const w = h.gridW * tile;
    const hh = h.gridH * tile;
    const erase = h.kind === "erase";
    const stroke = erase ? "#e07a5f" : "#3db89a";
    const fill = erase ? "rgba(224,122,95,0.16)" : "rgba(61,184,154,0.14)";
    const t = performance.now();
    const pulse = 0.72 + Math.sin(t / 260) * 0.28;

    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, hh);

    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.4)";
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, hh - 3);

    ctx.globalAlpha = pulse;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.lineDashOffset = -(t / 45) % 16;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, hh - 3);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;
  }

  /**
   * Light-gray picket fences along the owned-land perimeter (MC-style).
   * Shared edges between two owned parcels are omitted; river / road tiles
   * are skipped as openings. Edges next to unowned land are outset a few px
   * so sprites on the parcel rim do not sit under the pickets.
   */
  _drawExpansionFences() {
    const exp = this.expansions;
    if (!exp) return;
    const tile = this.grid.tile;
    const { zoneW, zoneH, zonesX, zonesY } = exp;
    /** @type {number} px gap between owned parcel content and fence */
    const outset = 5;

    // Horizontal edges (zy = 0 .. zonesY inclusive) — only owned↔unowned perimeter
    for (let zy = 0; zy <= zonesY; zy++) {
      const y = zy * zoneH * tile;
      for (let zx = 0; zx < zonesX; zx++) {
        const aboveOwned = zy > 0 && exp.isOwnedZone(zx, zy - 1);
        const belowOwned = zy < zonesY && exp.isOwnedZone(zx, zy);
        if (aboveOwned === belowOwned) continue;
        let yDraw = y;
        if (aboveOwned && !belowOwned) yDraw = y + outset;
        else if (!aboveOwned && belowOwned) yDraw = y - outset;
        const x0 = zx * zoneW * tile;
        this._drawFenceRun(x0, yDraw, zoneW * tile, true);
      }
    }

    // Vertical edges (zx = 0 .. zonesX inclusive) — only owned↔unowned perimeter
    for (let zx = 0; zx <= zonesX; zx++) {
      const x = zx * zoneW * tile;
      for (let zy = 0; zy < zonesY; zy++) {
        const leftOwned = zx > 0 && exp.isOwnedZone(zx - 1, zy);
        const rightOwned = zx < zonesX && exp.isOwnedZone(zx, zy);
        if (leftOwned === rightOwned) continue;
        let xDraw = x;
        if (leftOwned && !rightOwned) xDraw = x + outset;
        else if (!leftOwned && rightOwned) xDraw = x - outset;
        const y0 = zy * zoneH * tile;
        this._drawFenceRun(xDraw, y0, zoneH * tile, false);
      }
    }
  }

  /**
   * One straight fence segment in world pixels.
   * @param {number} x
   * @param {number} y
   * @param {number} length
   * @param {boolean} horizontal
   */
  _drawFenceRun(x, y, length, horizontal) {
    const ctx = this.ctx;
    const tile = this.grid.tile;
    const picketGap = 15.35625;
    const picketH = 16.891875;
    const rail = "#c2c2c2";
    const picket = "#dedede";
    const outline = "rgba(50,50,50,0.28)";

    const steps = Math.max(1, Math.round(length / tile));
    for (let s = 0; s < steps; s++) {
      const along = s * tile;
      const segLen = Math.min(tile, length - along);
      if (segLen <= 1) continue;

      let tx;
      let ty;
      if (horizontal) {
        tx = Math.floor((x + along + segLen * 0.5) / tile);
        ty = Math.floor(y / tile);
        if (this._fenceBlocked(tx, ty) || this._fenceBlocked(tx, ty - 1)) continue;
      } else {
        tx = Math.floor(x / tile);
        ty = Math.floor((y + along + segLen * 0.5) / tile);
        if (this._fenceBlocked(tx, ty) || this._fenceBlocked(tx - 1, ty)) continue;
      }

      const x0 = horizontal ? x + along : x;
      const y0 = horizontal ? y : y + along;

      // Soft shadow rail
      ctx.strokeStyle = outline;
      ctx.lineWidth = 6.1425;
      ctx.lineCap = "butt";
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(x0, y0 + 1.84275);
        ctx.lineTo(x0 + segLen, y0 + 1.84275);
      } else {
        ctx.moveTo(x0 + 1.84275, y0);
        ctx.lineTo(x0 + 1.84275, y0 + segLen);
      }
      ctx.stroke();

      // Main rail
      ctx.strokeStyle = rail;
      ctx.lineWidth = 3.8390625;
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + segLen, y0);
      } else {
        ctx.moveTo(x0, y0);
        ctx.lineTo(x0, y0 + segLen);
      }
      ctx.stroke();

      const count = Math.max(1, Math.floor(segLen / picketGap));
      for (let i = 0; i <= count; i++) {
        const t = count === 0 ? 0.5 : i / count;
        const px = horizontal ? x0 + t * segLen : x0;
        const py = horizontal ? y0 : y0 + t * segLen;
        this._drawPicket(ctx, px, py, picketH, picket, outline);
      }
    }
  }

  /** @param {number} tx @param {number} ty */
  _fenceBlocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.grid.cols || ty >= this.grid.rows) return false;
    if (this.river?.has(tx, ty)) return true;
    if (this.roads?.has(tx, ty)) return true;
    return false;
  }

  /**
   * Tiny top-down picket post with a pointed tip (reads on EW and NS rails).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} cx
   * @param {number} cy
   * @param {number} h
   * @param {string} fill
   * @param {string} stroke
   */
  _drawPicket(ctx, cx, cy, h, fill, stroke) {
    const half = 3.2248125;
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.84275;
    ctx.beginPath();
    ctx.moveTo(cx - half, cy + 3.6855);
    ctx.lineTo(cx - half, cy - h + 5.52825);
    ctx.lineTo(cx, cy - h);
    ctx.lineTo(cx + half, cy - h + 5.52825);
    ctx.lineTo(cx + half, cy + 3.6855);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
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
   * Decoration / wonder influence radius.
   * @param {number} tx
   * @param {number} ty
   * @param {object} def
   */
  _drawInfluenceRadius(tx, ty, def) {
    const base = def.influenceRadiusTiles != null ? def.influenceRadiusTiles : null;
    if (base == null || base < 0) return;
    const radiusTiles = base + Math.max(def.gridW, def.gridH) / 2;

    const ctx = this.ctx;
    const tile = this.grid.tile;
    const cx = (tx + def.gridW / 2) * tile;
    const cy = (ty + def.gridH / 2) * tile;
    const r = radiusTiles * tile;
    const isWonder = def.category === "wonder";
    const isShop = def.category === "commercial";
    const fill = isWonder
      ? "rgba(212,168,72,0.16)"
      : isShop
        ? "rgba(90,150,200,0.16)"
        : "rgba(138,154,91,0.18)";
    const stroke = isWonder
      ? "rgba(196,140,40,0.95)"
      : isShop
        ? "rgba(70,130,190,0.95)"
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

    // Construction progress (houses / wonders)
    if (st === "building" && rt.buildDurationMs > 0) {
      const left = Math.max(0, (rt.buildEndsAt || 0) - Date.now());
      const pct = 1 - left / rt.buildDurationMs;
      const bw = Math.max(72, b.def.gridW * tile * 0.95);
      const bh = 16;
      const bx = cx - bw / 2;
      const by = spriteTop - 22;
      this._drawTimedBar(bx, by, bw, bh, pct, "#f0c14a", formatDuration(left));

      const r = 11;
      ctx.beginPath();
      ctx.arc(cx, by - 16, r, 0, Math.PI * 2);
      ctx.fillStyle = "#c4a35a";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🔨", cx, by - 15.5);
      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
      return;
    }

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

    // Progress bar while waiting (loot interval or legacy rent timer)
    if (st === "waiting") {
      const bw = Math.max(72, b.def.gridW * tile * 0.95);
      const bh = 16;
      const bx = cx - bw / 2;
      const by = spriteTop - 20;

      if (usesLootEconomy(b.def)) {
        const intervalMs = lootIntervalMs(b.def);
        const last = rt.lastLootUpdate || Date.now();
        const elapsed = Math.max(0, Date.now() - last);
        const leftMs = Math.max(0, intervalMs - elapsed);
        // Fill grows toward the next loot tick (0% just after a tick, ~100% when due).
        const pct = Math.min(1, elapsed / intervalMs);
        this._drawTimedBar(bx, by, bw, bh, pct, "#3db89a", formatDuration(leftMs));
      } else if (rt.durationMs > 0) {
        const leftMs = Math.max(0, rt.remainingMs) / TIME_SCALE;
        const pct = 1 - Math.max(0, rt.remainingMs) / rt.durationMs;
        this._drawTimedBar(bx, by, bw, bh, pct, "#3db89a", formatDuration(leftMs));
      }
    }

    // Collect cue when rent is ready
    if (st !== "ready") return;

    const iconScale = 1.4;
    const badgeY = spriteTop - 6 * iconScale;
    const spriteUrl = "assets/ui/icon_cash.png";
    const img = this.images.get(spriteUrl);
    if (img) {
      const w = 30 * iconScale * 1.55;
      const h = (img.height / img.width) * w;
      const t = performance.now() / 280;
      const bob = Math.sin(t) * 3.5;
      const x = cx - w / 2;
      const y = badgeY - h + bob;
      const pulse = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t));
      ctx.save();
      ctx.shadowColor = `rgba(255, 220, 70, ${0.85 * pulse})`;
      ctx.shadowBlur = 14 + 6 * pulse;
      ctx.drawImage(img, x, y, w, h);
      ctx.shadowBlur = 4;
      ctx.shadowColor = `rgba(255, 245, 180, ${0.95 * pulse})`;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
      ctx.drawImage(img, x, y, w, h);
    }
  }

  /**
   * Wider timer bar with remaining-time label centered inside.
   * @param {number} bx
   * @param {number} by
   * @param {number} bw
   * @param {number} bh
   * @param {number} pct 0..1
   * @param {string} fillColor
   * @param {string} label
   */
  _drawTimedBar(bx, by, bw, bh, pct, fillColor, label) {
    const ctx = this.ctx;
    const p = Math.max(0, Math.min(1, pct));
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(bx - 1.5, by - 1.5, bw + 3, bh + 3);
    ctx.fillStyle = "#1a2329";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = fillColor;
    ctx.fillRect(bx, by, bw * p, bh);

    ctx.font = `bold ${Math.max(10, Math.min(13, bh - 3))}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const tx = bx + bw / 2;
    const ty = by + bh / 2 + 0.5;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(label, tx, ty);
    ctx.fillStyle = "#fff";
    ctx.fillText(label, tx, ty);
    ctx.textAlign = "start";
    ctx.textBaseline = "alphabetic";
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
