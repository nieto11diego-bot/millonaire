/**
 * Persist game state to localStorage (+ optional cloud via Next/Supabase).
 * Guest mode uses a separate local key and never touches the cloud.
 * Snapshot is versioned; buildings store objectId + runtime (not full defs).
 */

import { TIME_SCALE, STATUS, createRuntime } from "./economy.js";
import {
  fetchCloudSave,
  queueCloudSave,
  flushCloudSave,
  clearCloudSave,
} from "./cloudSave.js";

export const SAVE_KEY = "mc_save_v1";
export const SAVE_KEY_GUEST = "mc_save_guest_v1";
export const SAVE_VERSION = 1;
export const NEW_GAME_FLAG = "mc_force_new_v1";
export const GUEST_FLAG = "mc_guest_mode_v1";

/** When false, writeSave / autosave flush become no-ops (used during new-game reset). */
let persistEnabled = true;
/** Guest: local-only, separate slot from the account save. */
let guestMode = false;

export function setPersistEnabled(enabled) {
  persistEnabled = !!enabled;
}

export function isPersistEnabled() {
  return persistEnabled;
}

export function isGuestMode() {
  return guestMode;
}

function activeSaveKey() {
  return guestMode ? SAVE_KEY_GUEST : SAVE_KEY;
}

/**
 * Call once at boot (before loadInitialSave).
 * - ?mode=guest → guest slot, no cloud
 * - ?new=… → keep current mode (nueva partida reload)
 * - otherwise → account slot (clears guest flag)
 */
export function initPlayModeFromUrl() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get("mode") === "guest") {
      guestMode = true;
      sessionStorage.setItem(GUEST_FLAG, "1");
      url.searchParams.delete("mode");
      history.replaceState(null, "", url.pathname + url.search + url.hash);
      return;
    }
    if (url.searchParams.has("new")) {
      guestMode = sessionStorage.getItem(GUEST_FLAG) === "1";
      return;
    }
    guestMode = false;
    sessionStorage.removeItem(GUEST_FLAG);
  } catch {
    guestMode = false;
  }
}

/**
 * @param {object} snapshot
 * @returns {boolean}
 */
export function writeSave(snapshot) {
  if (!persistEnabled) return false;
  if (!snapshot) return false;
  try {
    localStorage.setItem(activeSaveKey(), JSON.stringify(snapshot));
    if (!guestMode) queueCloudSave(snapshot);
    return true;
  } catch (err) {
    console.warn("[save] write failed", err);
    return false;
  }
}

/**
 * @returns {object|null}
 */
export function readSave() {
  try {
    const raw = localStorage.getItem(activeSaveKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch (err) {
    console.warn("[save] read failed", err);
    return null;
  }
}

/**
 * Pick the newest of local vs cloud. Migrates local → cloud when cloud is empty.
 * Guest: local guest slot only.
 * @returns {Promise<object|null>}
 */
export async function loadInitialSave() {
  const local = readSave();
  if (guestMode) return local;

  let cloud = null;
  try {
    cloud = await fetchCloudSave();
  } catch (err) {
    console.warn("[save] cloud read failed", err);
  }

  if (cloud && cloud.version !== SAVE_VERSION) cloud = null;

  const localAt = local?.savedAt != null ? Number(local.savedAt) : 0;
  const cloudAt = cloud?.savedAt != null ? Number(cloud.savedAt) : 0;

  if (cloud && (!local || cloudAt >= localAt)) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(cloud));
    } catch {
      /* ignore */
    }
    return cloud;
  }

  if (local && !cloud) {
    queueCloudSave(local);
  }

  return local;
}

export function clearSave() {
  try {
    localStorage.removeItem(activeSaveKey());
  } catch {
    /* ignore */
  }
}

/** Wipe active local slot; cloud only when not guest. */
export async function clearAllSaves() {
  clearSave();
  if (!guestMode) await clearCloudSave();
}

export { flushCloudSave, clearCloudSave };

export function hasSave() {
  return !!readSave();
}

/**
 * Strip runtime to a JSON-safe shape; convert waiting timers to absolute readyAt.
 * @param {object|null|undefined} rt
 */
export function serializeRuntime(rt) {
  if (!rt || typeof rt !== "object") return null;
  const out = { ...rt };
  if (out.status === STATUS.WAITING && out.remainingMs != null) {
    const wallLeft = Math.max(0, Number(out.remainingMs) || 0) / Math.max(0.0001, TIME_SCALE);
    out.readyAt = Date.now() + wallLeft;
  }
  if (out.status === STATUS.BUILDING && out.buildEndsAt != null) {
    out.buildEndsAt = Number(out.buildEndsAt) || 0;
  }
  return out;
}

/**
 * Restore timers after offline time.
 * @param {object|null|undefined} rt
 */
export function hydrateRuntime(rt) {
  if (!rt || typeof rt !== "object") return null;
  const out = { ...rt };
  if (out.readyAt != null) {
    const wallLeft = Math.max(0, Number(out.readyAt) - Date.now());
    out.remainingMs = wallLeft * TIME_SCALE;
    delete out.readyAt;
    if (out.status === STATUS.WAITING && out.remainingMs <= 0) {
      out.remainingMs = 0;
      out.status = STATUS.READY;
    }
  }
  if (out.status === STATUS.BUILDING && out.buildEndsAt != null) {
    out.buildEndsAt = Number(out.buildEndsAt) || 0;
    if (out.buildEndsAt <= Date.now()) {
      // Leave BUILDING; sim will finish on next tick / recompute
    }
  }
  return out;
}

/**
 * @param {{
 *   state: object,
 *   grid: import("./map/grid.js").Grid,
 *   roads: import("./map/roads.js").RoadLayer,
 *   expansions: import("./map/expansions.js").ExpansionLayer,
 *   river: import("./map/river.js").RiverLayer,
 *   nature?: import("./map/nature.js").NatureLayer,
 *   missions: import("./missions.js").MissionTracker,
 *   renderer?: import("./map/renderer.js").Renderer,
 *   riverOpts?: { marginRight?: number, bridgeEvery?: number },
 * }} ctx
 */
export function buildSnapshot(ctx) {
  const { state, grid, roads, expansions, river, nature, missions, renderer, riverOpts } = ctx;
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    player: {
      cash: state.cash,
      gold: state.gold,
      diamonds: state.diamonds,
      level: state.level,
      xp: state.xp,
    },
    buildings: grid.buildings.map((b) => ({
      id: b.id,
      objectId: b.def?.objectId,
      constant: b.def?.constant ?? null,
      tx: b.tx,
      ty: b.ty,
      runtime: serializeRuntime(b.runtime),
    })),
    roads: serializeRoads(roads),
    nature: nature ? nature.serialize() : [],
    expansions: {
      owned: [...expansions.owned],
      boughtCount: expansions.boughtCount,
      startZx: expansions.startZx,
      startZy: expansions.startZy,
    },
    river: {
      seed: river._seed,
      marginRight: riverOpts?.marginRight ?? 5,
      bridgeEvery: riverOpts?.bridgeEvery ?? 12,
    },
    missions: {
      counted: { ...missions.counted },
      completed: { ...missions.completed },
      collected: { ...missions.collected },
      uniqueWonders: [...(missions.uniqueWonders || [])],
    },
    camera: renderer
      ? { x: renderer.camera.x, y: renderer.camera.y, zoom: renderer.camera.zoom }
      : null,
  };
}

/**
 * @param {import("./map/roads.js").RoadLayer} roads
 */
function serializeRoads(roads) {
  const list = [];
  for (let ty = 0; ty < roads.rows; ty++) {
    for (let tx = 0; tx < roads.cols; tx++) {
      if (!roads.has(tx, ty)) continue;
      list.push({ tx, ty, kind: roads.kindAt(tx, ty) || "road" });
    }
  }
  return list;
}

/**
 * @param {object} snapshot
 * @param {{
 *   state: object,
 *   grid: import("./map/grid.js").Grid,
 *   roads: import("./map/roads.js").RoadLayer,
 *   expansions: import("./map/expansions.js").ExpansionLayer,
 *   river: import("./map/river.js").RiverLayer,
 *   nature?: import("./map/nature.js").NatureLayer,
 *   missions: import("./missions.js").MissionTracker,
 *   renderer?: import("./map/renderer.js").Renderer,
 *   defsByObjectId: Map<number, object>,
 *   defsByConstant: Map<string, object>,
 *   sim?: import("./sim.js").EconomySim,
 * }} ctx
 * @returns {{ ok: boolean, reason?: string, restored: number }}
 */
export function applySnapshot(snapshot, ctx) {
  if (!snapshot || snapshot.version !== SAVE_VERSION) {
    return { ok: false, reason: "bad_version", restored: 0 };
  }

  const {
    state,
    grid,
    roads,
    expansions,
    river,
    nature,
    missions,
    renderer,
    defsByObjectId,
    defsByConstant,
    sim,
  } = ctx;

  const p = snapshot.player || {};
  if (p.cash != null) state.cash = Number(p.cash) || 0;
  if (p.gold != null) state.gold = Number(p.gold) || 0;
  if (p.diamonds != null) state.diamonds = Number(p.diamonds) || 0;
  if (p.level != null) state.level = Math.max(1, Number(p.level) || 1);
  if (p.xp != null) state.xp = Math.max(0, Number(p.xp) || 0);

  const ex = snapshot.expansions || {};
  expansions.owned = new Set(ex.owned || []);
  if (expansions.owned.size === 0) {
    expansions.owned.add(expansions.key(expansions.startZx, expansions.startZy));
  }
  expansions.boughtCount = Math.max(0, Number(ex.boughtCount) || 0);

  const rv = snapshot.river || {};
  if (rv.seed != null) {
    river.generate({
      seed: rv.seed,
      marginRight: rv.marginRight ?? 5,
      bridgeEvery: rv.bridgeEvery ?? 12,
    });
  }

  roads.cells.fill(false);
  roads.kinds.fill(null);
  for (const tile of snapshot.roads || []) {
    if (!tile) continue;
    roads.set(tile.tx, tile.ty, true, tile.kind === "zebra" ? "zebra" : "road");
  }

  grid.clear();
  let restored = 0;
  let maxId = 0;
  for (const row of snapshot.buildings || []) {
    if (!row) continue;
    const def =
      (row.objectId != null && defsByObjectId.get(row.objectId)) ||
      (row.constant && defsByConstant.get(row.constant)) ||
      null;
    if (!def) continue;
    const placed = grid.placeSaved(def, row.tx, row.ty, {
      id: row.id,
      runtime: hydrateRuntime(row.runtime) || createRuntime(def, { skipBuild: true }),
    });
    if (!placed) continue;
    // Hard exclusion: never keep roads under a building footprint
    roads.clearFootprint(placed.tx, placed.ty, placed.def.gridW, placed.def.gridH);
    restored += 1;
    const m = /^b(\d+)$/.exec(placed.id || "");
    if (m) maxId = Math.max(maxId, Number(m[1]) || 0);
  }
  if (maxId >= grid._nextId) grid._nextId = maxId + 1;

  if (nature) {
    const isBlocked = (tx, ty, w, h) => {
      for (let y = ty; y < ty + h; y++) {
        for (let x = tx; x < tx + w; x++) {
          if (river?.has(x, y)) return true;
          if (roads?.has(x, y)) return true;
          if (grid.buildingAt(x, y)) return true;
        }
      }
      return false;
    };
    if (Array.isArray(snapshot.nature) && snapshot.nature.length) {
      nature.load(snapshot.nature, isBlocked);
    } else {
      nature.clear();
    }
  }

  const ms = snapshot.missions || {};
  for (const sku of Object.keys(missions.counted)) {
    missions.counted[sku] = 0;
    missions.completed[sku] = false;
    missions.collected[sku] = false;
  }
  if (ms.counted) {
    for (const [sku, val] of Object.entries(ms.counted)) {
      if (sku in missions.counted) missions.counted[sku] = Number(val) || 0;
    }
  }
  if (ms.completed) {
    for (const [sku, val] of Object.entries(ms.completed)) {
      if (sku in missions.completed) missions.completed[sku] = !!val;
    }
  }
  if (ms.collected) {
    for (const [sku, val] of Object.entries(ms.collected)) {
      if (sku in missions.collected) missions.collected[sku] = !!val;
    }
  }
  if (Array.isArray(ms.uniqueWonders)) missions.uniqueWonders = [...ms.uniqueWonders];
  missions._emit?.();

  if (renderer && snapshot.camera) {
    if (snapshot.camera.x != null) renderer.camera.x = Number(snapshot.camera.x) || 0;
    if (snapshot.camera.y != null) renderer.camera.y = Number(snapshot.camera.y) || 0;
    if (snapshot.camera.zoom != null) {
      renderer.camera.zoom = Math.max(0.2, Math.min(2, Number(snapshot.camera.zoom) || 1));
    }
  }

  sim?.recomputeAll();
  return { ok: true, restored };
}

/**
 * Debounced autosave helper.
 * @param {() => object} buildFn
 * @param {{ delayMs?: number }} [opts]
 */
export function createAutosave(buildFn, opts = {}) {
  const delayMs = opts.delayMs ?? 400;
  let timer = 0;
  let lastOk = false;

  function flush() {
    timer = 0;
    if (!persistEnabled) return false;
    lastOk = writeSave(buildFn());
    if (!guestMode) flushCloudSave();
    return lastOk;
  }

  function schedule() {
    if (!persistEnabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  }

  function cancel() {
    if (timer) clearTimeout(timer);
    timer = 0;
  }

  return { schedule, flush, cancel, get lastOk() { return lastOk; } };
}
