import {
  STATUS,
  TIME_SCALE,
  LOST_RENT_GRACE_FACTOR,
  createRuntime,
  makeEconomyIndex,
  groupForHouse,
  contractCost,
  contractIncome,
  contractTenants,
  contractDurationMs,
  commercePayout,
  computeHouseInfluence,
  computeCommerceCustomers,
  isRoadConnected,
  needsRoad,
} from "./economy.js";

/**
 * Simulation ticker for house rent + commerce income.
 */
export class EconomySim {
  /**
   * @param {{ grid: import("./map/grid.js").Grid, roads?: object, economy: object, onEvent?: (type: string, payload: object) => void }} opts
   */
  constructor({ grid, roads = null, economy, onEvent = () => {} }) {
    this.grid = grid;
    this.roads = roads;
    this.index = makeEconomyIndex(economy);
    this.onEvent = onEvent;
  }

  recomputeAll() {
    for (const b of this.grid.buildings) {
      if (!b.runtime) b.runtime = createRuntime(b.def);
      if (b.def.category === "house") {
        b.runtime.influence = computeHouseInfluence(b, this.grid.buildings);
      }
    }
    for (const b of this.grid.buildings) {
      if (b.def.category === "commercial") {
        b.runtime.customers = computeCommerceCustomers(b, this.grid.buildings);
      }
    }
  }

  /**
   * @param {number} dtMs wall-clock delta
   */
  update(dtMs) {
    const step = Math.min(dtMs, 1000) * TIME_SCALE;
    let dirty = false;

    for (const b of this.grid.buildings) {
      if (!b.runtime) continue;
      const roadOk = !needsRoad(b.def) || isRoadConnected(b, this.roads);

      if (b.def.category === "house") {
        dirty = this._tickHouse(b, step, roadOk) || dirty;
      } else if (b.def.category === "commercial") {
        dirty = this._tickCommerce(b, step, roadOk) || dirty;
      }
    }
    return dirty;
  }

  _tickHouse(b, step, roadOk) {
    const rt = b.runtime;
    if (rt.status !== STATUS.WAITING && rt.status !== STATUS.READY) return false;
    if (!roadOk) return false;

    if (rt.status === STATUS.WAITING) {
      rt.remainingMs -= step;
      if (rt.remainingMs <= 0) {
        rt.remainingMs = 0;
        rt.status = STATUS.READY;
        // Grace period before lost rent
        rt.remainingMs = rt.durationMs * LOST_RENT_GRACE_FACTOR;
        this.onEvent("rent_ready", { building: b });
        return true;
      }
    } else if (rt.status === STATUS.READY) {
      rt.remainingMs -= step;
      if (rt.remainingMs <= 0) {
        rt.status = STATUS.LOST;
        rt.remainingMs = 0;
        rt.contractId = null;
        rt.tenants = 0;
        this.onEvent("rent_lost", { building: b });
        this.recomputeAll();
        return true;
      }
    }
    return false;
  }

  _tickCommerce(b, step, roadOk) {
    const rt = b.runtime;
    if (!roadOk) return false;
    if (rt.status === STATUS.READY) return false;

    if (rt.status !== STATUS.WAITING) {
      rt.status = STATUS.WAITING;
      rt.remainingMs = rt.durationMs || (b.def.incomeTimeSec || 180) * 1000;
    }

    // No customers → timer still runs but payout will be 0; keep ticking for feedback.
    rt.remainingMs -= step;
    if (rt.remainingMs <= 0) {
      rt.remainingMs = 0;
      rt.status = STATUS.READY;
      rt.customers = computeCommerceCustomers(b, this.grid.buildings);
      rt.lastPayout = commercePayout(b.def, rt.customers);
      this.onEvent("commerce_ready", { building: b });
      return true;
    }
    return false;
  }

  /**
   * Preview all contracts for a house.
   */
  previewContracts(building) {
    const group = groupForHouse(building.def, this.index);
    const infl = building.runtime?.influence ?? 0;
    return this.index.contracts.map((c) => ({
      contract: c,
      group,
      cost: contractCost(c, group),
      income: contractIncome(c, group, infl),
      tenants: contractTenants(group),
      xp: c.xp,
      durationMs: contractDurationMs(c),
      influence: infl,
    }));
  }

  canSign(building) {
    if (building.def.category !== "house") return false;
    if (!building.runtime) return false;
    const st = building.runtime.status;
    if (st !== STATUS.IDLE && st !== STATUS.LOST) return false;
    if (needsRoad(building.def) && !isRoadConnected(building, this.roads)) return false;
    return true;
  }

  /**
   * @returns {{ ok: boolean, reason?: string, cost?: number, xp?: number }}
   */
  signContract(building, contractId, cash) {
    if (building.def.category !== "house") return { ok: false, reason: "no_house" };
    if (!building.runtime) building.runtime = createRuntime(building.def);
    const rt = building.runtime;
    if (rt.status !== STATUS.IDLE && rt.status !== STATUS.LOST) {
      return { ok: false, reason: "busy" };
    }
    if (needsRoad(building.def) && !isRoadConnected(building, this.roads)) {
      return { ok: false, reason: "no_road" };
    }
    const contract = this.index.contractById[contractId];
    if (!contract) return { ok: false, reason: "bad_contract" };
    const group = groupForHouse(building.def, this.index);
    const cost = contractCost(contract, group);
    if (cash < cost) return { ok: false, reason: "no_cash", cost };

    rt.influence = computeHouseInfluence(building, this.grid.buildings);
    const income = contractIncome(contract, group, rt.influence);
    const tenants = contractTenants(group);
    const durationMs = contractDurationMs(contract);

    rt.status = STATUS.WAITING;
    rt.contractId = contract.id;
    rt.durationMs = durationMs;
    rt.remainingMs = durationMs;
    rt.tenants = tenants;
    rt.lastIncome = income;

    this.recomputeAll();
    this.onEvent("contract_signed", { building, contract, cost, xp: contract.xp, income, tenants });
    return { ok: true, cost, xp: contract.xp, income, tenants };
  }

  /**
   * @returns {{ ok: boolean, cash?: number, xp?: number, reason?: string }}
   */
  collectRent(building) {
    if (building.def.category !== "house") return { ok: false, reason: "no_house" };
    const rt = building.runtime;
    if (!rt || rt.status !== STATUS.READY) return { ok: false, reason: "not_ready" };

    const cash = rt.lastIncome || 0;
    const contract = this.index.contractById[rt.contractId];
    const xp = contract?.xp || 0;

    rt.status = STATUS.IDLE;
    rt.contractId = null;
    rt.remainingMs = 0;
    rt.durationMs = 0;
    rt.tenants = 0;
    rt.lastIncome = 0;

    this.recomputeAll();
    this.onEvent("rent_collected", { building, cash, xp });
    return { ok: true, cash, xp };
  }

  /**
   * Clear lost state so player can sign again.
   */
  clearLost(building) {
    if (!building.runtime || building.runtime.status !== STATUS.LOST) return false;
    building.runtime.status = STATUS.IDLE;
    building.runtime.contractId = null;
    building.runtime.tenants = 0;
    return true;
  }

  collectCommerce(building) {
    if (building.def.category !== "commercial") return { ok: false, reason: "no_shop" };
    const rt = building.runtime;
    if (!rt || rt.status !== STATUS.READY) return { ok: false, reason: "not_ready" };

    rt.customers = computeCommerceCustomers(building, this.grid.buildings);
    const cash = commercePayout(building.def, rt.customers);
    rt.lastPayout = cash;
    rt.status = STATUS.WAITING;
    rt.durationMs = (building.def.incomeTimeSec || 180) * 1000;
    rt.remainingMs = rt.durationMs;

    this.onEvent("commerce_collected", { building, cash, customers: rt.customers });
    return { ok: true, cash, customers: rt.customers };
  }

  /**
   * Resolve tap on a building → action hint for UI.
   * @returns {"open_contracts"|"collect_rent"|"clear_lost"|"collect_commerce"|"noop"}
   */
  tapAction(building) {
    if (!building?.runtime) return "noop";
    const cat = building.def.category;
    const st = building.runtime.status;
    if (cat === "house") {
      if (st === STATUS.READY) return "collect_rent";
      if (st === STATUS.LOST) return "clear_lost";
      if (st === STATUS.IDLE) return "open_contracts";
      return "noop"; // waiting
    }
    if (cat === "commercial") {
      if (st === STATUS.READY) return "collect_commerce";
      return "noop";
    }
    return "noop";
  }
}
