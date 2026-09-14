/**
 * Hover popup for houses and commerces (Millionaire City style).
 */
import { STATUS, TIME_SCALE } from "../economy.js";

const ICONS = {
  timer: "assets/ui/icon_timer.png",
  xp: "assets/ui/icon_xp.png",
  cash: "assets/ui/icon_cash.png",
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
    if (!building || (building.def.category !== "house" && building.def.category !== "commercial")) {
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

  update(screenPos) {
    if (!this.building || this.root.hidden) return;
    this._position(screenPos);
    if (!this._raf) {
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        if (this.building && !this.root.hidden) this.render();
      });
    }
  }

  hide() {
    this.building = null;
    this._key = "";
    this.root.classList.remove("visible");
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
        xpText = String(contract?.xp ?? 0);
        cashText = String(rt.lastIncome ?? 0);
        peopleText = String(rt.tenants ?? 0);
      } else if (rt.status === STATUS.READY) {
        showTimer = true;
        timeText = "¡Listo!";
        progressPct = 100;
        xpText = String(contract?.xp ?? 0);
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

    return { showTimer, timeText, progressPct, xpText, cashText, peopleText, peopleLabel, statusNote, name };
  }

  render() {
    if (!this.building) return;
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

    // Patch live timer/values without rebuilding the card
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
