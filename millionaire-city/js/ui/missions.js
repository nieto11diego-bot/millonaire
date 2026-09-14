/**
 * Missions panel UI — card list mirroring MissionObject states.
 */

const SPRITES = {
  progress: "assets/ui/mission_progress_card.png",
  locked: "assets/ui/mission_locked_card.png",
  reward: "assets/ui/mission_reward_card.png",
  cash: "assets/ui/icon_hud_cash.png",
  info: "assets/ui/icon_info.png",
  accept: "assets/ui/button_accept.png",
  lockedBtn: "assets/ui/button_locked.png",
  bar: "assets/ui/time_bar.png",
  barBg: "assets/ui/time_bar_background.png",
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
    el.className = `mission-card state-${card.state}`;
    el.dataset.sku = String(card.sku);

    const strip =
      card.state === "completed"
        ? SPRITES.reward
        : card.state === "locked"
          ? SPRITES.locked
          : SPRITES.progress;

    const pct = card.target > 0 ? Math.round((card.progress / card.target) * 100) : 0;
    const reward = card.rewardCash.toLocaleString("en-US");

    let body = "";
    if (card.state === "open") {
      body = `
        <div class="mission-reward-row">
          <span class="mission-reward-label">${escapeHtml(this.tracker.t(251, "Recompensa"))}</span>
          <img class="mission-cash-icon" src="${SPRITES.cash}" alt="" />
          <strong>$${reward}</strong>
        </div>
        <div class="mission-progress-block">
          <span class="mission-progress-label">${escapeHtml(this.tracker.t(252, "En curso"))}</span>
          <div class="mission-bar" style="border-image-source:url('${SPRITES.barBg}')">
            <div class="mission-bar-fill" style="width:${pct}%;background-image:url('${SPRITES.bar}')"></div>
          </div>
          <span class="mission-progress-count">${card.progress}/${card.target}</span>
        </div>
        ${card.trackable ? "" : `<p class="mission-soon">Progreso al implementar contratos / cobros</p>`}
      `;
    } else if (card.state === "completed") {
      body = `
        <div class="mission-reward-row">
          <span class="mission-reward-label">${escapeHtml(this.tracker.t(251, "Recompensa"))}</span>
          <img class="mission-cash-icon" src="${SPRITES.cash}" alt="" />
          <strong>$${reward}</strong>
        </div>
        <button type="button" class="mission-claim" data-claim="${card.sku}">
          <img src="${SPRITES.accept}" alt="" />
          <span>${escapeHtml(this.tracker.t(253, "Recoger recompensa"))}</span>
        </button>
      `;
    } else {
      body = `
        <div class="mission-reward-row muted">
          <span class="mission-reward-label">${escapeHtml(this.tracker.t(251, "Recompensa"))}</span>
          <img class="mission-cash-icon" src="${SPRITES.cash}" alt="" />
          <strong>$${reward}</strong>
        </div>
        <button type="button" class="mission-locked-btn" disabled>
          <img src="${SPRITES.lockedBtn}" alt="" />
          <span>Bloqueada</span>
        </button>
        ${card.unlockText ? `<p class="mission-unlock-hint">${escapeHtml(card.unlockText)}</p>` : ""}
      `;
    }

    el.innerHTML = `
      <div class="mission-strip" style="background-image:url('${strip}')"></div>
      <div class="mission-body">
        <header class="mission-head">
          <h3 class="mission-title">${escapeHtml(card.title)}</h3>
          <button type="button" class="mission-info" data-info="${card.sku}" title="${escapeHtml(this.tracker.t(255, "Info de la misión"))}">
            <img src="${SPRITES.info}" alt="info" />
          </button>
        </header>
        ${body}
      </div>
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
        <p class="mission-detail-desc">${escapeHtml(card.description)}</p>
        ${
          card.state === "locked" && card.unlockText
            ? `<p class="mission-detail-lock">${escapeHtml(card.unlockText)}</p>`
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
