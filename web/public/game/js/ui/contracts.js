import {
  contractCost,
  contractIncome,
  contractDurationMs,
  formatDuration,
  TIME_SCALE,
  houseContractBonusPercent,
} from "../economy.js";
import { cashHtml } from "./money.js";

/**
 * Modal to pick and sign a house rental contract.
 */
export class ContractsUI {
  /**
   * @param {HTMLElement} root
   * @param {{
   *   contracts: object[],
   *   getCash: () => number,
   *   onSign: (building: object, contractId: number) => void,
   * }} opts
   */
  constructor(root, opts) {
    this.root = root;
    this.contracts = opts.contracts || [];
    this.getCash = opts.getCash;
    this.onSign = opts.onSign;
    this.building = null;
    this.open = false;

    this.titleEl = root.querySelector("#contracts-title");
    this.subEl = root.querySelector("#contracts-sub");
    this.listEl = root.querySelector("#contracts-list");

    root.querySelector("#contracts-close")?.addEventListener("click", () => this.hide());
    root.addEventListener("click", (e) => {
      if (e.target === root) this.hide();
    });
  }

  /**
   * @param {object} building
   */
  show(building) {
    this.building = building;
    this.open = true;
    const name = building?.def?.name || "Casa";
    if (this.titleEl) this.titleEl.textContent = `Contrato — ${name}`;
    const bonus = houseContractBonusPercent(building?.def);
    if (this.subEl) {
      this.subEl.textContent =
        bonus > 0
          ? `Elige un contrato de alquiler. Botín +${bonus}% en esta casa.`
          : "Elige un contrato de alquiler.";
    }
    this.render();
    this.root.hidden = false;
    requestAnimationFrame(() => this.root.classList.add("visible"));
  }

  hide() {
    this.open = false;
    this.building = null;
    this.root.classList.remove("visible");
    this.root.hidden = true;
  }

  refresh() {
    if (this.open && this.building) this.render();
  }

  render() {
    if (!this.listEl || !this.building) return;
    const cash = this.getCash();
    const def = this.building.def;
    this.listEl.innerHTML = "";

    for (const c of this.contracts) {
      const cost = contractCost(c, def);
      const income = contractIncome(c, def);
      const dur = formatDuration(contractDurationMs(c) / TIME_SCALE);
      const canAfford = cash >= cost;

      const row = document.createElement("button");
      row.type = "button";
      row.className = "contract-row" + (canAfford ? "" : " contract-row--disabled");
      row.disabled = !canAfford;
      row.innerHTML = `
        <span class="contract-row-name">${escapeHtml(c.name)}</span>
        <span class="contract-row-meta">
          <span class="contract-row-cost">Firma ${cashHtml(cost)}</span>
          <span class="contract-row-sep">·</span>
          <span class="contract-row-income">Cobra ${cashHtml(income)}</span>
          <span class="contract-row-sep">·</span>
          <span class="contract-row-time">${escapeHtml(dur)}</span>
        </span>
      `;
      row.addEventListener("click", () => {
        if (!canAfford || !this.building) return;
        this.onSign(this.building, c.id);
      });
      this.listEl.appendChild(row);
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
