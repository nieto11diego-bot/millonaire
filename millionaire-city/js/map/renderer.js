import { spriteOrigin } from "./grid.js";
import { FloatingRewards } from "./floatingRewards.js";
import { TIME_SCALE, formatDuration, usesLootEconomy, lootIntervalMs } from "../economy.js";
import { chestTierByLevel } from "./dailyChests.js";

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
    /** @type {import("./nature.js").NatureLayer|null} */
    this.nature = null;
    /** @type {import("./dailyChests.js").DailyChestLayer|null} */
    this.dailyChests = null;
    /** Show tile grid only while placing / moving. */
    this.showGrid = false;
    /** Base grass mid-tone (lighter moss). */
    this.grassColor = "#7BA73B";
    /**
     * Weighted moss palette — same photo hues, lifted brighter
     * so the floor reads as light Minecraft-style grass.
     * @type {{ rgb: [number, number, number], w: number }[]}
     */
    this.grassPalette = [
      { rgb: [0xb8, 0xd4, 0x4a], w: 8 },
      { rgb: [0xac, 0xc8, 0x42], w: 12 },
      { rgb: [0xa0, 0xbc, 0x3c], w: 18 },
      { rgb: [0x94, 0xb0, 0x38], w: 22 },
      { rgb: [0x88, 0xa8, 0x34], w: 28 },
      { rgb: [0x7c, 0xa0, 0x32], w: 34 },
      { rgb: [0x74, 0x98, 0x30], w: 38 },
      { rgb: [0x6c, 0x90, 0x2c], w: 42 },
      { rgb: [0x64, 0x88, 0x2a], w: 40 },
      { rgb: [0x5c, 0x80, 0x28], w: 36 },
      { rgb: [0x54, 0x74, 0x24], w: 30 },
      { rgb: [0x4c, 0x6c, 0x22], w: 22 },
      { rgb: [0x44, 0x60, 0x1e], w: 14 },
      { rgb: [0x3a, 0x52, 0x18], w: 8 },
    ];
    /** @type {HTMLCanvasElement | null} */
    this._grassLayer = null;
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
    this.clampCamera();
  }

  async preload(defs, extraUrls = []) {
    const urls = [
      ...new Set([
        ...defs.map((d) => d.spriteUrl).filter(Boolean),
        ...extraUrls,
        "assets/ui/icon_cash.png",
        "assets/ui/icon_gold.png",
        "assets/ui/icon_diamond.svg",
        "assets/ui/icon_contract.svg",
      ]),
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

  /**
   * Keep the viewport near the map bounds (25% larger than the grid).
   * If zoomed out so the view is larger than that area, the camera stays centered.
   */
  clampCamera() {
    const z = Math.max(0.01, this.camera.zoom);
    const mapW = this.grid.cols * this.grid.tile;
    const mapH = this.grid.rows * this.grid.tile;
    // Allow panning a bit past the map edge (bounds = map × 1.25).
    const boundW = mapW * 1.25;
    const boundH = mapH * 1.25;
    const halfViewW = this.cssWidth / (2 * z);
    const halfViewH = this.cssHeight / (2 * z);
    const maxX = Math.max(0, boundW / 2 - halfViewW);
    const maxY = Math.max(0, boundH / 2 - halfViewH);
    this.camera.x = Math.max(-maxX, Math.min(maxX, this.camera.x));
    this.camera.y = Math.max(-maxY, Math.min(maxY, this.camera.y));
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
    this.clampCamera();
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

    // Base grass (mezcla aleatoria tipo césped Minecraft)
    this._drawGrassFloor(ctx, mapW, mapH);

    // River (right edge), over grass, under roads
    this._drawRiver();

    // Locked expansion parcels + for-sale signs
    this._drawExpansions();

    if (this.showGrid) {
      // Dual-tone grid so lines stay visible on light and dark grass texels
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
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
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      for (let x = 0; x <= cols; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tile + 0.5, 0);
        ctx.lineTo(x * tile + 0.5, mapH);
        ctx.stroke();
      }
      for (let y = 0; y <= rows; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * tile + 0.5);
        ctx.lineTo(mapW, y * tile + 0.5);
        ctx.stroke();
      }
    }

    // Roads under fences and buildings (autotiled)
    if (this.roads) {
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (!this.roads.has(tx, ty)) continue;
          if (this.river?.has(tx, ty)) continue;
          // Never draw a road through an occupied building cell
          if (this.grid.buildingAt(tx, ty)) continue;
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

    // Picket fences over roads, under buildings
    this._drawExpansionFences();

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

    // Buildings + nature Y-sorted by bottom of footprint
    const hideId = this.hover?.hideId || null;
    /** @type {{ bottom: number, tx: number, draw: () => void }[]} */
    const drawList = [];

    for (const b of this.grid.buildings) {
      if (hideId && b.id === hideId) continue;
      const constructing = b.runtime?.status === "building";
      const alpha = constructing ? 0.72 : 1;
      drawList.push({
        bottom: b.ty + b.def.gridH,
        tx: b.tx,
        draw: () => {
          this._drawBuilding(b.def, b.tx, b.ty, alpha);
          this._drawStatus(b);
        },
      });
    }

    if (this.nature) {
      for (const n of this.nature.items) {
        if (hideId && n.id === hideId) continue;
        const k = n.kind;
        drawList.push({
          bottom: n.ty + k.gridH,
          tx: n.tx,
          draw: () => this._drawNature(n),
        });
      }
    }

    if (this.dailyChests?.active) {
      const c = this.dailyChests.active;
      drawList.push({
        bottom: c.ty + 1,
        tx: c.tx,
        draw: () => this._drawDailyChest(c),
      });
    }

    drawList.sort((a, b) => a.bottom - b.bottom || a.tx - b.tx);
    for (const entry of drawList) entry.draw();

    // Category footprints while placing / moving / destroying
    this._drawCategoryPerimeters();

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

  /**
   * Minecraft-style grass: soft biome patches + fine speckled texels
   * using the moss photo palette (deterministic, cached).
   */
  _drawGrassFloor(ctx, mapW, mapH) {
    const layer = this._ensureGrassLayer();
    if (layer) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(layer, 0, 0, mapW, mapH);
      return;
    }
    ctx.fillStyle = this.grassColor;
    ctx.fillRect(0, 0, mapW, mapH);
  }

  /** Stable 0..1 hash. */
  _grassHash(x, y, salt = 0) {
    let h = (Math.imul(x + salt * 3741, 374761393) ^ Math.imul(y + salt * 6682, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /** Smooth value noise in 0..1 (for large grass patches). */
  _grassValueNoise(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const n00 = this._grassHash(x0, y0, 1);
    const n10 = this._grassHash(x0 + 1, y0, 1);
    const n01 = this._grassHash(x0, y0 + 1, 1);
    const n11 = this._grassHash(x0 + 1, y0 + 1, 1);
    const nx0 = n00 + (n10 - n00) * sx;
    const nx1 = n01 + (n11 - n01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  }

  _pickGrassRgb(tx, ty, px, py) {
    const palette = this.grassPalette;
    const n = palette.length;

    // Large soft patches (biome-ish) — bias toward a local mid tone
    const patch = this._grassValueNoise(tx * 0.18 + px * 0.02, ty * 0.18 + py * 0.02);
    const patch2 = this._grassValueNoise(tx * 0.07 + 20, ty * 0.07 + 11);
    const baseT = patch * 0.65 + patch2 * 0.35;

    // Fine Minecraft speckles (small random jumps near the base)
    const speck = this._grassHash(tx * 8 + (px >> 1), ty * 8 + (py >> 1), 3);
    const speck2 = this._grassHash(tx * 8 + (px >> 1), ty * 8 + (py >> 1), 7);

    let t = baseT + (speck - 0.5) * 0.28 + (speck2 - 0.5) * 0.12;
    t = Math.max(0, Math.min(0.999, t));

    // Weighted pick along palette (heavier mid tones)
    let total = 0;
    for (const p of palette) total += p.w;
    let target = t * total;
    let i0 = 0;
    for (; i0 < n - 1; i0++) {
      if (target < palette[i0].w) break;
      target -= palette[i0].w;
    }
    const i1 = Math.min(n - 1, i0 + 1);
    const blend = Math.max(0, Math.min(1, target / Math.max(1, palette[i0].w)));

    // Occasional bright highlight fleck
    if (speck > 0.93 && speck2 > 0.7) {
      return palette[0].rgb;
    }
    // Occasional deep shadow fleck
    if (speck < 0.06 && speck2 < 0.35) {
      return palette[n - 1].rgb;
    }

    const a = palette[i0].rgb;
    const b = palette[i1].rgb;
    return [
      (a[0] + (b[0] - a[0]) * blend) | 0,
      (a[1] + (b[1] - a[1]) * blend) | 0,
      (a[2] + (b[2] - a[2]) * blend) | 0,
    ];
  }

  _ensureGrassLayer() {
    const { cols, rows, tile } = this.grid;
    const key = `${cols}x${rows}x${tile}:v3`;
    if (this._grassLayer && this._grassLayerKey === key) return this._grassLayer;

    const mapW = cols * tile;
    const mapH = rows * tile;
    const canvas = document.createElement("canvas");
    canvas.width = mapW;
    canvas.height = mapH;
    const gctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!gctx) return null;

    // 2×2 texels → 16×16 “pixels” per tile, like Minecraft grass tops
    const texel = 2;
    const img = gctx.createImageData(mapW, mapH);
    const data = img.data;

    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        for (let py = 0; py < tile; py += texel) {
          for (let px = 0; px < tile; px += texel) {
            const [r, g, b] = this._pickGrassRgb(tx, ty, px, py);
            for (let dy = 0; dy < texel; dy++) {
              for (let dx = 0; dx < texel; dx++) {
                const x = tx * tile + px + dx;
                const y = ty * tile + py + dy;
                const i = (y * mapW + x) * 4;
                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = 255;
              }
            }
          }
        }
      }
    }

    gctx.putImageData(img, 0, 0);
    this._grassLayer = canvas;
    this._grassLayerKey = key;
    return canvas;
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

  /**
   * Colored footprint fills for all buildings while the edit grid is on.
   * Houses red · commerce blue · wonders yellow · decorations green.
   */
  _drawCategoryPerimeters() {
    if (!this.showGrid) return;
    const ctx = this.ctx;
    const tile = this.grid.tile;
    const styles = {
      house: { fill: "rgba(229, 57, 53, 0.42)", stroke: "#e53935" },
      commercial: { fill: "rgba(30, 136, 229, 0.42)", stroke: "#1e88e5" },
      wonder: { fill: "rgba(253, 216, 53, 0.42)", stroke: "#fdd835" },
      decoration: { fill: "rgba(129, 199, 132, 0.45)", stroke: "#81c784" },
    };
    const hideId = this.hover?.hideId || null;

    ctx.save();
    ctx.lineJoin = "round";
    for (const b of this.grid.buildings) {
      if (hideId && b.id === hideId) continue;
      const style = styles[b.def?.category];
      if (!style) continue;
      const x = b.tx * tile;
      const y = b.ty * tile;
      const w = b.def.gridW * tile;
      const h = b.def.gridH * tile;

      ctx.fillStyle = style.fill;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = 3.5;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);

      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
    }
    ctx.restore();
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
   * Light-gray picket fences on every expansion parcel perimeter (MC-style).
   * Shared edges between two owned parcels are omitted (merged land). All
   * other zone edges — including locked↔locked and map borders — get a
   * fence. River tiles open a gap; roads never do.
   */
  _drawExpansionFences() {
    const exp = this.expansions;
    if (!exp) return;
    const tile = this.grid.tile;
    const { zoneW, zoneH, zonesX, zonesY } = exp;
    /** @type {number} px gap between owned parcel content and unowned side */
    const outset = 5;

    // Horizontal edges (zy = 0 .. zonesY inclusive)
    for (let zy = 0; zy <= zonesY; zy++) {
      const y = zy * zoneH * tile;
      for (let zx = 0; zx < zonesX; zx++) {
        const aboveZone = zy > 0;
        const belowZone = zy < zonesY;
        if (!aboveZone && !belowZone) continue;
        const aboveOwned = aboveZone && exp.isOwnedZone(zx, zy - 1);
        const belowOwned = belowZone && exp.isOwnedZone(zx, zy);
        // Merged owned land: no fence between two owned parcels
        if (aboveOwned && belowOwned) continue;

        let yDraw = y;
        /** Rim row for river gap (prefer the non-owned / locked side). */
        let rimTy = null;
        if (aboveOwned && !belowOwned) {
          yDraw = y + outset;
          rimTy = aboveZone ? zy * zoneH - 1 : zy * zoneH;
        } else if (!aboveOwned && belowOwned) {
          yDraw = y - outset;
          rimTy = belowZone ? zy * zoneH : zy * zoneH - 1;
        } else {
          // Locked↔locked (or map edge of a locked parcel): sit on the grid line
          rimTy = belowZone ? zy * zoneH : zy * zoneH - 1;
        }
        const x0 = zx * zoneW * tile;
        this._drawFenceRun(x0, yDraw, zoneW * tile, true, null, rimTy);
      }
    }

    // Vertical edges (zx = 0 .. zonesX inclusive)
    for (let zx = 0; zx <= zonesX; zx++) {
      const x = zx * zoneW * tile;
      for (let zy = 0; zy < zonesY; zy++) {
        const leftZone = zx > 0;
        const rightZone = zx < zonesX;
        if (!leftZone && !rightZone) continue;
        const leftOwned = leftZone && exp.isOwnedZone(zx - 1, zy);
        const rightOwned = rightZone && exp.isOwnedZone(zx, zy);
        if (leftOwned && rightOwned) continue;

        let xDraw = x;
        let rimTx = null;
        if (leftOwned && !rightOwned) {
          xDraw = x + outset;
          rimTx = leftZone ? zx * zoneW - 1 : zx * zoneW;
        } else if (!leftOwned && rightOwned) {
          xDraw = x - outset;
          rimTx = rightZone ? zx * zoneW : zx * zoneW - 1;
        } else {
          rimTx = rightZone ? zx * zoneW : zx * zoneW - 1;
        }
        const y0 = zy * zoneH * tile;
        this._drawFenceRun(xDraw, y0, zoneH * tile, false, rimTx, null);
      }
    }
  }

  /**
   * One straight fence segment in world pixels.
   * Gaps only where the rim tile is river (not road).
   * @param {number} x
   * @param {number} y
   * @param {number} length
   * @param {boolean} horizontal
   * @param {number|null} rimTx fixed rim tx, or null to derive from segment
   * @param {number|null} rimTy fixed rim ty, or null to derive from segment
   */
  _drawFenceRun(x, y, length, horizontal, rimTx = null, rimTy = null) {
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

      const segTx = horizontal
        ? Math.floor((x + along + segLen * 0.5) / tile)
        : Math.floor(x / tile);
      const segTy = horizontal
        ? Math.floor(y / tile)
        : Math.floor((y + along + segLen * 0.5) / tile);
      const tx = rimTx != null ? rimTx : segTx;
      const ty = rimTy != null ? rimTy : segTy;
      // Only river opens a fence gap — roads stay under the pickets
      if (this._fenceRiverGap(tx, ty)) continue;

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

  /** River on the rim opens a fence gap; roads do not. */
  _fenceRiverGap(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.grid.cols || ty >= this.grid.rows) return false;
    return !!this.river?.has(tx, ty);
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
   * "EN VENTA" sign — red board, white title, gold frame.
   * @param {number} cx
   * @param {number} cy
   * @param {number} cost
   * @param {boolean} [hovered]
   */
  _drawForSaleSign(cx, cy, cost, hovered = false) {
    const ctx = this.ctx;
    const scale = hovered ? 1.1 : 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    const bw = 102;
    const bh = 52;
    const bx = -bw / 2;
    const by = -56;
    const r = 10;

    // Soft glow under the board
    ctx.save();
    ctx.shadowColor = hovered ? "rgba(220, 40, 40, 0.7)" : "rgba(180, 20, 20, 0.4)";
    ctx.shadowBlur = hovered ? 18 : 10;
    ctx.fillStyle = "rgba(255, 80, 80, 0.3)";
    this._roundRect(bx - 2, by - 2, bw + 4, bh + 4, r + 2);
    ctx.fill();
    ctx.restore();

    // Chrome / gold post
    const postGrad = ctx.createLinearGradient(-5, -10, 5, 50);
    postGrad.addColorStop(0, "#fff6c8");
    postGrad.addColorStop(0.35, "#ffd24a");
    postGrad.addColorStop(0.7, "#e8a010");
    postGrad.addColorStop(1, "#b87408");
    ctx.fillStyle = postGrad;
    ctx.fillRect(-4.5, -10, 9, 58);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(-3.5, -8, 2.5, 52);
    // Base plate
    const baseGrad = ctx.createLinearGradient(-14, 44, 14, 52);
    baseGrad.addColorStop(0, "#ffe08a");
    baseGrad.addColorStop(0.5, "#f0b020");
    baseGrad.addColorStop(1, "#c88810");
    ctx.fillStyle = baseGrad;
    this._roundRect(-14, 44, 28, 8, 3);
    ctx.fill();

    // Board fill — bright red → deep crimson
    const boardGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    boardGrad.addColorStop(0, "#ff4a4a");
    boardGrad.addColorStop(0.45, "#e01828");
    boardGrad.addColorStop(1, "#a00e18");
    ctx.fillStyle = boardGrad;
    this._roundRect(bx, by, bw, bh, r);
    ctx.fill();

    // Gold frame
    const frameGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
    frameGrad.addColorStop(0, "#fff3a8");
    frameGrad.addColorStop(0.35, "#ffd24a");
    frameGrad.addColorStop(0.7, "#e8a820");
    frameGrad.addColorStop(1, "#fff0a0");
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 3.5;
    this._roundRect(bx + 1.5, by + 1.5, bw - 3, bh - 3, r - 1);
    ctx.stroke();

    // Inner white highlight rim
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1.2;
    this._roundRect(bx + 5, by + 5, bw - 10, bh - 10, r - 4);
    ctx.stroke();

    // Accent stripe (white)
    ctx.fillStyle = "#ffffff";
    this._roundRect(bx + 8, by + 8, bw - 16, 3, 1.5);
    ctx.fill();

    // Title
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 12px Fredoka, sans-serif";
    ctx.fillStyle = "rgba(60, 0, 0, 0.35)";
    ctx.fillText("EN VENTA", 0.5, by + 20.5);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("EN VENTA", 0, by + 20);

    // Price row
    ctx.font = "700 14px Fredoka, sans-serif";
    const price = Number(cost).toLocaleString("en-US");
    const cashImg = this.images.get("assets/ui/icon_cash.png");
    const priceY = by + 38;
    if (cashImg) {
      const ih = 15;
      const iw = (cashImg.width / cashImg.height) * ih;
      const tw = ctx.measureText(price).width;
      const gap = 5;
      const total = iw + gap + tw;
      const x0 = -total / 2;
      ctx.drawImage(cashImg, x0, priceY - ih / 2, iw, ih);
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(60, 0, 0, 0.4)";
      ctx.fillText(price, x0 + iw + gap + 0.6, priceY + 0.6);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(price, x0 + iw + gap, priceY);
      ctx.textAlign = "center";
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillText(price, 0, priceY);
    }

    // Tiny sparkle accents
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(bx + 14, by + 14, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx + bw - 12, by + bh - 12, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} radius
   */
  _roundRect(x, y, w, h, radius) {
    const ctx = this.ctx;
    const r = Math.max(0, Math.min(radius, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Decoration / commerce influence radius (wonders are global — no ring).
   * @param {number} tx
   * @param {number} ty
   * @param {object} def
   */
  _drawInfluenceRadius(tx, ty, def) {
    if (!def || def.category === "wonder") return;
    const base = def.influenceRadiusTiles != null ? def.influenceRadiusTiles : null;
    if (base == null || base < 0) return;
    const radiusTiles = base + Math.max(def.gridW, def.gridH) / 2;

    const ctx = this.ctx;
    const tile = this.grid.tile;
    const cx = (tx + def.gridW / 2) * tile;
    const cy = (ty + def.gridH / 2) * tile;
    const r = radiusTiles * tile;
    const isShop = def.category === "commercial";
    const fill = isShop
      ? "rgba(90,150,200,0.16)"
      : "rgba(138,154,91,0.18)";
    const stroke = isShop
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
      const gAt = Number(rt.goldReadyAt) || 0;
      const dAt = Number(rt.diamondReadyAt) || 0;
      if (gAt > 0 && now >= gAt) icons.push("assets/ui/icon_gold.png");
      if (dAt > 0 && now >= dAt) icons.push("assets/ui/icon_diamond.svg");
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

    // Contract cue: house ready to sign (no active rental contract)
    if (
      b.def.category === "house" &&
      !usesLootEconomy(b.def) &&
      st !== "ready" &&
      (st === "idle" || rt.contractId == null)
    ) {
      this._drawBobbingBadge(cx, spriteTop, "assets/ui/icon_contract.svg", {
        baseW: 34 * 1.4,
        glowRgb: "80, 190, 255",
        softRgb: "200, 240, 255",
      });
      return;
    }

    // Collect cue when rent is ready
    if (st !== "ready") return;

    this._drawBobbingBadge(cx, spriteTop, "assets/ui/icon_cash.png", {
      baseW: 46.5,
      glowRgb: "255, 220, 70",
      softRgb: "255, 245, 180",
    });
  }

  /**
   * Floating status badge above a building (bob + pulse glow).
   * @param {number} cx
   * @param {number} spriteTop
   * @param {string} spriteUrl
   * @param {{ baseW?: number, glowRgb?: string, softRgb?: string }} [opts]
   */
  _drawBobbingBadge(cx, spriteTop, spriteUrl, opts = {}) {
    const ctx = this.ctx;
    const img = this.images.get(spriteUrl);
    if (!img) return;
    const iconScale = 1.4;
    const w = (opts.baseW ?? 42) * (iconScale / 1.4);
    const h = (img.height / Math.max(1, img.width)) * w;
    const t = performance.now() / 280;
    const bob = Math.sin(t) * 3.5;
    const x = cx - w / 2;
    const y = spriteTop - 6 * iconScale - h + bob;
    const pulse = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(t));
    const glowRgb = opts.glowRgb || "255, 220, 70";
    const softRgb = opts.softRgb || "255, 245, 180";
    ctx.save();
    ctx.shadowColor = `rgba(${glowRgb}, ${0.85 * pulse})`;
    ctx.shadowBlur = 14 + 6 * pulse;
    ctx.drawImage(img, x, y, w, h);
    ctx.shadowBlur = 4;
    ctx.shadowColor = `rgba(${softRgb}, ${0.95 * pulse})`;
    ctx.drawImage(img, x, y, w, h);
    ctx.restore();
    ctx.drawImage(img, x, y, w, h);
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

  /** @param {{ kind: object, tx: number, ty: number }} item */
  _drawNature(item) {
    const def = item.kind;
    const ctx = this.ctx;
    const { drawX, drawY } = spriteOrigin(def, item.tx, item.ty, this.grid.tile);
    const img = this.images.get(def.spriteUrl);
    if (img) {
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, drawX, drawY, def.width, def.height);
    } else {
      ctx.fillStyle = "#6aad3a";
      ctx.fillRect(
        item.tx * this.grid.tile + 6,
        item.ty * this.grid.tile + 4,
        this.grid.tile - 12,
        this.grid.tile - 8
      );
    }
  }

  /**
   * Procedural treasure chest tinted by tier color.
   * @param {{ level: number, tx: number, ty: number }} chest
   */
  _drawDailyChest(chest) {
    const tier = chestTierByLevel(chest.level);
    if (!tier) return;
    const ctx = this.ctx;
    const tile = this.grid.tile;
    const cx = chest.tx * tile + tile / 2;
    const cy = chest.ty * tile + tile * 0.72;
    const bob = Math.sin(Date.now() / 320) * 1.5;

    ctx.save();
    ctx.translate(cx, cy + bob);
    ctx.scale(2, 2);

    // Soft glow
    ctx.fillStyle = tier.colorLight;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(0, 6, 16, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Body
    const bw = 22;
    const bh = 14;
    const grad = ctx.createLinearGradient(-bw / 2, -bh, bw / 2, bh / 2);
    grad.addColorStop(0, tier.colorLight);
    grad.addColorStop(0.45, tier.color);
    grad.addColorStop(1, tier.colorDark);
    ctx.fillStyle = grad;
    this._roundRect(-bw / 2, -bh + 2, bw, bh, 3);
    ctx.fill();

    // Lid
    const lidGrad = ctx.createLinearGradient(0, -bh - 6, 0, -2);
    lidGrad.addColorStop(0, tier.colorLight);
    lidGrad.addColorStop(1, tier.color);
    ctx.fillStyle = lidGrad;
    this._roundRect(-bw / 2 - 1, -bh - 4, bw + 2, 9, 3);
    ctx.fill();

    // Gold band / clasp
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(-bw / 2, -2, bw, 3);
    ctx.fillStyle = "#fff6c8";
    ctx.beginPath();
    ctx.arc(0, -1, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#b8860b";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Outline
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.2;
    this._roundRect(-bw / 2, -bh + 2, bw, bh, 3);
    ctx.stroke();

    // Level pip
    ctx.fillStyle = "#fff";
    ctx.font = "700 9px Fredoka, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2.5;
    ctx.strokeText(String(tier.level), 0, -bh - 10);
    ctx.fillText(String(tier.level), 0, -bh - 10);

    ctx.restore();
  }
}
