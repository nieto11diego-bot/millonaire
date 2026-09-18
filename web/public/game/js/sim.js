import {
  STATUS,
  TIME_SCALE,
  createRuntime,
  makeEconomyIndex,
  houseIncome,
  houseCollectXp,
  houseMaxPeople,
  houseRewardDurationMs,
  houseGrowthIntervalMs,
  computeHouseInfluence,
  computeCommerceInfluence,
  commerceCycleReward,
  commerceCollectXp,
  commerceRewardDurationMs,
  isConnectedToHQ,
  needsRoad,
  wonderGoldIntervalMs,
  wonderDiamondIntervalMs,
  wonderGoldReward,
  wonderDiamondReward,
  wonderGoldReady,
  wonderDiamondReady,
  wonderAnyReady,
  isConstructing,
  buildRemainingMs,
  instantBuildCashCost,
  completeConstructionRuntime,
  usesLootEconomy,
  accrueHouseLoot,
  countHousesInCommerceRadius,
} from "./economy.js";

/**
 * Simulation ticker for house loot + commerce income + wonder premiums.
 */
export class EconomySim {
  /**
   * @param {{ grid: import("./map/grid.js").Grid, roads?: object, graph?: object, economy: object, onEvent?: (type: string, payload: object) => void }} opts
   */
  constructor({ grid, roads = null, graph = null, economy, onEvent = () => {} }) {
    this.grid = grid;
    this.roads = roads;
    this.graph = graph;
    this.index = makeEconomyIndex(economy);
    this.onEvent = onEvent;
  }

  recomputeAll() {
    const now = Date.now();
    for (const b of this.grid.buildings) {
      if (!b.runtime) b.runtime = createRuntime(b.def);
      if (b.runtime.status === STATUS.BUILDING) continue;
      if (b.def.category === "house") {
        b.runtime.influence = computeHouseInfluence(b, this.grid.buildings);
        b.runtime.maxPeople = houseMaxPeople(b.def);
        b.runtime.growthIntervalMs = houseGrowthIntervalMs(b.def);
        if (b.runtime.people > b.runtime.maxPeople) b.runtime.people = b.runtime.maxPeople;

        if (usesLootEconomy(b.def)) {
          if (b.runtime.pendingLoot == null) b.runtime.pendingLoot = 0;
          if (b.runtime.lastLootUpdate == null) b.runtime.lastLootUpdate = now;
          const roadOk = !needsRoad(b.def) || isConnectedToHQ(b, this.roads, this.graph);
          if (roadOk) accrueHouseLoot(b, this.grid.buildings, now);
          else {
            b.runtime.status =
              (b.runtime.pendingLoot || 0) > 0 ? STATUS.READY : STATUS.WAITING;
          }
          b.runtime.lastIncome = Math.floor(b.runtime.pendingLoot || 0);
        } else if (b.runtime.status === STATUS.READY) {
          b.runtime.lastIncome = houseIncome(b.def, b.runtime.people, b.runtime.influence);
        }
      } else if (b.def.category === "commercial") {
        b.runtime.influence = computeCommerceInfluence(b, this.grid.buildings);
        b.runtime.houseCount = countHousesInCommerceRadius(b, this.grid.buildings);
        if (usesLootEconomy(b.def)) {
          if (b.runtime.pendingLoot == null) b.runtime.pendingLoot = 0;
          if (b.runtime.lastLootUpdate == null) b.runtime.lastLootUpdate = now;
          const roadOk = !needsRoad(b.def) || isConnectedToHQ(b, this.roads, this.graph);
          if (roadOk) accrueHouseLoot(b, this.grid.buildings, now);
          else {
            b.runtime.status =
              (b.runtime.pendingLoot || 0) > 0 ? STATUS.READY : STATUS.WAITING;
          }
          b.runtime.lastIncome = Math.floor(b.runtime.pendingLoot || 0);
        } else if (b.runtime.status === STATUS.READY) {
          b.runtime.lastIncome = commerceCycleReward(b.def, b.runtime.influence);
        }
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

      if (isConstructing(b)) {
        dirty = this._tickBuild(b) || dirty;
        continue;
      }

      const roadOk = !needsRoad(b.def) || isConnectedToHQ(b, this.roads, this.graph);

      if (b.def.category === "house") {
        dirty = this._tickHouse(b, step, roadOk) || dirty;
      } else if (b.def.category === "commercial") {
        dirty = this._tickCommerce(b, step, roadOk) || dirty;
      } else if (b.def.category === "wonder") {
        dirty = this._tickWonder(b, roadOk) || dirty;
      }
    }
    return dirty;
  }

  _tickBuild(b) {
    const rt = b.runtime;
    if (!rt || rt.status !== STATUS.BUILDING) return false;
    if (buildRemainingMs(rt) > 0) return false;
    this.finishBuild(b);
    return true;
  }

  /**
   * Complete construction (timer finished or paid instant finish).
   * @returns {{ ok: boolean, reason?: string }}
   */
  finishBuild(building) {
    const rt = building?.runtime;
    if (!rt || rt.status !== STATUS.BUILDING) return { ok: false, reason: "not_building" };
    completeConstructionRuntime(building.def, rt);
    this.onEvent("build_complete", { building });
    this.recomputeAll();
    return { ok: true };
  }

  /**
   * Cash cost to finish now (based on remaining time).
   */
  instantBuildCost(building) {
    if (!isConstructing(building)) return 0;
    const rt = building.runtime;
    return instantBuildCashCost(building.def, buildRemainingMs(rt), rt.buildDurationMs);
  }

  _tickHouse(b, step, roadOk) {
    const rt = b.runtime;
    if (!rt || rt.status === STATUS.BUILDING) return false;

    let dirty = false;

    // Progressive population growth toward capacity (missions / legacy UI).
    if ((rt.people || 0) < (rt.maxPeople || 0)) {
      if (!rt.growthIntervalMs) rt.growthIntervalMs = houseGrowthIntervalMs(b.def);
      if (rt.growthRemainingMs == null || rt.growthRemainingMs <= 0) {
        rt.growthRemainingMs = rt.growthIntervalMs;
      }
      rt.growthRemainingMs -= step;
      while (rt.growthRemainingMs <= 0 && rt.people < rt.maxPeople) {
        rt.people += 1;
        rt.growthRemainingMs += rt.growthIntervalMs;
        dirty = true;
      }
      if (rt.people >= rt.maxPeople) rt.growthRemainingMs = 0;
      if (dirty) this.recomputeAll();
    }

    if (usesLootEconomy(b.def)) {
      if (!roadOk) return dirty;
      const before = rt.pendingLoot || 0;
      const changed = accrueHouseLoot(b, this.grid.buildings, Date.now());
      if (changed && (rt.pendingLoot || 0) > before && before <= 0) {
        this.onEvent("rent_ready", { building: b });
      }
      return dirty || changed;
    }

    if (!roadOk) return dirty;

    if (rt.status === STATUS.WAITING) {
      rt.remainingMs -= step;
      if (rt.remainingMs <= 0) {
        rt.remainingMs = 0;
        rt.status = STATUS.READY;
        rt.influence = computeHouseInfluence(b, this.grid.buildings);
        rt.lastIncome = houseIncome(b.def, rt.people, rt.influence);
        this.onEvent("rent_ready", { building: b });
        dirty = true;
      }
    }
    return dirty;
  }

  _tickCommerce(b, step, roadOk) {
    const rt = b.runtime;
    if (!rt || rt.status === STATUS.BUILDING) return false;

    if (usesLootEconomy(b.def)) {
      if (!roadOk) return false;
      const before = rt.pendingLoot || 0;
      const changed = accrueHouseLoot(b, this.grid.buildings, Date.now());
      if (changed && (rt.pendingLoot || 0) > before && before <= 0) {
        this.onEvent("commerce_ready", { building: b });
      }
      return changed;
    }

    if (!roadOk) return false;
    if (rt.status === STATUS.READY) return false;

    if (rt.status !== STATUS.WAITING) {
      rt.status = STATUS.WAITING;
      rt.remainingMs = rt.durationMs || commerceRewardDurationMs(b.def);
    }

    rt.remainingMs -= step;
    if (rt.remainingMs <= 0) {
      rt.remainingMs = 0;
      rt.status = STATUS.READY;
      rt.influence = computeCommerceInfluence(b, this.grid.buildings);
      rt.lastIncome = commerceCycleReward(b.def, rt.influence);
      this.onEvent("commerce_ready", { building: b });
      return true;
    }
    return false;
  }

  _tickWonder(b, roadOk = true) {
    const rt = b.runtime;
    if (!rt || rt.status === STATUS.BUILDING) return false;
    if (!roadOk) return false;
    const now = Date.now();
    let dirty = false;
    if (!rt.goldNotified && wonderGoldReady(rt, now)) {
      rt.goldNotified = true;
      this.onEvent("wonder_gold_ready", { building: b });
      dirty = true;
    }
    if (!rt.diamondNotified && wonderDiamondReady(rt, now)) {
      rt.diamondNotified = true;
      this.onEvent("wonder_diamond_ready", { building: b });
      dirty = true;
    }
    return dirty;
  }

  /**
   * Collect accrued house loot (or legacy cycle rent).
   * @returns {{ ok: boolean, cash?: number, xp?: number, reason?: string }}
   */
  collectRent(building) {
    if (building.def.category !== "house") return { ok: false, reason: "no_house" };
    const rt = building.runtime;
    if (!rt) return { ok: false, reason: "not_ready" };

    if (usesLootEconomy(building.def)) {
      accrueHouseLoot(building, this.grid.buildings, Date.now());
      const cash = Math.floor(Number(rt.pendingLoot) || 0);
      if (cash <= 0) return { ok: false, reason: "not_ready" };

      rt.pendingLoot = 0;
      rt.lastLootUpdate = Date.now();
      rt.lastIncome = cash;
      rt.status = STATUS.WAITING;
      rt.influence = computeHouseInfluence(building, this.grid.buildings);

      this.recomputeAll();
      this.onEvent("rent_collected", {
        building,
        cash,
        xp: 0,
        people: rt.people,
      });
      return { ok: true, cash, xp: 0 };
    }

    if (rt.status !== STATUS.READY) return { ok: false, reason: "not_ready" };

    rt.influence = computeHouseInfluence(building, this.grid.buildings);
    const cash = houseIncome(building.def, rt.people, rt.influence);
    const xp = houseCollectXp(building.def, cash);

    const durationMs = houseRewardDurationMs(building.def);
    rt.status = STATUS.WAITING;
    rt.durationMs = durationMs;
    rt.remainingMs = durationMs;
    rt.lastIncome = cash;

    this.recomputeAll();
    this.onEvent("rent_collected", {
      building,
      cash,
      xp,
      people: rt.people,
    });
    return { ok: true, cash, xp };
  }

  /** Alias used by plan docs / tooling. */
  collectLoot(building) {
    return this.collectRent(building);
  }

  /**
   * @returns {{ ok: boolean, cash?: number, xp?: number, reason?: string }}
   */
  collectCommerce(building) {
    if (building.def.category !== "commercial") return { ok: false, reason: "no_shop" };
    const rt = building.runtime;
    if (!rt) return { ok: false, reason: "not_ready" };

    if (usesLootEconomy(building.def)) {
      accrueHouseLoot(building, this.grid.buildings, Date.now());
      const cash = Math.floor(Number(rt.pendingLoot) || 0);
      if (cash <= 0) return { ok: false, reason: "not_ready" };

      rt.pendingLoot = 0;
      rt.lastLootUpdate = Date.now();
      rt.lastIncome = cash;
      rt.status = STATUS.WAITING;
      rt.influence = computeCommerceInfluence(building, this.grid.buildings);

      this.recomputeAll();
      this.onEvent("commerce_collected", { building, cash, xp: 0 });
      return { ok: true, cash, xp: 0 };
    }

    if (rt.status !== STATUS.READY) return { ok: false, reason: "not_ready" };

    rt.influence = computeCommerceInfluence(building, this.grid.buildings);
    const cash = commerceCycleReward(building.def, rt.influence);
    const xp = commerceCollectXp(building.def, cash);
    const durationMs = commerceRewardDurationMs(building.def);
    rt.lastIncome = cash;
    rt.status = STATUS.WAITING;
    rt.durationMs = durationMs;
    rt.remainingMs = durationMs;

    this.recomputeAll();
    this.onEvent("commerce_collected", { building, cash, xp });
    return { ok: true, cash, xp };
  }

  /**
   * Collect ready gold / diamonds from a wonder (whichever timers finished).
   * @returns {{ ok: boolean, gold?: number, diamonds?: number, reason?: string }}
   */
  collectWonder(building) {
    if (building.def.category !== "wonder") return { ok: false, reason: "no_wonder" };
    if (!building.runtime) building.runtime = createRuntime(building.def);
    const rt = building.runtime;
    const now = Date.now();
    if (!wonderAnyReady(rt, now)) return { ok: false, reason: "not_ready" };

    let gold = 0;
    let diamonds = 0;
    if (wonderGoldReady(rt, now)) {
      gold = wonderGoldReward(building.def);
      rt.lastGold = gold;
      rt.goldReadyAt = now + wonderGoldIntervalMs(building.def);
      rt.goldNotified = false;
    }
    if (wonderDiamondReady(rt, now)) {
      diamonds = wonderDiamondReward(building.def);
      rt.lastDiamond = diamonds;
      rt.diamondReadyAt = now + wonderDiamondIntervalMs(building.def);
      rt.diamondNotified = false;
    }

    this.onEvent("wonder_collected", { building, gold, diamonds });
    return { ok: true, gold, diamonds };
  }

  /**
   * Resolve tap on a building → action hint for UI.
   * @returns {"collect_rent"|"collect_commerce"|"collect_wonder"|"finish_build"|"noop"}
   */
  tapAction(building) {
    if (!building?.runtime) return "noop";
    if (isConstructing(building)) return "finish_build";
    const cat = building.def.category;
    const st = building.runtime.status;
    if (cat === "house") {
      if (usesLootEconomy(building.def)) {
        if ((building.runtime.pendingLoot || 0) > 0) return "collect_rent";
        return "noop";
      }
      if (st === STATUS.READY) return "collect_rent";
      return "noop";
    }
    if (cat === "commercial") {
      if (usesLootEconomy(building.def)) {
        if ((building.runtime.pendingLoot || 0) > 0) return "collect_commerce";
        return "noop";
      }
      if (st === STATUS.READY) return "collect_commerce";
      return "noop";
    }
    if (cat === "wonder") {
      if (wonderAnyReady(building.runtime)) return "collect_wonder";
      return "noop";
    }
    return "noop";
  }
}
