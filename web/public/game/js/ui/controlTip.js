/**
 * Long-press / hover helper tip for HUD and dock controls (mobile-friendly).
 */

const LONG_MS = 420;
const MOVE_CANCEL_PX = 12;

/**
 * @param {HTMLElement} root
 */
export class ControlTip {
  constructor(root) {
    this.root = root;
    this.root.classList.add("control-tip");
    this.root.hidden = true;
    this.root.setAttribute("role", "tooltip");
    this._hideTimer = 0;
  }

  /**
   * @param {string} text
   * @param {DOMRect | { left: number, top: number, width: number, height: number }} anchorRect
   * @param {{ stickyMs?: number }} [opts]
   */
  show(text, anchorRect, opts = {}) {
    const stickyMs = opts.stickyMs ?? 2200;
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = 0;
    }
    this.root.textContent = text;
    this.root.hidden = false;
    this.root.classList.add("visible");

    const stage = this.root.parentElement || document.body;
    const sr = stage.getBoundingClientRect();
    const tipW = this.root.offsetWidth || 160;
    const tipH = this.root.offsetHeight || 40;
    const cx = anchorRect.left + anchorRect.width / 2 - sr.left;
    const above = anchorRect.top - sr.top - 10;
    let left = cx;
    let top = above;
    const pad = 8;
    left = Math.max(pad + tipW / 2, Math.min(left, sr.width - pad - tipW / 2));
    if (top < tipH + pad) {
      top = anchorRect.bottom - sr.top + tipH / 2 + 10;
      this.root.classList.add("control-tip--below");
    } else {
      this.root.classList.remove("control-tip--below");
    }
    this.root.style.left = `${Math.round(left)}px`;
    this.root.style.top = `${Math.round(top)}px`;

    this._hideTimer = setTimeout(() => this.hide(), stickyMs);
  }

  hide() {
    if (this._hideTimer) {
      clearTimeout(this._hideTimer);
      this._hideTimer = 0;
    }
    this.root.classList.remove("visible", "control-tip--below");
    this.root.hidden = true;
  }
}

/**
 * Bind long-press (touch/pen) and optional hover (mouse) to show a tip.
 * Long-press suppresses the following click once.
 *
 * @param {HTMLElement} el
 * @param {() => string} getText
 * @param {ControlTip} tip
 * @param {{ hover?: boolean }} [opts]
 */
export function bindControlInfo(el, getText, tip, opts = {}) {
  const useHover = opts.hover !== false;
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let armed = false;

  const clear = () => {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
    }
  };

  const reveal = () => {
    const text = getText();
    if (!text) return;
    tip.show(text, el.getBoundingClientRect());
    armed = true;
    el.classList.add("info-armed");
  };

  el.addEventListener("pointerdown", (e) => {
    if (e.button != null && e.button !== 0) return;
    armed = false;
    el.classList.remove("info-armed");
    startX = e.clientX;
    startY = e.clientY;
    clear();
    timer = window.setTimeout(() => {
      timer = 0;
      reveal();
    }, LONG_MS);
  });

  el.addEventListener("pointermove", (e) => {
    if (!timer) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (dx * dx + dy * dy >= MOVE_CANCEL_PX * MOVE_CANCEL_PX) clear();
  });

  const end = () => clear();
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("pointerleave", end);

  el.addEventListener(
    "click",
    (e) => {
      if (!armed) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      armed = false;
      el.classList.remove("info-armed");
    },
    true
  );

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  if (useHover) {
    el.addEventListener("mouseenter", () => {
      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        tip.show(getText(), el.getBoundingClientRect(), { stickyMs: 4000 });
      }
    });
    el.addEventListener("mouseleave", () => tip.hide());
  }
}
