import { costHtml, cashHtml } from "./money.js";
import {
  normalizedBuildCost,
  commerceRentPerCustomer,
  COMMERCE_CYCLE_SEC,
  usesLootEconomy,
  getBuildingProductionPerMinute,
  houseMaxPeople,
  houseContractBonusPercent,
} from "../economy.js";

/**
 * Shop panel: lists catalog items and reports selection.
 */
export class ShopUI {
  /**
   * @param {HTMLElement} root
   * @param {{ houses: object[], commerces: object[], decorations: object[], wonders?: object[] }} catalog
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
      const ca = normalizedBuildCost(a);
      const cb = normalizedBuildCost(b);
      // Free / unset price last (shop progression by real price)
      const za = ca === 0 ? 1 : 0;
      const zb = cb === 0 ? 1 : 0;
      if (za !== zb) return za - zb;
      return ca - cb;
    });
  }

  subtitle(item) {
    const size = `${item.gridW}×${item.gridH}`;
    const costLabel = costHtml(item);
    const meta = (extra) => `${costLabel}<span class="shop-sub-meta">· ${extra}</span>`;
    if (item.category === "house" && usesLootEconomy(item)) {
      const perMin = Math.round(getBuildingProductionPerMinute(item) * 10) / 10;
      return meta(`${size} · ${cashHtml(perMin)}/min`);
    }
    if (item.category === "house") {
      const ppl = houseMaxPeople(item);
      const pplLabel = ppl > 0 ? ` · ${ppl} pers.` : "";
      const bonus = houseContractBonusPercent(item);
      const bonusLabel =
        bonus !== 0 ? ` · ${bonus > 0 ? "+" : ""}${bonus}% contrato` : "";
      return meta(`${size} · contratos${pplLabel}${bonusLabel}`);
    }
    if (item.category === "commercial") {
      const sec = COMMERCE_CYCLE_SEC;
      const label =
        sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)}m` : `${Math.round(sec / 3600)}h`;
      const rate = cashHtml(commerceRentPerCustomer(item));
      return meta(`${size} · ${rate}/cliente / ${label}`);
    }
    if (item.category === "wonder") {
      const pct =
        item.rewardBonusPercentApprox != null
          ? item.rewardBonusPercentApprox
          : item.rewardBonusScaled != null
            ? Math.round((item.rewardBonusScaled / 100) * 100) / 100
            : 0;
      const gold = item.goldReward || 0;
      const dia = item.diamondReward || 0;
      const parts = [];
      if (gold > 0) parts.push(`${gold} oro`);
      if (dia > 0) parts.push(`${dia} diam.`);
      const prod = parts.length ? ` · ${parts.join(" + ")}/7d` : "";
      return meta(`${size} · +${pct}% global${prod}`);
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
    const narrow = window.matchMedia("(max-width: 800px)").matches;
    if (narrow) {
      return {
        left: Math.min(Math.max(br.left - sr.left + br.width / 2, 90), sr.width - 90),
        top: Math.max(24, br.top - sr.top - 12),
      };
    }
    // Anchor just past the shop panel so the tip sits on the map, not under the tray.
    const shopRight = this.root.getBoundingClientRect().right;
    return {
      left: Math.max(br.right, shopRight) - sr.left + 12,
      top: br.top - sr.top + br.height / 2,
    };
  }

  _bindCatalogTip(btn, item) {
    if (
      item.category !== "house" &&
      item.category !== "commercial" &&
      item.category !== "wonder"
    ) {
      return;
    }
    const show = () => this.onHover(item, this._tipPos(btn));
    const hide = () => this.onHover(null);
    const finePointer = () =>
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    btn.addEventListener("pointerenter", (e) => {
      if (e.pointerType === "mouse" || finePointer()) show();
    });
    btn.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" || finePointer()) show();
    });
    btn.addEventListener("pointerleave", hide);
    btn.addEventListener("mouseenter", () => {
      if (finePointer()) show();
    });
    btn.addEventListener("mouseleave", hide);

    // Touch: long-press shows catalog info without selecting.
    const LONG_MS = 420;
    const MOVE_PX = 12;
    let timer = 0;
    let sx = 0;
    let sy = 0;
    let armed = false;
    const clear = () => {
      if (timer) {
        clearTimeout(timer);
        timer = 0;
      }
    };
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      armed = false;
      sx = e.clientX;
      sy = e.clientY;
      clear();
      timer = window.setTimeout(() => {
        timer = 0;
        armed = true;
        show();
      }, LONG_MS);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!timer || e.pointerType === "mouse") return;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (dx * dx + dy * dy >= MOVE_PX * MOVE_PX) clear();
    });
    btn.addEventListener("pointerup", clear);
    btn.addEventListener("pointercancel", clear);
    btn.addEventListener(
      "click",
      (e) => {
        if (!armed) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        armed = false;
      },
      true
    );
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
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

      this._bindCatalogTip(btn, item);

      list.appendChild(btn);
    }
  }
}
