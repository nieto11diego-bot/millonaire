/**
 * Cloud save via Next.js /api/saves (Supabase + cookie session).
 * No-ops gracefully when offline, guest, or not hosted under the Next app.
 */

const API = "/api/saves";

/** @type {ReturnType<typeof setTimeout> | 0} */
let queueTimer = 0;
/** @type {object | null} */
let pendingSnapshot = null;
/** @type {Promise<boolean> | null} */
let inFlight = null;

/**
 * @returns {Promise<{ id: string, email?: string } | null>}
 */
export async function getSessionUser() {
  try {
    const res = await fetch(API, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<object | null>}
 */
export async function fetchCloudSave() {
  try {
    const res = await fetch(API, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.user || !data.snapshot) return null;
    return data.snapshot;
  } catch {
    return null;
  }
}

/**
 * @param {object} snapshot
 * @returns {Promise<boolean>}
 */
export async function upsertCloudSave(snapshot) {
  if (!snapshot) return false;
  try {
    const res = await fetch(API, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    return res.ok;
  } catch (err) {
    console.warn("[cloudSave] upsert failed", err);
    return false;
  }
}

/**
 * @returns {Promise<boolean>}
 */
export async function clearCloudSave() {
  try {
    const res = await fetch(API, { method: "DELETE", credentials: "include" });
    // 401 = guest / no session — treat as ok
    return res.ok || res.status === 401;
  } catch (err) {
    console.warn("[cloudSave] clear failed", err);
    return false;
  }
}

/**
 * Debounced cloud upsert so the sim tick stays free.
 * @param {object} snapshot
 */
export function queueCloudSave(snapshot) {
  pendingSnapshot = snapshot;
  if (queueTimer) clearTimeout(queueTimer);
  queueTimer = setTimeout(() => {
    queueTimer = 0;
    flushCloudSave();
  }, 800);
}

/**
 * @returns {Promise<boolean>}
 */
export async function flushCloudSave() {
  if (queueTimer) {
    clearTimeout(queueTimer);
    queueTimer = 0;
  }
  const snap = pendingSnapshot;
  if (!snap) return true;
  pendingSnapshot = null;

  if (inFlight) await inFlight;
  inFlight = upsertCloudSave(snap).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
