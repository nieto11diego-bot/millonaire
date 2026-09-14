# Millionaire City data extraction — notes

Private prototype data pipeline. Assets/text come from **Millionaire City DEAR MOD v1.0.55**.

## Sources

| Path | Role |
|------|------|
| `c:\Users\nieto\Desktop\Millonaire\assets\l0_0`…`l4_0` | Localization packs (en/fr/de/it/es) |
| `c:\Users\nieto\Desktop\Millonaire\classes.dex` | Game logic |
| jadx-gui cache / `tools/jadx-out/com/dchoc/dollars/*.java` | Decompiled classes |
| `resources/r5_0078.bin` (asset catalog) | `LayerGameObjects` shop/object definitions |
| `refs/buildings.json` | ANM → sprite mapping |

## Deliverables

- `data/i18n.json` — 411 strings × 5 locales + semantic `keys`
- `data/economy.json` — houses, commerces (radii), contracts, decorations, wonders, level curve, formulas
- `data/missions.json` — 33 missions from `MissionScreen.DATA`
- `data/objects_catalog_raw.json` — raw parse of `r5_0078.bin`

## Confidence legend

- **dex-verified**: numbers/formulas taken from decompiled Java or binary object table with matching constructors.
- **inferred-from-i18n**: numeric goal also (or only) visible in EN mission text; used as cross-check.
- **partial**: ANM/sprite link guessed from name heuristics; economy stats still dex-verified.

## What is dex-verified

### Localization (`l*_0`)

```
u32be fileSize
u32be count          // 411
u32be offsets[count]
at each offset: u16be length + utf8 bytes
```

Locales: `l0=en`, `l1=fr`, `l2=de`, `l3=it`, `l4=es`.

### Contracts (`ContractScreen`)

`CONTRACT_IDS[id] = { xp, durationSec, costBase, incomeBase, nameTid, anm, icon }`

Resolved durations (seconds): 180, 1800, 3600, 14400, 28800, 43200, 86400, 172800, 259200.

Constants that jadx inlined as other types:

- `HttpConnection.HTTP_INTERNAL_ERROR` = **500** (contract 4 cost base; group 11 income mod)
- `GameStates.DAY` = **86400**
- `BuffObject.DRAWING_PRIORITY_IN_FRONT_OF_OBJECT` = **3000** (contract 8 cost base)
- Several `TextIDs.TID_*` used as bare ints in `CONTRACT_GROUPS` (e.g. `TID_BUY_EXPANSION=280`)

Formulas:

- `cost = (costBase * group.costMod) / 100`
- `income = ((incomeBase * group.incomeMod) / 100) * (influence + 10000) / 10000`
- `tenants = group.tenants`
- House `contractGroup` indexes into `CONTRACT_GROUPS` (0–16)

### Buildings / radii (`r5_0078.bin` + `ObjectCommercial`)

Field `mInfluenceRatioTiles` → `clientRadiusTiles` (pizzeria/coffee = **2**, flower = **3**, …).

Commerce `incomeTimeSec` is typically **180**; `incomeValue` is the commerce tick payout base.

Decoration `houseBonusScaled`: **100 ≈ 1%** contribution to house influence (trees 200 ≈ 2%, fountain 1400 ≈ 14%).

Wonder `cityBonusScaled`: **500 ≈ 5%** city-wide (matches HUD string “%U% bonus to entire city”).

### Level curve (`LevelUpLogic`)

- `BASE_EXPERIENCE = 100`
- `BASE_EXPERIENCEPERLEVEL = 470`
- Full `LEVEL_THRESHOLDS[]` copied into `economy.json`

### Missions (`MissionScreen.DATA`)

Row layout: `[sku, unlockSku, unlockLevel, amount, condition, rewardCash, titleTid, descTid]`

- Progress bar target uses **amount** (`MissionObject.mTargetAmount`).
- For client/bonus missions, **condition** usually holds the numeric goal (customers or house-bonus %).

## Conflicts / gaps

1. **Coffeelicious II** (`sku=21`): DEX `condition=12`, EN text says **24** customers. Flagged: prefer DEX for logic, keep i18n text as-is for UI.
2. **Singles Night** (`CLIENTS_NIGHT_CLUB=22`) exists as a constant but is **not** in this build’s `DATA` array.
3. Some Facebook / social missions (sku 1, 3, 4, 41–44) are absent from `DATA` in this APK.
4. Placeholder catalog entries with `objectId=-1` skipped in `economy.json`.
5. Duplicate wonder rows in the binary (statue/discovery appear twice); deduped by `objectId`.
6. `COMMERCE_ICE_CREAM_SHOP` reports `maxClients=1` in the binary — unusual; left as dex-verified literal.
7. Sprites: `tools/fix_sprites.ps1` maps `animationIdleRid` → ANM/`buildings.json`, or for DLC items reads descriptor byte\[22\]=sprite pack + bytes\[23:24\]=index (often `r5_*`). All shop buildings now have `spriteFile` + local PNG under `assets/buildings/`.
8. Expansion plot costs exist as `ObjectCityExpansion` records in the level layer; this catalog file had **0** expansion objects — expansion economy may live in another layer resource (not yet parsed). `CITY_EXPANSION_*` IDs are listed in `IdollarsConstants`.

## Tools

```powershell
powershell -File tools/extract_i18n.ps1
powershell -File tools/extract_economy.ps1
```

Re-building `economy.json` / `missions.json` is currently done by the one-shot scripts run during this extraction (logic documented here; can be folded into `extract_economy.ps1` later).

## jadx note

CLI decompile to `tools/jadx-out` via `jadx-gui-*-all.jar -d` did not always flush sources. Classes were recovered from the existing jadx-gui project cache:

`%LOCALAPPDATA%\skylot\jadx\cache\projects\Millionaire City DEAR MOD v1.0.55-*\code\sources\`

and copied under `tools/jadx-out/com/dchoc/dollars/`.
