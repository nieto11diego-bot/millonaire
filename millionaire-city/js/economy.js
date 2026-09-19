/**
 * Economy formulas for Millionaire City.
 */

export const STATUS = {
  IDLE: "idle", // decorations
  WAITING: "waiting", // house/commerce timer running
  READY: "ready", // collect available
  BUILDING: "building", // under construction
};

/** Real-time pace (1 = wall clock). */
export const TIME_SCALE = 1;

/**
 * Level XP curve: XP(nivel) = base × factor^nivel
 * That amount is required to advance from `nivel` → `nivel+1`.
 * Cumulative thresholds[k] = XP needed to reach level k+1.
 */
export const LEVEL_XP = {
  base: 100,
  factor: 1.2,
  maxLevel: 100,
};

/**
 * XP needed to advance from `level` to `level+1`.
 * XP(nivel) = base × factor^nivel
 */
export function xpForLevel(level, curve = LEVEL_XP) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const base = Number(curve?.base ?? curve?.baseExperience ?? LEVEL_XP.base);
  const factor = Number(curve?.factor ?? LEVEL_XP.factor);
  return Math.max(1, Math.round(base * Math.pow(factor, lv)));
}

/**
 * Cumulative XP thresholds: index 0 = level 1 (0 XP),
 * index n = total XP required to reach level n+1.
 * Caps at Number.MAX_SAFE_INTEGER so factor=2 stays usable at high levels.
 */
/**
 * Build cumulative XP thresholds from levels.json entries or a curve object.
 * levels.json: [{ level, xpRequired }, ...] where xpRequired is cumulative.
 */
export function buildLevelThresholds(curveOrLevels = LEVEL_XP) {
  if (Array.isArray(curveOrLevels)) {
    const sorted = [...curveOrLevels].sort((a, b) => (a.level || 0) - (b.level || 0));
    if (!sorted.length) return buildLevelThresholds(LEVEL_XP);
    const maxLevel = Math.max(
      2,
      sorted[sorted.length - 1].level || sorted.length,
      LEVEL_XP.maxLevel
    );
    const thresholds = new Array(maxLevel).fill(0);
    for (const row of sorted) {
      const lv = Math.max(1, Math.floor(Number(row.level) || 1));
      thresholds[lv - 1] = Math.max(0, Number(row.xpRequired) || 0);
    }
    // Fill gaps by carrying forward
    for (let i = 1; i < thresholds.length; i++) {
      if (thresholds[i] < thresholds[i - 1]) thresholds[i] = thresholds[i - 1];
    }
    return thresholds;
  }
  const curve = curveOrLevels || LEVEL_XP;
  const maxLevel = Math.max(2, Math.floor(Number(curve?.maxLevel) || LEVEL_XP.maxLevel));
  const cap = Number.MAX_SAFE_INTEGER;
  const thresholds = [0];
  let cumulative = 0;
  for (let level = 1; level < maxLevel; level++) {
    cumulative = Math.min(cap, cumulative + xpForLevel(level, curve));
    thresholds.push(cumulative);
  }
  return thresholds;
}

/**
 * Construction duration:
 *   houses / commerces → half of their collect cycle
 *   wonders → log curve by purchase cost (10s … ~2 days)
 */
export const BUILD_TIME = {
  minSec: 10,
  maxSec: 50 * 3600,
  /** Matches house curve: cheapest house → Petronas 30♦ ($15M). */
  minCost: 50_000,
  maxCost: 15_000_000,
};

/**
 * Currency exchange (canonical):
 *   1 diamante  = 10 lingotes
 *   10 lingotes = 500_000 dólares
 * → 1 lingote   = 50_000 dólares
 * → 1 diamante  = 500_000 dólares
 */
export const CURRENCY_EXCHANGE = {
  goldPerDiamond: 10,
  cashPerTenGold: 500_000,
  get cashPerGold() {
    return this.cashPerTenGold / this.goldPerDiamond;
  },
  get cashPerDiamond() {
    return this.cashPerGold * this.goldPerDiamond;
  },
};

/** Cash-equivalent rates used for build-time / instant-finish scaling. */
export const BUILD_COST_EQUIV = {
  goldToCash: CURRENCY_EXCHANGE.cashPerGold, // 50_000
  diamondToCash: CURRENCY_EXCHANGE.cashPerDiamond, // 500_000
};

/** Fraction of cash-equivalent charged to finish at the start of construction. */
export const INSTANT_BUILD_COST_FACTOR = 0.12;

/** Instant-build price drops one step every 5 wall-clock minutes. */
export const INSTANT_BUILD_STEP_MS = 5 * 60 * 1000;

/** Wonder premium production (wall-clock intervals, divided by TIME_SCALE). */
export const WONDER_PRODUCTION = {
  goldIntervalSec: 7 * 24 * 3600,
  goldReward: 0,
  diamondIntervalSec: 7 * 24 * 3600,
  diamondReward: 0,
};

export const HOUSE_REWARD_TIME = {
  minSec: 25,
  maxSec: 3 * 3600,
  minLevel: 1,
  maxLevel: 32,
};

/** @deprecated population cap removed from house economy */
export const HOUSE_POP = { basePeople: 0, peoplePerLevel: 0, areaBonusPer4Tiles: 0 };

/** Full occupancy from empty takes this many reward cycles. */
export const HOUSE_GROWTH = { fillCycles: 3 };

/**
 * House cash payout rate:
 *   10 seconds → $200 at level 1
 *   each further level adds the repeating succession +5, +10, +5, +5, +15
 *   → rates 200, 205, 215, 220, 225, 240, 245, …
 */
export const HOUSE_REWARD_RATE = {
  chunkSec: 10,
  base: 200,
  levelSteps: [5, 10, 5, 5, 15],
};

/** @deprecated kept for older references; house payout uses HOUSE_REWARD_RATE */
export const HOUSE_YIELD = { perCyclePercent: 6 };

/** Max residents from catalog `maxPeople` (0 if unset). */
export function houseMaxPeople(def) {
  if (def?.maxPeople == null) return 0;
  return Math.max(0, Math.round(Number(def.maxPeople) || 0));
}

/**
 * City population: sum of `people` on finished houses with an active contract.
 * Houses under construction or without a signed contract do not count.
 */
export function cityPopulation(buildings) {
  if (!buildings?.length) return 0;
  let total = 0;
  for (const b of buildings) {
    if (b.def?.category !== "house") continue;
    if (b.runtime?.status === STATUS.BUILDING) continue;
    if (b.runtime?.contractId == null) continue;
    total += Math.max(0, Math.round(Number(b.runtime.people) || 0));
  }
  return total;
}

export function contractDurationMs(contract) {
  const sec = Number(contract?.durationSec) || 0;
  return Math.max(1000, sec * 1000);
}

/** Flat sign cost from catalog (same for every house). */
export function contractCost(contract, _houseDef) {
  return Math.max(0, Math.round(Number(contract?.costBase) || 0));
}

/** House-specific % on contract collect payout (can be negative, e.g. -30 → −30%). */
export function houseContractBonusPercent(def) {
  if (def?.contractBonusPercent == null) return 0;
  return Number(def.contractBonusPercent) || 0;
}

/**
 * Collect payout: incomeBase × (1 + house %) × (1 + decoration/wonder influence).
 * influenceScaled: 100 ≈ +1% (same units as houseIncome).
 */
export function contractIncome(contract, houseDef, influenceScaled = 0) {
  const base = Math.max(0, Number(contract?.incomeBase) || 0);
  const pct = houseContractBonusPercent(houseDef);
  const afterHouse = base * (1 + pct / 100);
  return Math.max(
    0,
    Math.round((afterHouse * ((influenceScaled || 0) + 10000)) / 10000)
  );
}

/** Extra scale on XP when collecting a finished house contract (1 = full). */
export const CONTRACT_COLLECT_XP_SCALE = 0.4;

export function contractCollectXp(contract, cash) {
  const tier = Math.max(0, Number(contract?.id) || 0);
  const fromCash = Math.max(1, Math.round((cash / 50) * XP_REWARD_SCALE));
  return Math.max(1, Math.round((fromCash + tier) * CONTRACT_COLLECT_XP_SCALE));
}

export function findContract(contracts, contractId) {
  if (!contracts || contractId == null) return null;
  return contracts.find((c) => c.id === contractId) || null;
}

/** Unique rent/reward duration for this house, scaled by level. */
export function houseRewardDurationMs(def) {
  if (def?.rewardSec != null) return Math.max(1, def.rewardSec) * 1000;
  const { minSec, maxSec, minLevel, maxLevel } = HOUSE_REWARD_TIME;
  const lvl = Math.max(minLevel, Math.min(maxLevel, def?.level || 1));
  const t = (lvl - minLevel) / Math.max(1, maxLevel - minLevel);
  return Math.round(minSec * Math.pow(maxSec / minSec, t)) * 1000;
}

export function houseGrowthIntervalMs(def) {
  const max = houseMaxPeople(def);
  const fillMs = houseRewardDurationMs(def) * HOUSE_GROWTH.fillCycles;
  return Math.max(1000, Math.round(fillMs / Math.max(1, max)));
}

/** Dollars per 10s chunk for this house's unlock level. */
export function houseRewardRatePerChunk(def) {
  const lvl = Math.max(1, Math.round(def?.level || 1));
  const { base, levelSteps } = HOUSE_REWARD_RATE;
  let rate = base;
  for (let i = 1; i < lvl; i++) {
    rate += levelSteps[(i - 1) % levelSteps.length];
  }
  return rate;
}

/** Global cash payout scale for houses and commerces (1 = full, 0.5 = half). */
export const CASH_REWARD_SCALE = 0.15;

/** Global XP gain scale (1 = full, 0.5 = half). Applies to collect and build XP. */
export const XP_REWARD_SCALE = 0.5;

/** Full-occupancy cash before influence. No rewardCash → no house production. */
export function houseFullCycleReward(def) {
  if (def?.rewardCash == null) return 0;
  return Math.max(0, Math.round(Number(def.rewardCash) * CASH_REWARD_SCALE));
}

export function houseRentPerPerson(def) {
  if (def?.rentPerPerson != null) {
    return Math.max(0, Math.round(def.rentPerPerson * CASH_REWARD_SCALE));
  }
  const full = houseFullCycleReward(def);
  if (full <= 0) return 0;
  const max = houseMaxPeople(def);
  return Math.max(1, Math.round(full / Math.max(1, max)));
}

export function houseIncome(def, people, influenceScaled) {
  const base = houseRentPerPerson(def) * Math.max(0, people | 0);
  return Math.floor((base * ((influenceScaled || 0) + 10000)) / 10000);
}

export function houseCollectXp(_def, cash) {
  return Math.max(1, Math.round((cash / 10) * XP_REWARD_SCALE));
}

/** True when the building uses loot-accrual (houses and commerces with baseLoot). */
export function usesLootEconomy(def) {
  return (
    def?.baseLoot != null &&
    (def?.category === "house" || def?.category === "commercial")
  );
}

/** Purchase cost for payback math (optional buildCost override). */
export function buildCostOf(def) {
  if (def?.buildCost != null) return Math.max(0, Number(def.buildCost) || 0);
  return normalizedBuildCost(def);
}

export function lootIntervalSec(def) {
  return Math.max(1, Number(def?.lootInterval) || 60);
}

export function lootIntervalMs(def) {
  return lootIntervalSec(def) * 1000;
}

export function maxLootOf(def) {
  if (def?.maxLoot != null) return Math.max(0, Number(def.maxLoot) || 0);
  const base = Number(def?.baseLoot) || 0;
  return Math.max(0, base * 10);
}

/**
 * Decorations (+ wonders) bonus as a fraction (0.15 = +15%).
 * Applies to houses and commerces. Prefer live scan when `buildings` is
 * provided so a stale influence:0 cache cannot zero-out loot.
 */
export function getBuildingDecorationBonus(building, buildings) {
  if (!building) return 0;
  if (buildings) {
    const cat = building.def?.category;
    if (cat === "house" || cat === "commercial") {
      return Math.max(0, computeHouseInfluence(building, buildings) / 10000);
    }
  }
  if (building.runtime?.influence != null) {
    return Math.max(0, (Number(building.runtime.influence) || 0) / 10000);
  }
  return 0;
}

/** Capacity after decoration/wonder bonus (matches boosted accrual). */
export function effectiveMaxLoot(building, buildings) {
  const def = building?.def ?? building;
  const base = maxLootOf(def);
  if (base <= 0) return 0;
  const bonus =
    building?.def != null ? getBuildingDecorationBonus(building, buildings) : 0;
  return Math.max(0, Math.floor(base * (1 + bonus)));
}

/** Base production $/min before decoration bonus. */
export function getBuildingProductionPerMinute(def) {
  if (!def || def.baseLoot == null) return 0;
  const intervalMin = lootIntervalSec(def) / 60;
  if (intervalMin <= 0) return 0;
  return Number(def.baseLoot) / intervalMin;
}

/** Final production $/min including decoration/wonder bonus. */
export function getBuildingFinalProduction(building, buildings) {
  const def = building?.def ?? building;
  const base = getBuildingProductionPerMinute(def);
  if (base <= 0) return 0;
  const bonus =
    building?.def != null
      ? getBuildingDecorationBonus(building, buildings)
      : 0;
  return base * (1 + bonus);
}

/** Minutes to recover buildCost at final production (Infinity if no income). */
export function getBuildingPaybackTime(building, buildings) {
  const def = building?.def ?? building;
  const cost = buildCostOf(def);
  const perMin =
    building?.def != null
      ? getBuildingFinalProduction(building, buildings)
      : getBuildingProductionPerMinute(def);
  if (perMin <= 0) return Infinity;
  return cost / perMin;
}

/** Cash granted per completed loot interval (with bonus). */
export function lootPerInterval(building, buildings) {
  const def = building?.def ?? building;
  const base = Math.max(0, Number(def?.baseLoot) || 0);
  if (base <= 0) return 0;
  const bonus =
    building?.def != null
      ? getBuildingDecorationBonus(building, buildings)
      : 0;
  return base * (1 + bonus);
}

/**
 * Accrue pendingLoot from lastLootUpdate → now, capped by boosted maxLoot.
 * Works for houses and commerces with baseLoot.
 * Advances lastLootUpdate by whole intervals (no double-count on reload).
 * @returns {boolean} whether runtime changed
 */
export function accrueHouseLoot(building, buildings = null, now = Date.now()) {
  const def = building?.def;
  const rt = building?.runtime;
  if (!usesLootEconomy(def) || !rt || rt.status === STATUS.BUILDING) return false;

  if (rt.pendingLoot == null) rt.pendingLoot = 0;
  if (rt.lastLootUpdate == null) rt.lastLootUpdate = now;

  // Refresh decoration/wonder influence before computing loot.
  if (buildings && (def.category === "house" || def.category === "commercial")) {
    rt.influence = computeHouseInfluence(building, buildings);
  }

  const intervalMs = lootIntervalMs(def);
  const elapsed = Math.max(0, now - Number(rt.lastLootUpdate));
  const intervals = Math.floor(elapsed / intervalMs);
  if (intervals < 1) {
    const nextStatus = rt.pendingLoot > 0 ? STATUS.READY : STATUS.WAITING;
    if (rt.status !== nextStatus && rt.status !== STATUS.BUILDING) {
      rt.status = nextStatus;
      return true;
    }
    return false;
  }

  const per = lootPerInterval(building, buildings);
  const cap = effectiveMaxLoot(building, buildings);
  const before = Number(rt.pendingLoot) || 0;
  const gain = intervals * per;
  rt.pendingLoot = Math.min(cap, before + gain);
  rt.lastLootUpdate = Number(rt.lastLootUpdate) + intervals * intervalMs;
  rt.lastIncome = Math.floor(rt.pendingLoot);
  rt.status = rt.pendingLoot > 0 ? STATUS.READY : STATUS.WAITING;
  return rt.pendingLoot !== before || intervals > 0;
}

/** Alias for commerces (same accrual path). */
export function accrueCommerceLoot(building, buildings = null, now = Date.now()) {
  return accrueHouseLoot(building, buildings, now);
}

/**
 * Normalize house/commerce runtime after load (loot → contract / cycle migration).
 * Mutates and returns `rt`.
 */
export function migrateBuildingRuntime(def, rt) {
  if (!rt || !def) return rt;

  if (def.category === "house" && !usesLootEconomy(def)) {
    if (rt.pendingLoot != null) delete rt.pendingLoot;
    if (rt.lastLootUpdate != null) delete rt.lastLootUpdate;
    if (rt.contractId == null && (rt.status === STATUS.READY || rt.status === STATUS.WAITING)) {
      rt.status = STATUS.IDLE;
      rt.remainingMs = 0;
      rt.durationMs = 0;
      rt.lastIncome = 0;
    }
  }

  if (def.category === "commercial" && !usesLootEconomy(def)) {
    if (rt.pendingLoot != null) delete rt.pendingLoot;
    if (rt.lastLootUpdate != null) delete rt.lastLootUpdate;
    if (rt.influence == null) rt.influence = 0;
    const durationMs = commerceRewardDurationMs(def);
    if (!rt.durationMs || rt.durationMs <= 0) rt.durationMs = durationMs;
    if (rt.status === STATUS.READY) {
      // keep ready so player can collect once
    } else if (rt.status !== STATUS.BUILDING && rt.status !== STATUS.WAITING) {
      rt.status = STATUS.WAITING;
      rt.remainingMs = durationMs;
      rt.durationMs = durationMs;
    } else if (rt.status === STATUS.WAITING && (rt.remainingMs == null || rt.remainingMs < 0)) {
      rt.remainingMs = durationMs;
      rt.durationMs = durationMs;
    }
  }

  if (def.category === "wonder" && rt.status !== STATUS.BUILDING) {
    const gold = wonderGoldReward(def);
    const dia = wonderDiamondReward(def);
    if (gold <= 0) rt.goldReadyAt = 0;
    else if (!(Number(rt.goldReadyAt) > 0)) rt.goldReadyAt = Date.now() + wonderGoldIntervalMs(def);
    if (dia <= 0) rt.diamondReadyAt = 0;
    else if (!(Number(rt.diamondReadyAt) > 0)) {
      rt.diamondReadyAt = Date.now() + wonderDiamondIntervalMs(def);
    }
  }

  return rt;
}

/** Fresh operational runtime for a finished house (needs a signed contract). */
export function makeHouseRuntime(def, people = null) {
  const maxPeople = houseMaxPeople(def);
  const growthIntervalMs = houseGrowthIntervalMs(def);
  const pop =
    people == null
      ? maxPeople
      : Math.max(0, maxPeople > 0 ? Math.min(maxPeople, Math.round(people)) : 0);
  const now = Date.now();
  const base = {
    status: STATUS.IDLE,
    people: pop,
    maxPeople,
    growthRemainingMs: 0,
    growthIntervalMs,
    durationMs: 0,
    remainingMs: 0,
    influence: 0,
    lastIncome: 0,
    contractId: null,
  };
  if (usesLootEconomy(def)) {
    return {
      ...base,
      status: STATUS.WAITING,
      pendingLoot: 0,
      lastLootUpdate: now,
      remainingMs: 0,
      durationMs: 0,
    };
  }
  return base;
}

/** Global commerce collect cycle (3 minutes). */
export const COMMERCE_CYCLE_SEC = 180;

export function commerceRewardDurationMs(_def) {
  return Math.max(1, COMMERCE_CYCLE_SEC) * 1000;
}

/** Fixed cash charged per customer in the shop influence radius. */
export function commerceRentPerCustomer(def) {
  if (def?.rentPerTenant != null) {
    return Math.max(0, Math.round(Number(def.rentPerTenant) || 0));
  }
  return 0;
}

/**
 * Residents (people) in finished houses inside the commerce influence radius.
 * @param {object} shop
 * @param {object[]} buildings
 */
export function countCustomersInCommerceRadius(shop, buildings) {
  if (!shop || !buildings) return 0;
  const r = influenceRadiusOf(shop.def);
  if (r == null) return 0;
  let people = 0;
  for (const b of buildings) {
    if (b.id === shop.id) continue;
    if (isConstructing(b)) continue;
    if (b.def?.category !== "house") continue;
    if (!inRadius(shop, b, r)) continue;
    people += Math.max(0, Math.round(Number(b.runtime?.people) || 0));
  }
  return people;
}

/**
 * Cycle payout: rentPerTenant × customers, then decoration/wonder influence
 * (same scaling as houseIncome: influence 100 = +1%).
 */
export function commerceCycleReward(def, customers = 0, influenceScaled = 0) {
  const rate = commerceRentPerCustomer(def);
  const n = Math.max(0, Math.round(Number(customers) || 0));
  const base = rate * n;
  return Math.floor((base * ((influenceScaled || 0) + 10000)) / 10000);
}

export function commerceCollectXp(_def, cash) {
  return Math.max(1, Math.round((cash / 10) * XP_REWARD_SCALE));
}

export function makeCommerceRuntime(def) {
  const durationMs = commerceRewardDurationMs(def);
  return {
    status: STATUS.WAITING,
    durationMs,
    remainingMs: durationMs,
    customers: 0,
    influence: 0,
    lastIncome: 0,
  };
}

export function wonderGoldIntervalMs(def) {
  const sec = def?.goldIntervalSec ?? WONDER_PRODUCTION.goldIntervalSec;
  return Math.max(1000, (sec * 1000) / TIME_SCALE);
}

export function wonderDiamondIntervalMs(def) {
  const sec = def?.diamondIntervalSec ?? WONDER_PRODUCTION.diamondIntervalSec;
  return Math.max(1000, (sec * 1000) / TIME_SCALE);
}

export function wonderGoldReward(def) {
  if (def?.goldReward != null) return Math.max(0, Math.round(Number(def.goldReward) || 0));
  return Math.max(0, Math.round(Number(WONDER_PRODUCTION.goldReward) || 0));
}

export function wonderDiamondReward(def) {
  if (def?.diamondReward != null) return Math.max(0, Math.round(Number(def.diamondReward) || 0));
  return Math.max(0, Math.round(Number(WONDER_PRODUCTION.diamondReward) || 0));
}

export function wonderGoldReady(rt, now = Date.now()) {
  const at = Number(rt?.goldReadyAt) || 0;
  return at > 0 && now >= at;
}

export function wonderDiamondReady(rt, now = Date.now()) {
  const at = Number(rt?.diamondReadyAt) || 0;
  return at > 0 && now >= at;
}

export function wonderAnyReady(rt, now = Date.now()) {
  return wonderGoldReady(rt, now) || wonderDiamondReady(rt, now);
}

/** Start wonder production timers (0 readyAt = that premium is disabled). */
export function makeWonderRuntime(def, now = Date.now()) {
  const gold = wonderGoldReward(def);
  const dia = wonderDiamondReward(def);
  return {
    goldReadyAt: gold > 0 ? now + wonderGoldIntervalMs(def) : 0,
    diamondReadyAt: dia > 0 ? now + wonderDiamondIntervalMs(def) : 0,
    goldNotified: false,
    diamondNotified: false,
    lastGold: 0,
    lastDiamond: 0,
  };
}

export function wonderGoldRemainingMs(rt, now = Date.now()) {
  const at = Number(rt?.goldReadyAt) || 0;
  if (at <= 0) return 0;
  return Math.max(0, at - now);
}

export function wonderDiamondRemainingMs(rt, now = Date.now()) {
  const at = Number(rt?.diamondReadyAt) || 0;
  if (at <= 0) return 0;
  return Math.max(0, at - now);
}

export function footprintCenter(building) {
  return {
    x: building.tx + building.def.gridW / 2,
    y: building.ty + building.def.gridH / 2,
  };
}

/** Matches the ghost radius drawn in the renderer. */
export function effectiveRadiusTiles(def) {
  const base = def.influenceRadiusTiles != null ? def.influenceRadiusTiles : null;
  if (base == null || base < 0) return null;
  return base + Math.max(def.gridW, def.gridH) / 2;
}

export function distanceTiles(a, b) {
  const ca = footprintCenter(a);
  const cb = footprintCenter(b);
  const dx = ca.x - cb.x;
  const dy = ca.y - cb.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Gap between two footprints (0 if they touch or overlap). */
export function footprintEdgeDistance(a, b) {
  const ax0 = a.tx;
  const ay0 = a.ty;
  const ax1 = a.tx + a.def.gridW;
  const ay1 = a.ty + a.def.gridH;
  const bx0 = b.tx;
  const by0 = b.ty;
  const bx1 = b.tx + b.def.gridW;
  const by1 = b.ty + b.def.gridH;
  const dx = Math.max(0, ax0 - bx1, bx0 - ax1);
  const dy = Math.max(0, ay0 - by1, by0 - ay1);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Influence check: edge-to-edge distance vs raw influenceRadiusTiles.
 * (Center-to-center missed adjacent 2x2 houses next to 1x1 decorations.)
 */
export function inRadius(source, target, radiusTiles) {
  if (radiusTiles == null) return false;
  return footprintEdgeDistance(source, target) <= radiusTiles;
}

export function influenceRadiusOf(def) {
  if (!def || def.influenceRadiusTiles == null || def.influenceRadiusTiles < 0) return null;
  return def.influenceRadiusTiles;
}

export function createRuntime(def, opts = {}) {
  const cat = def.category;
  let base;
  if (cat === "house") {
    base = makeHouseRuntime(def);
  } else if (cat === "commercial") {
    base = makeCommerceRuntime(def);
  } else if (cat === "wonder") {
    base = makeWonderRuntime(def);
  } else {
    base = {
      status: STATUS.IDLE,
      influence: 0,
    };
  }

  if (opts.skipBuild) return base;
  if (cat !== "house" && cat !== "commercial" && cat !== "wonder") return base;

  const buildMs = buildDurationMs(def);
  if (buildMs <= 0) return base;

  // Production / rent clocks start only after construction finishes.
  if (cat === "wonder") {
    return {
      status: STATUS.BUILDING,
      buildEndsAt: Date.now() + buildMs,
      buildDurationMs: buildMs,
      goldReadyAt: 0,
      diamondReadyAt: 0,
      goldNotified: false,
      diamondNotified: false,
      lastGold: 0,
      lastDiamond: 0,
    };
  }
  if (cat === "commercial") {
    return {
      ...base,
      status: STATUS.BUILDING,
      buildEndsAt: Date.now() + buildMs,
      buildDurationMs: buildMs,
      remainingMs: 0,
      durationMs: 0,
    };
  }
  // House under construction: keep capacity info, freeze timers until finished.
  return {
    ...base,
    status: STATUS.BUILDING,
    buildEndsAt: Date.now() + buildMs,
    buildDurationMs: buildMs,
    people: 0,
    remainingMs: 0,
    durationMs: 0,
    growthRemainingMs: 0,
  };
}

/** Cash-equivalent purchase cost for scaling build time / instant finish / place XP. */
export function normalizedBuildCost(def) {
  if (!def) return 0;
  return (
    (def.costCoins || 0) +
    (def.costFortune || 0) * BUILD_COST_EQUIV.goldToCash +
    (def.costDiamonds || 0) * BUILD_COST_EQUIV.diamondToCash
  );
}

/**
 * XP granted when placing a construction.
 * Prefer catalog `exp` / `xpReward`; otherwise scale with purchase cost.
 */
export const BUILD_PLACE_XP = {
  cashPerXp: 900,
  min: 1,
};

export function buildPlaceXp(def) {
  if (!def) return 0;
  if (def.xpReward != null) {
    return Math.max(0, Math.round(Number(def.xpReward) || 0));
  }
  // economy.json `exp` is the authored place-XP (decorations, etc.)
  if (def.exp != null) {
    return Math.max(0, Math.round(Number(def.exp) || 0));
  }
  const cost = normalizedBuildCost(def);
  if (cost <= 0) return BUILD_PLACE_XP.min;
  const scale = def.buildXpScale != null ? Number(def.buildXpScale) : 1;
  return Math.max(
    BUILD_PLACE_XP.min,
    Math.round((cost / BUILD_PLACE_XP.cashPerXp) * XP_REWARD_SCALE * scale)
  );
}

/**
 * Wall-clock construction duration in ms.
 * Houses/commerces: half of collect time. Wonders: cost curve.
 */
export function buildDurationMs(def) {
  if (!def) return 0;
  const cat = def.category;
  if (cat !== "house" && cat !== "commercial" && cat !== "wonder") return 0;

  if (cat === "house") {
    if (def.buildTimeSec != null) {
      return Math.max(1, Math.round(Number(def.buildTimeSec) || 1)) * 1000;
    }
    if (usesLootEconomy(def)) {
      // Short construction relative to loot cycle; scale mildly with cost tier.
      const base = Math.max(10, Math.round(lootIntervalSec(def) / 2));
      const cost = normalizedBuildCost(def);
      if (cost <= BUILD_TIME.minCost) return base * 1000;
      const t = Math.min(1, Math.log(cost / BUILD_TIME.minCost) / Math.log(BUILD_TIME.maxCost / BUILD_TIME.minCost));
      const sec = Math.round(base * Math.pow(120 / base, t));
      return Math.max(base, Math.min(3600, sec)) * 1000;
    }
    const collectSec =
      def.rewardSec != null
        ? Math.max(1, def.rewardSec)
        : Math.max(1, Math.round(houseRewardDurationMs(def) / 1000));
    return Math.max(1, Math.round(collectSec / 2)) * 1000;
  }
  if (cat === "commercial") {
    const collectSec = Math.max(1, Math.round(commerceRewardDurationMs(def) / 1000));
    return Math.max(1, Math.round(collectSec / 2)) * 1000;
  }

  const cost = normalizedBuildCost(def);
  if (cost <= 0) return BUILD_TIME.minSec * 1000;

  const { minSec, maxSec, minCost, maxCost } = BUILD_TIME;
  const logMin = Math.log(minCost);
  const logMax = Math.log(maxCost);
  const t = Math.max(0, Math.min(1, (Math.log(Math.max(cost, minCost)) - logMin) / (logMax - logMin)));
  const sec = Math.round(minSec * Math.pow(maxSec / minSec, t));
  return Math.max(minSec, Math.min(maxSec, sec)) * 1000;
}

export function isConstructing(buildingOrRuntime) {
  const rt = buildingOrRuntime?.runtime ?? buildingOrRuntime;
  return rt?.status === STATUS.BUILDING;
}

export function buildRemainingMs(rt) {
  if (!rt || rt.status !== STATUS.BUILDING) return 0;
  return Math.max(0, (rt.buildEndsAt || 0) - Date.now());
}

export function buildProgressPct(rt) {
  const total = rt?.buildDurationMs || 0;
  if (total <= 0) return 100;
  const left = buildRemainingMs(rt);
  return Math.max(0, Math.min(100, (1 - left / total) * 100));
}

/**
 * Cash cost to finish construction instantly.
 * Starts at ~12% of building value and drops one discrete step every 5 minutes.
 * @param {object} def
 * @param {number} [remainingMs]
 * @param {number} [totalMs] actual build duration (defaults to buildDurationMs(def))
 */
export function instantBuildCashCost(def, remainingMs, totalMs = null) {
  const total = Math.max(0, totalMs == null ? buildDurationMs(def) : totalMs);
  const left = remainingMs == null ? total : Math.max(0, remainingMs);
  const elapsed = Math.max(0, total - left);

  const full = Math.max(100, Math.ceil(normalizedBuildCost(def) * INSTANT_BUILD_COST_FACTOR));
  const totalSteps = Math.max(1, Math.ceil(total / INSTANT_BUILD_STEP_MS));
  const stepsDone = Math.min(totalSteps, Math.floor(elapsed / INSTANT_BUILD_STEP_MS));
  const stepsLeft = Math.max(0, totalSteps - stepsDone);

  if (stepsLeft <= 0) return 100;
  return Math.max(100, Math.ceil((full * stepsLeft) / totalSteps));
}

/**
 * Transition runtime out of BUILDING into the category's normal start state.
 */
export function completeConstructionRuntime(def, rt) {
  if (!rt) return rt;
  delete rt.buildEndsAt;
  delete rt.buildDurationMs;

  if (def.category === "house") {
    const next = makeHouseRuntime(def);
    Object.keys(rt).forEach((k) => delete rt[k]);
    Object.assign(rt, next);
    return rt;
  }
  if (def.category === "commercial") {
    const next = makeCommerceRuntime(def);
    Object.keys(rt).forEach((k) => delete rt[k]);
    Object.assign(rt, next);
    return rt;
  }
  if (def.category === "wonder") {
    const next = makeWonderRuntime(def);
    delete rt.status;
    Object.assign(rt, next);
    return rt;
  }
  rt.status = STATUS.IDLE;
  return rt;
}

/**
 * @param {object} [_economy]
 */
export function makeEconomyIndex(_economy) {
  return {};
}

/**
 * Decoration (radius) + wonders (global) influence for a house or commerce.
 * Scaled units: 100 ≈ +1%.
 */
export function computeHouseInfluence(target, buildings) {
  let scaled = 0;
  for (const b of buildings) {
    if (b.id === target.id) continue;
    if (isConstructing(b)) continue;
    const d = b.def;
    // Wonders: global city bonus (accumulates, no radius)
    if (d.category === "wonder" && d.rewardBonusScaled) {
      scaled += d.rewardBonusScaled;
      continue;
    }
    if (d.category === "decoration" && d.houseBonusScaled) {
      const r = influenceRadiusOf(d);
      if (r != null && inRadius(b, target, r)) scaled += d.houseBonusScaled;
    }
  }
  return scaled;
}

/** Road adjacency: any footprint tile shares an edge (or corner) with a road. */
export function isRoadConnected(building, roads) {
  if (!roads) return true;
  const { tx, ty, def } = building;
  for (let y = ty; y < ty + def.gridH; y++) {
    for (let x = tx; x < tx + def.gridW; x++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (roads.has(x + dx, y + dy)) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Continuous road path to Headquarters (gameplay gate).
 * Falls back to local adjacency only when no graph is provided.
 * @param {object} building
 * @param {object|null} roads
 * @param {{ isConnectedToHQ?: (b: object) => boolean }|null} [graph]
 */
export function isConnectedToHQ(building, roads, graph = null) {
  if (graph && typeof graph.isConnectedToHQ === "function") {
    return graph.isConnectedToHQ(building);
  }
  return isRoadConnected(building, roads);
}

export function needsRoad(def) {
  return def.category === "house" || def.category === "commercial" || def.category === "wonder";
}

export function isHQ(def) {
  return !!def && (def.category === "hq" || def.constant === "HQ");
}

export function formatDuration(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  if (h < 24) return mr ? `${h}h ${mr}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return hr ? `${d}d ${hr}h` : `${d}d`;
}
