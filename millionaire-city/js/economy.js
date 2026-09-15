/**
 * Economy formulas — ported from ContractScreen / GameObject (dex-verified).
 */

export const STATUS = {
  IDLE: "idle", // house: select contract
  WAITING: "waiting", // timer running
  READY: "ready", // collect available
  LOST: "lost", // house: rent lost
};

/** Real-time pace (1 = wall clock). Contract UI durations match sim timers. */
export const TIME_SCALE = 1;

/** Wonder premium production (wall-clock intervals, divided by TIME_SCALE). */
export const WONDER_PRODUCTION = {
  goldIntervalSec: 8 * 3600,
  goldReward: 1,
  diamondIntervalSec: 24 * 3600,
  diamondReward: 1,
};

/** After rent is ready, wait this many contract-durations before "lost". */
export const LOST_RENT_GRACE_FACTOR = 1;

/**
 * Contract economy anchors (Tourists on bungalow group: $300 cost / $900 reward).
 * Scale mixes duration (soft power) + tier so longer/higher contracts pay more
 * while keeping reward ≈ 3× displayed cost on the base house group.
 */
export const CONTRACT_ECONOMY = {
  anchorCostBase: 120, // × costMod 250% → $300
  anchorIncomeBase: 900, // × incomeMod 100% → $900
  anchorDurationSec: 20,
  durationExponent: 0.45,
  tierStep: 0.22,
};

/** Duration×tier scale relative to Tourists (1.0). */
export function contractEconomyScale(contract) {
  const d0 = CONTRACT_ECONOMY.anchorDurationSec;
  const d = Math.max(1, contract?.durationSec || d0);
  const softDur = Math.pow(d / d0, CONTRACT_ECONOMY.durationExponent);
  const tier = 1 + (contract?.id || 0) * CONTRACT_ECONOMY.tierStep;
  return softDur * tier;
}

export function contractCostBase(contract) {
  return Math.max(1, Math.round(CONTRACT_ECONOMY.anchorCostBase * contractEconomyScale(contract)));
}

export function contractIncomeBase(contract) {
  return Math.max(1, Math.round(CONTRACT_ECONOMY.anchorIncomeBase * contractEconomyScale(contract)));
}

export function contractCost(contract, group) {
  return Math.floor((contractCostBase(contract) * group.costModifierPercent) / 100);
}

export function contractIncome(contract, group, influenceScaled) {
  const base = Math.floor((contractIncomeBase(contract) * group.incomeModifierPercent) / 100);
  return Math.floor((base * (influenceScaled + 10000)) / 10000);
}

export function contractTenants(group) {
  return group.tenants;
}

export function contractDurationMs(contract) {
  return contract.durationSec * 1000;
}

/**
 * XP bonus % by contract tier: lowest contract → 5%, highest → 25%.
 * @param {object} contract
 * @param {number} [contractCount]
 */
export function contractXpBonusPercent(contract, contractCount = 9) {
  const maxId = Math.max(1, (contractCount || 9) - 1);
  const id = Math.max(0, Math.min(maxId, contract?.id ?? 0));
  return 5 + (20 * id) / maxId;
}

/** Base contract XP with tier bonus applied. */
export function contractXp(contract, contractCount = 9) {
  const base = contract?.xp || 0;
  const pct = contractXpBonusPercent(contract, contractCount);
  return Math.max(0, Math.round(base * (1 + pct / 100)));
}

export function commerceDurationMs(def) {
  return (def.incomeTimeSec || 180) * 1000;
}

export function commercePayout(def, customers) {
  // incomeValue is the per-customer tick base (inferred; commerce is not influence-scaled).
  return (def.incomeValue || 0) * (customers || 0);
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

export function createRuntime(def) {
  const cat = def.category;
  if (cat === "house") {
    return {
      status: STATUS.IDLE,
      contractId: null,
      remainingMs: 0,
      durationMs: 0,
      influence: 0,
      tenants: 0,
      lastIncome: 0,
    };
  }
  if (cat === "commercial") {
    const ms = commerceDurationMs(def);
    return {
      status: STATUS.WAITING,
      remainingMs: ms,
      durationMs: ms,
      customers: 0,
      lastPayout: 0,
    };
  }
  if (cat === "wonder") {
    const now = Date.now();
    return {
      goldReadyAt: now + wonderGoldIntervalMs(def),
      diamondReadyAt: now + wonderDiamondIntervalMs(def),
      goldNotified: false,
      diamondNotified: false,
      lastGold: 0,
      lastDiamond: 0,
    };
  }
  return {
    status: STATUS.IDLE,
    influence: 0,
  };
}

/**
 * @param {object} economy
 */
export function makeEconomyIndex(economy) {
  const contracts = economy.contracts || [];
  const groups = economy.contractGroups || [];
  return {
    contracts,
    groups,
    contractById: Object.fromEntries(contracts.map((c) => [c.id, c])),
    groupById: Object.fromEntries(groups.map((g) => [g.id, g])),
  };
}

export function groupForHouse(def, index) {
  const gid = def.contractGroup ?? 0;
  return index.groupById[gid] || index.groups[0];
}

export function computeHouseInfluence(house, buildings) {
  let scaled = 0;
  for (const b of buildings) {
    if (b.id === house.id) continue;
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
 * Customers = tenants of houses with an active/ready/waiting contract in radius.
 */
export function computeCommerceCustomers(shop, buildings) {
  const r = effectiveRadiusTiles(shop.def);
  if (r == null) return 0;
  let sum = 0;
  for (const b of buildings) {
    if (b.def.category !== "house") continue;
    const rt = b.runtime;
    if (!rt || rt.status === STATUS.IDLE || rt.status === STATUS.LOST) continue;
    if (!rt.tenants) continue;
    if (inRadius(shop, b, r)) sum += rt.tenants;
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
  return mr ? `${h}h ${mr}m` : `${h}h`;
}
