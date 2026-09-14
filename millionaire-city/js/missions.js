/**
 * Mission progress tracker — ports MissionScreen / MissionObject from the original game.
 */

export const STATE = {
  OPEN: "open",
  LOCKED: "locked",
  COMPLETED: "completed",
  COLLECTED: "collected",
};

/** objectId → mission sku(s) to improve when that building is bought (MissionScreen.buildingBought). */
const BUILD_TRIGGERS = {
  2: [7],
  3: [13],
  5: [14],
  13: [16],
  15: [15],
  17: [2],
  18: [8],
  27: [10],
  28: [10],
  29: [10],
  31: [10],
  32: [10],
  30: [11],
  33: [12],
  34: [17],
  35: [17],
  36: [17],
  152: [17],
  160: [17],
};

const COMMERCE_UNIQUE_IDS = new Set([17, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
const WONDER_UNIQUE_IDS = new Set([34, 35, 36, 152, 160]);
const COMMERCE_UNIQUE_TARGET = 5;
const WONDER_UNIQUE_TARGET = 3;

/** Cash / company-value style missions (amount counter flips to 1 when condition met). */
const VALUE_SKUS = new Set([37, 35, 38, 39, 40]);

export class MissionTracker {
  /**
   * @param {object[]} missions from missions.json
   * @param {{ level: number }} user
   * @param {{ strings?: Record<string, Record<string, string>> }} [i18n]
   * @param {string} [lang]
   */
  constructor(missions, user, i18n = null, lang = "es") {
    this.user = user;
    this.i18n = i18n;
    this.lang = lang;
    this.missions = missions.map((m) => ({ ...m }));
    this.bySku = new Map(this.missions.map((m) => [m.sku, m]));
    this.counted = Object.fromEntries(this.missions.map((m) => [m.sku, 0]));
    this.completed = Object.fromEntries(this.missions.map((m) => [m.sku, false]));
    this.collected = Object.fromEntries(this.missions.map((m) => [m.sku, false]));
    this.uniqueCommerces = [];
    this.uniqueWonders = [];
    this._listeners = [];
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _emit() {
    for (const fn of this._listeners) fn();
  }

  t(tid, fallback = "") {
    if (tid == null || !this.i18n?.strings) return fallback;
    const row = this.i18n.strings[String(tid)];
    if (!row) return fallback;
    return row[this.lang] || row.en || fallback;
  }

  replaceParams(template, ...values) {
    if (!template) return "";
    let out = template;
    if (values.length === 1) {
      out = out.replace(/%U/g, String(values[0]));
    } else {
      values.forEach((v, i) => {
        out = out.replace(new RegExp(`%${i}U`, "g"), String(v));
      });
    }
    return out;
  }

  titleOf(mission) {
    return this.t(mission.titleTid, mission.title);
  }

  descriptionOf(mission) {
    return this.t(mission.descriptionTid, mission.description);
  }

  unlockTextOf(mission) {
    const needLevel = (mission.unlockLevel || 1) > 1;
    const prior = mission.unlockSku != null ? this.bySku.get(mission.unlockSku) : null;
    if (needLevel && prior) {
      return this.replaceParams(
        this.t(161, "Tienes que haber desbloqueado la misión '%0U' y estar en el nivel %1U para iniciar esta misión."),
        this.titleOf(prior),
        mission.unlockLevel
      );
    }
    if (needLevel) {
      return this.replaceParams(
        this.t(160, "Tienes que estar en el nivel %U para iniciar esta misión."),
        mission.unlockLevel
      );
    }
    if (prior) {
      return this.replaceParams(
        this.t(159, "Tienes que haber completado la misión '%U' para iniciarla."),
        this.titleOf(prior)
      );
    }
    return "";
  }

  targetAmount(mission) {
    return mission.target?.amount ?? 1;
  }

  isUnlocked(sku) {
    const m = this.bySku.get(sku);
    if (!m) return false;
    if ((m.unlockLevel || 1) > this.user.level) return false;
    if (m.unlockSku != null && !this.isCompleted(m.unlockSku)) return false;
    return true;
  }

  isCompleted(sku) {
    const m = this.bySku.get(sku);
    if (!m) return false;
    if (this.completed[sku]) return true;
    return this.counted[sku] >= this.targetAmount(m);
  }

  isCollected(sku) {
    return !!this.collected[sku];
  }

  stateOf(sku) {
    if (this.isCollected(sku)) return STATE.COLLECTED;
    if (this.isCompleted(sku)) return STATE.COMPLETED;
    if (this.isUnlocked(sku)) return STATE.OPEN;
    return STATE.LOCKED;
  }

  improve(sku) {
    if (!this.bySku.has(sku) || this.isCompleted(sku) || !this.isUnlocked(sku)) return false;
    this.counted[sku] += 1;
    if (this.isCompleted(sku)) {
      this.completed[sku] = true;
      this._onMissionCompleted(sku);
      this._emit();
      return true;
    }
    this._emit();
    return false;
  }

  setAmount(sku, n) {
    if (!this.bySku.has(sku) || this.isCompleted(sku) || !this.isUnlocked(sku)) return false;
    this.counted[sku] = n;
    if (this.isCompleted(sku)) {
      this.completed[sku] = true;
      this._onMissionCompleted(sku);
      this._emit();
      return true;
    }
    this._emit();
    return false;
  }

  _onMissionCompleted(sku) {
    for (const m of this.missions) {
      if (this.isCompleted(m.sku) || this.isCollected(m.sku)) continue;
      if (m.unlockSku === sku && (m.unlockLevel || 1) <= this.user.level) {
        // newly opened — state derived from unlock checks
      }
    }
  }

  onLevelUp() {
    this._emit();
  }

  /**
   * Collect reward cash for a completed mission. Returns reward amount or 0.
   * @param {number} sku
   */
  collect(sku) {
    if (!this.isCompleted(sku) || this.isCollected(sku)) return 0;
    const m = this.bySku.get(sku);
    this.collected[sku] = true;
    this.completed[sku] = true;
    this._emit();
    return m?.rewardCash || 0;
  }

  /**
   * Called after a building is placed. Mirrors MissionScreen.buildingBought.
   * @param {{ objectId?: number, category?: string }} def
   */
  onBuildingBought(def) {
    const oid = def?.objectId;
    if (oid == null) return;

    const skus = BUILD_TRIGGERS[oid];
    if (skus) {
      for (const sku of skus) this.improve(sku);
    }

    if (COMMERCE_UNIQUE_IDS.has(oid)) {
      this._noteUniqueCommerce(oid);
    }
    if (WONDER_UNIQUE_IDS.has(oid)) {
      this._noteUniqueWonder(oid);
    }
  }

  _noteUniqueCommerce(oid) {
    // Original also tracked sku 9 (diversify) which is absent from this build's DATA.
    if (this.uniqueCommerces.includes(oid)) return;
    if (this.uniqueCommerces.length >= COMMERCE_UNIQUE_TARGET) return;
    this.uniqueCommerces.push(oid);
  }

  _noteUniqueWonder(oid) {
    if (this.uniqueWonders.includes(oid)) return;
    if (this.uniqueWonders.length >= WONDER_UNIQUE_TARGET) return;
    this.uniqueWonders.push(oid);
    if (this.uniqueWonders.length >= WONDER_UNIQUE_TARGET) {
      this.improve(36);
    }
  }

  /**
   * Re-evaluate cash / company-value missions.
   * @param {number} cash
   * @param {number} companyValue sum of placed building costs
   */
  syncValueMissions(cash, companyValue) {
    const pairs = [
      [37, cash],
      [35, cash],
      [38, companyValue],
      [39, companyValue],
      [40, companyValue],
    ];
    let changed = false;
    for (const [sku, value] of pairs) {
      const m = this.bySku.get(sku);
      if (!m || this.isCompleted(sku) || !this.isUnlocked(sku)) continue;
      const need = m.target?.condition ?? 0;
      if (need > 0 && value >= need) {
        if (this.improve(sku)) changed = true;
      }
    }
    if (changed) this._emit();
  }

  /**
   * Ordered list for UI: completed (uncollected) → open → locked. Collected omitted.
   */
  list() {
    const completed = [];
    const open = [];
    const locked = [];
    for (const m of this.missions) {
      const state = this.stateOf(m.sku);
      if (state === STATE.COLLECTED) continue;
      const card = this._card(m, state);
      if (state === STATE.COMPLETED) completed.push(card);
      else if (state === STATE.OPEN) open.push(card);
      else locked.push(card);
    }
    return [...completed, ...open, ...locked];
  }

  _card(m, state) {
    const target = this.targetAmount(m);
    const progress = Math.min(this.counted[m.sku], target);
    return {
      sku: m.sku,
      type: m.type,
      state,
      title: this.titleOf(m),
      description: this.descriptionOf(m),
      unlockText: this.unlockTextOf(m),
      rewardCash: m.rewardCash,
      unlockLevel: m.unlockLevel,
      progress,
      target,
      metric: m.target?.metric,
      condition: m.target?.condition,
      trackable: isTrackableNow(m),
    };
  }

  claimableCount() {
    return this.missions.filter((m) => this.stateOf(m.sku) === STATE.COMPLETED).length;
  }
}

/** Metrics the prototype can advance today (placement + cash/company value). */
function isTrackableNow(m) {
  const metric = m.target?.metric;
  if (metric === "buildings_built" || metric === "wonders_owned") return true;
  if (metric === "company_value") return true;
  if (VALUE_SKUS.has(m.sku)) return true;
  return false;
}

export function companyValueFromGrid(grid) {
  let sum = 0;
  for (const b of grid.buildings || []) {
    sum += b.def?.costCoins || 0;
  }
  return sum;
}
