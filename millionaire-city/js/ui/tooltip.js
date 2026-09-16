/**
 * Hover popup for houses and commerces (Millionaire City style).
 */
import { STATUS, TIME_SCALE, formatDuration, contractXp, wonderGoldRemainingMs, wonderDiamondRemainingMs, wonderGoldReady, wonderDiamondReady, wonderGoldReward, wonderDiamondReward, wonderGoldIntervalMs, wonderDiamondIntervalMs } from "../economy.js";
import { CASH_ICON, GOLD_ICON, DIAMOND_ICON, formatCash, formatGold, formatDiamonds } from "./money.js";

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
   * @param {{ t?: (tid: number, fb: string) => string, getContract?: (id: number) => object|null }} [options]
   */
  constructor(root, options = {}) {
    this.root = root;
    this.t = options.t || ((_tid, fb) => fb);
    this.getContract = options.getContract || (() => null);
    this.building = null;
    /** @type {object|null} catalog def preview */
    this.catalogDef = null;
    this._raf = 0;
    this._key = "";

    root.classList.add("bldg-tip");
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
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
    if (this.building !== building) this._key = "";
    this.building = building;
    this.root.hidden = false;
    this.root.setAttribute("aria-hidden", "false");
    this.root.classList.add("visible");
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
    this._position(screenPos);
    this.renderCatalog();
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

  hide() {
    this.building = null;
    this.catalogDef = null;
    this._key = "";
    this.root.classList.remove("visible", "shop-side");
    this.root.hidden = true;
    this.root.setAttribute("aria-hidden", "true");
  }

  _position(pos) {
    if (!pos) return;
    this.root.style.left = `${Math.round(pos.left)}px`;
    this.root.style.top = `${Math.round(pos.top)}px`;
  }

  _model() {
    const def = this.building.def;
    const rt = this.building.runtime || {};
    const isHouse = def.category === "house";
    const isShop = def.category === "commercial";

    const name = def.name || "Edificio";
    const peopleLabel = isHouse ? this.t(371, "Inquilinos") : "Clientes";

    let timeText = "—";
    let progressPct = 0;
    let showTimer = false;
    let xpText = "0";
    let cashText = "0";
    let peopleText = "0";
    let statusNote = "";

    if (isHouse) {
      const contract = rt.contractId != null ? this.getContract(rt.contractId) : null;
      if (rt.status === STATUS.WAITING && rt.durationMs > 0) {
        showTimer = true;
        timeText = formatTipTime(rt.remainingMs / TIME_SCALE);
        progressPct = Math.max(0, Math.min(100, (1 - rt.remainingMs / rt.durationMs) * 100));
        xpText = String(contract ? contractXp(contract) : 0);
        cashText = String(rt.lastIncome ?? 0);
        peopleText = String(rt.tenants ?? 0);
      } else if (rt.status === STATUS.READY) {
        showTimer = true;
        timeText = "¡Listo!";
        progressPct = 100;
        xpText = String(contract ? contractXp(contract) : 0);
        cashText = String(rt.lastIncome ?? 0);
        peopleText = String(rt.tenants ?? 0);
        statusNote = "Toca para cobrar";
      } else if (rt.status === STATUS.LOST) {
        statusNote = "Toca para firmar de nuevo";
      } else {
        const infl = rt.influence || 0;
        const pct = Math.round((infl / 100) * 10) / 10;
        statusNote = pct > 0 ? `Bonus +${pct}%` : "Sin contrato";
      }
    } else if (isShop) {
      peopleText = String(rt.customers ?? 0);
      cashText = String(rt.lastPayout ?? def.incomeValue ?? 0);
      if (rt.status === STATUS.WAITING && rt.durationMs > 0) {
        showTimer = true;
        timeText = formatTipTime(rt.remainingMs / TIME_SCALE);
        progressPct = Math.max(0, Math.min(100, (1 - rt.remainingMs / rt.durationMs) * 100));
        cashText = String((def.incomeValue || 0) * (rt.customers || 0));
      } else if (rt.status === STATUS.READY) {
        showTimer = true;
        timeText = "¡Listo!";
        progressPct = 100;
        cashText = String(rt.lastPayout ?? 0);
        statusNote = "Toca para cobrar";
      }
    }

    return {
      kind: isHouse ? "house" : isShop ? "shop" : "other",
      showTimer,
      timeText,
      progressPct,
      xpText,
      cashText,
      peopleText,
      peopleLabel,
      statusNote,
      name,
    };
  }

  _wonderModel() {
    const def = this.building.def;
    const rt = this.building.runtime || {};
    const name = def.name || "Maravilla";
    const goldReady = wonderGoldReady(rt);
    const diaReady = wonderDiamondReady(rt);
    const goldLeft = wonderGoldRemainingMs(rt);
    const diaLeft = wonderDiamondRemainingMs(rt);
    const goldAmt = wonderGoldReward(def);
    const diaAmt = wonderDiamondReward(def);
    const cityPct =
      def.cityBonusPercentApprox != null
        ? def.cityBonusPercentApprox
        : def.cityBonusScaled != null
          ? Math.round((def.cityBonusScaled / 100) * 100) / 100
          : 0;
    let statusNote = "";
    if (goldReady || diaReady) statusNote = "Toca para cobrar";
    return {
      kind: "wonder",
      name,
      goldReady,
      diaReady,
      goldText: goldReady ? "¡Listo!" : formatTipTime(goldLeft),
      diaText: diaReady ? "¡Listo!" : formatTipTime(diaLeft),
      goldAmt: String(goldAmt),
      diaAmt: String(diaAmt),
      cityPct: String(cityPct),
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
    const xp = String(def.exp || 0);
    const size = `${def.gridW}×${def.gridH}`;
    const level = def.level != null ? String(def.level) : "1";

    let extra = "";
    if (isHouse) {
      extra = `
        <div class="bldg-tip-status">Firma contratos para alquilar</div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Tamaño:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(size)}</span></span>
        </div>
        <div class="bldg-tip-footnote">Nivel ${escapeHtml(level)}</div>
      `;
    } else if (def.category === "wonder") {
      const cityPct =
        def.cityBonusPercentApprox != null
          ? def.cityBonusPercentApprox
          : def.cityBonusScaled != null
            ? Math.round((def.cityBonusScaled / 100) * 100) / 100
            : 0;
      const goldEvery = formatDuration(wonderGoldIntervalMs(def));
      const diaEvery = formatDuration(wonderDiamondIntervalMs(def));
      const goldAmt = String(wonderGoldReward(def));
      const diaAmt = String(wonderDiamondReward(def));
      extra = `
        <div class="bldg-tip-status">Bonus ciudad +${escapeHtml(String(cityPct))}%</div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Oro:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num"><img class="gold-ico gold-ico--inline" src="${ICONS.gold}" alt="" />+${escapeHtml(goldAmt)} / ${escapeHtml(goldEvery)}</span></span>
        </div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Diamante:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num"><img class="gold-ico gold-ico--inline" src="${ICONS.diamond}" alt="" />+${escapeHtml(diaAmt)} / ${escapeHtml(diaEvery)}</span></span>
        </div>
        <div class="bldg-tip-footnote">${escapeHtml(size)} · Nivel ${escapeHtml(level)}</div>
      `;
    } else if (def.category === "service") {
      const bonus = def.happinessBonus != null ? String(def.happinessBonus) : "6";
      extra = `
        <div class="bldg-tip-status">Servicio público</div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Felicidad:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">+${escapeHtml(bonus)}</span></span>
        </div>
        <div class="bldg-tip-footnote">${escapeHtml(size)} · Nivel ${escapeHtml(level)}</div>
      `;
    } else {
      const income = (def.incomeValue || 0).toLocaleString("en-US");
      const clients = String(def.maxClients ?? "—");
      const radius = String(def.clientRadiusTiles ?? "—");
      const cycle =
        def.incomeTimeSec != null ? formatDuration((def.incomeTimeSec * 1000) / TIME_SCALE) : "—";
      extra = `
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Por cliente:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num"><img class="cash-ico cash-ico--inline" src="${ICONS.cash}" alt="" />${escapeHtml(income)}</span></span>
        </div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Máx. clientes:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(clients)}</span></span>
        </div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Radio:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(radius)}</span></span>
        </div>
        <div class="bldg-tip-tenants">
          <span class="bldg-tip-tenants-label">Ciclo:</span>
          <span class="bldg-tip-tenants-val"><span class="bldg-tip-tenants-num">${escapeHtml(cycle)}</span></span>
        </div>
        <div class="bldg-tip-footnote">${escapeHtml(size)} · Nivel ${escapeHtml(level)}</div>
      `;
    }

    const key = `cat|${name}|${costRewardClass}|${cost}|${xp}|${size}`;
    if (key === this._key) return;
    this._key = key;

    this.root.innerHTML = `
      <div class="bldg-tip-card">
        <div class="bldg-tip-title">${escapeHtml(name)}</div>
        <div class="bldg-tip-body">
          <div class="bldg-tip-rewards">
            <div class="bldg-tip-reward ${costRewardClass}">
              <img src="${costIcon}" alt="" />
              <span>${escapeHtml(cost)}</span>
            </div>
            <div class="bldg-tip-reward xp">
              <img src="${ICONS.xp}" alt="" />
              <span>${escapeHtml(xp)} XP</span>
            </div>
          </div>
          <div class="bldg-tip-divider"></div>
          ${extra}
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
    const cashFmt = Number(m.cashText).toLocaleString("en-US");
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
    ].join("|");
    if (key === this._key) return;

    const fill = this.root.querySelector(".bldg-tip-bar-fill");
    const barText = this.root.querySelector(".bldg-tip-bar-text");
    const sameShell =
      fill &&
      barText &&
      this._key &&
      this._key.startsWith(`${m.name}|${m.showTimer ? 1 : 0}|`) &&
      m.showTimer;

    if (sameShell) {
      fill.style.width = `${m.progressPct}%`;
      barText.textContent = m.timeText;
      const xp = this.root.querySelector(".bldg-tip-reward.xp span");
      const cash = this.root.querySelector(".bldg-tip-reward.cash span");
      const peopleNum = this.root.querySelector(".bldg-tip-tenants-num");
      if (xp) xp.textContent = `${m.xpText} XP`;
      if (cash) cash.textContent = cashFmt;
      if (peopleNum) peopleNum.textContent = m.peopleText;
      const note = this.root.querySelector(".bldg-tip-footnote");
      if (note) note.textContent = m.statusNote;
      this._key = key;
      return;
    }

    this._key = key;
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
              <img src="${ICONS.people}" alt="" />
            </span>
          </div>
          ${
            m.showTimer && m.statusNote
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
    const key = [
      "wonder",
      m.name,
      m.goldText,
      m.diaText,
      m.goldReady ? 1 : 0,
      m.diaReady ? 1 : 0,
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
          <div class="bldg-tip-footnote">Bonus ciudad +${escapeHtml(m.cityPct)}%</div>
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
  return `${h} Hrs ${mr} Mins`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
