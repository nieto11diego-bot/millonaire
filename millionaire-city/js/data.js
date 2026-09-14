/** Load game data JSON (requires local HTTP server). */
export async function loadGameData() {
  const [economy, buildings, i18n, roads] = await Promise.all([
    fetch("data/economy.json").then((r) => r.json()),
    fetch("refs/buildings.json").then((r) => r.json()),
    fetch("data/i18n.json").then((r) => r.json()),
    fetch("data/roads.json").then((r) => r.json()),
  ]);
  return { economy, buildings, i18n, roads };
}

export function spriteUrlFromFile(spriteFile) {
  if (!spriteFile) return null;
  const leaf = spriteFile.split("/").pop();
  return `assets/buildings/${leaf}`;
}

export function enrichCatalog(economy, buildings) {
  const enrich = (item) => {
    const b = item.anm ? buildings[item.anm] : null;
    const spriteFile = item.spriteFile || (b && b.sprite_file) || null;
    const width = item.width || (b && b.width) || item.gridW * 32;
    const height = item.height || (b && b.height) || item.gridH * 32;
    return {
      ...item,
      width,
      height,
      spriteUrl: spriteUrlFromFile(spriteFile),
      category:
        item.clientRadiusTiles != null
          ? "commercial"
          : item.houseBonusScaled != null
            ? "decoration"
            : item.cityBonusScaled != null
              ? "wonder"
              : "house",
    };
  };

  return {
    houses: (economy.houses || []).map(enrich),
    commerces: (economy.commerces || []).map(enrich),
    decorations: (economy.decorations || []).map(enrich),
    wonders: (economy.wonders || []).map(enrich),
  };
}
