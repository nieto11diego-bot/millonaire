import { loadGameData, enrichCatalog } from "./data.js";
import { Grid } from "./map/grid.js";
import { Renderer } from "./map/renderer.js";
import { RoadLayer } from "./map/roads.js";
import { RiverLayer } from "./map/river.js";
import { ExpansionLayer } from "./map/expansions.js";
import { ZeppelinFlyer, ZeppelinFleet, FCB_BANNER_TEXTS, MADRID_BANNER_TEXTS } from "./map/zeppelin.js";
import { FighterPair } from "./map/fighter.js";
import { ShopUI } from "./ui/shop.js";
import { MissionTracker, companyValueFromGrid } from "./missions.js";
import { MissionsUI } from "./ui/missions.js";
import { BuildingTooltip } from "./ui/tooltip.js";
import { EconomySim } from "./sim.js";
import { createRuntime, formatDuration, isRoadConnected, needsRoad, TIME_SCALE, wonderGoldRemainingMs, wonderDiamondRemainingMs, wonderGoldReady, wonderDiamondReady, buildDurationMs, buildPlaceXp, buildLevelThresholds, isConstructing } from "./economy.js";
import { cashHtml, goldHtml, diamondHtml, formatCash, replaceCurrencySymbols } from "./ui/money.js";
import { nextLevelReward, rewardsBetween, sumRewards } from "./levelRewards.js";
import { readSave, clearSave, buildSnapshot, applySnapshot, createAutosave } from "./save.js";

const TILE = 32;
const START_CASH = 50_000_000;
const START_GOLD = 50;
const START_DIAMONDS = 20;
const GOLD_DROP_CHANCE = 1 / 13;
const DIAMOND_DROP_CHANCE = 1 / 20;

const state = {
  cash: START_CASH,
  gold: START_GOLD,
  diamonds: START_DIAMONDS,
  level: 1,
  xp: 100,
  mode: "pan", // pan (puntero) | place | move | erase | road
  roadKind: "road", // road | zebra
  selected: null,
};

const cashEl = document.getElementById("cash");
const goldEl = document.getElementById("gold");
const diamondsEl = document.getElementById("diamonds");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const xpFillEl = document.getElementById("xp-fill");
const xpHudEl = document.getElementById("xp-hud");
const levelRewardTipEl = document.getElementById("level-reward-tip");
const levelRewardTipBodyEl = document.getElementById("level-reward-tip-body");
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
/** @type {import("./map/renderer.js").Renderer | null} */
let rendererRef = null;
/** @type {ReturnType<typeof createAutosave> | null} */
let autosave = null;
/** @type {{ marginRight: number, bridgeEvery: number } | null} */
let riverOptsRef = null;

function scheduleSave() {
  autosave?.schedule();
}

function xpProgress(xp, level, thresholds) {
  if (!thresholds?.length) return { pct: 0, label: String(xp) };
  const floor = thresholds[Math.max(0, level - 1)] ?? 0;
  const ceil = thresholds[level] ?? floor + Math.max(1, xp - floor);
  const span = Math.max(1, ceil - floor);
  const pct = Math.max(0, Math.min(100, ((xp - floor) / span) * 100));
  return { pct, label: String(xp) };
}

function refreshHud() {
  cashEl.textContent = formatCash(state.cash);
  if (goldEl) goldEl.textContent = state.gold.toLocaleString("en-US");
  if (diamondsEl) diamondsEl.textContent = state.diamonds.toLocaleString("en-US");
  levelEl.textContent = String(state.level);
  const { pct, label } = xpProgress(state.xp, state.level, levelThresholds);
  xpEl.textContent = label;
  if (xpFillEl) xpFillEl.style.width = `${pct}%`;
}

/** Independent rolls: gold 1/13, diamond 1/20 (can get both). */
function rollPremiumDrops() {
  const gotGold = Math.random() < GOLD_DROP_CHANCE;
  const gotDiamond = Math.random() < DIAMOND_DROP_CHANCE;
  if (gotGold) state.gold += 1;
  if (gotDiamond) state.diamonds += 1;
  const parts = [];
  if (gotGold) parts.push("+1 lingote");
  if (gotDiamond) parts.push("+1 diamante");
  return { gotGold, gotDiamond, suffix: parts.length ? ` · ${parts.join(" · ")}` : "" };
}

function escapeHint(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setHint(text) {
  hintEl.innerHTML = replaceCurrencySymbols(escapeHint(text));
}

function setMode(mode) {
  state.mode = mode;
  canvas.classList.toggle("mode-place", mode === "place" && !!state.selected);
  canvas.classList.toggle("mode-pan", mode === "pan");
  canvas.classList.toggle("mode-move", mode === "move");
  canvas.classList.toggle("mode-erase", mode === "erase");
  canvas.classList.toggle("mode-road", mode === "road");
  const btnPan = document.getElementById("btn-pan");
  btnPan?.classList.toggle("active", mode === "pan");
  btnPan?.setAttribute("aria-pressed", mode === "pan" ? "true" : "false");
  document.getElementById("btn-move").classList.toggle("active", mode === "move");
  document.getElementById("btn-erase").classList.toggle("active", mode === "erase");
  const btnRoad = document.getElementById("btn-road");
  btnRoad?.classList.toggle("active", mode === "road");
  btnRoad?.setAttribute("aria-pressed", mode === "road" ? "true" : "false");
  if (rendererRef) {
    rendererRef.showGrid =
      (mode === "place" && !!state.selected) ||
      mode === "move" ||
      mode === "erase" ||
      mode === "road";
  }
  if (mode === "pan") {
    setHint("Puntero: toca para seleccionar o cobrar. Arrastra para mover la cámara.");
  } else if (mode === "move") {
    setHint("Clic en un edificio o decoración para moverlo (cuesta 1/10 del precio). Te pedirá confirmación.");
  } else if (mode === "erase") {
    setHint("Clic en carretera o edificio para borrarlo (reembolso 50%). Te pedirá confirmación.");
  } else if (mode === "road") {
    setHint("Pinta carreteras: recta por defecto; curva/T/cruce según vecinos. Clic vacío cancela.");
  } else if (state.selected) {
    setHint(`Colocando: ${state.selected.name}. Clic en el mapa.`);
  } else {
    setHint("Arrastra para mover la cámara. Toca un edificio con $ para cobrar alquiler o beneficios.");
  }
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

function rewardHtml(reward) {
  if (!reward) return "—";
  if (reward.type === "cash") return cashHtml(reward.amount);
  if (reward.type === "gold") return goldHtml(reward.amount);
  return diamondHtml(reward.amount);
}

function applyLevelRewards(fromLevel, toLevel) {
  const list = rewardsBetween(fromLevel, toLevel);
  if (!list.length) return;
  const totals = sumRewards(list);
  if (totals.cash) state.cash += totals.cash;
  if (totals.gold) state.gold += totals.gold;
  if (totals.diamond) state.diamonds += totals.diamond;

  const parts = [];
  if (totals.cash) parts.push(`+$${formatCash(totals.cash)}`);
  if (totals.gold) parts.push(`+${totals.gold} oro`);
  if (totals.diamond) parts.push(`+${totals.diamond} diamante${totals.diamond === 1 ? "" : "s"}`);
  const gained = toLevel - fromLevel;
  const levelTxt = gained > 1 ? `niveles ${fromLevel + 1}–${toLevel}` : `nivel ${toLevel}`;
  setHint(`¡Subiste al ${levelTxt}! Recompensa: ${parts.join(", ")}`);
}

function refreshLevelRewardTip() {
  if (!levelRewardTipBodyEl) return;
  const nextLv = state.level + 1;
  const reward = nextLevelReward(state.level);
  levelRewardTipBodyEl.innerHTML = `
    <span class="lvl-tip-level">Nivel ${nextLv}</span>
    ${rewardHtml(reward)}
  `;
}

function showLevelRewardTip() {
  refreshLevelRewardTip();
  if (!levelRewardTipEl) return;
  levelRewardTipEl.hidden = false;
  requestAnimationFrame(() => levelRewardTipEl.classList.add("visible"));
}

function hideLevelRewardTip() {
  if (!levelRewardTipEl) return;
  levelRewardTipEl.classList.remove("visible");
  levelRewardTipEl.hidden = true;
}

function applyXp(amount) {
  if (!amount) return;
  state.xp += amount;
  if (levelThresholds) {
    const next = levelFromXp(state.xp, levelThresholds);
    if (next > state.level) {
      const prev = state.level;
      state.level = next;
      missions?.onLevelUp();
      applyLevelRewards(prev, next);
      refreshLevelRewardTip();
    }
  }
  syncMissionValues();
  refreshHud();
  scheduleSave();
}

function syncMissionValues() {
  if (!missions || !gridRef) return;
  missions.syncValueMissions(state.cash, companyValueFromGrid(gridRef), gridRef);
}

function initBuilding(building, opts = {}) {
  building.runtime = createRuntime(building.def, opts);
  sim?.recomputeAll();
  refreshHud();
  scheduleSave();
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
  const allDefs = [
    ...catalog.houses,
    ...catalog.commerces,
    ...catalog.decorations,
    ...catalog.wonders,
    ...(catalog.services || []),
  ];
  /** @type {Map<number, object>} */
  const defsByObjectId = new Map();
  /** @type {Map<string, object>} */
  const defsByConstant = new Map();
  for (const d of allDefs) {
    if (d.objectId != null) defsByObjectId.set(d.objectId, d);
    if (d.constant) defsByConstant.set(d.constant, d);
  }
  const roadCost = data.roads.costCoins ?? 500;
  levelThresholds = buildLevelThresholds(data.economy.levelCurve || {});

  const MAP_COLS = 80; // 5 × 16
  const MAP_ROWS = 80; // 5 × 16 → 25 equal parcels
  const grid = new Grid(MAP_COLS, MAP_ROWS, TILE);
  gridRef = grid;
  const roads = new RoadLayer(grid.cols, grid.rows, data.roads);
  const river = new RiverLayer(grid.cols, grid.rows, TILE);
  const expCfg = data.economy.expansions || {};
  const expansions = new ExpansionLayer(grid.cols, grid.rows, TILE, {
    zoneW: expCfg.zoneW ?? 16,
    zoneH: expCfg.zoneH ?? 16,
    baseCost: expCfg.baseCost ?? 50_000,
    costGrowth: expCfg.costGrowth ?? 3,
  });
  grid.river = river;
  grid.expansions = expansions;
  const renderer = new Renderer(canvas, grid, roads);
  rendererRef = renderer;
  renderer.river = river;
  renderer.expansions = expansions;
  const zeppelin = new ZeppelinFleet([
    new ZeppelinFlyer(grid),
    new ZeppelinFlyer(grid, {
      spriteUrl: "assets/fx/zeppelin_fcb.png",
      bannerTexts: FCB_BANNER_TEXTS,
      initialDelayMs: 4500,
      lockDir: -1,
      faction: "fcb",
    }),
    new ZeppelinFlyer(grid, {
      spriteUrl: "assets/fx/zeppelin_madrid.png",
      bannerTexts: MADRID_BANNER_TEXTS,
      initialDelayMs: 9000,
      lockDir: -1,
      faction: "madrid",
    }),
  ]);
  renderer.zeppelin = zeppelin;
  const fighters = new FighterPair(grid, { initialDelayMs: 3500 });
  renderer.fighters = fighters;
  await Promise.all([renderer.preload(allDefs), roads.preload(), zeppelin.preload(), fighters.preload()]);
  zeppelin.spawn();
  fighters.spawn();

  const saved = readSave();
  const riverOpts = saved?.river
    ? {
        seed: saved.river.seed,
        marginRight: saved.river.marginRight ?? 5,
        bridgeEvery: saved.river.bridgeEvery ?? 12,
      }
    : { marginRight: 5, bridgeEvery: 11 + Math.floor(Math.random() * 3) };
  riverOptsRef = { marginRight: riverOpts.marginRight, bridgeEvery: riverOpts.bridgeEvery };
  river.generate(riverOpts);

  sim = new EconomySim({
    grid,
    roads,
    economy: data.economy,
    onEvent: (type, payload) => {
      if (type === "rent_ready") {
        setHint(`Alquiler listo: ${payload.building.def.name}. Toca el edificio para cobrar.`);
      } else if (type === "commerce_ready") {
        setHint(`${payload.building.def.name} listo. Toca para cobrar.`);
      } else if (type === "wonder_gold_ready") {
        setHint(`${payload.building.def.name}: oro listo. Toca la maravilla para cobrar.`);
      } else if (type === "wonder_diamond_ready") {
        setHint(`${payload.building.def.name}: diamante listo. Toca la maravilla para cobrar.`);
      } else if (type === "build_complete") {
        setHint(`«${payload.building.def.name}» terminado. La población empezará a crecer.`);
        syncMissionValues();
        scheduleSave();
      }
    },
  });

  missions = new MissionTracker(data.missions.missions || [], state, data.i18n, "es");
  const missionsUi = new MissionsUI(document.getElementById("missions-panel"), missions, {
    onCollect: (sku, reward) => {
      state.cash += reward;
      syncMissionValues();
      refreshHud();
      scheduleSave();
      const row = missions.bySku.get(sku);
      setHint(
        `¡Misión cumplida! +$${reward.toLocaleString("en-US")}` +
          (row ? ` (${missions.titleOf(row)})` : "")
      );
    },
  });

  const t = (tid, fb) => missions.t(tid, fb);

  const tooltip = new BuildingTooltip(document.getElementById("building-tooltip"), {
    t,
    onInstantBuild: (building) => tryInstantBuild(building),
  });

  function tryInstantBuild(building) {
    if (!isConstructing(building)) return;
    const cost = sim.instantBuildCost(building);
    if (state.cash < cost) {
      setHint(`Necesitas ${cashHtml(cost)} para terminar «${building.def.name}» ahora.`);
      return;
    }
    state.cash -= cost;
    const result = sim.finishBuild(building);
    if (!result.ok) {
      state.cash += cost;
      return;
    }
    refreshHud();
    tooltip.hide();
    setHint(`«${building.def.name}» terminado. Coste: ${cashHtml(cost)}.`);
    scheduleSave();
  }

  window.__mc = { state, missions, grid, river, expansions, missionsUi, sim, tooltip, renderer };

  // —— Expansion purchase dialog ——
  const expandPanel = document.getElementById("expand-panel");
  const expandPriceEl = document.getElementById("expand-price");
  /** @type {{ zx: number, zy: number, cost: number } | null} */
  let pendingExpand = null;

  function hideExpandBuy() {
    pendingExpand = null;
    expandPanel.hidden = true;
    expandPanel.classList.remove("visible");
  }

  function openExpandBuy(zx, zy) {
    const cost = expansions.costFor(zx, zy);
    if (cost == null) return;
    pendingExpand = { zx, zy, cost };
    expandPriceEl.innerHTML = cashHtml(cost);
    expandPanel.hidden = false;
    requestAnimationFrame(() => expandPanel.classList.add("visible"));
  }

  function confirmExpandBuy() {
    if (!pendingExpand) return;
    const { cost } = pendingExpand;
    if (state.cash < cost) {
      setHint("No tienes suficiente efectivo para esta expansión.");
      hideExpandBuy();
      return;
    }
    const { zx, zy } = pendingExpand;
    const result = expansions.buy(zx, zy);
    if (!result.ok) {
      setHint(result.reason);
      hideExpandBuy();
      return;
    }
    state.cash -= result.cost;
    hideExpandBuy();
    missions?.improve(34); // "Size does Matter"
    syncMissionValues();
    refreshHud();
    setHint(`Expansión comprada por $${result.cost.toLocaleString("en-US")}.`);
    scheduleSave();
  }

  document.getElementById("expand-close").addEventListener("click", hideExpandBuy);
  document.getElementById("expand-cancel").addEventListener("click", hideExpandBuy);
  document.getElementById("expand-buy").addEventListener("click", confirmExpandBuy);
  expandPanel.addEventListener("click", (e) => {
    if (e.target === expandPanel) hideExpandBuy();
  });

  const confirmPanel = document.getElementById("confirm-panel");
  const confirmTitleEl = document.getElementById("confirm-title");
  const confirmCopyEl = document.getElementById("confirm-copy");
  const confirmAskEl = document.getElementById("confirm-ask");
  const confirmDetailEl = document.getElementById("confirm-detail");
  const confirmOkBtn = document.getElementById("confirm-ok");
  /** @type {null | (() => void)} */
  let pendingConfirm = null;

  function hideConfirm() {
    pendingConfirm = null;
    confirmPanel.hidden = true;
    confirmPanel.classList.remove("visible");
    confirmPanel.classList.remove("confirm-panel--danger");
  }

  /**
   * @param {{
   *   title: string,
   *   copy?: string,
   *   ask?: string,
   *   detailHtml?: string,
   *   okLabel?: string,
   *   danger?: boolean,
   *   onConfirm: () => void,
   * }} opts
   */
  function openConfirm(opts) {
    hideExpandBuy();
    pendingConfirm = opts.onConfirm;
    confirmTitleEl.textContent = opts.title;
    confirmCopyEl.textContent = opts.copy || "";
    confirmCopyEl.hidden = !opts.copy;
    confirmAskEl.textContent = opts.ask || "¿Quieres continuar?";
    confirmDetailEl.innerHTML = opts.detailHtml || "";
    confirmDetailEl.hidden = !opts.detailHtml;
    confirmOkBtn.textContent = opts.okLabel || "Confirmar";
    confirmPanel.classList.toggle("confirm-panel--danger", !!opts.danger);
    confirmPanel.hidden = false;
    requestAnimationFrame(() => confirmPanel.classList.add("visible"));
  }

  function runConfirm() {
    const fn = pendingConfirm;
    hideConfirm();
    if (fn) fn();
  }

  document.getElementById("confirm-close").addEventListener("click", hideConfirm);
  document.getElementById("confirm-cancel").addEventListener("click", hideConfirm);
  confirmOkBtn.addEventListener("click", runConfirm);
  confirmPanel.addEventListener("click", (e) => {
    if (e.target === confirmPanel) hideConfirm();
  });

  document.getElementById("btn-missions").addEventListener("click", () => missionsUi.toggle());
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" && e.code !== "Escape") return;
    e.preventDefault();
    if (!confirmPanel.hidden) hideConfirm();
    else if (!expandPanel.hidden) hideExpandBuy();
    else if (missionsUi.open) missionsUi.hide();
    else clearActiveTool();
  });

  // Load save or place starter bungalow on the unlocked parcel
  let loadedFromSave = false;
  if (saved) {
    const result = applySnapshot(saved, {
      state,
      grid,
      roads,
      expansions,
      river,
      missions,
      renderer,
      defsByObjectId,
      defsByConstant,
      sim,
    });
    if (result.ok) {
      loadedFromSave = true;
      if (saved.camera?.zoom != null) {
        const zoomInput = document.getElementById("zoom");
        if (zoomInput) zoomInput.value = String(renderer.camera.zoom);
      }
      syncMissionValues();
      refreshHud();
      setHint(`Partida cargada (${result.restored} edificios).`);
    }
  }

  if (!loadedFromSave) {
    const starter = catalog.houses.find((h) => h.name === "Bungalow") || catalog.houses[0];
    let starterTx = 0;
    let starterTy = 0;
    if (starter) {
      const foot = expansions.starterTileCenter(starter.gridW, starter.gridH);
      starterTx = foot.tx;
      starterTy = foot.ty;
      const placed = grid.place(starter, starterTx, starterTy);
      if (placed) initBuilding(placed, { skipBuild: true });
      for (let x = starterTx - 1; x < starterTx + starter.gridW + 1; x++) {
        if (!expansions.isUnlocked(x, starterTy + starter.gridH)) continue;
        roads.paint(x, starterTy + starter.gridH, true, () => false);
      }
    }
  }

  const shopEl = document.getElementById("shop");
  const btnShop = document.getElementById("btn-shop");

  function setShopOpen(open) {
    shopEl.classList.toggle("open", open);
    btnShop.setAttribute("aria-pressed", open ? "true" : "false");
    btnShop.classList.toggle("active", open);
  }
  setShopOpen(true);

  const shop = new ShopUI(
    shopEl,
    catalog,
    (item) => {
      state.selected = item;
      if (item) {
        setShopOpen(true);
        setMode("place");
        setHint(
          item.costDiamonds > 0
            ? `Colocando: ${item.name} (${item.gridW}×${item.gridH}). Costo ${item.costDiamonds} diamantes`
            : item.costFortune > 0
            ? `Colocando: ${item.name} (${item.gridW}×${item.gridH}). Costo ${item.costFortune} lingotes`
            : `Colocando: ${item.name} (${item.gridW}×${item.gridH}). Costo $${(item.costCoins || 0).toLocaleString("en-US")}`
        );
      } else if (state.mode === "place") {
        setMode("pan");
      }
    },
    {
      onHover: (item, screenPos) => {
        if (item && screenPos) tooltip.showCatalog(item, screenPos);
        else if (tooltip.catalogDef) tooltip.hide();
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
    hideConfirm();
    renderer.hover = null;
    renderer.highlight = null;
    renderer.radiusFocus = null;
    shop.clearSelection();
    setMode("pan");
  }

  btnShop.addEventListener("click", () => {
    const open = !shopEl.classList.contains("open");
    setShopOpen(open);
    if (open) {
      document.getElementById("btn-move").classList.remove("active");
      document.getElementById("btn-erase").classList.remove("active");
      document.getElementById("btn-road")?.classList.remove("active");
      if (state.mode === "move" || state.mode === "erase" || state.mode === "road") {
        moveDrag = null;
        renderer.hover = null;
        renderer.highlight = null;
        setMode(state.selected ? "place" : "pan");
      }
    }
  });

  document.getElementById("btn-pan").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    setMode("pan");
  });

  document.getElementById("btn-road").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    state.roadKind = "road";
    setMode(state.mode === "road" ? "pan" : "road");
  });

  document.getElementById("btn-move").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    setMode(state.mode === "move" ? "pan" : "move");
  });
  document.getElementById("btn-erase").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    setMode(state.mode === "erase" ? "pan" : "erase");
  });

  const zoomInput = document.getElementById("zoom");
  const ZOOM_MAX = 2;
  /** Zoom out far enough to fit the full map in the viewport. */
  function zoomMin() {
    const mapW = grid.cols * TILE;
    const mapH = grid.rows * TILE;
    const fit = Math.min(renderer.cssWidth / mapW, renderer.cssHeight / mapH);
    return Math.max(0.15, Math.min(0.5, fit * 0.92));
  }
  function applyZoom(z) {
    z = Math.min(ZOOM_MAX, Math.max(zoomMin(), z));
    zoomInput.min = String(zoomMin());
    zoomInput.value = String(Math.round(z * 100) / 100);
    renderer.camera.zoom = Number(zoomInput.value);
  }
  zoomInput.min = String(zoomMin());
  zoomInput.addEventListener("input", (e) => {
    applyZoom(Number(e.target.value));
  });
  document.getElementById("zoom-in").addEventListener("click", () => {
    applyZoom(Number(zoomInput.value) + 0.1);
  });
  document.getElementById("zoom-out").addEventListener("click", () => {
    applyZoom(Number(zoomInput.value) - 0.1);
  });
  window.addEventListener("resize", () => {
    applyZoom(renderer.camera.zoom);
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

  function moveCostOf(def) {
    return Math.floor((def.costCoins || 0) / 10);
  }

  function canDropBuilding(building, tx, ty) {
    const def = building.def;
    const sameSpot = building.tx === tx && building.ty === ty;
    const cost = sameSpot ? 0 : moveCostOf(def);
    return (
      grid.canPlace(tx, ty, def.gridW, def.gridH, building.id) &&
      !footprintOnRoad(tx, ty, def) &&
      state.cash >= cost
    );
  }

  function hasInfluenceRadius(def) {
    const infl = def.influenceRadiusTiles;
    return infl != null && infl >= 0;
  }

  function startCamDrag(p) {
    camDragging = true;
    canvas.classList.add("dragging");
    lastX = p.x;
    lastY = p.y;
  }

  function blockedForRoad(tx, ty) {
    return !!grid.buildingAt(tx, ty) || river.has(tx, ty) || !expansions.isUnlocked(tx, ty);
  }

  function paintRoadAt(tx, ty) {
    if (blockedForRoad(tx, ty)) {
      setHint("No se puede poner carretera sobre un edificio.");
      return;
    }
    const kind = state.roadKind === "zebra" ? "zebra" : "road";
    if (roads.has(tx, ty)) {
      // Allow converting an existing road tile into a zebra crossing (no extra charge).
      if (kind === "zebra" && roads.kindAt(tx, ty) !== "zebra") {
        roads.paint(tx, ty, true, blockedForRoad, "zebra");
        sim.recomputeAll();
        refreshHud();
        scheduleSave();
      }
      return;
    }
    if (state.cash < roadCost) {
      setHint("No tienes suficiente efectivo.");
      return;
    }
    if (roads.paint(tx, ty, true, blockedForRoad, kind)) {
      state.cash -= roadCost;
      sim.recomputeAll();
      syncMissionValues();
      refreshHud();
      scheduleSave();
    }
  }

  function eraseAt(tx, ty) {
    if (roads.has(tx, ty)) {
      roads.paint(tx, ty, false);
      const refund = Math.floor(roadCost * 0.5);
      state.cash += refund;
      sim.recomputeAll();
      syncMissionValues();
      refreshHud();
      setHint(`Carretera borrada. Reembolso $${refund.toLocaleString("en-US")}`);
      scheduleSave();
      return true;
    }
    const removed = grid.eraseAt(tx, ty);
    if (removed) {
      const diamondPrice = removed.def.costDiamonds || 0;
      const goldPrice = removed.def.costFortune || 0;
      const cashPrice = removed.def.costCoins || 0;
      if (diamondPrice > 0) {
        const refund = Math.floor(diamondPrice * 0.5);
        state.diamonds += refund;
        setHint(
          `Borrado ${removed.def.name}. Reembolso 50%: ${refund} diamantes (de ${diamondPrice})`
        );
      } else if (goldPrice > 0) {
        const refund = Math.floor(goldPrice * 0.5);
        state.gold += refund;
        setHint(
          `Borrado ${removed.def.name}. Reembolso 50%: ${refund} lingotes (de ${goldPrice})`
        );
      } else {
        const refund = Math.floor(cashPrice * 0.5);
        state.cash += refund;
        setHint(
          `Borrado ${removed.def.name}. Reembolso 50%: $${refund.toLocaleString("en-US")}` +
            (cashPrice ? ` (de $${cashPrice.toLocaleString("en-US")})` : "")
        );
      }
      sim.recomputeAll();
      syncMissionValues();
      refreshHud();
      scheduleSave();
      return true;
    }
    return false;
  }

  /** Preview info for erase confirmation (no mutation). */
  function erasePreviewAt(tx, ty) {
    if (roads.has(tx, ty)) {
      const kind = roads.kindAt(tx, ty) === "zebra" ? "Paso de cebra" : "Carretera";
      const refund = Math.floor(roadCost * 0.5);
      return {
        name: kind,
        detailHtml: `Reembolso 50%: ${cashHtml(refund)}`,
      };
    }
    const hit = grid.buildingAt(tx, ty);
    if (hit) {
      const diamondPrice = hit.def.costDiamonds || 0;
      const goldPrice = hit.def.costFortune || 0;
      const cashPrice = hit.def.costCoins || 0;
      let detailHtml;
      if (diamondPrice > 0) detailHtml = `Reembolso 50%: ${diamondHtml(Math.floor(diamondPrice * 0.5))}`;
      else if (goldPrice > 0) detailHtml = `Reembolso 50%: ${goldHtml(Math.floor(goldPrice * 0.5))}`;
      else detailHtml = `Reembolso 50%: ${cashHtml(Math.floor(cashPrice * 0.5))}`;
      return { name: hit.def.name, detailHtml };
    }
    return null;
  }

  function askMoveBuilding(hit, tx, ty) {
    const cost = moveCostOf(hit.def);
    const ox = tx - hit.tx;
    const oy = ty - hit.ty;
    openConfirm({
      title: "Mover",
      copy: `Vas a mover «${hit.def.name}». El coste se cobra al soltarlo en otra casilla.`,
      ask: "¿Quieres moverlo?",
      detailHtml: cost > 0 ? `Coste: ${cashHtml(cost)}` : "Coste: gratis (sin precio en efectivo)",
      okLabel: "Mover",
      onConfirm: () => {
        moveDrag = { building: hit, ox, oy };
        updateMoveHover(tx, ty);
        tooltip.hide();
        setHint(
          `Moviendo ${hit.def.name}. Coste al soltar: $${cost.toLocaleString("en-US")}. Clic para soltar.`
        );
      },
    });
  }

  function askEraseAt(tx, ty) {
    const preview = erasePreviewAt(tx, ty);
    if (!preview) return false;
    openConfirm({
      title: "Destruir",
      copy: `Vas a destruir «${preview.name}». Esta acción no se puede deshacer.`,
      ask: "¿Seguro que quieres destruirlo?",
      detailHtml: preview.detailHtml,
      okLabel: "Destruir",
      danger: true,
      onConfirm: () => {
        eraseAt(tx, ty);
      },
    });
    return true;
  }

  function interactBuilding(building) {
    const action = sim.tapAction(building);

    if (action === "finish_build") {
      const anchor = renderer.buildingAnchorScreen(building);
      tooltip.show(building, { left: anchor.x, top: anchor.y });
      setHint(`«${building.def.name}»: confirma con ✓ o cancela con ✕.`);
      return;
    }

    if (action === "collect_rent") {
      if (needsRoad(building.def) && !isRoadConnected(building, roads)) {
        setHint("Esta casa necesita carretera adyacente para cobrar alquiler.");
        return;
      }
      const result = sim.collectRent(building);
      if (!result.ok) return;
      state.cash += result.cash;
      const drops = rollPremiumDrops();
      missions.onRentCollected();
      applyXp(result.xp || 0);
      renderer.spawnCollectPopup(building, result.cash, result.xp || 0);
      syncMissionValues();
      refreshHud();
      setHint(
        `Cobrado alquiler de ${building.def.name}: +$${result.cash.toLocaleString("en-US")}${drops.suffix}`
      );
      scheduleSave();
      return;
    }

    if (action === "collect_commerce") {
      if (needsRoad(building.def) && !isRoadConnected(building, roads)) {
        setHint("Este comercio necesita carretera adyacente para cobrar.");
        return;
      }
      const result = sim.collectCommerce(building);
      if (!result.ok) return;
      state.cash += result.cash;
      const drops = rollPremiumDrops();
      missions.onCommerceCollected(building.def.objectId);
      applyXp(result.xp || 0);
      renderer.spawnCollectPopup(building, result.cash, result.xp || 0);
      syncMissionValues();
      refreshHud();
      setHint(
        `Cobrado ${building.def.name}: +$${result.cash.toLocaleString("en-US")}${drops.suffix}`
      );
      scheduleSave();
      return;
    }

    if (action === "collect_wonder") {
      const result = sim.collectWonder(building);
      if (!result.ok) return;
      if (result.gold) state.gold += result.gold;
      if (result.diamonds) state.diamonds += result.diamonds;
      refreshHud();
      const parts = [];
      if (result.gold) parts.push(`+${result.gold} lingote${result.gold === 1 ? "" : "s"}`);
      if (result.diamonds) parts.push(`+${result.diamonds} diamante${result.diamonds === 1 ? "" : "s"}`);
      setHint(`Cobrado ${building.def.name}: ${parts.join(" · ")}`);
      scheduleSave();
      return;
    }

    if (building.def.category === "house" && building.runtime?.status === "waiting") {
      const rt = building.runtime;
      setHint(
        `${building.def.name}: ${rt.people || 0}/${rt.maxPeople || 0} hab. · cobra en ${formatDuration(rt.remainingMs / TIME_SCALE)}.`
      );
    } else if (building.def.category === "commercial" && building.runtime?.status === "waiting") {
      setHint(
        `${building.def.name}: cobra en ${formatDuration(building.runtime.remainingMs / TIME_SCALE)}.`
      );
    } else if (isConstructing(building)) {
      const left = Math.max(0, (building.runtime.buildEndsAt || 0) - Date.now());
      setHint(
        `${building.def.name}: en construcción (${formatDuration(left)}). Usa construcción rápida o espera.`
      );
    } else if (building.def.category === "wonder" && building.runtime) {
      const rt = building.runtime;
      const goldLeft = wonderGoldRemainingMs(rt);
      const diaLeft = wonderDiamondRemainingMs(rt);
      const parts = [];
      parts.push(wonderGoldReady(rt) ? "oro listo" : `oro en ${formatDuration(goldLeft)}`);
      parts.push(wonderDiamondReady(rt) ? "diamante listo" : `diamante en ${formatDuration(diaLeft)}`);
      setHint(`${building.def.name}: ${parts.join(" · ")}`);
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
    renderer.highlight = null;
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

    if (state.mode === "pan") {
      // Pointer tool: select / interact, or pan if empty / drag
      const zone = expansions.zoneAt(tx, ty);
      if (zone && expansions.isBuyable(zone.zx, zone.zy)) {
        openExpandBuy(zone.zx, zone.zy);
        return;
      }
      const hit = grid.buildingAt(tx, ty);
      if (hit) {
        pendingInteract = hit;
        lastX = p.x;
        lastY = p.y;
      } else {
        startCamDrag(p);
      }
      return;
    }

    // Drop while moving a building (invalid drop keeps it picked up)
    if (state.mode === "move" && moveDrag) {
      const { building, ox, oy } = moveDrag;
      const dropTx = tx - ox;
      const dropTy = ty - oy;
      const sameSpot = building.tx === dropTx && building.ty === dropTy;
      const cost = sameSpot ? 0 : moveCostOf(building.def);
      if (canDropBuilding(building, dropTx, dropTy)) {
        if (grid.move(building, dropTx, dropTy)) {
          if (cost > 0) {
            state.cash -= cost;
            refreshHud();
          }
          sim.recomputeAll();
          syncMissionValues();
          refreshHud();
          setHint(
            sameSpot
              ? `Sin cambio: ${building.def.name}`
              : `Movido: ${building.def.name}. Coste $${cost.toLocaleString("en-US")}`
          );
          scheduleSave();
        }
        moveDrag = null;
        renderer.hover = null;
      } else {
        updateMoveHover(tx, ty);
        if (state.cash < cost) {
          setHint(
            `No tienes suficiente efectivo para mover (cuesta $${cost.toLocaleString("en-US")}). Esc cancela.`
          );
        } else {
          setHint("No se puede soltar aquí (ocupado, fuera del mapa o sobre carretera). Esc cancela.");
        }
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
      askMoveBuilding(hit, tx, ty);
      return;
    }

    if (state.mode === "erase") {
      const asked = askEraseAt(tx, ty);
      if (!asked) {
        clearActiveTool();
        startCamDrag(p);
      }
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
      const diamondCost = def.costDiamonds || 0;
      const goldCost = def.costFortune || 0;
      const cashCost = def.costCoins || 0;
      if (diamondCost > 0) {
        if (state.diamonds < diamondCost) {
          setHint("No tienes suficientes diamantes.");
          return;
        }
      } else if (goldCost > 0) {
        if (state.gold < goldCost) {
          setHint("No tienes suficientes lingotes de oro.");
          return;
        }
      } else if (state.cash < cashCost) {
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
        if (diamondCost > 0) state.diamonds -= diamondCost;
        else if (goldCost > 0) state.gold -= goldCost;
        else state.cash -= cashCost;
        missions?.onBuildingBought(def);
        applyXp(buildPlaceXp(def));
        syncMissionValues();
        refreshHud();
        const buildMs = buildDurationMs(def);
        setHint(
          buildMs > 0
            ? `Colocado: ${def.name}. Construcción: ${formatDuration(buildMs)}.`
            : `Colocado: ${def.name}`
        );
        scheduleSave();
      }
      return;
    }

    // Idle: buy adjacent expansion, tap building, or pan
    const zone = expansions.zoneAt(tx, ty);
    if (zone && expansions.isBuyable(zone.zx, zone.zy)) {
      openExpandBuy(zone.zx, zone.zy);
      return;
    }

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
      renderer.radiusFocus = null;
      renderer.highlight = null;
      tooltip.hide();
      return;
    }

    const { tx, ty } = tileFromEvent(e);
    const key = `${tx},${ty}`;

    if (moveDrag) {
      updateMoveHover(tx, ty);
      renderer.radiusFocus = null;
      tooltip.hide();
      return;
    }

    if (paintDragging && state.mode === "road") {
      if (key !== lastPaintKey) {
        lastPaintKey = key;
        paintRoadAt(tx, ty);
      }
    }

    if (state.mode === "pan" || (state.mode === "place" && !state.selected && !camDragging && !paintDragging)) {
      renderer.hover = null;
      renderer.highlight = null;
      const zone = expansions.zoneAt(tx, ty);
      renderer.expandHover =
        zone && expansions.isBuyable(zone.zx, zone.zy) ? { zx: zone.zx, zy: zone.zy } : null;
      const hit = grid.buildingAt(tx, ty);
      if (hit && hasInfluenceRadius(hit.def)) {
        renderer.radiusFocus = { tx: hit.tx, ty: hit.ty, def: hit.def };
      } else {
        renderer.radiusFocus = null;
      }
      if (hit && (hit.def.category === "house" || hit.def.category === "commercial" || hit.def.category === "wonder")) {
        // Construcción rápida: solo al clic, no al pasar el ratón
        if (isConstructing(hit)) {
          if (!(tooltip.building === hit && !tooltip.root.hidden) && !tooltip.pointerInside) {
            tooltip.scheduleHide(80);
          }
        } else {
          const anchor = renderer.buildingAnchorScreen(hit);
          tooltip.show(hit, { left: anchor.x, top: anchor.y });
        }
      } else if (renderer.expandHover) {
        const cost = expansions.costFor(renderer.expandHover.zx, renderer.expandHover.zy);
        setHint(`Expansión en venta: $${(cost || 0).toLocaleString("en-US")}. Toca para comprar.`);
        if (!tooltip.pointerInside) tooltip.scheduleHide(80);
      } else {
        if (!tooltip.pointerInside) tooltip.scheduleHide(80);
      }
    } else if (state.mode === "road") {
      renderer.hover = {
        tx,
        ty,
        road: true,
        valid: !blockedForRoad(tx, ty) && state.cash >= roadCost,
      };
      renderer.highlight = null;
      renderer.expandHover = null;
      renderer.radiusFocus = null;
      tooltip.hide();
    } else if (state.mode === "move") {
      const hit = grid.buildingAt(tx, ty);
      renderer.hover = null;
      renderer.highlight = hit
        ? { tx: hit.tx, ty: hit.ty, gridW: hit.def.gridW, gridH: hit.def.gridH, kind: "move" }
        : null;
      renderer.expandHover = null;
      renderer.radiusFocus =
        hit && hasInfluenceRadius(hit.def) ? { tx: hit.tx, ty: hit.ty, def: hit.def } : null;
      tooltip.hide();
    } else if (state.mode === "erase") {
      const hit = grid.buildingAt(tx, ty);
      renderer.hover = null;
      if (roads.has(tx, ty)) {
        renderer.highlight = { tx, ty, gridW: 1, gridH: 1, kind: "erase" };
      } else if (hit) {
        renderer.highlight = {
          tx: hit.tx,
          ty: hit.ty,
          gridW: hit.def.gridW,
          gridH: hit.def.gridH,
          kind: "erase",
        };
      } else {
        renderer.highlight = null;
      }
      renderer.expandHover = null;
      renderer.radiusFocus = null;
      tooltip.hide();
    } else if (state.mode === "place" && state.selected) {
      const def = state.selected;
      renderer.hover = {
        tx,
        ty,
        def,
        valid:
          grid.canPlace(tx, ty, def.gridW, def.gridH) &&
          !footprintOnRoad(tx, ty, def) &&
          ((def.costDiamonds || 0) > 0
            ? state.diamonds >= def.costDiamonds
            : (def.costFortune || 0) > 0
              ? state.gold >= def.costFortune
              : state.cash >= (def.costCoins || 0)),
      };
      renderer.highlight = null;
      renderer.expandHover = null;
      renderer.radiusFocus = hasInfluenceRadius(def) ? { tx, ty, def } : null;
      tooltip.hide();
    } else {
      renderer.hover = null;
      renderer.highlight = null;
      renderer.expandHover = null;
      renderer.radiusFocus = null;
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
    if (!moveDrag) {
      renderer.hover = null;
      renderer.highlight = null;
    }
    renderer.expandHover = null;
    renderer.radiusFocus = null;
    if (!tooltip.pointerInside) {
      tooltip.scheduleHide(tooltip.root.classList.contains("interactive") ? 280 : 120);
    }
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      applyZoom(Number(zoomInput.value) - Math.sign(e.deltaY) * 0.1);
    },
    { passive: false }
  );

  sim.recomputeAll();
  syncMissionValues();
  refreshLevelRewardTip();
  if (xpHudEl) {
    xpHudEl.addEventListener("mouseenter", showLevelRewardTip);
    xpHudEl.addEventListener("mouseleave", hideLevelRewardTip);
  }
  refreshHud();
  setMode("pan");

  autosave = createAutosave(
    () =>
      buildSnapshot({
        state,
        grid,
        roads,
        expansions,
        river,
        missions,
        renderer,
        riverOpts: riverOptsRef || undefined,
      }),
    { delayMs: 450 }
  );

  // Persist immediately after first load/new game, then periodically.
  scheduleSave();
  setInterval(() => autosave?.flush(), 60_000);

  window.addEventListener("beforeunload", () => {
    autosave?.flush();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") autosave?.flush();
  });

  document.getElementById("btn-new-game")?.addEventListener("click", () => {
    openConfirm({
      title: "Nueva partida",
      copy: "Se borrará el progreso guardado en este navegador.",
      ask: "¿Empezar de cero?",
      detailHtml: "Esta acción no se puede deshacer.",
      okLabel: "Nueva partida",
      danger: true,
      onConfirm: () => {
        // Cancel pending/autosave flush so beforeunload does not rewrite the save.
        autosave?.cancel();
        autosave = null;
        clearSave();
        location.reload();
      },
    });
  });

  let lastTs = performance.now();
  function loop(ts) {
    const dt = ts - lastTs;
    lastTs = ts;
    sim.update(dt);
    zeppelin.update(dt);
    fighters.update(dt);
    renderer.floatingRewards.update(dt);
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
