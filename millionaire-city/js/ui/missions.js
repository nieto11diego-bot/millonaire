import { replaceDollarSymbols } from "./money.js";

/**
 * Missions panel UI — compact vertical list.
 */

const SPRITES = {
  cash: "assets/ui/icon_cash.png",
  info: "assets/ui/icon_info.png",
  accept: "assets/ui/button_accept.png",
  lockedBtn: "assets/ui/button_locked.png",
};

export class MissionsUI {
  /**
   * @param {HTMLElement} root overlay root (#missions-panel)
   * @param {import("../missions.js").MissionTracker} tracker
   * @param {{ onCollect?: (sku: number, reward: number) => void }} [options]
   */
  constructor(root, tracker, options = {}) {
    this.root = root;
    this.tracker = tracker;
    this.onCollect = options.onCollect || (() => {});
    this.open = false;
    this.filter = "all"; // all | open | completed | locked

    this.listEl = root.querySelector("#missions-list");
    this.badgeEl = document.getElementById("missions-badge");
    this.detailEl = root.querySelector("#mission-detail");
    this.windowEl = root.querySelector(".missions-window");

    root.querySelector("#missions-close")?.addEventListener("click", () => this.hide());
    root.addEventListener("click", (e) => {
      if (e.target === root) this.hide();
    });
    this.windowEl?.addEventListener("click", (e) => e.stopPropagation());

    root.querySelectorAll("[data-mission-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        root.querySelectorAll("[data-mission-filter]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.filter = btn.dataset.missionFilter;
        this.render();
      });
    });

    tracker.onChange(() => {
      this.refreshBadge();
      if (this.open) this.render();
    });

    this.refreshBadge();
    this.hide();
  }

  show() {
    this.open = true;
    this.root.hidden = false;
    this.root.classList.add("visible");
    if (this.detailEl) {
      this.detailEl.hidden = true;
      this.detailEl.innerHTML = "";
    }
    this.render();
  }

  hide() {
    this.open = false;
    this.root.classList.remove("visible");
    this.root.hidden = true;
    if (this.detailEl) {
      this.detailEl.hidden = true;
      this.detailEl.innerHTML = "";
    }
  }

  toggle() {
    if (this.open) this.hide();
    else this.show();
  }

  refreshBadge() {
    if (!this.badgeEl) return;
    const n = this.tracker.claimableCount();
    this.badgeEl.textContent = String(n);
    this.badgeEl.hidden = n === 0;
  }

  filtered() {
    const all = this.tracker.list();
    if (this.filter === "all") return all;
    return all.filter((c) => c.state === this.filter);
  }

  render() {
    const list = this.listEl;
    list.innerHTML = "";
    const cards = this.filtered();

    if (!cards.length) {
      const empty = document.createElement("p");
      empty.className = "missions-empty";
      empty.textContent =
        this.filter === "completed"
          ? "No hay recompensas pendientes."
          : "No hay misiones en esta categoría.";
      list.appendChild(empty);
      return;
    }

    for (const card of cards) {
      list.appendChild(this._buildCard(card));
    }
  }

  _buildCard(card) {
    const el = document.createElement("article");
    el.className = `mission-row state-${card.state}`;
    el.dataset.sku = String(card.sku);

    const pct = card.target > 0 ? Math.round((card.progress / card.target) * 100) : 0;
    const reward = card.rewardCash.toLocaleString("en-US");

    let statusHtml = "";
    if (card.state === "open") {
      statusHtml = `
        <div class="mission-row-status">
          <div class="mission-bar"><div class="mission-bar-fill" style="width:${pct}%"></div></div>
          <span class="mission-progress-count">${card.progress}/${card.target}</span>
        </div>
      `;
    } else if (card.state === "completed") {
      statusHtml = `
        <button type="button" class="mission-claim" data-claim="${card.sku}">
          Recoger
        </button>
      `;
    } else {
      statusHtml = `<span class="mission-locked-tag">Bloqueada</span>`;
    }

    const unlock =
      card.state === "locked" && card.unlockText
        ? `<p class="mission-unlock-hint">${replaceDollarSymbols(escapeHtml(card.unlockText))}</p>`
        : "";

    el.innerHTML = `
      <div class="mission-row-top">
        <h3 class="mission-title">${escapeHtml(card.title)}</h3>
        <button type="button" class="mission-info" data-info="${card.sku}" title="${escapeHtml(this.tracker.t(255, "Info de la misión"))}">
          <img src="${SPRITES.info}" alt="info" />
        </button>
      </div>
      <div class="mission-row-bottom">
        <div class="mission-reward-row${card.state === "locked" ? " muted" : ""}">
          <img class="mission-cash-icon" src="${SPRITES.cash}" alt="" />
          <strong>${reward}</strong>
        </div>
        ${statusHtml}
      </div>
      ${unlock}
    `;

    el.querySelector("[data-info]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showDetail(card);
    });

    el.querySelector("[data-claim]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      const rewardCash = this.tracker.collect(card.sku);
      if (rewardCash > 0) this.onCollect(card.sku, rewardCash);
      this.render();
    });

    return el;
  }

  showDetail(card) {
    if (!this.detailEl) return;
    const title = this.tracker.t(255, "Info de la misión");
    this.detailEl.hidden = false;
    this.detailEl.innerHTML = `
      <div class="mission-detail-card">
        <h3>${escapeHtml(card.title)}</h3>
        <p class="mission-detail-label">${escapeHtml(title)}</p>
        <p class="mission-detail-desc">${replaceDollarSymbols(escapeHtml(card.description))}</p>
        ${
          card.state === "locked" && card.unlockText
            ? `<p class="mission-detail-lock">${replaceDollarSymbols(escapeHtml(card.unlockText))}</p>`
            : ""
        }
        <button type="button" class="mission-detail-ok">OK</button>
      </div>
    `;
    this.detailEl.querySelector(".mission-detail-ok")?.addEventListener("click", () => {
      this.detailEl.hidden = true;
    });
    this.detailEl.addEventListener(
      "click",
      (e) => {
        if (e.target === this.detailEl) this.detailEl.hidden = true;
      },
      { once: true }
    );
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
