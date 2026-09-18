/** Load game data JSON (requires local HTTP server). */
export async function loadGameData() {
  const [economy, buildings, i18n, roads, missions, levels] = await Promise.all([
    fetch("data/economy.json").then((r) => r.json()),
    fetch("refs/buildings.json").then((r) => r.json()),
    fetch("data/i18n.json").then((r) => r.json()),
    fetch("data/roads.json").then((r) => r.json()),
    fetch("data/missions.json").then((r) => r.json()),
    fetch("data/levels.json").then((r) => r.json()).catch(() => null),
  ]);
  return { economy, buildings, i18n, roads, missions, levels };
}

export function spriteUrlFromFile(spriteFile) {
  if (!spriteFile) return null;
  const leaf = spriteFile.split("/").pop();
  return `assets/buildings/${leaf}`;
}

export function enrichCatalog(economy, buildings) {
  const enrich = (item, forcedCategory = null) => {
    const b = item.anm ? buildings[item.anm] : null;
    const spriteFile = item.spriteFile || (b && b.sprite_file) || null;
    const width = item.width || (b && b.width) || item.gridW * 32;
    const height = item.height || (b && b.height) || item.gridH * 32;
    const category =
      forcedCategory ||
      (item.houseBonusScaled != null || item.decorationBonus != null
        ? "decoration"
        : "house");

    // economy.json uses cityBonus*; gameplay/UI read rewardBonus*
    const rewardBonusScaled =
      item.rewardBonusScaled ??
      (category === "wonder" ? item.cityBonusScaled : undefined);
    const rewardBonusPercentApprox =
      item.rewardBonusPercentApprox ??
      (category === "wonder" ? item.cityBonusPercentApprox : undefined);

    // decorationBonus (fraction) ↔ houseBonusScaled (100 = 1%)
    let houseBonusScaled = item.houseBonusScaled;
    if (houseBonusScaled == null && item.decorationBonus != null) {
      houseBonusScaled = Math.round(Number(item.decorationBonus) * 10000);
    }
    const houseBonusPercentApprox =
      item.houseBonusPercentApprox != null
        ? item.houseBonusPercentApprox
        : houseBonusScaled != null
          ? Math.round((houseBonusScaled / 100) * 100) / 100
          : undefined;

    const influenceRadiusTiles =
      item.influenceRadiusTiles ?? item.influenceRadius ?? undefined;

    return {
      ...item,
      width,
      height,
      spriteUrl: spriteUrlFromFile(spriteFile),
      category,
      ...(rewardBonusScaled != null ? { rewardBonusScaled } : {}),
      ...(rewardBonusPercentApprox != null ? { rewardBonusPercentApprox } : {}),
      ...(houseBonusScaled != null ? { houseBonusScaled } : {}),
      ...(houseBonusPercentApprox != null ? { houseBonusPercentApprox } : {}),
      ...(influenceRadiusTiles != null ? { influenceRadiusTiles } : {}),
    };
  };

  return {
    houses: (economy.houses || []).map((item) => enrich(item)),
    commerces: (economy.commerces || []).map((item) => enrich(item, "commercial")),
    decorations: (economy.decorations || []).map((item) => enrich(item, "decoration")),
    wonders: (economy.wonders || []).map((item) => enrich(item, "wonder")),
    hq: economy.hq ? enrich(economy.hq, "hq") : null,
  };
}
