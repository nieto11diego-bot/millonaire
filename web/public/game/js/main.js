import { loadGameData, enrichCatalog } from "./data.js";
import { Grid } from "./map/grid.js";
import { Renderer } from "./map/renderer.js";
import { RoadLayer } from "./map/roads.js";
import { RiverLayer } from "./map/river.js";
import { ExpansionLayer } from "./map/expansions.js";
import { NatureLayer, NATURE_KINDS } from "./map/nature.js";
import { DailyChestLayer, chestTierByLevel } from "./map/dailyChests.js";
import { ZeppelinFlyer, ZeppelinFleet, FCB_BANNER_TEXTS, MADRID_BANNER_TEXTS } from "./map/zeppelin.js";
import { FighterPair } from "./map/fighter.js";
import { RoadGraph } from "./map/roadGraph.js";
import { ShopUI } from "./ui/shop.js";
import { ContractsUI } from "./ui/contracts.js";
import { MissionTracker, companyValueFromGrid } from "./missions.js";
import { MissionsUI } from "./ui/missions.js";
import { BuildingTooltip } from "./ui/tooltip.js";
import { ControlTip, bindControlInfo } from "./ui/controlTip.js";
import { EconomySim } from "./sim.js";
import { createRuntime, formatDuration, isConnectedToHQ, isHQ, needsRoad, TIME_SCALE, wonderGoldRemainingMs, wonderDiamondRemainingMs, wonderGoldReady, wonderDiamondReady, buildDurationMs, buildPlaceXp, buildLevelThresholds, isConstructing, usesLootEconomy, getBuildingFinalProduction, effectiveMaxLoot, findContract, cityPopulation, commerceCycleReward, commerceRentPerCustomer } from "./economy.js";
import { cashHtml, goldHtml, diamondHtml, formatCash, replaceCurrencySymbols } from "./ui/money.js";
import { rewardForLevel, rewardsBetween, sumRewards } from "./levelRewards.js";
import { clearSave, clearAllSaves, loadInitialSave, buildSnapshot, applySnapshot, createAutosave, setPersistEnabled, NEW_GAME_FLAG, flushCloudSave, initPlayModeFromUrl, isGuestMode } from "./save.js";

const TILE = 32;
const START_CASH = 200_000;
const START_GOLD = 0;
const START_DIAMONDS = 0;
const GOLD_DROP_CHANCE = 1 / 10;
const DIAMOND_DROP_CHANCE = 1 / 20;

function prefersTouchPlaceUi() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

const state = {
  cash: START_CASH,
  gold: START_GOLD,
  diamonds: START_DIAMONDS,
  level: 1,
  xp: 0,
  mode: "pan", // pan (puntero) | place | move | erase | road
  roadKind: "road", // road | zebra | path
  editKind: "erase", // erase | move
  selected: null,
};

const cashEl = document.getElementById("cash");
const goldEl = document.getElementById("gold");
const diamondsEl = document.getElementById("diamonds");
const levelEl = document.getElementById("level");
const xpEl = document.getElementById("xp");
const xpFillEl = document.getElementById("xp-fill");
const xpHudEl = document.getElementById("xp-hud");
const populationEl = document.getElementById("population");
const levelRewardTipEl = document.getElementById("level-reward-tip");
const levelRewardTipBodyEl = document.getElementById("level-reward-tip-body");
const levelUpPanelEl = document.getElementById("levelup-panel");
const levelUpCopyEl = document.getElementById("levelup-copy");
const levelUpLevelEl = document.getElementById("levelup-level");
const levelUpRewardsEl = document.getElementById("levelup-rewards");
const levelUpAcceptBtn = document.getElementById("levelup-accept");

/** @type {{ fromLevel: number, toLevel: number }[]} */
const levelUpQueue = [];
let levelUpOpen = false;
const hintEl = document.getElementById("hint");
const canvas = document.getElementById("map");

/** @type {MissionTracker | null} */
let missions = null;
/** @type {EconomySim | null} */
let sim = null;
/** @type {import("./map/roadGraph.js").RoadGraph | null} */
let roadGraphRef = null;
/** @type {number[] | null} */
let levelThresholds = null;
/** @type {import("./map/grid.js").Grid | null} */
let gridRef = null;
/** @type {import("./map/renderer.js").Renderer | null} */
let rendererRef = null;
/** Clears sticky touch-place preview when leaving place mode. */
let onLeavePlaceMode = null;
/** @type {ReturnType<typeof createAutosave> | null} */
let autosave = null;
/** @type {{ marginRight: number, bridgeEvery: number } | null} */
let riverOptsRef = null;

function scheduleSave() {
  autosave?.schedule();
}

/** Hard reset: stop persistence, wipe local + cloud save, force a cold load. */
async function startNewGame() {
  setPersistEnabled(false);
  autosave?.cancel();
  autosave = null;
  await clearAllSaves();
  try {
    sessionStorage.setItem(NEW_GAME_FLAG, "1");
  } catch {
    /* ignore */
  }
  const url = new URL(location.href);
  url.searchParams.set("new", String(Date.now()));
  location.replace(url.pathname + url.search + url.hash);
}

function xpProgress(xp, level, thresholds) {
  if (!thresholds?.length) return { pct: 0, label: `${xp}/0` };
  const floor = thresholds[Math.max(0, level - 1)] ?? 0;
  const ceil = thresholds[level] ?? floor + Math.max(1, xp - floor);
  const span = Math.max(1, ceil - floor);
  const intoLevel = Math.max(0, Math.min(span, xp - floor));
  const pct = Math.max(0, Math.min(100, (intoLevel / span) * 100));
  return { pct, label: `${intoLevel}/${span}` };
}

function refreshHud() {
  cashEl.textContent = formatCash(state.cash);
  if (goldEl) goldEl.textContent = state.gold.toLocaleString("en-US");
  if (diamondsEl) diamondsEl.textContent = state.diamonds.toLocaleString("en-US");
  levelEl.textContent = String(state.level);
  const { pct, label } = xpProgress(state.xp, state.level, levelThresholds);
  xpEl.textContent = label;
  if (xpFillEl) xpFillEl.style.width = `${pct}%`;
  if (populationEl) {
    populationEl.textContent = cityPopulation(gridRef?.buildings).toLocaleString("en-US");
  }
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

function positionFlyout(flyout, anchorBtn) {
  if (!flyout || !anchorBtn || flyout.hidden) return;
  const dock = flyout.closest(".dock");
  const dockRect = dock?.getBoundingClientRect();
  const btnRect = anchorBtn.getBoundingClientRect();
  if (!dockRect) return;
  const cx = btnRect.left + btnRect.width / 2 - dockRect.left;
  flyout.style.left = `${Math.round(cx)}px`;
  flyout.style.bottom = `${Math.round(dockRect.bottom - btnRect.top + 8)}px`;
}

function syncRoadKindUi() {
  const kind = state.roadKind;
  const btnNormal = document.getElementById("btn-road-normal");
  const btnZebra = document.getElementById("btn-road-zebra");
  const btnPath = document.getElementById("btn-road-path");
  const flyout = document.getElementById("road-flyout");
  const btnRoad = document.getElementById("btn-road");
  const inRoad = state.mode === "road";
  if (flyout) {
    flyout.hidden = !inRoad;
    if (inRoad) positionFlyout(flyout, btnRoad);
  }
  btnNormal?.classList.toggle("active", inRoad && kind === "road");
  btnNormal?.setAttribute("aria-pressed", inRoad && kind === "road" ? "true" : "false");
  btnZebra?.classList.toggle("active", inRoad && kind === "zebra");
  btnZebra?.setAttribute("aria-pressed", inRoad && kind === "zebra" ? "true" : "false");
  btnPath?.classList.toggle("active", inRoad && kind === "path");
  btnPath?.setAttribute("aria-pressed", inRoad && kind === "path" ? "true" : "false");
  const mainImg = document.querySelector("#btn-road img");
  if (mainImg) {
    mainImg.src =
      kind === "zebra"
        ? "assets/ui/icon_zebra.png"
        : kind === "path"
          ? "assets/ui/icon_path.png"
          : "assets/roads/straight_ew.png";
  }
}

function syncEditFlyoutUi() {
  const flyout = document.getElementById("edit-flyout");
  const btnEdit = document.getElementById("btn-edit");
  const btnErase = document.getElementById("btn-erase");
  const btnMove = document.getElementById("btn-move");
  const inEdit = state.mode === "erase" || state.mode === "move";
  if (flyout) {
    flyout.hidden = !inEdit;
    if (inEdit) positionFlyout(flyout, btnEdit);
  }
  btnEdit?.classList.toggle("active", inEdit);
  btnEdit?.setAttribute("aria-pressed", inEdit ? "true" : "false");
  btnErase?.classList.toggle("active", state.mode === "erase");
  btnErase?.setAttribute("aria-pressed", state.mode === "erase" ? "true" : "false");
  btnMove?.classList.toggle("active", state.mode === "move");
  btnMove?.setAttribute("aria-pressed", state.mode === "move" ? "true" : "false");
  const mainImg = document.querySelector("#btn-edit img");
  if (mainImg) {
    mainImg.src =
      state.mode === "move"
        ? "assets/ui/icon_move.png"
        : state.mode === "erase"
          ? "assets/ui/icon_excavator.png"
          : "assets/ui/icon_edit.png";
  }
}

function setMode(mode) {
  state.mode = mode;
  if (mode === "erase" || mode === "move") state.editKind = mode;
  canvas.classList.toggle("mode-place", mode === "place" && !!state.selected);
  canvas.classList.toggle("mode-pan", mode === "pan");
  canvas.classList.toggle("mode-move", mode === "move");
  canvas.classList.toggle("mode-erase", mode === "erase");
  canvas.classList.toggle("mode-road", mode === "road");
  const btnPan = document.getElementById("btn-pan");
  btnPan?.classList.toggle("active", mode === "pan");
  btnPan?.setAttribute("aria-pressed", mode === "pan" ? "true" : "false");
  const btnRoad = document.getElementById("btn-road");
  btnRoad?.classList.toggle("active", mode === "road");
  btnRoad?.setAttribute("aria-pressed", mode === "road" ? "true" : "false");
  syncRoadKindUi();
  syncEditFlyoutUi();
  if (mode !== "place") {
    onLeavePlaceMode?.();
  }
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
    setHint("Clic en edificio o vegetación (terreno comprado) para reubicar. Esc cancela.");
  } else if (mode === "erase") {
    setHint("Clic en carretera, camino, edificio o vegetación (terreno comprado) para destruir.");
  } else if (mode === "road") {
    setHint(
      state.roadKind === "zebra"
        ? "Paso de cebra: pinta sobre vacío o convierte una carretera. Clic vacío cancela."
        : state.roadKind === "path"
          ? "Camino de tierra: pinta sendas peatonales. Clic vacío cancela."
          : "Pinta carreteras: recta por defecto; curva/T/cruce según vecinos. Clic vacío cancela."
    );
  } else if (state.selected) {
    setHint(
      prefersTouchPlaceUi()
        ? `Colocando: ${state.selected.name}. Toca el mapa para elegir sitio y confirma con ✓.`
        : `Colocando: ${state.selected.name}. Clic en el mapa.`
    );
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
  if (!list.length) return null;
  const totals = sumRewards(list);
  if (totals.cash) state.cash += totals.cash;
  if (totals.gold) state.gold += totals.gold;
  if (totals.diamond) state.diamonds += totals.diamond;
  return totals;
}

function totalsRewardHtml(totals) {
  if (!totals) return `<span class="lvlup-empty">Sin recompensa extra</span>`;
  const parts = [];
  if (totals.cash) {
    parts.push(`<span class="lvlup-reward">${cashHtml(totals.cash)}</span>`);
  }
  if (totals.gold) {
    parts.push(`<span class="lvlup-reward">${goldHtml(totals.gold)}</span>`);
  }
  if (totals.diamond) {
    parts.push(`<span class="lvlup-reward">${diamondHtml(totals.diamond)}</span>`);
  }
  return parts.length ? parts.join("") : `<span class="lvlup-empty">Sin recompensa extra</span>`;
}

function showLevelUpPanel(fromLevel, toLevel) {
  if (!levelUpPanelEl) return;
  const gained = toLevel - fromLevel;
  const list = rewardsBetween(fromLevel, toLevel);
  const totals = sumRewards(list);

  if (levelUpCopyEl) {
    levelUpCopyEl.textContent =
      gained > 1
        ? `Has avanzado ${gained} niveles de una vez.`
        : "Has alcanzado un nuevo nivel.";
  }
  if (levelUpLevelEl) {
    levelUpLevelEl.textContent =
      gained > 1 ? `Niveles ${fromLevel + 1}–${toLevel}` : `Nivel ${toLevel}`;
  }
  if (levelUpRewardsEl) {
    levelUpRewardsEl.innerHTML = totalsRewardHtml(
      list.length ? totals : null
    );
  }

  levelUpOpen = true;
  levelUpPanelEl.hidden = false;
  requestAnimationFrame(() => levelUpPanelEl.classList.add("visible"));
  levelUpAcceptBtn?.focus?.();
}

function hideLevelUpPanel() {
  if (!levelUpPanelEl) return;
  levelUpPanelEl.classList.remove("visible");
  levelUpPanelEl.hidden = true;
  levelUpOpen = false;
}

function acceptLevelUp() {
  hideLevelUpPanel();
  const next = levelUpQueue.shift();
  if (next) showLevelUpPanel(next.fromLevel, next.toLevel);
}

function queueLevelUpPanel(fromLevel, toLevel) {
  if (!levelUpPanelEl) {
    // Fallback if DOM missing: keep old hint behaviour
    const totals = sumRewards(rewardsBetween(fromLevel, toLevel));
    const parts = [];
    if (totals.cash) parts.push(`+$${formatCash(totals.cash)}`);
    if (totals.gold) parts.push(`+${totals.gold} oro`);
    if (totals.diamond) parts.push(`+${totals.diamond} diamante${totals.diamond === 1 ? "" : "s"}`);
    const gained = toLevel - fromLevel;
    const levelTxt = gained > 1 ? `niveles ${fromLevel + 1}–${toLevel}` : `nivel ${toLevel}`;
    setHint(`¡Subiste al ${levelTxt}! Recompensa: ${parts.join(", ") || "ninguna"}`);
    return;
  }
  if (levelUpOpen) {
    levelUpQueue.push({ fromLevel, toLevel });
    return;
  }
  showLevelUpPanel(fromLevel, toLevel);
}

function refreshLevelRewardTip() {
  if (!levelRewardTipBodyEl) return;
  const maxLv = levelThresholds?.length || 100;
  const rows = [];
  for (let i = 1; i <= 3; i++) {
    const lv = state.level + i;
    if (lv > maxLv) break;
    const reward = rewardForLevel(lv);
    rows.push(`
      <div class="lvl-tip-row">
        <span class="lvl-tip-level">Nivel ${lv}</span>
        ${rewardHtml(reward)}
      </div>
    `);
  }
  levelRewardTipBodyEl.innerHTML = rows.length
    ? rows.join("")
    : `<div class="lvl-tip-row"><span class="lvl-tip-level">Máximo alcanzado</span></div>`;
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
      queueLevelUpPanel(prev, next);
      refreshLevelRewardTip();
    }
  }
  syncMissionValues();
  refreshHud();
  scheduleSave();
}

/** Public alias for XP grants (place building, etc.). */
function addExperience(amount) {
  applyXp(amount);
}

function syncMissionValues() {
  if (!missions || !gridRef) return;
  missions.syncValueMissions(state.cash, companyValueFromGrid(gridRef), gridRef);
}

function initBuilding(building, opts = {}) {
  building.runtime = createRuntime(building.def, opts);
  roadGraphRef?.invalidate();
  sim?.recomputeAll();
  refreshHud();
  scheduleSave();
}

/**
 * Place HQ on unlocked land and paint a road strip that touches its footprint.
 * @returns {object|null} placed HQ building
 */
function placeHeadquarters(grid, roads, expansions, hqDef, preferredTx, preferredTy, initFn) {
  if (!hqDef) return null;
  const w = hqDef.gridW;
  const h = hqDef.gridH;
  const candidates = [];
  if (preferredTx != null && preferredTy != null) {
    candidates.push({ tx: preferredTx, ty: preferredTy });
  }
  const foot = expansions.starterTileCenter(w, h);
  candidates.push(foot);
  // Scan starter parcel for a free footprint
  const z0x = expansions.startZx * expansions.zoneW;
  const z0y = expansions.startZy * expansions.zoneH;
  for (let ty = z0y; ty <= z0y + expansions.zoneH - h; ty++) {
    for (let tx = z0x; tx <= z0x + expansions.zoneW - w; tx++) {
      candidates.push({ tx, ty });
    }
  }

  for (const { tx, ty } of candidates) {
    if (!grid.canPlace(tx, ty, w, h)) continue;
    const placed = grid.place(hqDef, tx, ty);
    if (!placed) continue;
    roads.clearFootprint(tx, ty, w, h);
    initFn?.(placed, { skipBuild: true });
    const roadY = ty + h;
    if (roadY < grid.rows) {
      for (let x = tx; x < tx + w; x++) {
        if (!expansions.isUnlocked(x, roadY)) continue;
        if (grid.buildingAt(x, roadY)) continue;
        roads.paint(x, roadY, true, () => false);
      }
    }
    return placed;
  }
  return null;
}

/**
 * Paint a continuous road between two footprints' bottom edges (same row if possible).
 */
function connectBuildingsWithRoad(roads, expansions, grid, a, b) {
  if (!a || !b) return;
  const ay = a.ty + a.def.gridH;
  const by = b.ty + b.def.gridH;
  const y = ay === by ? ay : Math.max(ay, by);
  const x0 = Math.min(a.tx, b.tx);
  const x1 = Math.max(a.tx + a.def.gridW - 1, b.tx + b.def.gridW - 1);
  for (let x = x0; x <= x1; x++) {
    if (!expansions.isUnlocked(x, y)) continue;
    if (grid.buildingAt(x, y)) continue;
    roads.paint(x, y, true, () => false);
  }
  // Vertical stubs if bottoms differ
  if (ay !== by) {
    const top = Math.min(ay, by);
    const bot = Math.max(ay, by);
    const stubX = a.tx + Math.floor(a.def.gridW / 2);
    for (let yv = top; yv <= bot; yv++) {
      if (!expansions.isUnlocked(stubX, yv)) continue;
      if (grid.buildingAt(stubX, yv)) continue;
      roads.paint(stubX, yv, true, () => false);
    }
  }
}

async function main() {
  initPlayModeFromUrl();

  let data;
  try {
    data = await loadGameData();
  } catch (err) {
    setHint("No se pudieron cargar los JSON. Ejecuta tools/serve.ps1 y abre http://localhost:8080");
    console.error(err);
    return;
  }

  const catalog = enrichCatalog(data.economy, data.buildings);
  const hqDef = catalog.hq;
  const allDefs = [
    ...catalog.houses,
    ...catalog.commerces,
    ...catalog.decorations,
    ...catalog.wonders,
    ...(hqDef ? [hqDef] : []),
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
  levelThresholds = buildLevelThresholds(
    Array.isArray(data.levels) && data.levels.length
      ? data.levels
      : data.economy.levelCurve || {}
  );

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
    costsByOffset: expCfg.costsByOffset,
  });
  grid.river = river;
  grid.expansions = expansions;
  const nature = new NatureLayer(grid.cols, grid.rows);
  grid.nature = nature;
  const dailyChests = new DailyChestLayer(grid.cols, grid.rows);
  grid.dailyChests = dailyChests;
  const roadGraph = new RoadGraph({ cols: grid.cols, rows: grid.rows, roads, grid });
  roadGraphRef = roadGraph;
  const renderer = new Renderer(canvas, grid, roads);
  rendererRef = renderer;
  renderer.river = river;
  renderer.expansions = expansions;
  renderer.nature = nature;
  renderer.dailyChests = dailyChests;
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
  await Promise.all([
    renderer.preload(
      allDefs,
      NATURE_KINDS.map((k) => k.spriteUrl)
    ),
    roads.preload(),
    zeppelin.preload(),
    fighters.preload(),
  ]);
  zeppelin.spawn();
  fighters.spawn();

  const forceNewGame = (() => {
    try {
      if (sessionStorage.getItem(NEW_GAME_FLAG) === "1") {
        sessionStorage.removeItem(NEW_GAME_FLAG);
        clearSave();
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  })();

  const saved = forceNewGame ? null : await loadInitialSave();
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
    graph: roadGraph,
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
    isRoadOk: (building) => isConnectedToHQ(building, roads, roadGraph),
    getContract: (id) => findContract(data.economy.contracts || [], id),
  });

  const contractsUi = new ContractsUI(document.getElementById("contracts-panel"), {
    contracts: data.economy.contracts || [],
    getCash: () => state.cash,
    onSign: (building, contractId) => {
      if (needsRoad(building.def) && !isConnectedToHQ(building, roads, roadGraph)) {
        setHint("Esta casa necesita carretera continua hasta el Headquarters.");
        return;
      }
      const result = sim.signContract(building, contractId, state.cash);
      if (!result.ok) {
        if (result.reason === "no_cash") {
          setHint(`Necesitas ${cashHtml(result.cost)} para firmar este contrato.`);
        } else {
          setHint("No se puede firmar el contrato ahora.");
        }
        contractsUi.refresh();
        return;
      }
      state.cash -= result.cost;
      contractsUi.hide();
      refreshHud();
      scheduleSave();
      const dur = formatDuration((building.runtime.durationMs || 0) / TIME_SCALE);
      setHint(
        `Contrato «${result.contract.name}» firmado en ${building.def.name}. Coste ${cashHtml(result.cost)}. Listo en ${dur}.`
      );
    },
  });

  function notifyTopologyChanged() {
    roadGraph.invalidate();
    sim?.recomputeAll();
  }

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
    missions?.improve(420);
    refreshHud();
    tooltip.hide();
    setHint(`«${building.def.name}» terminado. Coste: ${cashHtml(cost)}.`);
    scheduleSave();
  }

  window.__mc = {
    state,
    missions,
    grid,
    river,
    expansions,
    missionsUi,
    sim,
    tooltip,
    renderer,
    roadGraph,
  };

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
    notifyTopologyChanged();
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
  levelUpAcceptBtn?.addEventListener("click", acceptLevelUp);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" && e.code !== "Escape") return;
    e.preventDefault();
    if (levelUpOpen) acceptLevelUp();
    else if (contractsUi.open) contractsUi.hide();
    else if (!confirmPanel.hidden) hideConfirm();
    else if (!expandPanel.hidden) hideExpandBuy();
    else if (missionsUi.open) missionsUi.hide();
    else clearActiveTool();
  });

  // Load save or place starter house + HQ on the unlocked parcel
  let loadedFromSave = false;
  if (saved) {
    const result = applySnapshot(saved, {
      state,
      grid,
      roads,
      expansions,
      river,
      nature,
      dailyChests,
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
    const starter = catalog.houses[0] || null;
    let starterHouse = null;
    if (starter) {
      const foot = expansions.starterTileCenter(starter.gridW, starter.gridH);
      starterHouse = grid.place(starter, foot.tx, foot.ty);
      if (starterHouse) {
        roads.clearFootprint(foot.tx, foot.ty, starter.gridW, starter.gridH);
        initBuilding(starterHouse, { skipBuild: true });
      }
    }
    if (hqDef) {
      let hqTx = null;
      let hqTy = null;
      if (starterHouse) {
        hqTx = starterHouse.tx - hqDef.gridW - 1;
        hqTy = starterHouse.ty;
      }
      const hq = placeHeadquarters(grid, roads, expansions, hqDef, hqTx, hqTy, initBuilding);
      if (hq && starterHouse) connectBuildingsWithRoad(roads, expansions, grid, hq, starterHouse);
      else if (starterHouse) {
        for (let x = starterHouse.tx - 1; x < starterHouse.tx + starterHouse.def.gridW + 1; x++) {
          if (!expansions.isUnlocked(x, starterHouse.ty + starterHouse.def.gridH)) continue;
          roads.paint(x, starterHouse.ty + starterHouse.def.gridH, true, () => false);
        }
      }
    }
  }

  function natureBlocked(tx, ty, w, h) {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (river.has(x, y)) return true;
        if (roads.has(x, y)) return true;
        if (grid.buildingAt(x, y)) return true;
        if (dailyChests.has(x, y)) return true;
      }
    }
    return false;
  }

  function chestTileFree(tx, ty) {
    if (!expansions.isUnlocked(tx, ty)) return false;
    if (river.has(tx, ty)) return false;
    if (roads.has(tx, ty)) return false;
    if (grid.buildingAt(tx, ty)) return false;
    if (nature.has(tx, ty)) return false;
    return true;
  }

  function trySpawnDailyChest(announce = false) {
    const result = dailyChests.ensureDaily(chestTileFree);
    if (result.spawned && result.chest) {
      const tier = chestTierByLevel(result.chest.level);
      if (announce && tier) {
        setHint(`¡Ha aparecido una ${tier.name}! Tócala para abrirla.`);
      }
      scheduleSave();
    }
    return result;
  }

  function collectDailyChestAt(tx, ty) {
    const chest = dailyChests.at(tx, ty);
    if (!chest) return false;
    const got = dailyChests.collect();
    if (!got) return false;
    const { tier } = got;
    if (tier.cash) state.cash += tier.cash;
    if (tier.gold) state.gold += tier.gold;
    if (tier.diamonds) state.diamonds += tier.diamonds;
    if (tier.xp) addExperience(tier.xp);

    const tile = TILE;
    renderer.floatingRewards.spawnAt(
      (got.tx + 0.5) * tile,
      got.ty * tile - 8,
      { cash: tier.cash, xp: tier.xp }
    );

    const bits = [`$${tier.cash.toLocaleString("en-US")}`];
    if (tier.gold) bits.push(`${tier.gold} oro`);
    if (tier.diamonds) bits.push(`${tier.diamonds} diamante${tier.diamonds === 1 ? "" : "s"}`);
    bits.push(`${tier.xp} XP`);
    setHint(`Abriste ${tier.name}: ${bits.join(" · ")}`);
    refreshHud();
    scheduleSave();
    // If the player collects yesterday's leftover after midnight, try today's spawn.
    trySpawnDailyChest(true);
    return true;
  }

  // Ensure HQ exists (new game already placed it; old saves get one injected)
  if (hqDef && !roadGraph.findHQ()) {
    const house =
      grid.buildings.find((b) => b.def?.category === "house") || grid.buildings[0] || null;
    let prefTx = null;
    let prefTy = null;
    if (house) {
      prefTx = house.tx - hqDef.gridW - 1;
      prefTy = house.ty;
    }
    const hq = placeHeadquarters(grid, roads, expansions, hqDef, prefTx, prefTy, (b, opts) => {
      b.runtime = createRuntime(b.def, opts);
    });
    if (hq && house) connectBuildingsWithRoad(roads, expansions, grid, hq, house);
    notifyTopologyChanged();
    scheduleSave();
  }

  // Scatter map vegetation after buildings/roads exist
  if (nature.items.length === 0) {
    const seed = (river._seed || Date.now()) ^ 0x4e415455;
    nature.seed(60, natureBlocked, seed);
  }

  notifyTopologyChanged();

  const shopEl = document.getElementById("shop");
  const btnShop = document.getElementById("btn-shop");

  function setShopOpen(open) {
    shopEl.classList.toggle("open", open);
    btnShop.setAttribute("aria-pressed", open ? "true" : "false");
    btnShop.classList.toggle("active", open);
  }
  setShopOpen(false);

  const shop = new ShopUI(
    shopEl,
    catalog,
    (item) => {
      state.selected = item;
      clearPlacePreview();
      if (item) {
        setShopOpen(true);
        setMode("place");
        const costHint =
          item.costDiamonds > 0
            ? `Costo ${item.costDiamonds} diamantes`
            : item.costFortune > 0
            ? `Costo ${item.costFortune} lingotes`
            : `Costo $${(item.costCoins || 0).toLocaleString("en-US")}`;
        setHint(
          prefersTouchPlaceUi()
            ? `Colocando: ${item.name} (${item.gridW}×${item.gridH}). ${costHint}. Toca el mapa para elegir sitio y confirma con ✓.`
            : `Colocando: ${item.name} (${item.gridW}×${item.gridH}). ${costHint}`
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

  function closeShop() {
    shop.clearSelection();
    if (tooltip.catalogDef) tooltip.hide();
    setShopOpen(false);
    if (state.mode === "place") setMode("pan");
  }

  document.getElementById("shop-close")?.addEventListener("click", closeShop);

  let camDragging = false;
  let paintDragging = false;
  let pendingInteract = null;
  /** @type {{ building: object, ox: number, oy: number } | null} */
  let moveDrag = null;
  /** Sticky ghost for touch placement: tap to preview, confirm to build. */
  /** @type {{ tx: number, ty: number } | null} */
  let placePreview = null;
  /** @type {{ tx: number, ty: number, x: number, y: number } | null} */
  let pendingPlaceTap = null;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  let lastPaintKey = "";
  const DRAG_THRESHOLD = 6;
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_MOVE_PX = 12;

  const placeConfirmEl = document.getElementById("place-confirm");
  const placeConfirmNameEl = document.getElementById("place-confirm-name");
  const placeConfirmHintEl = document.getElementById("place-confirm-hint");
  const placeOkBtn = document.getElementById("place-ok");
  const placeCancelBtn = document.getElementById("place-cancel");

  function isTouchPlacePointer(e) {
    return e.pointerType === "touch" || e.pointerType === "pen";
  }

  /** @type {Map<number, { x: number, y: number }>} */
  const activePointers = new Map();
  /** @type {{ dist: number, zoom: number, midX: number, midY: number } | null} */
  let pinch = null;
  /** Suppress building tap after a long-press info reveal. */
  let longPressConsumed = false;
  let mapLongPressTimer = 0;
  /** Keep building tip visible after a touch long-press until next map tap. */
  let tipPinned = false;

  const controlTip = new ControlTip(document.getElementById("control-tip"));

  function tipTextOf(el) {
    return el?.getAttribute("data-tip") || el?.getAttribute("title") || "";
  }

  document.querySelectorAll("[data-tip]").forEach((el) => {
    if (el.id === "xp-hud") return;
    bindControlInfo(el, () => tipTextOf(el), controlTip, { hover: false });
  });
  if (xpHudEl) {
    // Touch: long-press opens the next-level rewards card (same as desktop hover).
    let xpTimer = 0;
    let xpArmed = false;
    xpHudEl.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      xpArmed = false;
      const sx = e.clientX;
      const sy = e.clientY;
      if (xpTimer) clearTimeout(xpTimer);
      xpTimer = window.setTimeout(() => {
        xpTimer = 0;
        xpArmed = true;
        showLevelRewardTip();
        if (navigator.vibrate) {
          try {
            navigator.vibrate(18);
          } catch {
            /* ignore */
          }
        }
      }, LONG_PRESS_MS);
      const onMove = (ev) => {
        if (!xpTimer) return;
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) >= LONG_PRESS_MOVE_PX) {
          clearTimeout(xpTimer);
          xpTimer = 0;
        }
      };
      const onEnd = () => {
        if (xpTimer) {
          clearTimeout(xpTimer);
          xpTimer = 0;
        }
        xpHudEl.removeEventListener("pointermove", onMove);
        xpHudEl.removeEventListener("pointerup", onEnd);
        xpHudEl.removeEventListener("pointercancel", onEnd);
      };
      xpHudEl.addEventListener("pointermove", onMove);
      xpHudEl.addEventListener("pointerup", onEnd);
      xpHudEl.addEventListener("pointercancel", onEnd);
    });
    xpHudEl.addEventListener(
      "click",
      (e) => {
        if (!xpArmed) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        xpArmed = false;
      },
      true
    );
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (!levelRewardTipEl || levelRewardTipEl.hidden) return;
        if (xpHudEl.contains(/** @type {Node} */ (e.target)) || levelRewardTipEl.contains(/** @type {Node} */ (e.target)))
          return;
        hideLevelRewardTip();
      },
      true
    );
  }

  function clearActiveTool() {
    moveDrag = null;
    clearPlacePreview();
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
      document.getElementById("btn-edit")?.classList.remove("active");
      document.getElementById("btn-move")?.classList.remove("active");
      document.getElementById("btn-erase")?.classList.remove("active");
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
    clearPlacePreview();
    hideConfirm();
    setShopOpen(false);
    setMode("pan");
  });

  document.getElementById("btn-road").addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    if (state.mode === "road") {
      setMode("pan");
      return;
    }
    state.roadKind = "road";
    setMode("road");
  });

  document.getElementById("btn-road-normal")?.addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    state.roadKind = "road";
    setMode("road");
  });

  document.getElementById("btn-road-zebra")?.addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    state.roadKind = "zebra";
    setMode("road");
  });

  document.getElementById("btn-road-path")?.addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    state.roadKind = "path";
    setMode("road");
  });

  document.getElementById("btn-edit")?.addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    if (state.mode === "erase" || state.mode === "move") {
      setMode("pan");
      return;
    }
    setMode(state.editKind === "move" ? "move" : "erase");
  });

  document.getElementById("btn-move")?.addEventListener("click", () => {
    shop.clearSelection();
    moveDrag = null;
    hideConfirm();
    setShopOpen(false);
    setMode(state.mode === "move" ? "pan" : "move");
  });
  document.getElementById("btn-erase")?.addEventListener("click", () => {
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
  /** Zoom while keeping a screen point fixed in world space (pinch / wheel). */
  function applyZoomAt(z, screenX, screenY) {
    const before = renderer.screenToWorld(screenX, screenY);
    applyZoom(z);
    const after = renderer.screenToWorld(screenX, screenY);
    renderer.camera.x += before.x - after.x;
    renderer.camera.y += before.y - after.y;
    renderer.clampCamera();
  }
  function pointerMidpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  function pointerDist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy) || 1;
  }
  function beginPinch() {
    if (activePointers.size < 2) return;
    const pts = [...activePointers.values()];
    const mid = pointerMidpoint(pts[0], pts[1]);
    pinch = {
      dist: pointerDist(pts[0], pts[1]),
      zoom: renderer.camera.zoom,
      midX: mid.x,
      midY: mid.y,
    };
    pendingInteract = null;
    longPressConsumed = true;
    clearMapLongPress();
    camDragging = false;
    paintDragging = false;
    canvas.classList.remove("dragging");
    tooltip.hide();
    tipPinned = false;
  }
  function updatePinch() {
    if (!pinch || activePointers.size < 2) return;
    const pts = [...activePointers.values()];
    const mid = pointerMidpoint(pts[0], pts[1]);
    const dist = pointerDist(pts[0], pts[1]);
    const nextZoom = pinch.zoom * (dist / pinch.dist);
    applyZoomAt(nextZoom, mid.x, mid.y);
    // Pan with the midpoint so the gesture feels glued to the fingers.
    const z = renderer.camera.zoom;
    renderer.camera.x -= (mid.x - pinch.midX) / z;
    renderer.camera.y -= (mid.y - pinch.midY) / z;
    renderer.clampCamera();
    pinch.midX = mid.x;
    pinch.midY = mid.y;
  }
  function clearMapLongPress() {
    if (mapLongPressTimer) {
      clearTimeout(mapLongPressTimer);
      mapLongPressTimer = 0;
    }
  }
  function scheduleMapLongPress(building) {
    clearMapLongPress();
    if (!building) return;
    const cat = building.def?.category;
    if (cat !== "house" && cat !== "commercial" && cat !== "wonder") return;
    mapLongPressTimer = window.setTimeout(() => {
      mapLongPressTimer = 0;
      const anchor = renderer.buildingAnchorScreen(building);
      tooltip.show(building, { left: anchor.x, top: anchor.y });
      tipPinned = true;
      pendingInteract = null;
      longPressConsumed = true;
      if (navigator.vibrate) {
        try {
          navigator.vibrate(18);
        } catch {
          /* ignore */
        }
      }
    }, LONG_PRESS_MS);
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
    if (state.mode === "road") syncRoadKindUi();
    if (state.mode === "erase" || state.mode === "move") syncEditFlyoutUi();
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

  function worldFromEvent(e) {
    const p = pointerPos(e);
    return renderer.screenToWorld(p.x, p.y);
  }

  /** Buyable expansion only if the pointer is on the "EN VENTA" sign. */
  function expandSignFromEvent(e) {
    const w = worldFromEvent(e);
    return expansions.hitTestSign(w.x, w.y);
  }

  function footprintOnRoad(tx, ty, def) {
    for (let y = ty; y < ty + def.gridH; y++) {
      for (let x = tx; x < tx + def.gridW; x++) {
        if (roads.has(x, y)) return true;
      }
    }
    return false;
  }

  function canAffordDef(def) {
    const diamondCost = def.costDiamonds || 0;
    const goldCost = def.costFortune || 0;
    const cashCost = def.costCoins || 0;
    if (diamondCost > 0) return state.diamonds >= diamondCost;
    if (goldCost > 0) return state.gold >= goldCost;
    return state.cash >= cashCost;
  }

  function placeSpotValid(def, tx, ty) {
    return (
      !!def &&
      grid.canPlace(tx, ty, def.gridW, def.gridH) &&
      !footprintOnRoad(tx, ty, def) &&
      canAffordDef(def)
    );
  }

  function hidePlaceConfirmUi() {
    if (!placeConfirmEl) return;
    placeConfirmEl.hidden = true;
  }

  function syncPlaceConfirmUi() {
    if (!placeConfirmEl) return;
    const def = state.selected;
    if (!placePreview || !def || state.mode !== "place") {
      hidePlaceConfirmUi();
      return;
    }
    const valid = placeSpotValid(def, placePreview.tx, placePreview.ty);
    placeConfirmNameEl.textContent = def.name;
    placeConfirmHintEl.textContent = valid
      ? "Confirma o toca otro sitio"
      : "Sitio no válido — elige otro";
    placeOkBtn.disabled = !valid;
    placeConfirmEl.hidden = false;
  }

  function applyPlaceHover(tx, ty) {
    const def = state.selected;
    if (!def) {
      renderer.hover = null;
      renderer.radiusFocus = null;
      return;
    }
    const valid = placeSpotValid(def, tx, ty);
    renderer.hover = { tx, ty, def, valid };
    renderer.highlight = null;
    renderer.expandHover = null;
    renderer.radiusFocus = hasInfluenceRadius(def) ? { tx, ty, def } : null;
    tooltip.hide();
  }

  function clearPlacePreview() {
    placePreview = null;
    pendingPlaceTap = null;
    hidePlaceConfirmUi();
  }
  onLeavePlaceMode = () => {
    placePreview = null;
    pendingPlaceTap = null;
    hidePlaceConfirmUi();
    if (rendererRef && !moveDrag) rendererRef.hover = null;
  };

  function setPlacePreview(tx, ty) {
    placePreview = { tx, ty };
    applyPlaceHover(tx, ty);
    syncPlaceConfirmUi();
    setShopOpen(false);
    const def = state.selected;
    if (def) {
      setHint(
        placeSpotValid(def, tx, ty)
          ? `«${def.name}»: confirma con ✓ o toca otro sitio para mover.`
          : `«${def.name}»: no se puede colocar aquí. Toca otro sitio.`
      );
    }
  }

  /**
   * @returns {"ok"|"blocked"|"funds"|false}
   */
  function commitPlaceAt(tx, ty) {
    const def = state.selected;
    if (!def) return false;
    const diamondCost = def.costDiamonds || 0;
    const goldCost = def.costFortune || 0;
    const cashCost = def.costCoins || 0;
    if (diamondCost > 0) {
      if (state.diamonds < diamondCost) {
        setHint("No tienes suficientes diamantes.");
        return "funds";
      }
    } else if (goldCost > 0) {
      if (state.gold < goldCost) {
        setHint("No tienes suficientes lingotes de oro.");
        return "funds";
      }
    } else if (state.cash < cashCost) {
      setHint("No tienes suficiente efectivo.");
      return "funds";
    }
    if (!grid.canPlace(tx, ty, def.gridW, def.gridH) || footprintOnRoad(tx, ty, def)) {
      setHint("No se puede colocar aquí.");
      return "blocked";
    }
    const placed = grid.place(def, tx, ty);
    if (!placed) return "blocked";
    roads.clearFootprint(tx, ty, def.gridW, def.gridH);
    initBuilding(placed);
    if (diamondCost > 0) state.diamonds -= diamondCost;
    else if (goldCost > 0) state.gold -= goldCost;
    else state.cash -= cashCost;
    missions?.onBuildingBought(def);
    addExperience(buildPlaceXp(def));
    syncMissionValues();
    refreshHud();
    const buildMs = buildDurationMs(def);
    setHint(
      buildMs > 0
        ? `Colocado: ${def.name}. Construcción: ${formatDuration(buildMs)}.`
        : `Colocado: ${def.name}`
    );
    scheduleSave();
    return "ok";
  }

  function confirmPlacePreview() {
    if (!placePreview || !state.selected) return;
    const result = commitPlaceAt(placePreview.tx, placePreview.ty);
    if (result === "ok") {
      clearPlacePreview();
      renderer.hover = null;
      renderer.radiusFocus = null;
      if (prefersTouchPlaceUi()) {
        setHint(`Toca el mapa para colocar otra «${state.selected.name}», o cierra la tienda.`);
      }
    } else {
      syncPlaceConfirmUi();
    }
  }

  placeOkBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    confirmPlacePreview();
  });
  placeCancelBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearActiveTool();
  });

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
    if (!def || def.category === "wonder") return false;
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
    return (
      !!grid.buildingAt(tx, ty) ||
      nature.has(tx, ty) ||
      dailyChests.has(tx, ty) ||
      river.has(tx, ty) ||
      !expansions.isUnlocked(tx, ty)
    );
  }

  function paintRoadAt(tx, ty) {
    if (blockedForRoad(tx, ty)) {
      setHint("No se puede poner carretera sobre un edificio.");
      return;
    }
    const kind =
      state.roadKind === "zebra" ? "zebra" : state.roadKind === "path" ? "path" : "road";
    if (roads.has(tx, ty)) {
      // Allow converting an existing road/path tile (no extra charge).
      if (roads.kindAt(tx, ty) !== kind) {
        roads.paint(tx, ty, true, blockedForRoad, kind);
        notifyTopologyChanged();
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
      notifyTopologyChanged();
      syncMissionValues();
      refreshHud();
      scheduleSave();
    }
  }

  function canInteractNature(item) {
    if (!item) return false;
    return expansions.canBuild(item.tx, item.ty, item.kind.gridW, item.kind.gridH);
  }

  function natureLabel(item) {
    return item?.kind?.name || "Árbol";
  }

  function canDropNature(item, tx, ty) {
    const k = item.kind;
    if (!expansions.canBuild(tx, ty, k.gridW, k.gridH)) return false;
    for (let y = ty; y < ty + k.gridH; y++) {
      for (let x = tx; x < tx + k.gridW; x++) {
        if (river.has(x, y)) return false;
        if (roads.has(x, y)) return false;
        if (grid.buildingAt(x, y)) return false;
        if (dailyChests.has(x, y)) return false;
        const other = nature.at(x, y);
        if (other && other.id !== item.id) return false;
      }
    }
    return true;
  }

  function eraseAt(tx, ty) {
    if (roads.has(tx, ty)) {
      roads.paint(tx, ty, false);
      const refund = Math.floor(roadCost * 0.5);
      state.cash += refund;
      notifyTopologyChanged();
      syncMissionValues();
      refreshHud();
      setHint(`Carretera borrada. Reembolso $${refund.toLocaleString("en-US")}`);
      scheduleSave();
      return true;
    }
    const hitB = grid.buildingAt(tx, ty);
    if (hitB && isHQ(hitB.def)) {
      setHint("El Headquarters no se puede destruir.");
      return false;
    }
    if (hitB) {
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
        notifyTopologyChanged();
        syncMissionValues();
        refreshHud();
        scheduleSave();
        return true;
      }
    }
    const hitN = nature.at(tx, ty);
    if (hitN) {
      if (!canInteractNature(hitN)) {
        setHint("Compra la expansión de este terreno para destruir la vegetación.");
        return false;
      }
      nature.remove(hitN);
      const xpGain = 5;
      applyXp(xpGain);
      setHint(`${natureLabel(hitN)} retirado. +${xpGain} XP`);
      scheduleSave();
      return true;
    }
    if (dailyChests.has(tx, ty)) {
      return collectDailyChestAt(tx, ty);
    }
    return false;
  }

  /** Preview info for erase confirmation (no mutation). */
  function erasePreviewAt(tx, ty) {
    if (roads.has(tx, ty)) {
      const rk = roads.kindAt(tx, ty);
      const kind =
        rk === "zebra" ? "Paso de cebra" : rk === "path" ? "Camino" : "Carretera";
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
    const hitN = nature.at(tx, ty);
    if (hitN) {
      if (!canInteractNature(hitN)) {
        return {
          name: natureLabel(hitN),
          detailHtml: "Necesitas comprar esta expansión para retirarlo.",
          locked: true,
        };
      }
      return {
        name: natureLabel(hitN),
        detailHtml: "Gratis · +5 XP al retirarlo",
      };
    }
    return null;
  }

  function askMoveBuilding(hit, tx, ty) {
    if (isHQ(hit.def)) {
      setHint("El Headquarters no se puede mover.");
      return;
    }
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

  function askMoveNature(hit, tx, ty) {
    if (!canInteractNature(hit)) {
      setHint("Compra la expansión de este terreno para mover la vegetación.");
      return;
    }
    const ox = tx - hit.tx;
    const oy = ty - hit.ty;
    openConfirm({
      title: "Mover",
      copy: `Vas a mover «${natureLabel(hit)}». Solo puedes soltarlo en terreno comprado.`,
      ask: "¿Quieres moverlo?",
      detailHtml: "Coste: gratis",
      okLabel: "Mover",
      onConfirm: () => {
        moveDrag = { nature: hit, ox, oy };
        updateMoveHover(tx, ty);
        tooltip.hide();
        setHint(`Moviendo ${natureLabel(hit)}. Clic en terreno comprado para soltar.`);
      },
    });
  }

  function askEraseAt(tx, ty) {
    const hit = grid.buildingAt(tx, ty);
    if (hit && isHQ(hit.def)) {
      setHint("El Headquarters no se puede destruir.");
      return false;
    }
    const preview = erasePreviewAt(tx, ty);
    if (!preview) return false;
    if (preview.locked) {
      setHint("Compra la expansión de este terreno para destruir la vegetación.");
      return true;
    }
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
      if (needsRoad(building.def) && !isConnectedToHQ(building, roads, roadGraph)) {
        setHint("Esta casa necesita carretera continua hasta el Headquarters.");
        return;
      }
      const result = sim.collectRent(building);
      if (!result.ok) return;
      state.cash += result.cash;
      const drops = rollPremiumDrops();
      missions.onRentCollected();
      if (result.xp) applyXp(result.xp);
      renderer.spawnCollectPopup(building, result.cash, result.xp || 0);
      syncMissionValues();
      refreshHud();
      setHint(
        `Cobrado alquiler de ${building.def.name}: +$${result.cash.toLocaleString("en-US")}${drops.suffix}`
      );
      scheduleSave();
      return;
    }

    if (action === "sign_contract") {
      if (needsRoad(building.def) && !isConnectedToHQ(building, roads, roadGraph)) {
        setHint("Esta casa necesita carretera continua hasta el Headquarters antes de firmar.");
        return;
      }
      hideConfirm();
      contractsUi.show(building);
      setHint(`Elige un contrato para «${building.def.name}».`);
      return;
    }

    if (action === "collect_commerce") {
      if (needsRoad(building.def) && !isConnectedToHQ(building, roads, roadGraph)) {
        setHint("Este comercio necesita carretera continua hasta el Headquarters.");
        return;
      }
      const result = sim.collectAllReadyCommerce((b) => {
        if (b === building) return true;
        return !needsRoad(b.def) || isConnectedToHQ(b, roads, roadGraph);
      });
      if (!result.ok) return;
      state.cash += result.cash;
      const drops = rollPremiumDrops();
      for (const entry of result.collected) {
        missions.onCommerceCollected(entry.building.def.objectId);
        renderer.spawnCollectPopup(entry.building, entry.cash, entry.xp || 0);
      }
      applyXp(result.xp || 0);
      syncMissionValues();
      refreshHud();
      const n = result.collected.length;
      setHint(
        n > 1
          ? `Cobrados ${n} comercios: +$${result.cash.toLocaleString("en-US")}${drops.suffix}`
          : `Cobrado ${building.def.name}: +$${result.cash.toLocaleString("en-US")}${drops.suffix}`
      );
      scheduleSave();
      return;
    }

    if (action === "collect_wonder") {
      if (needsRoad(building.def) && !isConnectedToHQ(building, roads, roadGraph)) {
        setHint("Esta maravilla necesita carretera continua hasta el Headquarters.");
        return;
      }
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

    if (building.def.category === "house" && usesLootEconomy(building.def)) {
      const rt = building.runtime || {};
      const pending = Math.floor(rt.pendingLoot || 0);
      const cap = effectiveMaxLoot(building, grid.buildings);
      const perMin = Math.round(getBuildingFinalProduction(building, grid.buildings) * 10) / 10;
      setHint(
        `${building.def.name}: $${pending.toLocaleString("en-US")} / $${cap.toLocaleString("en-US")} · $${perMin}/min`
      );
    } else if (building.def.category === "commercial" && usesLootEconomy(building.def)) {
      const rt = building.runtime || {};
      const pending = Math.floor(rt.pendingLoot || 0);
      const cap = effectiveMaxLoot(building, grid.buildings);
      const perMin = Math.round(getBuildingFinalProduction(building, grid.buildings) * 10) / 10;
      setHint(
        `${building.def.name}: $${pending.toLocaleString("en-US")} / $${cap.toLocaleString("en-US")} · $${perMin}/min`
      );
    } else if (building.def.category === "house" && building.runtime?.status === "waiting") {
      const rt = building.runtime;
      const contract = findContract(data.economy.contracts || [], rt.contractId);
      const label = contract?.name || "Contrato";
      setHint(
        `${building.def.name}: ${label} · cobra en ${formatDuration(rt.remainingMs / TIME_SCALE)}.`
      );
    } else if (building.def.category === "house" && building.runtime?.status === "idle") {
      setHint(`${building.def.name}: sin contrato. Toca para firmar alquiler.`);
    } else if (building.def.category === "commercial" && building.runtime?.status === "waiting") {
      const rt = building.runtime;
      const customers = rt.customers ?? 0;
      const projected = commerceCycleReward(building.def, customers, rt.influence || 0);
      const rate = commerceRentPerCustomer(building.def);
      setHint(
        `${building.def.name}: ${customers} clientes · $${rate}/c · +$${projected.toLocaleString("en-US")} en ${formatDuration(rt.remainingMs / TIME_SCALE)}.`
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
    if (moveDrag.nature) {
      const { nature: item, ox, oy } = moveDrag;
      const dropTx = tx - ox;
      const dropTy = ty - oy;
      const valid = canDropNature(item, dropTx, dropTy);
      renderer.highlight = null;
      renderer.hover = {
        tx: dropTx,
        ty: dropTy,
        def: item.kind,
        valid,
        hideId: item.id,
      };
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
    activePointers.set(e.pointerId, p);

    if (activePointers.size >= 2) {
      beginPinch();
      return;
    }

    if (tipPinned) {
      tooltip.hide();
      tipPinned = false;
    }
    controlTip.hide();

    downX = p.x;
    downY = p.y;
    pendingInteract = null;
    longPressConsumed = false;
    clearMapLongPress();

    if (e.button === 1 || e.shiftKey) {
      startCamDrag(p);
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const { tx, ty } = tileFromEvent(e);
    lastPaintKey = `${tx},${ty}`;

    if (state.mode === "pan") {
      // Pointer tool: select / interact, or pan if empty / drag
      // Expansions: only the "EN VENTA" sign opens buy (not the whole parcel).
      const sign = expandSignFromEvent(e);
      if (sign) {
        openExpandBuy(sign.zx, sign.zy);
        return;
      }
      if (collectDailyChestAt(tx, ty)) return;
      const hit = grid.buildingAt(tx, ty);
      if (hit) {
        pendingInteract = hit;
        lastX = p.x;
        lastY = p.y;
        scheduleMapLongPress(hit);
      } else {
        startCamDrag(p);
      }
      return;
    }

    // Drop while moving a building or nature item
    if (state.mode === "move" && moveDrag) {
      if (moveDrag.nature) {
        const { nature: item, ox, oy } = moveDrag;
        const dropTx = tx - ox;
        const dropTy = ty - oy;
        const sameSpot = item.tx === dropTx && item.ty === dropTy;
        if (canDropNature(item, dropTx, dropTy)) {
          if (nature.move(item, dropTx, dropTy)) {
            setHint(
              sameSpot
                ? `Sin cambio: ${natureLabel(item)}`
                : `Movido: ${natureLabel(item)}`
            );
            scheduleSave();
          }
          moveDrag = null;
          renderer.hover = null;
        } else {
          updateMoveHover(tx, ty);
          setHint("Solo puedes soltar vegetación en terreno comprado y libre. Esc cancela.");
        }
        return;
      }
      const { building, ox, oy } = moveDrag;
      const dropTx = tx - ox;
      const dropTy = ty - oy;
      const sameSpot = building.tx === dropTx && building.ty === dropTy;
      const cost = sameSpot ? 0 : moveCostOf(building.def);
      if (canDropBuilding(building, dropTx, dropTy)) {
        if (grid.move(building, dropTx, dropTy)) {
          roads.clearFootprint(dropTx, dropTy, building.def.gridW, building.def.gridH);
          if (cost > 0) {
            state.cash -= cost;
            refreshHud();
          }
          notifyTopologyChanged();
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
      if (hit) {
        askMoveBuilding(hit, tx, ty);
        return;
      }
      const hitN = nature.at(tx, ty);
      if (hitN) {
        askMoveNature(hitN, tx, ty);
        return;
      }
      clearActiveTool();
      startCamDrag(p);
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
      if (isTouchPlacePointer(e)) {
        // Two-step on touch: set/move preview on tap-up (unless this becomes a pan).
        pendingPlaceTap = { tx, ty, x: p.x, y: p.y };
        lastX = p.x;
        lastY = p.y;
        return;
      }
      const result = commitPlaceAt(tx, ty);
      if (result === "blocked") {
        clearActiveTool();
        startCamDrag(p);
      }
      return;
    }

    // Idle: buy via for-sale sign, open daily chest, tap building, or pan
    const sign = expandSignFromEvent(e);
    if (sign) {
      openExpandBuy(sign.zx, sign.zy);
      return;
    }
    if (collectDailyChestAt(tx, ty)) return;

    const hit = grid.buildingAt(tx, ty);
    if (hit) {
      pendingInteract = hit;
      lastX = p.x;
      lastY = p.y;
      scheduleMapLongPress(hit);
    } else {
      startCamDrag(p);
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const p = pointerPos(e);
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, p);
    }

    if (pinch && activePointers.size >= 2) {
      updatePinch();
      return;
    }

    // Convert a pending building tap into a pan if the pointer moves enough
    if (pendingInteract && !camDragging) {
      const dx = p.x - downX;
      const dy = p.y - downY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        pendingInteract = null;
        clearMapLongPress();
        startCamDrag({ x: downX, y: downY });
        lastX = p.x;
        lastY = p.y;
      } else if (
        mapLongPressTimer &&
        dx * dx + dy * dy >= LONG_PRESS_MOVE_PX * LONG_PRESS_MOVE_PX
      ) {
        clearMapLongPress();
      }
    }

    // Touch place: drag cancels the pending tap and pans instead.
    if (pendingPlaceTap && !camDragging) {
      const dx = p.x - downX;
      const dy = p.y - downY;
      if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
        pendingPlaceTap = null;
        startCamDrag({ x: downX, y: downY });
        lastX = p.x;
        lastY = p.y;
      }
    }

    if (camDragging) {
      const z = renderer.camera.zoom;
      renderer.camera.x -= (p.x - lastX) / z;
      renderer.camera.y -= (p.y - lastY) / z;
      renderer.clampCamera();
      lastX = p.x;
      lastY = p.y;
      renderer.radiusFocus = null;
      renderer.highlight = null;
      if (!tipPinned) tooltip.hide();
      // Keep sticky place ghost while panning on touch.
      if (placePreview && state.mode === "place" && state.selected) {
        applyPlaceHover(placePreview.tx, placePreview.ty);
      }
      return;
    }

    // Touch/pen: skip hover tooltips while finger is down (avoids flicker); desktop mouse keeps hover.
    if (e.pointerType !== "mouse") {
      if (paintDragging && state.mode === "road") {
        const { tx, ty } = tileFromEvent(e);
        const key = `${tx},${ty}`;
        if (key !== lastPaintKey) {
          lastPaintKey = key;
          paintRoadAt(tx, ty);
        }
      }
      if (moveDrag) {
        const { tx, ty } = tileFromEvent(e);
        updateMoveHover(tx, ty);
      }
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
      const w = worldFromEvent(e);
      renderer.expandHover = expansions.hitTestSign(w.x, w.y);
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
        setHint(`Toca el cartel EN VENTA para comprar ($${(cost || 0).toLocaleString("en-US")}).`);
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
      const hitN = !hit ? nature.at(tx, ty) : null;
      renderer.hover = null;
      if (hit) {
        renderer.highlight = {
          tx: hit.tx,
          ty: hit.ty,
          gridW: hit.def.gridW,
          gridH: hit.def.gridH,
          kind: "move",
        };
        renderer.radiusFocus = hasInfluenceRadius(hit.def)
          ? { tx: hit.tx, ty: hit.ty, def: hit.def }
          : null;
      } else if (hitN) {
        renderer.highlight = {
          tx: hitN.tx,
          ty: hitN.ty,
          gridW: hitN.kind.gridW,
          gridH: hitN.kind.gridH,
          kind: "move",
        };
        renderer.radiusFocus = null;
      } else {
        renderer.highlight = null;
        renderer.radiusFocus = null;
      }
      renderer.expandHover = null;
      tooltip.hide();
    } else if (state.mode === "erase") {
      const hit = grid.buildingAt(tx, ty);
      const hitN = !hit && !roads.has(tx, ty) ? nature.at(tx, ty) : null;
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
      } else if (hitN) {
        renderer.highlight = {
          tx: hitN.tx,
          ty: hitN.ty,
          gridW: hitN.kind.gridW,
          gridH: hitN.kind.gridH,
          kind: "erase",
        };
      } else {
        renderer.highlight = null;
      }
      renderer.expandHover = null;
      renderer.radiusFocus = null;
      tooltip.hide();
    } else if (state.mode === "place" && state.selected) {
      if (placePreview) {
        applyPlaceHover(placePreview.tx, placePreview.ty);
        syncPlaceConfirmUi();
      } else {
        const def = state.selected;
        renderer.hover = {
          tx,
          ty,
          def,
          valid: placeSpotValid(def, tx, ty),
        };
        renderer.highlight = null;
        renderer.expandHover = null;
        renderer.radiusFocus = hasInfluenceRadius(def) ? { tx, ty, def } : null;
        tooltip.hide();
      }
    } else {
      renderer.hover = null;
      renderer.highlight = null;
      renderer.expandHover = null;
      renderer.radiusFocus = null;
      tooltip.hide();
    }
  });

  function endPointer(e) {
    activePointers.delete(e.pointerId);
    clearMapLongPress();

    if (pinch) {
      if (activePointers.size < 2) {
        pinch = null;
        // Continue panning with the remaining finger if any.
        if (activePointers.size === 1) {
          const rem = [...activePointers.values()][0];
          startCamDrag(rem);
          lastX = rem.x;
          lastY = rem.y;
        }
      }
      pendingInteract = null;
      pendingPlaceTap = null;
      paintDragging = false;
      if (activePointers.size === 0) {
        camDragging = false;
        canvas.classList.remove("dragging");
      }
      return;
    }

    if (pendingPlaceTap && !camDragging && state.mode === "place" && state.selected) {
      const { tx, ty } = pendingPlaceTap;
      const sameSpot =
        placePreview && placePreview.tx === tx && placePreview.ty === ty;
      if (sameSpot && placeSpotValid(state.selected, tx, ty)) {
        confirmPlacePreview();
      } else {
        setPlacePreview(tx, ty);
      }
    }
    pendingPlaceTap = null;

    if (pendingInteract && !camDragging && !longPressConsumed) {
      interactBuilding(pendingInteract);
    }
    pendingInteract = null;
    longPressConsumed = false;
    camDragging = false;
    paintDragging = false;
    canvas.classList.remove("dragging");
  }

  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("pointerleave", () => {
    if (!moveDrag && !placePreview) {
      renderer.hover = null;
      renderer.highlight = null;
    }
    renderer.expandHover = null;
    if (!placePreview) renderer.radiusFocus = null;
    if (tipPinned) return;
    if (!tooltip.pointerInside) {
      tooltip.scheduleHide(tooltip.root.classList.contains("interactive") ? 280 : 120);
    }
  });

  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const p = pointerPos(e);
      applyZoomAt(Number(zoomInput.value) - Math.sign(e.deltaY) * 0.1, p.x, p.y);
    },
    { passive: false }
  );

  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  notifyTopologyChanged();
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
        nature,
        dailyChests,
        missions,
        renderer,
        riverOpts: riverOptsRef || undefined,
      }),
    { delayMs: 450 }
  );

  // Persist immediately after first load/new game, then periodically.
  trySpawnDailyChest(true);
  scheduleSave();
  setInterval(() => {
    trySpawnDailyChest(false);
    autosave?.flush();
  }, 60_000);

  window.addEventListener("beforeunload", () => {
    autosave?.flush();
    if (!isGuestMode()) flushCloudSave();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      autosave?.flush();
      if (!isGuestMode()) flushCloudSave();
    }
  });

  document.getElementById("btn-new-game")?.addEventListener("click", () => {
    openConfirm({
      title: "Nueva partida",
      copy: isGuestMode()
        ? "Se borrará el progreso de invitado en este navegador."
        : "Se borrará el progreso guardado en este navegador y en la nube (si hay sesión).",
      ask: "¿Empezar de cero?",
      detailHtml: "Esta acción no se puede deshacer.",
      okLabel: "Nueva partida",
      danger: true,
      onConfirm: () => {
        void startNewGame();
      },
    });
  });

  // Avoid restoring a stale in-memory city from the browser back-forward cache.
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) location.reload();
  });

  let lastTs = performance.now();
  function loop(ts) {
    const dt = ts - lastTs;
    lastTs = ts;
    const simDirty = sim.update(dt);
    if (simDirty) refreshHud();
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
