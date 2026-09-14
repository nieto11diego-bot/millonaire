/**
 * Contract selection modal for a house.
 */
export class ContractsUI {
  /**
   * @param {HTMLElement} root
   * @param {{ onSign: (contractId: number) => void, t?: (tid: number, fb: string) => string }} options
   */
  constructor(root, options) {
    this.root = root;
    this.onSign = options.onSign;
    this.t = options.t || ((_tid, fb) => fb);
    this.open = false;
    this.building = null;
    this.previews = [];

    this.listEl = root.querySelector("#contracts-list");
    this.titleEl = root.querySelector("#contracts-title");
    this.metaEl = root.querySelector("#contracts-meta");

    root.querySelector("#contracts-close")?.addEventListener("click", () => this.hide());
    root.addEventListener("click", (e) => {
      if (e.target === root) this.hide();
    });
    root.querySelector(".contracts-window")?.addEventListener("click", (e) => e.stopPropagation());
    this.hide();
  }

  /**
   * @param {object} building
   * @param {object[]} previews from EconomySim.previewContracts
   */
  show(building, previews) {
    this.open = true;
    this.building = building;
    this.previews = previews;
    this.root.hidden = false;
    this.root.classList.add("visible");
    if (this.titleEl) this.titleEl.textContent = building.def.name || "Casa";
    const infl = building.runtime?.influence ?? 0;
    const pct = Math.round((infl / 100) * 10) / 10;
    if (this.metaEl) {
      this.metaEl.textContent =
        pct > 0
          ? `Bonus de casa: +${pct}% (influencia ${infl})`
          : "Sin bonus de decoración / maravillas";
    }
    this.render();
  }

  hide() {
    this.open = false;
    this.building = null;
    this.root.classList.remove("visible");
    this.root.hidden = true;
  }

  render() {
    const list = this.listEl;
    if (!list) return;
    list.innerHTML = "";
    for (const p of this.previews) {
      const c = p.contract;
      const name = this.t(c.nameTid, c.name);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "contract-card";
      btn.innerHTML = `
        <div class="contract-name">${escapeHtml(name)}</div>
        <div class="contract-stats">
          <span title="Coste"><em>$</em> ${p.cost.toLocaleString("en-US")}</span>
          <span title="Ingreso"><em>↓$</em> ${p.income.toLocaleString("en-US")}</span>
          <span title="Inquilinos">👤 ${p.tenants}</span>
          <span title="XP">★ ${p.xp}</span>
          <span title="Duración">⏱ ${formatMin(c.durationSec)}</span>
        </div>
      `;
      btn.addEventListener("click", () => {
        this.onSign(c.id);
      });
      list.appendChild(btn);
    }
  }
}

function formatMin(sec) {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  if (sec < 86400) return `${Math.round(sec / 3600)} h`;
  return `${Math.round(sec / 86400)} d`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
