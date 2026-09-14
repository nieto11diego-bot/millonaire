# Parse LayerGameObjects catalog (r5_0078.bin) + emit economy.json pieces helpers
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$BinPath = "c:\Users\nieto\Downloads\Millionaire_City_asset_catalog\resources\r5_0078.bin"
$OutRaw = Join-Path $ProjectRoot "data\objects_catalog_raw.json"

function BE32([byte[]]$b, [int]$i) {
  return (($b[$i] -band 255) -shl 24) -bor (($b[$i + 1] -band 255) -shl 16) -bor (($b[$i + 2] -band 255) -shl 8) -bor ($b[$i + 3] -band 255)
}
function BE16([byte[]]$b, [int]$i) {
  return (($b[$i] -band 255) -shl 8) -bor ($b[$i + 1] -band 255)
}
function U8([byte[]]$b, [int]$i) { return $b[$i] -band 255 }
function ReadBuffs([byte[]]$b, [ref]$p) {
  $nb = U8 $b $p.Value; $p.Value++
  for ($i = 0; $i -lt $nb; $i++) { $p.Value += 4 }
}

$b = [IO.File]::ReadAllBytes($BinPath)
$count = BE16 $b 21
$p = 23
$objects = New-Object System.Collections.Generic.List[object]

for ($n = 0; $n -lt $count; $n++) {
  $type = U8 $b $p; $p++
  switch ($type) {
    0 {
      $p += 28
      $objects.Add([ordered]@{ kind = "player"; index = $n })
    }
    1 {
      $dav = BE32 $b $p; $p += 4; $p += 8
      $oid = BE32 $b $p; $p += 4
      $name = BE32 $b $p; $p += 4
      $desc = BE32 $b $p; $p += 4
      $level = BE32 $b $p; $p += 4
      $exp = BE32 $b $p; $p += 4
      $rows = BE32 $b $p; $p += 4
      $cols = BE32 $b $p; $p += 4
      $coins = BE32 $b $p; $p += 4
      $fortune = BE32 $b $p; $p += 4
      $ctime = BE32 $b $p; $p += 4
      $inst = BE32 $b $p; $p += 4
      $cgroup = BE32 $b $p; $p += 4
      $forsale = BE32 $b $p; $p += 4
      ReadBuffs $b ([ref]$p)
      $sound = BE32 $b $p; $p += 4
      $idle = BE32 $b $p; $p += 4
      $p += 16 # destroyed, damaged, construction, shop
      $objects.Add([ordered]@{
          kind = "house"; index = $n; objectId = $oid; nameTid = $name; descTid = $desc
          level = $level; exp = $exp; gridH = $rows; gridW = $cols
          costCoins = $coins; costFortune = $fortune; buildTimeSec = $ctime
          instantBuildFactor = $inst; contractGroup = $cgroup; forSale = $forsale
          animationIdleRid = $idle; davinciAnimationRid = $dav
        })
    }
    2 {
      $dav = BE32 $b $p; $p += 4; $p += 8
      $oid = BE32 $b $p; $p += 4
      $name = BE32 $b $p; $p += 4
      $desc = BE32 $b $p; $p += 4
      $level = BE32 $b $p; $p += 4
      $exp = BE32 $b $p; $p += 4
      $rows = BE32 $b $p; $p += 4
      $cols = BE32 $b $p; $p += 4
      $coins = BE32 $b $p; $p += 4
      $fortune = BE32 $b $p; $p += 4
      $ctime = BE32 $b $p; $p += 4
      $inst = BE32 $b $p; $p += 4
      $itime = BE32 $b $p; $p += 4
      $ival = BE32 $b $p; $p += 4
      $radius = BE32 $b $p; $p += 4
      $maxc = BE32 $b $p; $p += 4
      $daily = BE32 $b $p; $p += 4
      $forsale = BE32 $b $p; $p += 4
      ReadBuffs $b ([ref]$p)
      $p += 4
      $idle = BE32 $b $p; $p += 4
      $p += 16
      $objects.Add([ordered]@{
          kind = "commercial"; index = $n; objectId = $oid; nameTid = $name; descTid = $desc
          level = $level; exp = $exp; gridH = $rows; gridW = $cols
          costCoins = $coins; costFortune = $fortune; buildTimeSec = $ctime
          instantBuildFactor = $inst; incomeTimeSec = $itime; incomeValue = $ival
          clientRadiusTiles = $radius; maxClients = $maxc; dailyBonus = $daily; forSale = $forsale
          animationIdleRid = $idle; davinciAnimationRid = $dav
        })
    }
    3 {
      $dav = BE32 $b $p; $p += 4; $p += 8
      $oid = BE32 $b $p; $p += 4
      $name = BE32 $b $p; $p += 4
      $desc = BE32 $b $p; $p += 4
      $level = BE32 $b $p; $p += 4
      $exp = BE32 $b $p; $p += 4
      $rows = BE32 $b $p; $p += 4
      $cols = BE32 $b $p; $p += 4
      $coins = BE32 $b $p; $p += 4
      $fortune = BE32 $b $p; $p += 4
      $ctime = BE32 $b $p; $p += 4
      $bonus = BE32 $b $p; $p += 4
      $infl = BE32 $b $p; $p += 4
      ReadBuffs $b ([ref]$p)
      $p += 4
      $idle = BE32 $b $p; $p += 4
      $p += 16
      $objects.Add([ordered]@{
          kind = "deco"; index = $n; objectId = $oid; nameTid = $name; descTid = $desc
          level = $level; exp = $exp; gridH = $rows; gridW = $cols
          costCoins = $coins; costFortune = $fortune; buildTimeSec = $ctime
          houseBonusScaled = $bonus; influenceRadiusTiles = $infl
          animationIdleRid = $idle; davinciAnimationRid = $dav
        })
    }
    4 {
      $dav = BE32 $b $p; $p += 4; $p += 8
      $oid = BE32 $b $p; $p += 4
      $name = BE32 $b $p; $p += 4
      $desc = BE32 $b $p; $p += 4
      $level = BE32 $b $p; $p += 4
      $exp = BE32 $b $p; $p += 4
      $rows = BE32 $b $p; $p += 4
      $cols = BE32 $b $p; $p += 4
      $coins = BE32 $b $p; $p += 4
      $fortune = BE32 $b $p; $p += 4
      $ctime = BE32 $b $p; $p += 4
      $inst = BE32 $b $p; $p += 4
      $bonus = BE32 $b $p; $p += 4
      $infl = BE32 $b $p; $p += 4
      ReadBuffs $b ([ref]$p)
      $p += 4
      $idle = BE32 $b $p; $p += 4
      $p += 16
      $objects.Add([ordered]@{
          kind = "wonder"; index = $n; objectId = $oid; nameTid = $name; descTid = $desc
          level = $level; exp = $exp; gridH = $rows; gridW = $cols
          costCoins = $coins; costFortune = $fortune; buildTimeSec = $ctime
          instantBuildFactor = $inst; cityBonusScaled = $bonus; influenceRadiusTiles = $infl
          animationIdleRid = $idle; davinciAnimationRid = $dav
        })
    }
    5 {
      $dav = BE32 $b $p; $p += 4; $p += 8
      $oid = BE32 $b $p; $p += 4
      $name = BE32 $b $p; $p += 4
      $desc = BE32 $b $p; $p += 4
      $level = BE32 $b $p; $p += 4
      $exp = BE32 $b $p; $p += 4
      $rows = BE32 $b $p; $p += 4
      $cols = BE32 $b $p; $p += 4
      $coins = BE32 $b $p; $p += 4
      $fortune = BE32 $b $p; $p += 4
      $ctime = BE32 $b $p; $p += 4
      ReadBuffs $b ([ref]$p)
      $p += 4
      $idle = BE32 $b $p; $p += 4
      $p += 12 # destroyed, damaged, construction (no shop)
      $objects.Add([ordered]@{
          kind = "hq"; index = $n; objectId = $oid; nameTid = $name; descTid = $desc
          level = $level; exp = $exp; gridH = $rows; gridW = $cols
          costCoins = $coins; costFortune = $fortune; buildTimeSec = $ctime
          animationIdleRid = $idle; davinciAnimationRid = $dav
        })
    }
    6 {
      $p += 16
      $oid = BE32 $b $p; $p += 4
      $coins = BE32 $b $p; $p += 4
      $fortune = BE32 $b $p; $p += 4
      $ev = BE32 $b $p; $p += 4
      $p += 4
      $objects.Add([ordered]@{ kind = "expansion"; index = $n; objectId = $oid; costCoins = $coins; costFortune = $fortune; buyEventId = $ev })
    }
    7 {
      $p += 16
      $active = U8 $b $p; $p++
      ReadBuffs $b ([ref]$p)
      $p += 8
      $objects.Add([ordered]@{ kind = "trigger"; index = $n })
    }
    8 {
      $p += 16
      $objects.Add([ordered]@{ kind = "mapStart"; index = $n })
    }
    default { throw "Unknown type $type at index $n offset $($p-1)" }
  }
}

Write-Host "Parsed $($objects.Count)/$count objects, pos=$p/$($b.Length)"
$payload = [ordered]@{
  source = "resources/r5_0078.bin"
  mapWidth = (BE32 $b 0)
  mapHeight = (BE32 $b 4)
  tileWidth = (BE32 $b 13)
  tileHeight = (BE32 $b 17)
  objectCount = $count
  objects = $objects
}
[IO.File]::WriteAllText($OutRaw, ($payload | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
Write-Host "Wrote $OutRaw"
$objects | Where-Object { $_.kind -in @('house','commercial','deco','wonder','hq','expansion') } |
  ForEach-Object {
    $o = $_
    $extra = ""
    if ($o.clientRadiusTiles) { $extra += " r=$($o.clientRadiusTiles) max=$($o.maxClients) inc=$($o.incomeValue)/$($o.incomeTimeSec)s" }
    if ($o.PSObject.Properties.Name -contains 'contractGroup') { $extra += " cg=$($o.contractGroup)" }
    if ($o.houseBonusScaled) { $extra += " bonus=$($o.houseBonusScaled) infl=$($o.influenceRadiusTiles)" }
    if ($o.cityBonusScaled) { $extra += " cityBonus=$($o.cityBonusScaled)" }
    "{0,-12} id={1,3} name={2,4} lv={3,2} {4}x{5} cost={6}/{7} t={8}{9}" -f $o.kind, $o.objectId, $o.nameTid, $o.level, $o.gridW, $o.gridH, $o.costCoins, $o.costFortune, $o.buildTimeSec, $extra
  }
