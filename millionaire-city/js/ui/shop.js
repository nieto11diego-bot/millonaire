import { costHtml } from "./money.js";
import { normalizedBuildCost } from "../economy.js";

/**
 * Shop panel: lists catalog items and reports selection.
 */
export class ShopUI {
  /**
   * @param {HTMLElement} root
   * @param {{ houses: object[], commerces: object[], decorations: object[], wonders?: object[], services?: object[] }} catalog
   * @param {(item: object|null) => void} onSelect
   * @param {{
   *   onHover?: (item: object|null, screenPos?: { left: number, top: number }|null) => void,
   * }} [options]
   */
  constructor(root, catalog, onSelect, options = {}) {
    this.root = root;
    this.catalog = catalog;
    this.onSelect = onSelect;
    this.onHover = options.onHover || (() => {});
    this.selected = null;
    this.tab = "houses";

    root.querySelectorAll(".tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.tab = btn.dataset.tab;
        this.selected = null;
        this.onSelect(null);
        this.onHover(null);
        this.render();
      });
    });

    this.listEl = root.querySelector("#catalog");
    this.render();
  }

  clearSelection() {
    this.selected = null;
    this.onSelect(null);
    this.onHover(null);
    this.render();
  }

  /**
   * Switch shop tab by id (e.g. "commerces").
   * @param {string} tab
   */
  setTab(tab) {
    const btn = this.root.querySelector(`.tab[data-tab="${tab}"]`);
    if (!btn) return;
    this.root.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    this.tab = tab;
    this.selected = null;
    this.onSelect(null);
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
      case "services":
        items = this.catalog.services || [];
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
    return [...items].sort((a, b) => normalizedBuildCost(a) - normalizedBuildCost(b));
  }

  subtitle(item) {
    const size = `${item.gridW}×${item.gridH}`;
    const costLabel = costHtml(item);
    const meta = (extra) => `${costLabel}<span class="shop-sub-meta">· ${extra}</span>`;
    if (item.category === "commercial" && item.rewardSec != null) {
      const sec = item.rewardSec;
      const label =
        sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`;
      return meta(`${size} · cada ${label}`);
    }
    if (item.category === "wonder") {
      const pct =
        item.rewardBonusPercentApprox != null
          ? item.rewardBonusPercentApprox
          : item.rewardBonusScaled != null
            ? Math.round((item.rewardBonusScaled / 100) * 100) / 100
            : 0;
      const infl =
        item.influenceRadiusTiles != null && item.influenceRadiusTiles >= 0
          ? ` · radio ${item.influenceRadiusTiles}`
          : "";
      return meta(`${size} · +${pct}% casas/comercios${infl}`);
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
