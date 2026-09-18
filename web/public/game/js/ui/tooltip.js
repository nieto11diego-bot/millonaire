/**
 * Hover popup for houses and wonders (Millionaire City style).
 */
import {
  STATUS,
  TIME_SCALE,
  formatDuration,
  houseIncome,
  houseCollectXp,
  houseMaxPeople,
  houseRewardDurationMs,
  commerceCycleReward,
  commerceCollectXp,
  commerceRewardDurationMs,
  wonderGoldRemainingMs,
  wonderDiamondRemainingMs,
  wonderGoldReady,
  wonderDiamondReady,
  wonderGoldReward,
  wonderDiamondReward,
  isConstructing,
  buildRemainingMs,
  buildProgressPct,
  buildDurationMs,
  buildPlaceXp,
  instantBuildCashCost,
  needsRoad,
  usesLootEconomy,
  getBuildingProductionPerMinute,
  getBuildingDecorationBonus,
  getBuildingFinalProduction,
  maxLootOf,
  effectiveMaxLoot,
  commerceHouseBonusPercent,
} from "../economy.js";
import {
  CASH_ICON,
  GOLD_ICON,
  DIAMOND_ICON,
  formatCash,
  formatGold,
  formatDiamonds,
  cashHtml,
} from "./money.js";

const ICONS = {
  timer: "assets/ui/icon_timer.png",
  xp: "assets/ui/icon_xp.png",
  cash: CASH_ICON,
  gold: GOLD_ICON,
  diamond: DIAMOND_ICON,
  people: "assets/ui/icon_people.png",
};

export class BuildingTooltip {
  /**
   * @param {HTMLElement} root
   * @param {{
   *   t?: (tid: number, fb: string) => string,
   *   onInstantBuild?: (building: object) => void,
   *   isRoadOk?: (building: object) => boolean,
   * }} [options]
   */
  constructor(root, options = {}) {
    this.root = root;
    this.t = options.t || ((_tid, fb) => fb);
    this.onInstantBuild = options.onInstantBuild || null;
    this.isRoadOk = options.isRoadOk || (() => true);
    this.building = null;
    /** @type {object|null} catalog def preview */
    this.catalogDef = null;
    this._raf = 0;
    this._key = "";
    /** Pointer is over the interactive tip (construction finish button). */
    this.pointerInside = false;
    this._hideTimer = 0;

    root.classList.add("bldg-tip");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");

    root.addEventListener("pointerenter", () => {
      this.pointerInside = true;
      if (this._hideTimer) {
        clearTimeout(this._hideTimer);
        this._hideTimer = 0;
      }
    });
    root.addEventListener("pointerleave", () => {
      this.pointerInside = false;
      this.scheduleHide(180);
    });
    root.addEventListener("click", (e) => {
      const confirmBtn = e.target.closest("[data-instant-build]");
      const cancelBtn = e.target.closest("[data-build-cancel]");
      if (cancelBtn) {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
        return;
      }
      if (!confirmBtn || !this.building || !this.onInstantBuild) return;
      e.preventDefault();
      e.stopPropagation();
      this.onInstantBuild(this.building);
    });
  }

  /**
   * @param {object|null} building
   * @param {{ left: number, top: number }} screenPos CSS px relative to stage
   */
  show(building, screenPos) {
    this.catalogDef = null;
    this.root.classList.remove("shop-side");
    if (
      !building ||
      (building.def.category !== "house" &&
        building.def.category !== "commercial" &&
        building.def.category !== "wonder")
    ) {
      this.hide();
      return;
    }
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = 0;
    }
    if (this.building !== building) this._key = "";
    this.building = building;
    this.root.hidden = false;
    this.root.setAttribute("aria-hidden", "false");
    this.root.classList.add("visible");
    this.root.classList.toggle("interactive", isConstructing(building));
    this._position(screenPos);
    this.render();
  }

  /**
   * Shop catalog preview (def only, no runtime).
   * @param {object|null} def
   * @param {{ left: number, top: number }} screenPos
   */
  showCatalog(def, screenPos) {
    this.building = null;
    this.pointerInside = false;
    this.root.classList.remove("interactive");
    if (
      !def ||
      (def.category !== "house" && def.category !== "commercial" && def.category !== "wonder")
    ) {
      this.hide();
      return;
    }
    if (this.catalogDef !== def) this._key = "";
    this.catalogDef = def;
    this.root.classList.add("shop-side");
    this.root.hidden = false;
    this.root.setAttribute("aria-hidden", "false");
    this.root.classList.add("visible");
    this.renderCatalog();
    this._position(screenPos);
  }

  update(screenPos) {
    if ((!this.building && !this.catalogDef) || this.root.hidden) return;
    this._position(screenPos);
    if (!this._raf) {
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        if (this.root.hidden) return;
        if (this.catalogDef) this.renderCatalog();
        else if (this.building) this.render();
      });
    }
  }

  scheduleHide(delayMs = 120) {
    if (this.pointerInside) return;
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => {
      this._hideTimer = 0;
      if (!this.pointerInside) this.hide();
    }, delayMs);
  }

  hide() {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = 0;
    }
    this.building = null;
    this.catalogDef = null;
    this.pointerInside = false;
    this._key = "";
    this.root.classList.remove("visible", "shop-side", "interactive");
    this.root.hidden = true;
    this.root.setAttribute("aria-hidden", "true");
  }

  _position(pos) {
    if (!pos) return;
    let left = pos.left;
    let top = pos.top;
    // Keep shop-side tips inside the stage so tall commerce cards stay readable.
    if (this.root.classList.contains("shop-side")) {
      const stage = this.root.parentElement;
      const sh = stage ? stage.clientHeight : window.innerHeight;
      const tipH = this.root.offsetHeight || 220;
      const half = tipH / 2;
      const pad = 8;
      top = Math.max(half + pad, Math.min(top, sh - half - pad));
      left = Math.max(pad, left);
    }
    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(top)}px`;
  }

  _model() {
    const def = this.building.def;
    const rt = this.building.runtime || {};
    const isHouse = def.category === "house";
    const isShop = def.category === "commercial";
    const roadOk = !needsRoad(def) || this.isRoadOk(this.building);

    const name = def.name || "Edificio";
    let peopleLabel = isHouse ? "Población" : "Ciclo";

    let timeText = "—";
    let progressPct = 0;
    let showTimer = false;
    let xpText = "0";
    let cashText = "0";
    let peopleText = "0";
    let statusNote = "";
    let constructing = false;
    let instantCost = 0;

    if (isConstructing(rt)) {
      constructing = true;
      showTimer = true;
      const left = buildRemainingMs(rt);
      timeText = formatTipTime(left);
      progressPct = buildProgressPct(rt);
      instantCost = instantBuildCashCost(def, left, rt.buildDurationMs);
      statusNote = "En construcción";
      return {
        kind: isHouse ? "house" : isShop ? "shop" : "wonder",
        showTimer,
        timeText,
        progressPct,
        xpText,
        cashText,
        peopleText,
        peopleLabel,
        statusNote,
        name,
        constructing,
        instantCost,
      };
    }

    if (!roadOk) statusNote = "Sin conexión al Headquarters";

    if (isHouse) {
      if (usesLootEconomy(def)) {
        const pending = Math.floor(rt.pendingLoot || 0);
        const cap = effectiveMaxLoot(this.building);
        const bonusFrac = getBuildingDecorationBonus(this.building);
        const bonusPct = Math.round(bonusFrac * 1000) / 10;
        const basePerMin = getBuildingProductionPerMinute(def);
        const finalPerMin = getBuildingFinalProduction(this.building);
        cashText = String(pending);
        xpText = String(buildPlaceXp(def));
        peopleLabel = "Botín";
        peopleText = `${pending.toLocaleString("en-US")} / ${cap.toLocaleString("en-US")}`;
        if (roadOk && pending > 0) {
          showTimer = true;
          timeText = "¡Listo!";
          progressPct = Math.min(100, Math.round((pending / Math.max(1, cap)) * 100));
          statusNote = "Toca para cobrar";
        } else if (roadOk) {
          showTimer = true;
          const intervalMs = Math.max(1, (def.lootInterval || 60) * 1000);
          const last = rt.lastLootUpdate || Date.now();
          const elapsed = Math.max(0, Date.now() - last);
          const left = Math.max(0, intervalMs - elapsed);
          timeText = formatTipTime(left);
          // Match map bar: fill grows as the next loot tick approaches
          progressPct = Math.max(0, Math.min(100, (elapsed / intervalMs) * 100));
          statusNote = `$${Math.round(finalPerMin * 10) / 10}/min`;
        }
        return {
          kind: "house",
          loot: true,
          showTimer,
          timeText,
          progressPct,
          xpText,
          cashText,
          peopleText,
          peopleLabel,
          statusNote,
          bonusPct,
          basePerMin: Math.round(basePerMin * 10) / 10,
          finalPerMin: Math.round(finalPerMin * 10) / 10,
          pendingLoot: pending,
          maxLoot: cap,
          name,
          constructing,
          instantCost,
        };
      }

      const people = rt.people || 0;
      const maxPeople = rt.maxPeople || houseMaxPeople(def);
      peopleText = `${people}/${maxPeople}`;
      const infl = rt.influence || 0;
      const bonusPct = Math.round((infl / 100) * 10) / 10;
      const projected = houseIncome(def, people, infl);
      cashText = String(rt.status === STATUS.READY ? rt.lastIncome || projected : projected);
      xpText = String(houseCollectXp(def, Number(cashText) || 0));
      if (roadOk && rt.status === STATUS.WAITING && rt.durationMs > 0) {
        showTimer = true;
        timeText = formatTipTime(rt.remainingMs / TIME_SCALE);
        progressPct = Math.max(0, Math.min(100, (1 - rt.remainingMs / rt.durationMs) * 100));
        if (people < maxPeople) statusNote = "Población en crecimiento";
      } else if (roadOk && rt.status === STATUS.READY) {
        showTimer = true;
        timeText = "¡Listo!";
        progressPct = 100;
        statusNote = "Toca para cobrar";
      }
      return {
        kind: "house",
        showTimer,
        timeText,
        progressPct,
        xpText,
        cashText,
        peopleText,
        peopleLabel,
        statusNote,
        bonusPct,
        name,
        constructing,
        instantCost,
      };
    } else if (isShop) {
      if (usesLootEconomy(def)) {
        const pending = Math.floor(rt.pendingLoot || 0);
        const cap = effectiveMaxLoot(this.building);
        const bonusFrac = getBuildingDecorationBonus(this.building);
        const bonusPct = Math.round(bonusFrac * 1000) / 10;
        const basePerMin = getBuildingProductionPerMinute(def);
        const finalPerMin = getBuildingFinalProduction(this.building);
        const houseCount = rt.houseCount ?? 0;
        cashText = String(pending);
        xpText = String(buildPlaceXp(def));
        peopleLabel = "Botín";
        peopleText = `${pending.toLocaleString("en-US")} / ${cap.toLocaleString("en-US")}`;
        if (roadOk && pending > 0) {
          showTimer = true;
          timeText = "¡Listo!";
          progressPct = Math.min(100, Math.round((pending / Math.max(1, cap)) * 100));
          statusNote = "Toca para cobrar";
        } else if (roadOk) {
          showTimer = true;
          const intervalMs = Math.max(1, (def.lootInterval || 60) * 1000);
          const last = rt.lastLootUpdate || Date.now();
          const elapsed = Math.max(0, Date.now() - last);
          const left = Math.max(0, intervalMs - elapsed);
          timeText = formatTipTime(left);
          progressPct = Math.max(0, Math.min(100, (elapsed / intervalMs) * 100));
          statusNote = `$${Math.round(finalPerMin * 10) / 10}/min · ${houseCount} casa${houseCount === 1 ? "" : "s"}`;
        }
        return {
          kind: "shop",
          loot: true,
          showTimer,
          timeText,
          progressPct,
          xpText,
          cashText,
          peopleText,
          peopleLabel,
          statusNote,
          bonusPct,
          basePerMin: Math.round(basePerMin * 10) / 10,
          finalPerMin: Math.round(finalPerMin * 10) / 10,
          pendingLoot: pending,
          maxLoot: cap,
          houseCount,
          name,
          constructing,
          instantCost,
        };
      }

      const projected = commerceCycleReward(def, rt.influence || 0);
      cashText = String(rt.status === STATUS.READY ? rt.lastIncome || projected : projected);
      xpText = String(commerceCollectXp(def, Number(cashText) || 0));
      peopleText = formatDuration(commerceRewardDurationMs(def));
      const infl = rt.influence || 0;
      const bonusPct = Math.round((infl / 100) * 10) / 10;
      if (roadOk && rt.status === STATUS.WAITING && rt.durationMs > 0) {
        showTimer = true;
        timeText = formatTipTime(rt.remainingMs / TIME_SCALE);
        progressPct = Math.max(0, Math.min(100, (1 - rt.remainingMs / rt.durationMs) * 100));
      } else if (roadOk && rt.status === STATUS.READY) {
        showTimer = true;
        timeText = "¡Listo!";
        progressPct = 100;
        statusNote = "Toca para cobrar";
      }
      return {
        kind: "shop",
        showTimer,
        timeText,
        progressPct,
        xpText,
        cashText,
        peopleText,
        peopleLabel,
        statusNote,
        bonusPct,
        name,
        constructing,
        instantCost,
      };
    }

    return {
      kind: "other",
      showTimer,
      timeText,
      progressPct,
      xpText,
      cashText,
      peopleText,
      peopleLabel,
      statusNote,
      bonusPct: 0,
      name,
      constructing,
      instantCost,
    };
  }

  _wonderModel() {
    const def = this.building.def;
    const rt = this.building.runtime || {};
    const name = def.name || "Maravilla";

    if (isConstructing(rt)) {
      const left = buildRemainingMs(rt);
      return {
        kind: "wonder",
        name,
        constructing: true,
        showTimer: true,
        timeText: formatTipTime(left),
        progressPct: buildProgressPct(rt),
        instantCost: instantBuildCashCost(def, left, rt.buildDurationMs),
        statusNote: "En construcción",
        goldReady: false,
        diaReady: false,
        goldText: "—",
        diaText: "—",
        goldAmt: "0",
        diaAmt: "0",
        bonusPct: "0",
      };
    }

    const roadOk = !needsRoad(def) || this.isRoadOk(this.building);
    const goldReady = roadOk && wonderGoldReady(rt);
    const diaReady = roadOk && wonderDiamondReady(rt);
    const goldLeft = wonderGoldRemainingMs(rt);
    const diaLeft = wonderDiamondRemainingMs(rt);
    const goldAmt = wonderGoldReward(def);
    const diaAmt = wonderDiamondReward(def);
    const bonusPct =
      def.rewardBonusPercentApprox != null
        ? def.rewardBonusPercentApprox
        : def.rewardBonusScaled != null
          ? Math.round((def.rewardBonusScaled / 100) * 100) / 100
          : 0;
    let statusNote = "";
    if (!roadOk) statusNote = "Sin conexión al Headquarters";
    else if (goldReady || diaReady) statusNote = "Toca para cobrar";
    return {
      kind: "wonder",
      name,
      constructing: false,
      showTimer: false,
      timeText: "",
      progressPct: 0,
      instantCost: 0,
      goldReady,
      diaReady,
      goldText: goldReady ? "¡Listo!" : formatTipTime(goldLeft),
      diaText: diaReady ? "¡Listo!" : formatTipTime(diaLeft),
      goldAmt: String(goldAmt),
      diaAmt: String(diaAmt),
      bonusPct: String(bonusPct),
      statusNote,
    };
  }

  renderCatalog() {
    const def = this.catalogDef;
    if (!def) return;
    const isHouse = def.category === "house";
    const name = def.name || "Edificio";
    const isDiamond = (def.costDiamonds || 0) > 0;
    const isGold = !isDiamond && (def.costFortune || 0) > 0;
    const cost = isDiamond
      ? formatDiamonds(def.costDiamonds)
      : isGold
        ? formatGold(def.costFortune)
        : formatCash(def.costCoins || 0);
    const costIcon = isDiamond ? ICONS.diamond : isGold ? ICONS.gold : ICONS.cash;
    const costRewardClass = isDiamond ? "diamond" : isGold ? "gold" : "cash";
    const xp = String(buildPlaceXp(def));
    const size = `${def.gridW}×${def.gridH}`;
    const level = def.level != null ? String(def.level) : "1";
    const buildMs = buildDurationMs(def);
    const buildLabel = buildMs > 0 ? formatDuration(buildMs) : "Instantánea";

    let extra = "";
    if (isHouse) {
      if (usesLootEconomy(def)) {
        const perMin = Math.round(getBuildingProductionPerMinute(def) * 10) / 10;
        const cap = maxLootOf(def);
        const interval = formatDuration((def.lootInterval || 60) * 1000);
        extra = `
          <div class="bldg-tip-status">Genera botín con el tiempo</div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Producción:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${cashHtml(perMin)}/min</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Cada:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(interval)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Capacidad:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${cashHtml(cap)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Construcción:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(buildLabel)}</span></span>
          </div>
          <div class="bldg-tip-footnote">Nivel ${escapeHtml(level)} · ${escapeHtml(size)} · ${escapeHtml(xp)} XP</div>
        `;
      } else {
        const maxP = houseMaxPeople(def);
        const reward = formatDuration(houseRewardDurationMs(def));
        extra = `
          <div class="bldg-tip-status">La población crece sola</div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Población máx:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(String(maxP))}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Cobro cada:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(reward)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Construcción:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(buildLabel)}</span></span>
          </div>
          <div class="bldg-tip-footnote">Nivel ${escapeHtml(level)} · ${escapeHtml(size)}</div>
        `;
      }
    } else if (def.category === "wonder") {
      const pct =
        def.rewardBonusPercentApprox != null
          ? def.rewardBonusPercentApprox
          : def.rewardBonusScaled != null
            ? Math.round((def.rewardBonusScaled / 100) * 100) / 100
            : 0;
      const radio =
        def.influenceRadiusTiles != null ? ` · radio ${def.influenceRadiusTiles}` : "";
      extra = `
        <div class="bldg-tip-status">+${escapeHtml(String(pct))}% casas y comercios${escapeHtml(radio)}</div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Construcción:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(buildLabel)}</span></span>
        </div>
        <div class="bldg-tip-footnote">También produce oro y diamantes</div>
      `;
    } else if (def.category === "commercial") {
      if (usesLootEconomy(def)) {
        const perMin = Math.round(getBuildingProductionPerMinute(def) * 10) / 10;
        const cap = maxLootOf(def);
        const interval = formatDuration((def.lootInterval || 60) * 1000);
        const radio = def.influenceRadiusTiles != null ? String(def.influenceRadiusTiles) : "—";
        const pct = commerceHouseBonusPercent(def);
        extra = `
          <div class="bldg-tip-status">Botín · +${pct}% por casa en radio</div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Producción:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${cashHtml(perMin)}/min</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Cada:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(interval)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Capacidad:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${cashHtml(cap)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Radio:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(radio)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Construcción:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(buildLabel)}</span></span>
          </div>
          <div class="bldg-tip-footnote">Nivel ${escapeHtml(level)} · ${escapeHtml(size)}</div>
        `;
      } else {
        const reward = formatDuration(commerceRewardDurationMs(def));
        const cycleCash = commerceCycleReward(def);
        extra = `
          <div class="bldg-tip-status">Ingresos por ciclo</div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Cobro cada:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(reward)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Recompensa:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${cashHtml(cycleCash)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Construcción:</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(buildLabel)}</span></span>
          </div>
          <div class="bldg-tip-footnote">Nivel ${escapeHtml(level)} · ${escapeHtml(size)}</div>
        `;
      }
    } else {
      extra = `
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Construcción:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(buildLabel)}</span></span>
        </div>
        <div class="bldg-tip-footnote">Nivel ${escapeHtml(level)} · ${escapeHtml(size)}</div>
      `;
    }

    const isCommercial = def.category === "commercial";
    const lootCommercial = isCommercial && usesLootEconomy(def);
    const cycleCash = isCommercial && !lootCommercial ? commerceCycleReward(def) : 0;
    const cycleCashLabel = lootCommercial
      ? formatCash(getBuildingProductionPerMinute(def))
      : isCommercial
        ? formatCash(cycleCash)
        : "";
    const key = `cat|${name}|${cost}|${xp}|${buildLabel}|${cycleCashLabel}`;
    if (key === this._key) return;
    this._key = key;
    this.root.innerHTML = `
      <div class="bldg-tip-card">
        <div class="bldg-tip-title">${escapeHtml(name)}</div>
        <div class="bldg-tip-body">
          <div class="bldg-tip-rewards">
            <div class="bldg-tip-reward xp">
              <img src="${ICONS.xp}" alt="" />
              <span>${escapeHtml(xp)} XP</span>
            </div>
            <div class="bldg-tip-reward ${costRewardClass}">
              <img src="${costIcon}" alt="" />
              <span>${escapeHtml(cost)}</span>
            </div>
            ${
              isCommercial
                ? `<div class="bldg-tip-reward cash" title="Producción">
              <img src="${ICONS.cash}" alt="" />
              <span>+${escapeHtml(cycleCashLabel)}${lootCommercial ? "/min" : ""}</span>
            </div>`
                : ""
            }
          </div>
          <div class="bldg-tip-divider"></div>
          ${extra}
        </div>
        <div class="bldg-tip-arrow"></div>
      </div>
    `;
  }

  _constructionHtml(m) {
    const costFmt = formatCash(m.instantCost || 0);
    return `
      <div class="bldg-tip-card bldg-tip-card--build">
        <div class="bldg-tip-title">${escapeHtml(m.name)}</div>
        <div class="bldg-tip-body">
          <div class="bldg-tip-status">Construcción rápida</div>
          <div class="bldg-tip-timer-row">
            <img class="bldg-tip-ico" src="${ICONS.timer}" alt="" />
            <div class="bldg-tip-bar">
              <div class="bldg-tip-bar-fill bldg-tip-bar-fill--build" style="width:${m.progressPct}%"></div>
              <span class="bldg-tip-bar-text">${escapeHtml(m.timeText)}</span>
            </div>
          </div>
          <div class="bldg-tip-build-cost-row">
            <span>Coste</span>
            <span class="bldg-tip-build-cost">
              <img src="${ICONS.cash}" alt="" />
              ${escapeHtml(costFmt)}
            </span>
          </div>
          <div class="bldg-tip-build-actions">
            <button type="button" class="bldg-tip-icon-btn bldg-tip-icon-btn--ok" data-instant-build title="Confirmar" aria-label="Confirmar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 13.2 L10 18 L19 7" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button type="button" class="bldg-tip-icon-btn bldg-tip-icon-btn--cancel" data-build-cancel title="Cancelar" aria-label="Cancelar">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7 L17 17 M17 7 L7 17" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="bldg-tip-arrow"></div>
      </div>
    `;
  }

  render() {
    if (!this.building) return;
    if (this.building.def.category === "wonder") {
      this._renderWonder();
      return;
    }
    const m = this._model();
    if (m.constructing) {
      const key = `build|${m.name}|${m.timeText}|${Math.round(m.progressPct)}|${m.instantCost}`;
      const fill = this.root.querySelector(".bldg-tip-bar-fill--build");
      const barText = this.root.querySelector(".bldg-tip-bar-text");
      const costEl = this.root.querySelector(".bldg-tip-build-cost");
      if (fill && barText && this._key.startsWith(`build|${m.name}|`)) {
        fill.style.width = `${m.progressPct}%`;
        barText.textContent = m.timeText;
        if (costEl) {
          costEl.innerHTML = `<img src="${ICONS.cash}" alt="" /> ${escapeHtml(formatCash(m.instantCost || 0))}`;
        }
        this._key = key;
        return;
      }
      this._key = key;
      this.root.classList.add("interactive");
      this.root.innerHTML = this._constructionHtml(m);
      return;
    }

    this.root.classList.remove("interactive");
    const cashFmt = Number(m.cashText).toLocaleString("en-US");
    const bonusPctFmt = Number(m.bonusPct || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });
    const key = [
      m.name,
      m.showTimer ? 1 : 0,
      m.timeText,
      Math.round(m.progressPct),
      m.xpText,
      cashFmt,
      m.peopleText,
      m.peopleLabel,
      m.statusNote,
      bonusPctFmt,
      m.loot ? m.finalPerMin : "",
      m.loot ? m.pendingLoot : "",
    ].join("|");
    if (key === this._key) return;

    const fill = this.root.querySelector(".bldg-tip-bar-fill");
    const barText = this.root.querySelector(".bldg-tip-bar-text");
    const sameShell =
      fill &&
      barText &&
      this._key &&
      this._key.startsWith(`${m.name}|${m.showTimer ? 1 : 0}|`) &&
      m.showTimer &&
      !this.root.querySelector("[data-instant-build]");

    if (sameShell) {
      fill.style.width = `${m.progressPct}%`;
      barText.textContent = m.timeText;
      const xp = this.root.querySelector(".bldg-tip-reward.xp span");
      const cash = this.root.querySelector(".bldg-tip-reward.cash span");
      const peopleNum = this.root.querySelector(".bldg-tip-tenants-num");
      const bonusEl = this.root.querySelector(".bldg-tip-bonus-num");
      if (xp) xp.textContent = `${m.xpText} XP`;
      if (cash) cash.textContent = cashFmt;
      if (peopleNum) peopleNum.textContent = m.peopleText;
      if (bonusEl) bonusEl.textContent = `+${bonusPctFmt}%`;
      const note = this.root.querySelector(".bldg-tip-footnote");
      if (note) note.textContent = m.statusNote || "";
      const finalEl = this.root.querySelector(".bldg-tip-final-num");
      if (finalEl && m.loot) finalEl.textContent = `$${Number(m.finalPerMin).toLocaleString("en-US")}/min`;
      this._key = key;
      return;
    }

    this._key = key;
    const lootExtra = m.loot
      ? `
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Producción:</span>
            <span class="bldg-tip-tenants-val">
              <span class="bldg-tip-tenants-num">$${escapeHtml(String(m.basePerMin))}/min</span>
            </span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Final:</span>
            <span class="bldg-tip-tenants-val">
              <span class="bldg-tip-tenants-num bldg-tip-final-num">$${escapeHtml(String(m.finalPerMin))}/min</span>
            </span>
          </div>
          ${
            m.kind === "shop" && m.houseCount != null
              ? `<div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Casas en radio:</span>
            <span class="bldg-tip-tenants-val">
              <span class="bldg-tip-tenants-num">${escapeHtml(String(m.houseCount))}</span>
            </span>
          </div>`
              : ""
          }`
      : "";
    this.root.innerHTML = `
      <div class="bldg-tip-card">
        <div class="bldg-tip-title">${escapeHtml(m.name)}</div>
        <div class="bldg-tip-body">
          ${
            m.showTimer
              ? `<div class="bldg-tip-timer-row">
                  <img class="bldg-tip-ico" src="${ICONS.timer}" alt="" />
                  <div class="bldg-tip-bar">
                    <div class="bldg-tip-bar-fill" style="width:${m.progressPct}%"></div>
                    <span class="bldg-tip-bar-text">${escapeHtml(m.timeText)}</span>
                  </div>
                </div>`
              : m.statusNote
                ? `<div class="bldg-tip-status">${escapeHtml(m.statusNote)}</div>`
                : ""
          }
          <div class="bldg-tip-rewards">
            <div class="bldg-tip-reward xp">
              <img src="${ICONS.xp}" alt="" />
              <span>${escapeHtml(m.xpText)} XP</span>
            </div>
            <div class="bldg-tip-reward cash">
              <img src="${ICONS.cash}" alt="" />
              <span>${escapeHtml(cashFmt)}</span>
            </div>
          </div>
          <div class="bldg-tip-divider"></div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">${escapeHtml(m.peopleLabel)}:</span>
            <span class="bldg-tip-tenants-val">
              <span class="bldg-tip-tenants-num">${escapeHtml(m.peopleText)}</span>
              ${m.kind === "shop" || m.loot ? "" : `<img src="${ICONS.people}" alt="" />`}
            </span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Bonus:</span>
            <span class="bldg-tip-tenants-val">
              <span class="bldg-tip-tenants-num bldg-tip-bonus-num">+${escapeHtml(bonusPctFmt)}%</span>
            </span>
          </div>
          ${lootExtra}
          ${
            m.statusNote
              ? `<div class="bldg-tip-footnote">${escapeHtml(m.statusNote)}</div>`
              : ""
          }
        </div>
        <div class="bldg-tip-arrow"></div>
      </div>
    `;
  }

  _renderWonder() {
    const m = this._wonderModel();
    if (m.constructing) {
      const key = `build|${m.name}|${m.timeText}|${Math.round(m.progressPct)}|${m.instantCost}`;
      const fill = this.root.querySelector(".bldg-tip-bar-fill--build");
      const barText = this.root.querySelector(".bldg-tip-bar-text");
      const costEl = this.root.querySelector(".bldg-tip-build-cost");
      if (fill && barText && this._key.startsWith(`build|${m.name}|`)) {
        fill.style.width = `${m.progressPct}%`;
        barText.textContent = m.timeText;
        if (costEl) {
          costEl.innerHTML = `<img src="${ICONS.cash}" alt="" /> ${escapeHtml(formatCash(m.instantCost || 0))}`;
        }
        this._key = key;
        return;
      }
      this._key = key;
      this.root.classList.add("interactive");
      this.root.innerHTML = this._constructionHtml(m);
      return;
    }

    this.root.classList.remove("interactive");
    const key = [
      "wonder",
      m.name,
      m.goldText,
      m.diaText,
      m.goldReady ? 1 : 0,
      m.diaReady ? 1 : 0,
      m.bonusPct,
      m.statusNote,
    ].join("|");
    if (key === this._key) return;
    this._key = key;
    this.root.innerHTML = `
      <div class="bldg-tip-card">
        <div class="bldg-tip-title">${escapeHtml(m.name)}</div>
        <div class="bldg-tip-body">
          ${m.statusNote ? `<div class="bldg-tip-status">${escapeHtml(m.statusNote)}</div>` : ""}
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Oro (+${escapeHtml(m.goldAmt)}):</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num"><img class="gold-ico gold-ico--inline" src="${ICONS.gold}" alt="" />${escapeHtml(m.goldText)}</span></span>
          </div>
          <div class="bldg-tip-tenants">
            <span class="bldg-tip-tenants-label">Diamante (+${escapeHtml(m.diaAmt)}):</span>
            <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num"><img class="gold-ico gold-ico--inline" src="${ICONS.diamond}" alt="" />${escapeHtml(m.diaText)}</span></span>
          </div>
          <div class="bldg-tip-footnote">+${escapeHtml(m.bonusPct)}% casas y comercios en radio</div>
        </div>
        <div class="bldg-tip-arrow"></div>
      </div>
    `;
  }
}

function formatTipTime(msWall) {
  const s = Math.max(0, Math.ceil(msWall / 1000));
  if (s < 60) return `0 Mins ${s} Secs`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m} Mins ${rem} Secs`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  if (h < 24) return `${h} Hrs ${mr} Mins`;
  const d = Math.floor(h / 24);
  const hr = h % 24;
  return `${d} Days ${hr} Hrs`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
