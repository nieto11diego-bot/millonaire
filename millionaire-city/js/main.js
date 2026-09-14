import { loadGameData, enrichCatalog } from "./data.js";
import { Grid } from "./map/grid.js";
import { Renderer } from "./map/renderer.js";
import { RoadLayer } from "./map/roads.js";
import { ShopUI } from "./ui/shop.js";

const TILE = 32;
const START_CASH = 500_000;

const state = {
  cash: START_CASH,
  level: 1,
  xp: 100,
  mode: "place", // place | pan | erase | road
  selected: null,
};

const cashEl = document.getElementById("cash");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const hintEl = document.getElementById("hint");
const canvas = document.getElementById("map");

function refreshHud() {
  cashEl.textContent = state.cash.toLocaleString("en-US");
  levelEl.textContent = String(state.level);
  xpEl.textContent = String(state.xp);
}

function setHint(text) {
  hintEl.textContent = text;
}

function setMode(mode) {
  state.mode = mode;
  canvas.classList.toggle("mode-pan", mode === "pan");
  canvas.classList.toggle("mode-erase", mode === "erase");
  document.getElementById("btn-pan").classList.toggle("active", mode === "pan");
  document.getElementById("btn-erase").classList.toggle("active", mode === "erase");
  if (mode === "pan") setHint("Arrastra el mapa para mover la cámara.");
  else if (mode === "erase") setHint("Clic/arrastra: borra carretera o edificios (reembolso 50%).");
  else if (mode === "road") setHint("Pinta carreteras: recta por defecto; curva/T/cruce según vecinos.");
  else if (state.selected) setHint(`Colocando: ${state.selected.name}. Clic en el mapa.`);
  else setHint("Elige un edificio en la tienda o Carretera en Herramientas.");
}

async function main() {
  let data;
  try {
    data = await loadGameData();
  } catch (err) {
    setHint("No se pudieron cargar los JSON. Ejecuta tools/serve.ps1 y abre http://localhost:8080");
    console.error(err);
    return;
  }

  const catalog = enrichCatalog(data.economy, data.buildings);
  const allDefs = [...catalog.houses, ...catalog.commerces, ...catalog.decorations, ...catalog.wonders];
  const roadCost = data.roads.costCoins ?? 500;

  const grid = new Grid(40, 30, TILE);
  const roads = new RoadLayer(grid.cols, grid.rows, data.roads);
  const renderer = new Renderer(canvas, grid, roads);
  await Promise.all([renderer.preload(allDefs), roads.preload()]);

  const starter = catalog.houses.find((h) => h.name === "Bungalow") || catalog.houses[0];
  if (starter) {
    const tx = Math.floor(grid.cols / 2) - Math.floor(starter.gridW / 2);
    const ty = Math.floor(grid.rows / 2) - Math.floor(starter.gridH / 2);
    grid.place(starter, tx, ty);
  }

  const shop = new ShopUI(
    document.getElementById("shop"),
    catalog,
    (item) => {
      state.selected = item;
      if (item) {
        setMode("place");
        setHint(
          `Colocando: ${item.name} (${item.gridW}×${item.gridH}). Costo $${item.costCoins.toLocaleString("en-US")}`
        );
      } else if (state.mode === "place") {
        setHint("Elige un edificio en la tienda o Carretera en Herramientas.");
      }
    },
    {
      roadCost,
      onTool: (tool) => {
        if (tool === "road") setMode("road");
        else if (state.mode === "road") setMode("place");
      },
    }
  );

  document.getElementById("btn-pan").addEventListener("click", () => {
    shop.clearSelection();
    setMode(state.mode === "pan" ? "place" : "pan");
  });
  document.getElementById("btn-erase").addEventListener("click", () => {
    shop.clearSelection();
    setMode(state.mode === "erase" ? "place" : "erase");
  });
  document.getElementById("zoom").addEventListener("input", (e) => {
    renderer.camera.zoom = Number(e.target.value);
  });

  let camDragging = false;
  let paintDragging = false;
  let lastX = 0;
  let lastY = 0;
  let lastPaintKey = "";

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function tileFromEvent(e) {
    const p = pointerPos(e);
    const world = renderer.screenToWorld(p.x, p.y);
    return renderer.worldToTile(world.x, world.y);
  }

  function blockedForRoad(tx, ty) {
    return !!grid.buildingAt(tx, ty);
  }

  function paintRoadAt(tx, ty) {
    if (blockedForRoad(tx, ty)) {
      setHint("No se puede poner carretera sobre un edificio.");
      return;
    }
    if (roads.has(tx, ty)) return;
    if (state.cash < roadCost) {
      setHint("No tienes suficiente efectivo.");
      return;
    }
    if (roads.paint(tx, ty, true, blockedForRoad)) {
      state.cash -= roadCost;
      refreshHud();
    }
  }

  function eraseAt(tx, ty) {
    if (roads.has(tx, ty)) {
      roads.paint(tx, ty, false);
      state.cash += Math.floor(roadCost * 0.5);
      refreshHud();
      setHint("Carretera borrada.");
      return;
    }
    const removed = grid.eraseAt(tx, ty);
    if (removed) {
      const refund = Math.floor((removed.def.costCoins || 0) * 0.5);
      state.cash += refund;
      refreshHud();
      setHint(`Borrado ${removed.def.name}. Reembolso $${refund.toLocaleString("en-US")}`);
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    if (state.mode === "pan" || e.button === 1 || e.shiftKey) {
      camDragging = true;
      canvas.classList.add("dragging");
      lastX = p.x;
      lastY = p.y;
      return;
    }

    const { tx, ty } = tileFromEvent(e);
    lastPaintKey = `${tx},${ty}`;

    if (state.mode === "erase") {
      paintDragging = true;
      eraseAt(tx, ty);
      return;
    }

    if (state.mode === "road") {
      paintDragging = true;
      paintRoadAt(tx, ty);
      return;
    }

    if (state.mode === "place" && state.selected) {
      const def = state.selected;
      if (state.cash < def.costCoins) {
        setHint("No tienes suficiente efectivo.");
        return;
      }
      if (!grid.canPlace(tx, ty, def.gridW, def.gridH)) {
        setHint("No cabe aquí (fuera del mapa o ocupado).");
        return;
      }
      // Don't place building on roads
      let onRoad = false;
      for (let y = ty; y < ty + def.gridH; y++) {
        for (let x = tx; x < tx + def.gridW; x++) {
          if (roads.has(x, y)) onRoad = true;
        }
      }
      if (onRoad) {
        setHint("Quita la carretera antes de construir encima.");
        return;
      }
      const placed = grid.place(def, tx, ty);
      if (placed) {
        state.cash -= def.costCoins;
        state.xp += def.exp || 0;
        refreshHud();
        setHint(`Colocado: ${def.name}`);
      }
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pointerPos(e);
    if (camDragging) {
      const z = renderer.camera.zoom;
      renderer.camera.x -= (p.x - lastX) / z;
      renderer.camera.y -= (p.y - lastY) / z;
      lastX = p.x;
      lastY = p.y;
      return;
    }

    const { tx, ty } = tileFromEvent(e);
    const key = `${tx},${ty}`;

    if (paintDragging && state.mode === "road") {
      if (key !== lastPaintKey) {
        lastPaintKey = key;
        paintRoadAt(tx, ty);
      }
    } else if (paintDragging && state.mode === "erase") {
      if (key !== lastPaintKey) {
        lastPaintKey = key;
        eraseAt(tx, ty);
      }
    }

    if (state.mode === "road") {
      renderer.hover = {
        tx,
        ty,
        road: true,
        valid: !blockedForRoad(tx, ty) && state.cash >= roadCost,
      };
    } else if (state.mode === "place" && state.selected) {
      const def = state.selected;
      let onRoad = false;
      for (let y = ty; y < ty + def.gridH; y++) {
        for (let x = tx; x < tx + def.gridW; x++) {
          if (roads.has(x, y)) onRoad = true;
        }
      }
      renderer.hover = {
        tx,
        ty,
        def,
        valid: grid.canPlace(tx, ty, def.gridW, def.gridH) && state.cash >= def.costCoins && !onRoad,
      };
    } else {
      renderer.hover = null;
    }
  });

  canvas.addEventListener("pointerup", () => {
    camDragging = false;
    paintDragging = false;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => {
    renderer.hover = null;
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const zoomInput = document.getElementById("zoom");
      let z = Number(zoomInput.value) - Math.sign(e.deltaY) * 0.1;
      z = Math.min(2, Math.max(0.5, z));
      zoomInput.value = String(z);
      renderer.camera.zoom = z;
    },
    { passive: false }
  );

  refreshHud();
  setMode("place");

  function loop() {
    renderer.draw();
    requestAnimationFrame(loop);
  }
  loop();
}

main();
