import { cashHtml, costHtml } from "./money.js";

/**
 * Shop panel: lists catalog items and reports selection.
 */
export class ShopUI {
  /**
   * @param {HTMLElement} root
   * @param {{ houses: object[], commerces: object[], decorations: object[] }} catalog
   * @param {(item: object|null) => void} onSelect
   * @param {{
   *   roadCost?: number,
   *   onTool?: (tool: string|null) => void,
   *   onHover?: (item: object|null, screenPos?: { left: number, top: number }|null) => void,
   * }} [options]
   */
  constructor(root, catalog, onSelect, options = {}) {
    this.root = root;
    this.catalog = catalog;
    this.onSelect = onSelect;
    this.onTool = options.onTool || (() => {});
    this.onHover = options.onHover || (() => {});
    this.roadCost = options.roadCost ?? 500;
    this.selected = null;
    this.tool = null;
    this.tab = "houses";

    root.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.tab = btn.dataset.tab;
        this.selected = null;
        this.tool = null;
        this.onSelect(null);
        this.onTool(null);
        this.onHover(null);
        this.render();
      });
    });

    this.listEl = root.querySelector("#catalog");
    this.render();
  }

  clearSelection() {
    this.selected = null;
    this.tool = null;
    this.onSelect(null);
    this.onTool(null);
    this.onHover(null);
    this.render();
  }

  itemsForTab() {
    let items;
    switch (this.tab) {
      case "houses":
        items = this.catalog.houses || [];
        break;
      case "commerces":
        items = this.catalog.commerces || [];
        break;
      case "decorations":
        items = this.catalog.decorations || [];
        break;
      case "wonders":
        items = this.catalog.wonders || [];
        break;
      default:
        return [];
    }
    return [...items].sort((a, b) => {
      const ca =
        (a.costDiamonds || 0) * 1_000_000_000_000 +
        (a.costFortune || 0) * 1_000_000_000 +
        (a.costCoins || 0);
      const cb =
        (b.costDiamonds || 0) * 1_000_000_000_000 +
        (b.costFortune || 0) * 1_000_000_000 +
        (b.costCoins || 0);
      return ca - cb;
    });
  }

  subtitle(item) {
    const size = `${item.gridW}×${item.gridH}`;
    const costLabel = costHtml(item);
    const meta = (extra) => `${costLabel}<span class="shop-sub-meta">· ${extra}</span>`;
    if (item.clientRadiusTiles != null) {
      return meta(`${size} · radio ${item.clientRadiusTiles}`);
    }
    if (item.cityBonusScaled != null || item.cityBonusPercentApprox != null) {
      const pct =
        item.cityBonusPercentApprox != null
          ? item.cityBonusPercentApprox
          : Math.round((item.cityBonusScaled / 100) * 100) / 100;
      const infl =
        item.influenceRadiusTiles != null && item.influenceRadiusTiles >= 0
          ? ` · infl. ${item.influenceRadiusTiles}`
          : "";
      return meta(`${size} · ciudad +${pct}%${infl}`);
    }
    if (item.houseBonusPercentApprox != null || item.houseBonusScaled != null) {
      const pct =
        item.houseBonusPercentApprox != null
          ? item.houseBonusPercentApprox
          : Math.round((item.houseBonusScaled / 100) * 100) / 100;
      const infl = item.influenceRadiusTiles != null ? ` · infl. ${item.influenceRadiusTiles}` : "";
      return meta(`${size} · +${pct}%${infl}`);
    }
    return meta(size);
  }

  _tipPos(btn) {
    const stage = this.root.closest(".stage") || document.body;
    const sr = stage.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    return {
      left: br.right - sr.left + 10,
      top: br.top - sr.top + br.height / 2,
    };
  }

  render() {
    const list = this.listEl;
    list.innerHTML = "";
    this.onHover(null);

    if (this.tab === "tools") {
      const roadBtn = document.createElement("button");
      roadBtn.type = "button";
      roadBtn.className = "card" + (this.tool === "road" ? " selected" : "");
      roadBtn.innerHTML = `
        <img src="assets/roads/straight_ew.png" alt="" />
        <div class="meta">
          <div class="name">Carretera</div>
          <div class="sub">${cashHtml(this.roadCost)} / tile</div>
        </div>
      `;
      roadBtn.addEventListener("click", () => {
        this.selected = null;
        this.onSelect(null);
        this.tool = this.tool === "road" ? null : "road";
        this.onTool(this.tool);
        this.render();
      });
      list.appendChild(roadBtn);

      const zebraBtn = document.createElement("button");
      zebraBtn.type = "button";
      zebraBtn.className = "card" + (this.tool === "zebra" ? " selected" : "");
      zebraBtn.innerHTML = `
        <img src="assets/roads/r1_0623.png" alt="" />
        <div class="meta">
          <div class="name">Paso de cebra</div>
          <div class="sub">${cashHtml(this.roadCost)} / tile</div>
        </div>
      `;
      zebraBtn.addEventListener("click", () => {
        this.selected = null;
        this.onSelect(null);
        this.tool = this.tool === "zebra" ? null : "zebra";
        this.onTool(this.tool);
        this.render();
      });
      list.appendChild(zebraBtn);

      const help = document.createElement("p");
      help.style.cssText = "color:#1a5f96;font-size:0.8rem;padding:0.5rem;margin:0;font-weight:600";
      help.innerHTML =
        "Pinta arrastrando. Recta por defecto; curva / T / cruce solo según vecinos. <strong>Paso de cebra</strong> fija el cruce peatonal. <strong>Mover</strong> reubica edificios; <strong>Borrar</strong> los quita. Clic vacío o Esc cancela la herramienta.";
      list.appendChild(help);
      return;
    }

    const items = this.itemsForTab();
    for (const item of items) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card" + (this.selected === item ? " selected" : "");
      btn.innerHTML = `
        ${
          item.spriteUrl
            ? `<img src="${item.spriteUrl}" alt="" />`
            : `<div class="ph">${item.gridW}×${item.gridH}</div>`
        }
        <div class="meta">
          <div class="name">${item.name || item.constant || "Item"}</div>
          <div class="sub">${this.subtitle(item)}</div>
        </div>
      `;
      btn.addEventListener("click", () => {
        this.tool = null;
        this.onTool(null);
        this.onHover(null);
        if (this.selected === item) {
          this.selected = null;
          this.onSelect(null);
        } else {
          this.selected = item;
          this.onSelect(item);
        }
        this.render();
      });

      if (item.category === "house" || item.category === "commercial" || item.category === "wonder") {
        btn.addEventListener("pointerenter", () => {
          this.onHover(item, this._tipPos(btn));
        });
        btn.addEventListener("pointermove", () => {
          this.onHover(item, this._tipPos(btn));
        });
        btn.addEventListener("pointerleave", () => {
          this.onHover(null);
        });
      }

      list.appendChild(btn);
    }
  }
}
