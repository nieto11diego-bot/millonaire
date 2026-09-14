# Extract Millionaire City localization packs l0_0..l4_0 → data/i18n.json
# Format: u32be size, u32be count, u32be offsets[count], then at each offset: u16be len + utf8
$ErrorActionPreference = "Stop"

$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -ErrorAction SilentlyContinue
if (-not $Root) { $Root = "c:\Users\nieto\Desktop\CURSOR\millionaire-city" }
# Script lives in millionaire-city/tools → project root is parent
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$Assets = "c:\Users\nieto\Desktop\Millonaire\assets"
$OutFile = Join-Path $ProjectRoot "data\i18n.json"

function Read-U8([byte[]]$b, [int]$i) { return [int]($b[$i] -band 0xFF) }
function Read-BE16([byte[]]$b, [int]$i) {
  return ((Read-U8 $b $i) -shl 8) -bor (Read-U8 $b ($i + 1))
}
function Read-BE32([byte[]]$b, [int]$i) {
  return ((Read-U8 $b $i) -shl 24) -bor ((Read-U8 $b ($i + 1)) -shl 16) -bor ((Read-U8 $b ($i + 2)) -shl 8) -bor (Read-U8 $b ($i + 3))
}

function Read-LocalePack([string]$path) {
  $bytes = [System.IO.File]::ReadAllBytes($path)
  $size = Read-BE32 $bytes 0
  $count = Read-BE32 $bytes 4
  if ($size -ne $bytes.Length) {
    Write-Warning "Size header $size != file length $($bytes.Length) for $path"
  }
  $strings = New-Object string[] $count
  for ($i = 0; $i -lt $count; $i++) {
    $off = Read-BE32 $bytes (8 + $i * 4)
    $len = Read-BE16 $bytes $off
    if ($len -lt 0 -or ($off + 2 + $len) -gt $bytes.Length) {
      $strings[$i] = ""
      continue
    }
    $strings[$i] = [System.Text.Encoding]::UTF8.GetString($bytes, $off + 2, $len)
  }
  return @{ count = $count; strings = $strings }
}

$localeFiles = @{
  en = "l0_0"
  fr = "l1_0"
  de = "l2_0"
  it = "l3_0"
  es = "l4_0"
}

$packs = @{}
foreach ($loc in @("en", "fr", "de", "it", "es")) {
  $path = Join-Path $Assets $localeFiles[$loc]
  if (-not (Test-Path $path)) { throw "Missing locale pack: $path" }
  $packs[$loc] = Read-LocalePack $path
  Write-Host "Loaded $loc ($($localeFiles[$loc])): $($packs[$loc].count) strings"
}

$count = $packs["en"].count
foreach ($loc in @("fr", "de", "it", "es")) {
  if ($packs[$loc].count -ne $count) {
    Write-Warning "Locale $loc count $($packs[$loc].count) != en count $count"
  }
}

# Semantic keys (stable indices from original game)
$keys = [ordered]@{
  "ui.language_name" = 0
  "ui.language_code" = 1
  "ui.ok" = 2
  "ui.select" = 3
  "ui.exit" = 4
  "ui.back" = 5
  "ui.edit" = 6
  "ui.erase" = 7
  "ui.menu" = 8
  "ui.start" = 9
  "ui.place" = 10
  "ui.retry" = 11
  "ui.yes" = 12
  "ui.no" = 13
  "ui.cancel" = 14
  "ui.next" = 15
  "ui.change" = 16
  "ui.done" = 17
  "ui.pause" = 18
  "ui.continue" = 19
  "ui.skip" = 20
  "ui.play" = 29
  "ui.settings" = 31
  "ui.options" = 32
  "ui.sounds" = 33
  "ui.music" = 34
  "ui.on" = 35
  "ui.off" = 36
  "ui.language" = 37
  "ui.hints" = 38
  "ui.reset_game" = 39
  "ui.instructions" = 41
  "ui.controls" = 42
  "ui.rules" = 43
  "ui.about" = 45
  "mission.pizzalicious_i.title" = 70
  "mission.pizzalicious_i.desc" = 71
  "mission.every_friend_counts_i.title" = 72
  "mission.every_friend_counts_i.desc" = 73
  "mission.every_friends_counts_ii.title" = 74
  "mission.every_friends_counts_ii.desc" = 75
  "mission.sign_2_contracts.title" = 76
  "mission.sign_2_contracts.desc" = 77
  "mission.sign_20_contracts.title" = 78
  "mission.sign_20_contracts.desc" = 79
  "mission.build_townhouse.title" = 80
  "mission.build_townhouse.desc" = 81
  "mission.coffeelicious_i.title" = 82
  "mission.coffeelicious_i.desc" = 83
  "mission.diversify.title" = 84
  "mission.diversify.desc" = 85
  "mission.green_thumb.title" = 86
  "mission.green_thumb.desc" = 87
  "mission.fountain_dream.title" = 88
  "mission.fountain_dream.desc" = 89
  "mission.green_thumb_ii.title" = 90
  "mission.green_thumb_ii.desc" = 91
  "mission.luxury_houses_i.title" = 92
  "mission.luxury_houses_i.desc" = 93
  "mission.twice_the_fun.title" = 94
  "mission.twice_the_fun.desc" = 95
  "mission.chateau_dream.title" = 96
  "mission.chateau_dream.desc" = 97
  "mission.skyscraper_dream.title" = 98
  "mission.skyscraper_dream.desc" = 99
  "mission.world_wonder.title" = 100
  "mission.world_wonder.desc" = 101
  "mission.pizzalicious_more_clients.title" = 102
  "mission.pizzalicious_more_clients.desc" = 103
  "mission.pizzalicious_ii.title" = 104
  "mission.pizzalicious_ii.desc" = 105
  "mission.pizzalicious_iii.title" = 106
  "mission.pizzalicious_iii.desc" = 107
  "mission.coffeelicious_ii.title" = 108
  "mission.coffeelicious_ii.desc" = 109
  "mission.singles_night.title" = 110
  "mission.singles_night.desc" = 111
  "mission.pimp_my_house_i.title" = 112
  "mission.pimp_my_house_i.desc" = 113
  "mission.pimp_my_house_ii.title" = 114
  "mission.pimp_my_house_ii.desc" = 115
  "mission.pimp_my_townhouse.title" = 116
  "mission.pimp_my_townhouse.desc" = 117
  "mission.rockstar_villa.title" = 118
  "mission.rockstar_villa.desc" = 119
  "mission.pimp_the_chateau.title" = 120
  "mission.pimp_the_chateau.desc" = 121
  "mission.pizza_sale.title" = 122
  "mission.pizza_sale.desc" = 123
  "mission.coffee_profit.title" = 124
  "mission.coffee_profit.desc" = 125
  "mission.show_me_the_rent_i.title" = 126
  "mission.show_me_the_rent_i.desc" = 127
  "mission.show_me_the_rent_ii.title" = 128
  "mission.show_me_the_rent_ii.desc" = 129
  "mission.show_me_the_rent_iii.title" = 130
  "mission.show_me_the_rent_iii.desc" = 131
  "mission.show_me_the_rent_iv.title" = 132
  "mission.show_me_the_rent_iv.desc" = 133
  "mission.cash_is_king_i.title" = 140
  "mission.wonderful.title" = 138
  "mission.wonderful.desc" = 139
  "mission.company_1m.desc" = 143
  "mission.company_5m.desc" = 145
  "mission.company_10m.desc" = 147
  "mission.instant_build.title" = 156
  "mission.instant_build.desc" = 157
  "mission.req.level_needed" = 158
  "mission.req.prior_mission" = 159
  "mission.req.level_to_start" = 160
  "mission.req.mission_and_level" = 161
  "building.bungalow" = 162
  "building.bungalow_luxury" = 163
  "building.townhouse" = 164
  "building.townhouse_luxury" = 165
  "building.duplex" = 166
  "building.duplex_luxury" = 167
  "building.condo" = 168
  "building.three_story" = 169
  "building.three_story_luxury" = 170
  "building.apartment_block" = 171
  "building.apartment_block_luxury" = 172
  "building.manor" = 173
  "building.villa" = 174
  "building.loft_block" = 175
  "building.villa_luxury" = 176
  "building.skyscraper" = 177
  "building.loft_block_luxury" = 178
  "building.chateau" = 179
  "building.skyscraper_luxury" = 180
  "building.gold_house" = 181
  "building.hacienda" = 182
  "building.tiki" = 183
  "building.pizzeria" = 184
  "building.coffee_shop" = 185
  "building.flower_shop" = 186
  "building.bowling" = 187
  "building.jewellery" = 188
  "building.night_club" = 189
  "building.mall" = 190
  "building.bank" = 191
  "building.hospital" = 192
  "building.casino" = 193
  "building.taco_stand" = 194
  "building.ice_cream_shop" = 195
  "building.cypress_tree" = 196
  "building.oak_tree" = 197
  "building.palm_tree" = 198
  "building.fountain" = 199
  "building.orange_tree" = 200
  "building.japanese_tree" = 201
  "building.big_garden" = 202
  "building.pond_of_wealth" = 203
  "building.mariachi" = 204
  "building.lemonade_stand" = 205
  "building.golden_statue" = 206
  "building.discovery" = 207
  "building.pyramid" = 208
  "building.aztec_calendar" = 209
  "building.transatlantic" = 210
  "tutorial.welcome" = 211
  "tutorial.commerce_radius" = 212
  "tutorial.contracts_rent" = 213
  "tutorial.xp_level" = 214
  "ui.missions" = 250
  "ui.city_shop" = 257
  "ui.houses" = 258
  "ui.wonders" = 261
  "ui.cash" = 293
  "ui.buildings" = 294
  "ui.select_contract" = 332
  "contract.tourists" = 335
  "contract.students" = 336
  "contract.family" = 337
  "contract.pensioner" = 338
  "contract.athletes" = 339
  "contract.pilots" = 340
  "contract.models" = 341
  "contract.artists" = 342
  "contract.entrepreneur" = 343
  "ui.level" = 359
  "ui.build_time" = 360
  "ui.income" = 361
  "ui.customers" = 366
  "ui.radius" = 367
  "ui.xp" = 370
  "ui.tenants" = 371
  "ui.house_bonus" = 375
  "ui.cost" = 376
  "ui.change_contract" = 379
  "ui.income_time" = 380
  "ui.mission_accomplished" = 382
}

$strings = [ordered]@{}
for ($i = 0; $i -lt $count; $i++) {
  $entry = [ordered]@{
    en = $packs["en"].strings[$i]
    fr = $packs["fr"].strings[$i]
    de = $packs["de"].strings[$i]
    it = $packs["it"].strings[$i]
    es = $packs["es"].strings[$i]
  }
  $strings["$i"] = $entry
}

$result = [ordered]@{
  meta = [ordered]@{
    source = "Millionaire City DEAR MOD v1.0.55"
    packs = [ordered]@{ en = "l0_0"; fr = "l1_0"; de = "l2_0"; it = "l3_0"; es = "l4_0" }
    count = $count
    extractedAt = (Get-Date).ToString("o")
  }
  locales = @("en", "fr", "de", "it", "es")
  keys = $keys
  strings = $strings
}

$json = $result | ConvertTo-Json -Depth 8 -Compress:$false
# ConvertTo-Json may escape unicode awkwardly on older PS; write UTF8
[System.IO.File]::WriteAllText($OutFile, $json, [System.Text.UTF8Encoding]::new($false))
Write-Host "Wrote $OutFile ($([math]::Round((Get-Item $OutFile).Length/1KB,1)) KB)"
