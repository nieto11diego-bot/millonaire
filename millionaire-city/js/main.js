import { loadGameData, enrichCatalog } from "./data.js";
import { Grid } from "./map/grid.js";
import { Renderer } from "./map/renderer.js";
import { RoadLayer } from "./map/roads.js";
import { ShopUI } from "./ui/shop.js";
import { MissionTracker, companyValueFromGrid } from "./missions.js";
import { MissionsUI } from "./ui/missions.js";
import { ContractsUI } from "./ui/contracts.js";
import { BuildingTooltip } from "./ui/tooltip.js";
import { EconomySim } from "./sim.js";
import { createRuntime, formatDuration, isRoadConnected, needsRoad, TIME_SCALE } from "./economy.js";

const TILE = 32;
const START_CASH = 500_000;

const state = {
  cash: START_CASH,
  level: 1,
  xp: 100,
  mode: "place", // place | move | erase | road
  selected: null,
};

const cashEl = document.getElementById("cash");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const hintEl = document.getElementById("hint");
const canvas = document.getElementById("map");

/** @type {MissionTracker | null} */
let missions = null;
/** @type {EconomySim | null} */
let sim = null;
/** @type {number[] | null} */
let levelThresholds = null;
/** @type {import("./map/grid.js").Grid | null} */
let gridRef = null;

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
  canvas.classList.toggle("mode-place", mode === "place" && !!state.selected);
  canvas.classList.toggle("mode-move", mode === "move");
  canvas.classList.toggle("mode-erase", mode === "erase");
  canvas.classList.toggle("mode-road", mode === "road");
  document.getElementById("btn-move").classList.toggle("active", mode === "move");
  document.getElementById("btn-erase").classList.toggle("active", mode === "erase");
  if (mode === "move") setHint("Clic en un edificio o decoración para moverlo. Clic vacío cancela.");
  else if (mode === "erase") setHint("Clic/arrastra: borra carretera o edificios (reembolso 50%). Clic vacío cancela.");
  else if (mode === "road") setHint("Pinta carreteras: recta por defecto; curva/T/cruce según vecinos. Clic vacío cancela.");
  else if (state.selected) setHint(`Colocando: ${state.selected.name}. Clic en el mapa.`);
  else setHint("Arrastra para mover la cámara. Toca una casa (📋) para contrato, o un edificio con $ para cobrar.");
}

function levelFromXp(xp, thresholds) {
  if (!thresholds?.length) return 1;
  let level = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  return level;
}

function applyXp(amount) {
  if (!amount) return;
  state.xp += amount;
  if (levelThresholds) {
    const next = levelFromXp(state.xp, levelThresholds);
    if (next > state.level) {
      state.level = next;
      missions?.onLevelUp();
      setHint(`¡Subiste al nivel ${state.level}!`);
    }
  }
  syncMissionValues();
  refreshHud();
}

function syncMissionValues() {
  if (!missions || !gridRef) return;
  missions.syncValueMissions(state.cash, companyValueFromGrid(gridRef), gridRef);
}

function initBuilding(building) {
  building.runtime = createRuntime(building.def);
  sim?.recomputeAll();
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
  levelThresholds = data.economy.levelCurve?.thresholds || null;

  const grid = new Grid(40, 30, TILE);
  gridRef = grid;
  const roads = new RoadLayer(grid.cols, grid.rows, data.roads);
  const renderer = new Renderer(canvas, grid, roads);
  await Promise.all([renderer.preload(allDefs), roads.preload()]);

  sim = new EconomySim({
    grid,
    roads,
    economy: data.economy,
    onEvent: (type, payload) => {
      if (type === "rent_ready") {
        setHint(`Alquiler listo: ${payload.building.def.name}. Toca el edificio para cobrar.`);
      } else if (type === "rent_lost") {
        setHint(`Perdiste el alquiler de ${payload.building.def.name}. Toca para firmar de nuevo.`);
        syncMissionValues();
      } else if (type === "commerce_ready") {
        const n = payload.building.runtime?.customers || 0;
        setHint(`${payload.building.def.name} listo (${n} clientes). Toca para cobrar.`);
      }
    },
  });

  missions = new MissionTracker(data.missions.missions || [], state, data.i18n, "es");
  const missionsUi = new MissionsUI(document.getElementById("missions-panel"), missions, {
    onCollect: (sku, reward) => {
      state.cash += reward;
      syncMissionValues();
      refreshHud();
      const row = missions.bySku.get(sku);
      setHint(
        `¡Misión cumplida! +$${reward.toLocaleString("en-US")}` +
          (row ? ` (${missions.titleOf(row)})` : "")
      );
    },
  });

  const t = (tid, fb) => missions.t(tid, fb);
  const contractsUi = new ContractsUI(document.getElementById("contracts-panel"), {
    t,
    onSign: (contractId) => {
      const building = contractsUi.building;
      if (!building) return;
      const result = sim.signContract(building, contractId, state.cash);
      if (!result.ok) {
        if (result.reason === "no_cash") setHint("No tienes suficiente efectivo para ese contrato.");
        else if (result.reason === "no_road") setHint("La casa necesita conexión a carretera.");
        else setHint("No se pudo firmar el contrato.");
        return;
      }
      state.cash -= result.cost;
      missions.onContractSigned();
      applyXp(result.xp || 0);
      syncMissionValues();
      refreshHud();
      contractsUi.hide();
      const wait = formatDuration(building.runtime.durationMs / TIME_SCALE);
      setHint(
        `Contrato firmado en ${building.def.name}: +$${result.income.toLocaleString("en-US")} en ~${wait} (${result.tenants} inquilinos).`
      );
    },
  });

  const tooltip = new BuildingTooltip(document.getElementById("building-tooltip"), {
    t,
    getContract: (id) => sim.index.contractById[id] || null,
  });

  window.__mc = { state, missions, grid, missionsUi, contractsUi, sim, tooltip, renderer };

  document.getElementById("btn-missions").addEventListener("click", () => missionsUi.toggle());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" && e.code !== "Escape") return;
    e.preventDefault();
    if (contractsUi.open) contractsUi.hide();
    else if (missionsUi.open) missionsUi.hide();
    else clearActiveTool();
  });

  // Starter bungalow + road stub so economy is playable immediately
  const starter = catalog.houses.find((h) => h.name === "Bungalow") || catalog.houses[0];
  let starterTx = 0;
  let starterTy = 0;
  if (starter) {
    starterTx = Math.floor(grid.cols / 2) - Math.floor(starter.gridW / 2);
    starterTy = Math.floor(grid.rows / 2) - Math.floor(starter.gridH / 2);
    const placed = grid.place(starter, starterTx, starterTy);
    if (placed) initBuilding(placed);
    // Road ring south of starter (free)
    for (let x = starterTx - 1; x < starterTx + starter.gridW + 1; x++) {
      roads.paint(x, starterTy + starter.gridH, true, () => false);
    }
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
        setMode("place");
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

  let camDragging = false;
  let paintDragging = false;
  let pendingInteract = null;
  /** @type {{ building: object, ox: number, oy: number } | null} */
  let moveDrag = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let lastPaintKey = "";
  const DRAG_THRESHOLD = 6;

  function clearActiveTool() {
    moveDrag = null;
    renderer.hover = null;
    shop.clearSelection();
    setMode("place");
  }

  document.getElementById("btn-move").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    setMode(state.mode === "move" ? "place" : "move");
  });
  document.getElementById("btn-erase").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    setMode(state.mode === "erase" ? "place" : "erase");
  });
  document.getElementById("zoom").addEventListener("input", (e) => {
    renderer.camera.zoom = Number(e.target.value);
  });

  function pointerPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function tileFromEvent(e) {
    const p = pointerPos(e);
    const world = renderer.screenToWorld(p.x, p.y);
    return renderer.worldToTile(world.x, world.y);
  }

  function footprintOnRoad(tx, ty, def) {
    for (let y = ty; y < ty + def.gridH; y++) {
      for (let x = tx; x < tx + def.gridW; x++) {
        if (roads.has(x, y)) return true;
      }
    }
    return false;
  }

  function canDropBuilding(building, tx, ty) {
    const def = building.def;
    return grid.canPlace(tx, ty, def.gridW, def.gridH, building.id) && !footprintOnRoad(tx, ty, def);
  }

  function startCamDrag(p) {
    camDragging = true;
    canvas.classList.add("dragging");
    lastX = p.x;
    lastY = p.y;
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
      sim.recomputeAll();
      syncMissionValues();
      refreshHud();
    }
  }

  function eraseAt(tx, ty) {
    if (roads.has(tx, ty)) {
      roads.paint(tx, ty, false);
      state.cash += Math.floor(roadCost * 0.5);
      sim.recomputeAll();
      syncMissionValues();
      refreshHud();
      setHint("Carretera borrada.");
      return true;
    }
    const removed = grid.eraseAt(tx, ty);
    if (removed) {
      const refund = Math.floor((removed.def.costCoins || 0) * 0.5);
      state.cash += refund;
      sim.recomputeAll();
      syncMissionValues();
      refreshHud();
      setHint(`Borrado ${removed.def.name}. Reembolso $${refund.toLocaleString("en-US")}`);
      return true;
    }
    return false;
  }

  function interactBuilding(building) {
    const action = sim.tapAction(building);

    if (action === "open_contracts") {
      if (needsRoad(building.def) && !isRoadConnected(building, roads)) {
        setHint("Esta casa necesita carretera adyacente para firmar contratos.");
        return;
      }
      contractsUi.show(building, sim.previewContracts(building));
      return;
    }

    if (action === "clear_lost") {
      sim.clearLost(building);
      contractsUi.show(building, sim.previewContracts(building));
      setHint("Alquiler perdido. Elige un nuevo contrato.");
      return;
    }

    if (action === "collect_rent") {
      const result = sim.collectRent(building);
      if (!result.ok) return;
      state.cash += result.cash;
      missions.onRentCollected();
      applyXp(result.xp || 0);
      syncMissionValues();
      refreshHud();
      setHint(`Cobrado alquiler de ${building.def.name}: +$${result.cash.toLocaleString("en-US")}`);
      return;
    }

    if (action === "collect_commerce") {
      const result = sim.collectCommerce(building);
      if (!result.ok) return;
      state.cash += result.cash;
      missions.onCommerceCollected(building.def.objectId);
      syncMissionValues();
      refreshHud();
      setHint(
        `Cobrado ${building.def.name}: +$${result.cash.toLocaleString("en-US")} (${result.customers} clientes)`
      );
      return;
    }

    if (building.def.category === "house" && building.runtime?.status === "waiting") {
      setHint(
        `${building.def.name}: contrato en curso (${formatDuration(building.runtime.remainingMs / TIME_SCALE)} resto).`
      );
    } else if (building.def.category === "commercial" && building.runtime?.status === "waiting") {
      setHint(
        `${building.def.name}: ${building.runtime.customers || 0} clientes · cobra en ${formatDuration(building.runtime.remainingMs / TIME_SCALE)}.`
      );
    }
  }

  function updateMoveHover(tx, ty) {
    if (!moveDrag) {
      renderer.hover = null;
      return;
    }
    const { building, ox, oy } = moveDrag;
    const dropTx = tx - ox;
    const dropTy = ty - oy;
    const valid = canDropBuilding(building, dropTx, dropTy);
    renderer.hover = {
      tx: dropTx,
      ty: dropTy,
      def: building.def,
      valid,
      hideId: building.id,
    };
  }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = pointerPos(e);
    downX = p.x;
    downY = p.y;
    pendingInteract = null;

    if (e.button === 1 || e.shiftKey) {
      startCamDrag(p);
      return;
    }
    if (e.button !== 0) return;

    const { tx, ty } = tileFromEvent(e);
    lastPaintKey = `${tx},${ty}`;

    // Drop while moving a building (invalid drop keeps it picked up)
    if (state.mode === "move" && moveDrag) {
      const { building, ox, oy } = moveDrag;
      const dropTx = tx - ox;
      const dropTy = ty - oy;
      if (canDropBuilding(building, dropTx, dropTy)) {
        if (grid.move(building, dropTx, dropTy)) {
          sim.recomputeAll();
          syncMissionValues();
          setHint(`Movido: ${building.def.name}`);
        }
        moveDrag = null;
        renderer.hover = null;
      } else {
        updateMoveHover(tx, ty);
        setHint("No se puede soltar aquí (ocupado, fuera del mapa o sobre carretera). Esc cancela.");
      }
      return;
    }

    if (state.mode === "move") {
      const hit = grid.buildingAt(tx, ty);
      if (!hit) {
        clearActiveTool();
        startCamDrag(p);
        return;
      }
      moveDrag = { building: hit, ox: tx - hit.tx, oy: ty - hit.ty };
      updateMoveHover(tx, ty);
      tooltip.hide();
      setHint(`Moviendo ${hit.def.name}. Clic para soltar.`);
      return;
    }

    if (state.mode === "erase") {
      const erased = eraseAt(tx, ty);
      if (!erased) {
        clearActiveTool();
        startCamDrag(p);
        return;
      }
      paintDragging = true;
      return;
    }

    if (state.mode === "road") {
      if (blockedForRoad(tx, ty)) {
        clearActiveTool();
        startCamDrag(p);
        return;
      }
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
      if (!grid.canPlace(tx, ty, def.gridW, def.gridH) || footprintOnRoad(tx, ty, def)) {
        clearActiveTool();
        startCamDrag(p);
        return;
      }
      const placed = grid.place(def, tx, ty);
      if (placed) {
        initBuilding(placed);
        state.cash -= def.costCoins;
        missions?.onBuildingBought(def);
        applyXp(def.exp || 0);
        syncMissionValues();
        refreshHud();
        setHint(`Colocado: ${def.name}`);
      }
      return;
    }

    // Idle: tap building to interact, or drag empty map to pan
    const hit = grid.buildingAt(tx, ty);
    if (hit) {
      pendingInteract = hit;
      lastX = p.x;
      lastY = p.y;
    } else {
      startCamDrag(p);
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pointerPos(e);

    // Convert a pending building tap into a pan if the pointer moves enough
    if (pendingInteract && !camDragging) {
      const dx = p.x - downX;
      const dy = p.y - downY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        pendingInteract = null;
        startCamDrag({ x: downX, y: downY });
        lastX = p.x;
        lastY = p.y;
      }
    }

    if (camDragging) {
      const z = renderer.camera.zoom;
      renderer.camera.x -= (p.x - lastX) / z;
      renderer.camera.y -= (p.y - lastY) / z;
      lastX = p.x;
      lastY = p.y;
      tooltip.hide();
      return;
    }

    const { tx, ty } = tileFromEvent(e);
    const key = `${tx},${ty}`;

    if (moveDrag) {
      updateMoveHover(tx, ty);
      tooltip.hide();
      return;
    }

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
      tooltip.hide();
    } else if (state.mode === "move") {
      const hit = grid.buildingAt(tx, ty);
      renderer.hover = hit
        ? { tx: hit.tx, ty: hit.ty, def: hit.def, valid: true }
        : null;
      tooltip.hide();
    } else if (state.mode === "place" && state.selected) {
      const def = state.selected;
      renderer.hover = {
        tx,
        ty,
        def,
        valid: grid.canPlace(tx, ty, def.gridW, def.gridH) && state.cash >= def.costCoins && !footprintOnRoad(tx, ty, def),
      };
      tooltip.hide();
    } else if (state.mode === "place" && !state.selected && !camDragging && !paintDragging) {
      renderer.hover = null;
      const hit = grid.buildingAt(tx, ty);
      if (hit && (hit.def.category === "house" || hit.def.category === "commercial")) {
        const anchor = renderer.buildingAnchorScreen(hit);
        tooltip.show(hit, { left: anchor.x, top: anchor.y });
      } else {
        tooltip.hide();
      }
    } else {
      renderer.hover = null;
      tooltip.hide();
    }
  });

  canvas.addEventListener("pointerup", () => {
    if (pendingInteract && !camDragging) {
      interactBuilding(pendingInteract);
    }
    pendingInteract = null;
    camDragging = false;
    paintDragging = false;
    canvas.classList.remove("dragging");
  });
  canvas.addEventListener("pointerleave", () => {
    if (!moveDrag) renderer.hover = null;
    tooltip.hide();
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

  sim.recomputeAll();
  syncMissionValues();
  refreshHud();
  setMode("place");

  let lastTs = performance.now();
  function loop(ts) {
    const dt = ts - lastTs;
    lastTs = ts;
    sim.update(dt);
    // Keep tooltip timer live while hovering
    if (tooltip.building && !tooltip.root.hidden) {
      const anchor = renderer.buildingAnchorScreen(tooltip.building);
      tooltip.update({ left: anchor.x, top: anchor.y });
    }
    renderer.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

main();
