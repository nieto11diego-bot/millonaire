# Build economy.json + missions.json from extracted catalog + decompiled tables
# Run after extract_economy.ps1 (objects_catalog_raw.json) and extract_i18n.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$raw = Get-Content "$root\data\objects_catalog_raw.json" -Raw | ConvertFrom-Json
$i18n = Get-Content "$root\data\i18n.json" -Raw | ConvertFrom-Json
$buildings = Get-Content "$root\refs\buildings.json" -Raw | ConvertFrom-Json

$idNames = @{
  0="HOUSE_BUNGALOW"; 1="HOUSE_BUNGALOW_LUXURY"; 2="HOUSE_TOWNHOUSE"; 3="HOUSE_TOWNHOUSE_LUXURY"
  4="HOUSE_DUPLEX"; 5="HOUSE_DUPLEX_LUXURY"; 6="HOUSE_THREE_STORY"; 7="HOUSE_THREE_STORY_LUXURY"
  8="HOUSE_APARTMENT_BLOCK"; 9="HOUSE_APARTMENT_BLOCK_LUXURY"; 10="HOUSE_VILLA"; 11="HOUSE_LOFT_BLOCK"
  12="HOUSE_VILLA_LUXURY"; 13="HOUSE_SKYSCRAPER"; 14="HOUSE_LOFT_BLOCK_LUXURY"; 15="HOUSE_CHATEAU"; 16="HOUSE_SKYSCRAPER_LUXURY"
  17="COMMERCE_PIZZA"; 18="COMMERCE_CAFE"; 19="COMMERCE_FLOWERSHOP"; 20="COMMERCE_BOWLING"
  21="COMMERCE_JEWELLERY"; 22="COMMERCE_NIGHTCLUB"; 23="COMMERCE_MALL"; 24="COMMERCE_BANK"
  25="COMMERCE_HOSPITAL"; 26="COMMERCE_CASINO"; 27="DECO_TREE1"; 28="DECO_TREE2"; 29="DECO_PALM1"
  30="DECO_FOUNTAIN1"; 31="DECO_TREE4"; 32="DECO_TREE5"; 33="DECO_FOUNTAIN2"
  34="WONDER_STATUEOFMONEY"; 35="WONDER_DISCOVERY"; 36="WONDER_PYRAMID"; 38="HQ"
  151="DECO_POND_WEALTH"; 152="WONDER_AZTEC_CALENDAR"; 153="DECO_MARIACHI"; 154="COMMERCE_TACO_STAND"
  155="HOUSE_HACIENDA"; 157="HOUSE_TIKI"; 158="DECO_LEMON_STAND"; 159="COMMERCE_ICE_CREAM_SHOP"; 160="WONDER_TRANSATLANTIC"
}

$manualAnm = @{
  "Pizzeria"="ANM_COMMERCE_PIZZA_3X3"; "Coffee Shop"="ANM_COMMERCE_COFFEE_3X3"; "Flower Shop"="ANM_COMMERCE_FLOWERSHOP_3X3"
  "Bowling"="ANM_COMMERCE_BOWLING_3X4"; "Jewelery"="ANM_COMMERCE_JEWLLERY_3X4"; "Night Club"="ANM_COMMERCE_NIGHTCLUB_3X4"
  "Mall"="ANM_COMMERCE_SHOPPINGMALL_3X6"; "Bank"="ANM_COMMERCE_BANK_3X3"; "Hospital"="ANM_COMMERCE_HOSPITAL_3X5"
  "Casino"="ANM_COMMERCE_CASINO_3X5"; "Taco stand"="ANM_COMMERCE_TACOS_3X3"; "Ice cream shop"="ANM_COMMERCE_ICECREAM_3X3"
  "Bungalow"="ANM_HOUSE_06_2X2"; "Bungalow Luxury"="ANM_HOUSE_17_2X2"; "Townhouse"="ANM_HOUSE_01_3X3"
  "Townhouse Luxury"="ANM_HOUSE_02_3X3"; "Hacienda"="ANM_HOUSE_HACIENDA_3X3"; "Tiki"="ANM_HOUSE_TIKI_2X3"
}

function NameOf([int]$tid) {
  if ($tid -lt 0) { return $null }
  $s = $i18n.strings."$tid"
  if ($s) { return $s.en }
  return $null
}

function Find-Anm([string]$nameEn) {
  if (-not $nameEn) { return $null }
  if ($manualAnm.ContainsKey($nameEn)) { return $manualAnm[$nameEn] }
  foreach ($p in $buildings.PSObject.Properties) {
    $anm = $p.Name
    $key = ($nameEn -replace '[^a-zA-Z]', '').ToLower()
    if ($key.Length -ge 4 -and $anm.ToLower().Contains($key.Substring(0, [Math]::Min(5, $key.Length)))) { return $anm }
  }
  return $null
}

$byId = @{}
foreach ($o in $raw.objects) {
  if ($o.kind -notin @('house','commercial','deco','wonder','hq','expansion')) { continue }
  if ($o.objectId -lt 0) { continue }
  $key = [string]$o.objectId
  if (-not $byId.ContainsKey($key)) { $byId[$key] = $o }
}

$houses = @(); $commerces = @(); $decos = @(); $wonders = @(); $expansions = @(); $hq = $null
foreach ($k in ($byId.Keys | Sort-Object { [int]$_ })) {
  $o = $byId[$k]
  $name = NameOf ([int]$o.nameTid)
  $anm = Find-Anm $name
  $binfo = if ($anm -and $buildings.$anm) { $buildings.$anm } else { $null }
  $base = [ordered]@{
    objectId = [int]$o.objectId
    constant = $(if ($idNames.ContainsKey([int]$o.objectId)) { $idNames[[int]$o.objectId] } else { $null })
    nameTid = [int]$o.nameTid
    name = $name
    descTid = $(if ($null -ne $o.descTid) { [int]$o.descTid } else { $null })
    level = [int]$o.level
    exp = [int]$o.exp
    gridW = [int]$o.gridW
    gridH = [int]$o.gridH
    costCoins = [int]$o.costCoins
    costFortune = [int]$o.costFortune
    buildTimeSec = [int]$o.buildTimeSec
    anm = $anm
    spriteFile = $(if ($binfo) { $binfo.sprite_file } else { $null })
    confidence = "dex-verified"
  }
  switch ($o.kind) {
    'house' {
      $base.contractGroup = [int]$o.contractGroup
      $base.instantBuildFactor = [int]$o.instantBuildFactor
      $base.forSale = [int]$o.forSale
      $houses += $base
    }
    'commercial' {
      $base.clientRadiusTiles = [int]$o.clientRadiusTiles
      $base.maxClients = [int]$o.maxClients
      $base.incomeValue = [int]$o.incomeValue
      $base.incomeTimeSec = [int]$o.incomeTimeSec
      $base.dailyBonus = [int]$o.dailyBonus
      $base.instantBuildFactor = [int]$o.instantBuildFactor
      $base.forSale = [int]$o.forSale
      $commerces += $base
    }
    'deco' {
      $base.houseBonusScaled = [int]$o.houseBonusScaled
      $base.houseBonusPercentApprox = [math]::Round([int]$o.houseBonusScaled / 100.0, 2)
      $base.influenceRadiusTiles = [int]$o.influenceRadiusTiles
      $base.bonusNote = "100 scaled ~= 1% toward house influence; rent uses (influence+10000)/10000"
      $decos += $base
    }
    'wonder' {
      $base.cityBonusScaled = [int]$o.cityBonusScaled
      $base.cityBonusPercentApprox = [math]::Round([int]$o.cityBonusScaled / 100.0, 2)
      $base.influenceRadiusTiles = $(if ($null -ne $o.influenceRadiusTiles) { [int]$o.influenceRadiusTiles } else { $null })
      $base.instantBuildFactor = $(if ($null -ne $o.instantBuildFactor) { [int]$o.instantBuildFactor } else { $null })
      $wonders += $base
    }
    'hq' { $hq = $base }
    'expansion' {
      $expansions += [ordered]@{
        objectId = [int]$o.objectId; costCoins = [int]$o.costCoins; costFortune = [int]$o.costFortune
        buyEventId = [int]$o.buyEventId; confidence = "dex-verified"
      }
    }
  }
}

$contractNames = @(335,336,337,338,339,340,341,342,343)
$contractIds = @(
  @{ xp=1; timeSec=180; costBase=36; incomeBase=350 },
  @{ xp=3; timeSec=1800; costBase=200; incomeBase=1230 },
  @{ xp=7; timeSec=3600; costBase=300; incomeBase=1570 },
  @{ xp=15; timeSec=14400; costBase=425; incomeBase=4300 },
  @{ xp=20; timeSec=28800; costBase=500; incomeBase=5800 },
  @{ xp=25; timeSec=43200; costBase=1500; incomeBase=8500 },
  @{ xp=30; timeSec=86400; costBase=2000; incomeBase=12000 },
  @{ xp=40; timeSec=172800; costBase=2500; incomeBase=17000 },
  @{ xp=50; timeSec=259200; costBase=3000; incomeBase=20700 }
)
$contracts = @()
for ($i = 0; $i -lt 9; $i++) {
  $c = $contractIds[$i]
  $contracts += [ordered]@{
    id = $i; nameTid = $contractNames[$i]; name = (NameOf $contractNames[$i])
    xp = $c.xp; durationSec = $c.timeSec; durationMin = [int]($c.timeSec / 60)
    costBase = $c.costBase; incomeBase = $c.incomeBase
    anm = ("ANM_CONTRACT_0{0}" -f ($i + 1)); confidence = "dex-verified"
  }
}

$groups = @(
  @{ tenants=3; inversion=30000; costMod=250; incomeMod=100 },
  @{ tenants=4; inversion=60000; costMod=250; incomeMod=115 },
  @{ tenants=5; inversion=100000; costMod=270; incomeMod=280 },
  @{ tenants=6; inversion=160000; costMod=270; incomeMod=300 },
  @{ tenants=5; inversion=250000; costMod=270; incomeMod=395 },
  @{ tenants=6; inversion=300000; costMod=270; incomeMod=410 },
  @{ tenants=8; inversion=200000; costMod=330; incomeMod=270 },
  @{ tenants=9; inversion=225000; costMod=330; incomeMod=275 },
  @{ tenants=20; inversion=600000; costMod=290; incomeMod=355 },
  @{ tenants=28; inversion=1000000; costMod=290; incomeMod=480 },
  @{ tenants=25; inversion=3000000; costMod=290; incomeMod=400 },
  @{ tenants=30; inversion=7000000; costMod=290; incomeMod=500 },
  @{ tenants=6; inversion=2000000; costMod=290; incomeMod=600 },
  @{ tenants=7; inversion=4000000; costMod=290; incomeMod=680 },
  @{ tenants=35; inversion=5000000; costMod=300; incomeMod=440 },
  @{ tenants=50; inversion=15000000; costMod=300; incomeMod=900 },
  @{ tenants=5; inversion=12000000; costMod=300; incomeMod=1450 }
)
$contractGroups = @()
for ($i = 0; $i -lt $groups.Count; $i++) {
  $g = $groups[$i]
  $contractGroups += [ordered]@{
    id = $i; tenants = $g.tenants; inversion = $g.inversion
    costModifierPercent = $g.costMod; incomeModifierPercent = $g.incomeMod; confidence = "dex-verified"
  }
}

$levelThresholds = @(0,470,1010,1580,2220,2890,3600,4500,5630,7130,9010,11410,14110,16910,19810,24820,31490,41490,53490,68160,85490,104820,128150,161480,198150,238150,281480,341480,409480,489480,589480,701480,825480,961480,1109480,1269480,1441480,1617480,1805480,2005480,2217480,2449480,2689480,2945480,3225480,3521480,3841480,4181480,4541480,4941480,5381480,5429480,5481480,5537480,5597480,5661480,5729480,5801480,5877480,5957480,6041480,6129480,6221480,6317480,6417480,6521480,6629480,6741480,6857480,6977480,7101480,7229480,7361480,7497480,7637480,7781480,7929480,8081480,8237480,8397480,8561480,8729480,8905480,9089480,9281480,9481480,9689480,9905480,10129480,10361480,10601480,10849480,11105480,11369480,11641480,11921480,12209480,12505480,12809480,13121480)

$economy = [ordered]@{
  meta = [ordered]@{ source = "Millionaire City DEAR MOD v1.0.55"; objectsCatalog = "resources/r5_0078.bin"; extractedAt = (Get-Date).ToString("o") }
  rules = [ordered]@{
    rent = [ordered]@{
      description = "Houses earn rent via signed contracts. Collect when ready; missing collect triggers lost-rent state."
      collectStateIds = [ordered]@{ select = 58; wait = 59; collect = 60; lost = 61 }
      formulas = [ordered]@{
        contractCost = "(contract.costBase * contractGroup.costModifierPercent) / 100"
        contractIncome = "((contract.incomeBase * contractGroup.incomeModifierPercent) / 100) * (houseInfluence + 10000) / 10000"
        tenants = "contractGroup.tenants"; durationMs = "contract.durationSec * 1000"; xp = "contract.xp"
      }
      confidence = "dex-verified"
    }
    commerce = [ordered]@{
      description = "Signed-contract houses inside clientRadiusTiles count as customers (capped by maxClients)."
      confidence = "dex-verified"
    }
    houseBonus = [ordered]@{
      description = "Decorations within influenceRadiusTiles add houseBonusScaled to house influence."
      scale = "100 scaled units ~= 1%"; confidence = "dex-verified"
    }
    wonders = [ordered]@{ description = "cityBonusScaled; 500 ~= 5% city-wide."; confidence = "dex-verified" }
  }
  levelCurve = [ordered]@{ baseExperience = 100; baseExperiencePerLevel = 470; thresholds = $levelThresholds; confidence = "dex-verified" }
  contracts = $contracts
  contractGroups = $contractGroups
  houses = $houses
  commerces = $commerces
  decorations = $decos
  wonders = $wonders
  hq = $hq
  expansions = $expansions
}
[IO.File]::WriteAllText("$root\data\economy.json", ($economy | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))

# ----- missions -----
$skuTypes = @{
  2="buy_pizzeria"; 5="sign_contracts"; 6="sign_contracts"; 7="buy_townhouse"; 8="buy_coffee_shop"
  10="buy_trees"; 11="buy_fountains"; 12="buy_big_garden"; 13="buy_townhouse_luxury"; 16="buy_skyscrapers"
  17="buy_wonder"; 18="clients_pizzeria"; 19="clients_pizzeria"; 20="clients_pizzeria"; 21="clients_coffee_shop"
  23="bonus_bungalow"; 24="bonus_bungalow_luxury"; 25="bonus_townhouse"; 26="bonus_villa"
  28="collect_from_pizzeria"; 29="collect_coffee_shop"; 30="collect_rents"; 31="collect_rents"
  32="collect_rents"; 33="collect_rents"; 34="buy_expansion"; 35="millionaire"; 36="buy_all_wonders"
  37="millionaire"; 38="company_value"; 39="company_value"; 40="company_value"; 420="instant_build"
}
$data = @(
  @(2,-1,1,1,0,35000,70,71), @(28,2,1,1,0,25000,122,123), @(18,2,1,1,3,30000,102,103),
  @(19,18,1,1,10,35000,104,105), @(20,19,1,1,16,60000,106,107), @(23,-1,1,1,12,25000,112,113),
  @(24,23,1,1,16,60000,114,115), @(7,-1,5,1,0,35000,80,81), @(25,7,1,1,30,40000,116,117),
  @(8,-1,5,1,0,35000,82,83), @(21,8,1,1,12,35000,108,109), @(29,8,1,50,0,55000,124,125),
  @(10,-1,1,2,0,35000,86,87), @(11,-1,13,3,0,40000,88,89), @(12,-1,24,1,0,40000,90,91),
  @(13,-1,6,1,0,40000,92,93), @(16,-1,23,3,0,250000,98,99), @(17,-1,1,1,0,35000,100,101),
  @(26,-1,18,1,90,50000,118,119), @(5,-1,1,2,0,40000,76,77), @(6,5,1,20,0,50000,78,79),
  @(30,-1,4,10,0,30000,126,127), @(31,30,4,50,0,35000,128,129), @(32,31,4,100,0,40000,130,131),
  @(33,32,4,200,0,45000,132,133), @(34,-1,20,1,0,55000,134,135), @(37,-1,10,1,1000000,35000,140,141),
  @(35,-1,10,1,10000000,125000,136,137), @(38,-1,1,1,1000000,35000,142,143),
  @(39,38,1,1,5000000,55000,144,145), @(40,39,1,1,10000000,125000,146,147),
  @(36,-1,1,1,6,200000,138,139), @(420,-1,1,10,0,50000,156,157)
)

$missions = @()
foreach ($row in $data) {
  $sku = [int]$row[0]; $unlockSku = [int]$row[1]; $unlockLevel = [int]$row[2]
  $amount = [int]$row[3]; $condition = [int]$row[4]; $reward = [int]$row[5]
  $nameTid = [int]$row[6]; $descTid = [int]$row[7]
  $type = if ($skuTypes.ContainsKey($sku)) { $skuTypes[$sku] } else { "unknown" }
  $title = NameOf $nameTid; $desc = NameOf $descTid
  $target = [ordered]@{ amount = $amount; condition = $condition; metric = "progress"; value = $amount; source = "dex-verified" }
  if ($type -like 'clients_*') { $target.metric = "customers"; $target.value = $condition; $target.note = "condition holds customer target; amount is progress counter unit" }
  elseif ($type -like 'bonus_*') { $target.metric = "house_bonus_percent"; $target.value = $condition }
  elseif ($type -like 'collect_rents') { $target.metric = "rents_collected"; $target.value = $amount }
  elseif ($type -like 'sign_contracts') { $target.metric = "contracts_signed"; $target.value = $amount }
  elseif ($type -like 'collect_*') { $target.metric = "commerce_collects"; $target.value = $amount }
  elseif ($type -in @('company_value','millionaire')) { $target.metric = "company_value"; $target.value = $condition }
  elseif ($type -eq 'buy_all_wonders') { $target.metric = "wonders_owned"; $target.value = $condition }
  elseif ($type -eq 'instant_build') { $target.metric = "instant_builds"; $target.value = $amount }
  elseif ($type -like 'buy_*') { $target.metric = "buildings_built"; $target.value = $amount }
  if ($sku -eq 21) { $target.i18nConflict = "EN text says 24 customers; DEX condition=12" }

  $missions += [ordered]@{
    sku = $sku; type = $type; titleTid = $nameTid; title = $title
    descriptionTid = $descTid; description = $desc; rewardCash = $reward
    unlockLevel = $unlockLevel; unlockSku = $(if ($unlockSku -eq -1) { $null } else { $unlockSku })
    target = $target; confidence = "dex-verified"
  }
}

$missionsPayload = [ordered]@{
  meta = [ordered]@{ source = "MissionScreen.DATA + TextIDs"; count = $missions.Count; extractedAt = (Get-Date).ToString("o") }
  schema = [ordered]@{
    sku = "Mission id"; type = "MissionScreen constant category"; rewardCash = "Cash on collect"
    unlockLevel = "Min level"; unlockSku = "Prior mission sku or null"
    target = "Goal; clients/bonus often use condition as the numeric requirement"
  }
  missions = $missions
}
[IO.File]::WriteAllText("$root\data\missions.json", ($missionsPayload | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))

Write-Host "Wrote economy.json and missions.json"
Write-Host "houses=$($houses.Count) commerces=$($commerces.Count) missions=$($missions.Count)"
