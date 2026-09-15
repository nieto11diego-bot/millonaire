/** Shared cash / gold / diamond icon + amount formatting. */

export const CASH_ICON = "assets/ui/icon_cash.png";
export const GOLD_ICON = "assets/ui/icon_gold.svg";
export const DIAMOND_ICON = "assets/ui/icon_diamond.svg";

/**
 * @param {number|string} n
 * @returns {string}
 */
export function formatCash(n) {
  return Number(n || 0).toLocaleString("en-US");
}

/**
 * @param {number|string} n
 * @returns {string}
 */
export function formatGold(n) {
  return Number(n || 0).toLocaleString("en-US");
}

/**
 * @param {number|string} n
 * @returns {string}
 */
export function formatDiamonds(n) {
  return Number(n || 0).toLocaleString("en-US");
}

/**
 * @param {string} [className]
 * @returns {string}
 */
export function cashIconHtml(className = "cash-ico") {
  return `<img class="${className}" src="${CASH_ICON}" alt="" />`;
}

/**
 * @param {string} [className]
 * @returns {string}
 */
export function goldIconHtml(className = "gold-ico") {
  return `<img class="${className}" src="${GOLD_ICON}" alt="" />`;
}

/**
 * @param {string} [className]
 * @returns {string}
 */
export function diamondIconHtml(className = "diamond-ico") {
  return `<img class="${className}" src="${DIAMOND_ICON}" alt="" />`;
}

/**
 * Inline cash icon + amount for HTML UIs.
 * @param {number|string} n
 * @param {string} [wrapClass]
 * @returns {string}
 */
export function cashHtml(n, wrapClass = "cash-amt") {
  return `<span class="${wrapClass}">${cashIconHtml()}<span>${formatCash(n)}</span></span>`;
}

/**
 * Inline gold-ingot icon + amount for HTML UIs.
 * @param {number|string} n
 * @param {string} [wrapClass]
 * @returns {string}
 */
export function goldHtml(n, wrapClass = "gold-amt") {
  return `<span class="${wrapClass}">${goldIconHtml()}<span>${formatGold(n)}</span></span>`;
}

/**
 * Inline diamond icon + amount for HTML UIs.
 * @param {number|string} n
 * @param {string} [wrapClass]
 * @returns {string}
 */
export function diamondHtml(n, wrapClass = "diamond-amt") {
  return `<span class="${wrapClass}">${diamondIconHtml()}<span>${formatDiamonds(n)}</span></span>`;
}

/**
 * Prefer diamonds → gold → cash for shop/tooltip cost labels.
 * @param {object} def
 * @returns {string}
 */
export function costHtml(def) {
  if ((def?.costDiamonds || 0) > 0) return diamondHtml(def.costDiamonds);
  if ((def?.costFortune || 0) > 0) return goldHtml(def.costFortune);
  return cashHtml(def?.costCoins || 0);
}

/**
 * Turn plain "$12,000" / bare "$" into icon markup (input must already be HTML-escaped).
 * @param {string} escaped
 * @returns {string}
 */
export function replaceDollarSymbols(escaped) {
  const ico = cashIconHtml("cash-ico cash-ico--inline");
  return String(escaped ?? "")
    .replace(/\$([0-9][0-9,]*)/g, `${ico}$1`)
    .replace(/\$/g, ico);
}

/**
 * Replace "lingote(s) [de oro]" phrases with the gold-ingot icon.
 * @param {string} escaped
 * @returns {string}
 */
export function replaceGoldWords(escaped) {
  const ico = goldIconHtml("gold-ico gold-ico--inline");
  return String(escaped ?? "")
    .replace(/(\d[\d,]*)\s+lingotes?(?:\s+de\s+oro)?/gi, `${ico}$1`)
    .replace(/lingotes?(?:\s+de\s+oro)?/gi, ico);
}

/**
 * Replace "diamante(s)" phrases with the diamond icon.
 * @param {string} escaped
 * @returns {string}
 */
export function replaceDiamondWords(escaped) {
  const ico = diamondIconHtml("diamond-ico diamond-ico--inline");
  return String(escaped ?? "")
    .replace(/(\d[\d,]*)\s+diamantes?/gi, `${ico}$1`)
    .replace(/diamantes?/gi, ico);
}

/**
 * Apply cash + gold + diamond symbol replacements for hint / plain text HTML.
 * @param {string} escaped
 * @returns {string}
 */
export function replaceCurrencySymbols(escaped) {
  return replaceDiamondWords(replaceGoldWords(replaceDollarSymbols(escaped)));
}
