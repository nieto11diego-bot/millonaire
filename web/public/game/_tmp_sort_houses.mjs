import fs from "fs";
import { execSync } from "child_process";

let raw = execSync("git show HEAD:millionaire-city/data/economy.json", {
  encoding: "utf8",
  maxBuffer: 20e6,
});
if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
const old = JSON.parse(raw);

function sortHouses(houses) {
  return [...houses].sort((a, b) => {
    const ca =
      (a.costCoins || 0) +
      (a.costFortune || 0) * 1e12 +
      (a.costDiamonds || 0) * 1e15;
    const cb =
      (b.costCoins || 0) +
      (b.costFortune || 0) * 1e12 +
      (b.costDiamonds || 0) * 1e15;
    // Free / unset price last so shop + starter stay sensible
    const za = ca === 0 ? 1 : 0;
    const zb = cb === 0 ? 1 : 0;
    if (za !== zb) return za - zb;
    return ca - cb;
  });
}

const sorted = sortHouses(old.houses);
console.log("Order for shop:");
sorted.forEach((h, i) => {
  console.log(`${i + 1}. ${h.name} — $${h.costCoins}`);
});

const paths = [
  "millionaire-city/data/economy.json",
  "web/public/game/data/economy.json",
];

for (const p of paths) {
  let cur = fs.readFileSync(p, "utf8");
  if (cur.charCodeAt(0) === 0xfeff) cur = cur.slice(1);
  const e = JSON.parse(cur);
  e.houses = sorted;
  const ordered = {};
  for (const k of [
    "meta",
    "rules",
    "levelCurve",
    "houses",
    "commerces",
    "decorations",
    "wonders",
    "hq",
    "expansions",
  ]) {
    if (e[k] !== undefined) ordered[k] = e[k];
  }
  for (const k of Object.keys(e)) {
    if (!(k in ordered)) ordered[k] = e[k];
  }
  fs.writeFileSync(p, JSON.stringify(ordered, null, 4) + "\n");
  console.log("Wrote", p, "houses:", ordered.houses.length);
}
