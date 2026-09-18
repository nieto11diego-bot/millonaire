/**
 * Level-up rewards: cash, gold ingots, or diamonds (every 5 levels).
 */

/**
 * @typedef {{ type: 'cash' | 'gold' | 'diamond', amount: number }} LevelReward
 */

/**
 * Reward granted for reaching `level` (level 1 has none).
 * Diamonds every 5 levels: L5→1, L10→2, L15→3…
 * Other levels: even → gold, odd → cash, scaled by level.
 * @param {number} level
 * @returns {LevelReward | null}
 */
export function rewardForLevel(level) {
  const lv = Math.floor(Number(level) || 0);
  if (lv < 2) return null;

  if (lv % 5 === 0) {
    return { type: "diamond", amount: lv / 5 };
  }

  if (lv % 2 === 0) {
    // Gold scales gently with level (L2→1, L6→2, L12→4…)
    return { type: "gold", amount: Math.max(1, Math.round(lv / 3)) };
  }

  // Cash: equitable curve vs. level (half of previous scale)
  const amount = Math.round(12_500 * lv * (1 + (lv - 1) * 0.1));
  return { type: "cash", amount };
}

/**
 * Reward for the next level after `currentLevel`.
 * @param {number} currentLevel
 * @returns {LevelReward | null}
 */
export function nextLevelReward(currentLevel) {
  return rewardForLevel(Math.floor(Number(currentLevel) || 1) + 1);
}

/**
 * Rewards for each level gained when jumping from `fromLevel` to `toLevel`.
 * @param {number} fromLevel
 * @param {number} toLevel
 * @returns {LevelReward[]}
 */
export function rewardsBetween(fromLevel, toLevel) {
  const from = Math.floor(Number(fromLevel) || 1);
  const to = Math.floor(Number(toLevel) || 1);
  /** @type {LevelReward[]} */
  const out = [];
  for (let lv = from + 1; lv <= to; lv++) {
    const r = rewardForLevel(lv);
    if (r) out.push(r);
  }
  return out;
}

/**
 * Merge several rewards into totals by type.
 * @param {LevelReward[]} rewards
 * @returns {{ cash: number, gold: number, diamond: number }}
 */
export function sumRewards(rewards) {
  let cash = 0;
  let gold = 0;
  let diamond = 0;
  for (const r of rewards) {
    if (r.type === "cash") cash += r.amount;
    else if (r.type === "gold") gold += r.amount;
    else if (r.type === "diamond") diamond += r.amount;
  }
  return { cash, gold, diamond };
}
