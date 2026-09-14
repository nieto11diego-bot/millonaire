/**
 * Shop panel: lists catalog items and reports selection.
 */
export class ShopUI {
  /**
   * @param {HTMLElement} root
   * @param {{ houses: object[], commerces: object[], decorations: object[] }} catalog
   * @param {(item: object|null) => void} onSelect
   * @param {{ roadCost?: number, onTool?: (tool: string|null) => void }} [options]
   */
  constructor(root, catalog, onSelect, options = {}) {
    this.root = root;
    this.catalog = catalog;
    this.onSelect = onSelect;
    this.onTool = options.onTool || (() => {});
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
    this.render();
  }

  itemsForTab() {
    switch (this.tab) {
      case "houses":
        return this.catalog.houses || [];
      case "commerces":
        return this.catalog.commerces || [];
      case "decorations":
        return this.catalog.decorations || [];
      default:
        return [];
    }
  }

  subtitle(item) {
    const cost = item.costCoins != null ? item.costCoins.toLocaleString("en-US") : "?";
    const size = `${item.gridW}×${item.gridH}`;
    if (item.clientRadiusTiles != null) {
      return `$${cost} · ${size} · radio ${item.clientRadiusTiles}`;
    }
    if (item.houseBonusPercentApprox != null || item.houseBonusScaled != null) {
      const pct =
        item.houseBonusPercentApprox != null
          ? item.houseBonusPercentApprox
          : Math.round((item.houseBonusScaled / 100) * 100) / 100;
      const infl = item.influenceRadiusTiles != null ? ` · infl. ${item.influenceRadiusTiles}` : "";
      return `$${cost} · ${size} · +${pct}%${infl}`;
    }
    return `$${cost} · ${size}`;
  }

  render() {
    const list = this.listEl;
    list.innerHTML = "";

    if (this.tab === "tools") {
      const roadBtn = document.createElement("button");
      roadBtn.type = "button";
      roadBtn.className = "card" + (this.tool === "road" ? " selected" : "");
      roadBtn.innerHTML = `
        <img src="assets/roads/r1_0611.png" alt="" />
        <div class="meta">
          <div class="name">Carretera</div>
          <div class="sub">$${this.roadCost.toLocaleString("en-US")} / tile</div>
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

      const help = document.createElement("p");
      help.style.cssText = "color:var(--muted);font-size:0.8rem;padding:0.5rem;margin:0";
      help.innerHTML =
        "Pinta arrastrando. Recta por defecto; curva / T / cruce solo según vecinos. <strong>Borrar</strong> quita carretera o edificios.";
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
        this.selected = item;
        this.onSelect(item);
        this.render();
      });
      list.appendChild(btn);
    }
  }
}
