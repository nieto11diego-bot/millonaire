/**
 * Economy formulas for Millionaire City.
 */

export const STATUS = {
  IDLE: "idle", // decorations / services
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
export function buildLevelThresholds(curve = LEVEL_XP) {
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
  /** Matches house curve: Bungalow $50k → Petronas 30♦ ($15M). */
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
  goldIntervalSec: 8 * 3600,
  goldReward: 1,
  diamondIntervalSec: 24 * 3600,
  diamondReward: 1,
};

/**
 * House population (SimCity-style growth) and rent cycle.
 * maxPeople and reward duration scale with building level.
 */
export const HOUSE_POP = {
  basePeople: 4,
  peoplePerLevel: 1.6,
  areaBonusPer4Tiles: 1,
};

export const HOUSE_REWARD_TIME = {
  minSec: 25,
  maxSec: 3 * 3600,
  minLevel: 1,
  maxLevel: 32,
};

/** Full occupancy from empty takes this many reward cycles. */
export const HOUSE_GROWTH = { fillCycles: 3 };

/**
 * House cash payout rate:
 *   10 seconds → $200 at level 1
 *   each further level adds the repeating succession +5, +10, +5, +5, +15
 *   → rates 200, 205, 215, 220, 225, 240, 245, …
 * Full-cycle reward ≈ (rewardSec / 10) * rate(level), split across maxPeople.
 */
export const HOUSE_REWARD_RATE = {
  chunkSec: 10,
  base: 200,
  levelSteps: [5, 10, 5, 5, 15],
};

/** @deprecated kept for older references; house payout uses HOUSE_REWARD_RATE */
export const HOUSE_YIELD = { perCyclePercent: 6 };

export function houseMaxPeople(def) {
  if (def?.maxPeople != null) return Math.max(1, Math.round(def.maxPeople));
  const lvl = Math.max(1, def?.level || 1);
  const area = Math.max(1, (def?.gridW || 2) * (def?.gridH || 2));
  return Math.max(
    1,
    Math.round(
      HOUSE_POP.basePeople +
        HOUSE_POP.peoplePerLevel * (lvl - 1) +
        ((area - 4) / 4) * HOUSE_POP.areaBonusPer4Tiles
    )
  );
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

/** Full-occupancy cash before influence (override with def.rewardCash). */
export function houseFullCycleReward(def) {
  if (def?.rewardCash != null) return Math.max(0, Math.round(def.rewardCash));
  const durationSec = houseRewardDurationMs(def) / 1000;
  const chunks = durationSec / HOUSE_REWARD_RATE.chunkSec;
  return Math.max(1, Math.round(chunks * houseRewardRatePerChunk(def)));
}

export function houseRentPerPerson(def) {
  if (def?.rentPerPerson != null) return Math.max(1, Math.round(def.rentPerPerson));
  const max = houseMaxPeople(def);
  return Math.max(1, Math.round(houseFullCycleReward(def) / Math.max(1, max)));
}

export function houseIncome(def, people, influenceScaled) {
  const base = houseRentPerPerson(def) * Math.max(0, people | 0);
  return Math.floor((base * ((influenceScaled || 0) + 10000)) / 10000);
}

export function houseCollectXp(_def, cash) {
  return Math.max(1, Math.round(cash / 10));
}

/** Fresh operational runtime for a finished house (full population by default). */
export function makeHouseRuntime(def, people = null) {
  const maxPeople = houseMaxPeople(def);
  const durationMs = houseRewardDurationMs(def);
  const growthIntervalMs = houseGrowthIntervalMs(def);
  const pop =
    people == null
      ? maxPeople
      : Math.max(0, Math.min(maxPeople, Math.round(people)));
  return {
    status: STATUS.WAITING,
    people: pop,
    maxPeople,
    growthRemainingMs: pop >= maxPeople ? 0 : growthIntervalMs,
    growthIntervalMs,
    durationMs,
    remainingMs: durationMs,
    influence: 0,
    lastIncome: 0,
  };
}

export function commerceDurationMs(def) {
  return (def.incomeTimeSec || 180) * 1000;
}

export function commercePayout(def, customers) {
  return (def.incomeValue || 0) * (customers || 0);
}

/** XP granted when collecting commerce profit (matches original ~10:1 cash:xp). */
export function commerceCollectXp(_def, cash) {
  return Math.max(1, Math.round(cash / 10));
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
  return Math.max(0, def?.goldReward ?? WONDER_PRODUCTION.goldReward);
}

export function wonderDiamondReward(def) {
  return Math.max(0, def?.diamondReward ?? WONDER_PRODUCTION.diamondReward);
}

export function wonderGoldReady(rt, now = Date.now()) {
  return !!rt && now >= (rt.goldReadyAt || 0);
}

export function wonderDiamondReady(rt, now = Date.now()) {
  return !!rt && now >= (rt.diamondReadyAt || 0);
}

export function wonderAnyReady(rt, now = Date.now()) {
  return wonderGoldReady(rt, now) || wonderDiamondReady(rt, now);
}

export function wonderGoldRemainingMs(rt, now = Date.now()) {
  return Math.max(0, (rt?.goldReadyAt || 0) - now);
}

export function wonderDiamondRemainingMs(rt, now = Date.now()) {
  return Math.max(0, (rt?.diamondReadyAt || 0) - now);
}

export function footprintCenter(building) {
  return {
    x: building.tx + building.def.gridW / 2,
    y: building.ty + building.def.gridH / 2,
  };
}

/** Matches the ghost radius drawn in the renderer. */
export function effectiveRadiusTiles(def) {
  const base =
    def.clientRadiusTiles != null
      ? def.clientRadiusTiles
      : def.influenceRadiusTiles != null
        ? def.influenceRadiusTiles
        : null;
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

export function inRadius(source, target, radiusTiles) {
  if (radiusTiles == null) return false;
  return distanceTiles(source, target) <= radiusTiles;
}

export function createRuntime(def, opts = {}) {
  const cat = def.category;
  let base;
  if (cat === "house") {
    base = makeHouseRuntime(def);
  } else if (cat === "commercial") {
    const ms = commerceDurationMs(def);
    base = {
      status: STATUS.WAITING,
      remainingMs: ms,
      durationMs: ms,
      customers: 0,
      lastPayout: 0,
    };
  } else if (cat === "wonder") {
    const now = Date.now();
    base = {
      goldReadyAt: now + wonderGoldIntervalMs(def),
      diamondReadyAt: now + wonderDiamondIntervalMs(def),
      goldNotified: false,
      diamondNotified: false,
      lastGold: 0,
      lastDiamond: 0,
    };
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
 * Scales with purchase cost: $500 → 1 XP (Bungalow $50k → 100 XP).
 */
export const BUILD_PLACE_XP = {
  cashPerXp: 500,
  min: 1,
};

export function buildPlaceXp(def) {
  if (!def) return 0;
  const cost = normalizedBuildCost(def);
  if (cost <= 0) return BUILD_PLACE_XP.min;
  return Math.max(BUILD_PLACE_XP.min, Math.round(cost / BUILD_PLACE_XP.cashPerXp));
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
    const collectSec =
      def.rewardSec != null
        ? Math.max(1, def.rewardSec)
        : Math.max(1, Math.round(houseRewardDurationMs(def) / 1000));
    return Math.max(1, Math.round(collectSec / 2)) * 1000;
  }
  if (cat === "commercial") {
    const collectSec = Math.max(1, def.incomeTimeSec || 180);
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
    const ms = commerceDurationMs(def);
    rt.status = STATUS.WAITING;
    rt.remainingMs = ms;
    rt.durationMs = ms;
    rt.customers = 0;
    rt.lastPayout = 0;
    return rt;
  }
  if (def.category === "wonder") {
    const now = Date.now();
    delete rt.status;
    rt.goldReadyAt = now + wonderGoldIntervalMs(def);
    rt.diamondReadyAt = now + wonderDiamondIntervalMs(def);
    rt.goldNotified = false;
    rt.diamondNotified = false;
    rt.lastGold = 0;
    rt.lastDiamond = 0;
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

export function computeHouseInfluence(house, buildings) {
  let scaled = 0;
  for (const b of buildings) {
    if (b.id === house.id) continue;
    if (isConstructing(b)) continue;
    const d = b.def;
    if (d.category === "wonder" && d.cityBonusScaled) {
      scaled += d.cityBonusScaled;
      continue;
    }
    if (d.category === "decoration" && d.houseBonusScaled) {
      const r = effectiveRadiusTiles(d);
      if (r != null && inRadius(b, house, r)) scaled += d.houseBonusScaled;
    }
  }
  return scaled;
}

/**
 * Customers = population of finished houses inside the shop radius.
 */
export function computeCommerceCustomers(shop, buildings) {
  const r = effectiveRadiusTiles(shop.def);
  if (r == null) return 0;
  let sum = 0;
  for (const b of buildings) {
    if (b.def.category !== "house") continue;
    const rt = b.runtime;
    if (!rt || rt.status === STATUS.BUILDING) continue;
    const people = rt.people || 0;
    if (!people) continue;
    if (inRadius(shop, b, r)) sum += people;
  }
  const cap = shop.def.maxClients ?? 9999;
  return Math.min(cap, sum);
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

export function needsRoad(def) {
  return def.category === "house" || def.category === "commercial" || def.category === "wonder";
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
