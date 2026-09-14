# Fix economy.json sprite/anm/width/height from animationIdleRid → descriptor → PNG
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$catRes = "c:\Users\nieto\Downloads\Millionaire_City_asset_catalog\resources"
$bld = Get-Content "$root\refs\buildings.json" -Raw | ConvertFrom-Json
$raw = Get-Content "$root\data\objects_catalog_raw.json" -Raw | ConvertFrom-Json
$econ = Get-Content "$root\data\economy.json" -Raw | ConvertFrom-Json
$i18n = Get-Content "$root\data\i18n.json" -Raw | ConvertFrom-Json

# ANM rid → buildings.json entry
$byRid = @{}
foreach ($p in $bld.PSObject.Properties) {
  $v = $p.Value
  if ($null -eq $v.descriptor_index) { continue }
  $packNum = switch ($v.pack) { 'r1' { 1 } 'r2' { 2 } 'r3' { 3 } 'r4' { 4 } 'r5' { 5 } 'r6' { 6 } default { 1 } }
  $rid = ($packNum -shl 16) -bor [int]$v.descriptor_index
  $byRid[$rid] = $v
}

function Read-PngSize([string]$path) {
  $png = [IO.File]::ReadAllBytes($path)
  $w = ($png[16] -shl 24) -bor ($png[17] -shl 16) -bor ($png[18] -shl 8) -bor $png[19]
  $h = ($png[20] -shl 24) -bor ($png[21] -shl 16) -bor ($png[22] -shl 8) -bor $png[23]
  return @{ w = $w; h = $h }
}

function Resolve-FromRid([int]$rid) {
  if ($rid -lt 0) { return $null }
  if ($byRid.ContainsKey($rid)) {
    $v = $byRid[$rid]
    return [ordered]@{
      anm = $v.anm
      spriteFile = $v.sprite_file
      width = [int]$v.width
      height = [int]$v.height
      confidence = "dex-verified"
    }
  }
  # Descriptor in pack from high word; sprite pack at byte[22]
  $descPack = $rid -shr 16
  $descIdx = $rid -band 0xFFFF
  $binPath = Join-Path $catRes ("r{0}_{1:D4}.bin" -f $descPack, $descIdx)
  if (-not (Test-Path $binPath)) { return $null }
  $b = [IO.File]::ReadAllBytes($binPath)
  if ($b.Length -lt 26) { return $null }
  $spritePack = $b[22] -band 255
  $spriteIdx = (($b[23] -band 255) -shl 8) -bor ($b[24] -band 255)
  $rel = "resources/r{0}_{1:D4}.png" -f $spritePack, $spriteIdx
  $abs = Join-Path $catRes ("r{0}_{1:D4}.png" -f $spritePack, $spriteIdx)
  if (-not (Test-Path $abs)) { return $null }
  $sz = Read-PngSize $abs
  return [ordered]@{
    anm = ("ANM_R{0}_{1:D4}" -f $descPack, $descIdx)
    spriteFile = $rel
    width = $sz.w
    height = $sz.h
    confidence = "descriptor-resolved"
  }
}

# objectId → idle rid (first occurrence)
$idleById = @{}
foreach ($o in $raw.objects) {
  if ($o.objectId -lt 0) { continue }
  if ($o.kind -notin @('house', 'commercial', 'deco', 'wonder', 'hq')) { continue }
  $key = [string]$o.objectId
  if (-not $idleById.ContainsKey($key)) {
    $idleById[$key] = [int]$o.animationIdleRid
  }
}

function Patch-List($list) {
  $out = @()
  foreach ($item in $list) {
    $hash = [ordered]@{}
    foreach ($p in $item.PSObject.Properties) { $hash[$p.Name] = $p.Value }
    $oid = [string]$item.objectId
    if ($idleById.ContainsKey($oid)) {
      $resolved = Resolve-FromRid $idleById[$oid]
      if ($resolved) {
        $hash.anm = $resolved.anm
        $hash.spriteFile = $resolved.spriteFile
        $hash.width = $resolved.width
        $hash.height = $resolved.height
        $hash.spriteConfidence = $resolved.confidence
      }
    }
    $out += $hash
  }
  return $out
}

$meta = [ordered]@{}
foreach ($p in $econ.meta.PSObject.Properties) { $meta[$p.Name] = $p.Value }
$meta.spritesFixedAt = (Get-Date).ToString("o")

$out = [ordered]@{
  meta = $meta
  rules = $econ.rules
  levelCurve = $econ.levelCurve
  contracts = $econ.contracts
  contractGroups = $econ.contractGroups
  houses = Patch-List $econ.houses
  commerces = Patch-List $econ.commerces
  decorations = Patch-List $econ.decorations
  wonders = Patch-List $econ.wonders
  hq = $null
  expansions = $econ.expansions
}
if ($econ.hq -and $econ.hq -isnot [ValueType]) {
  $hqList = @(Patch-List @($econ.hq))
  # Avoid ConvertTo-Json unwrapping single hashtable → use PSCustomObject
  $h = $hqList[0]
  $out.hq = [pscustomobject]$h
} elseif ($econ.hq -is [ValueType]) {
  # corrupted previous export; leave null (re-run will need raw repair)
  $out.hq = $null
}

[IO.File]::WriteAllText("$root\data\economy.json", ($out | ConvertTo-Json -Depth 10), [Text.UTF8Encoding]::new($false))

# Copy all referenced sprites into assets/buildings
$assetDir = Join-Path $root "assets\buildings"
New-Item -ItemType Directory -Force -Path $assetDir | Out-Null
$copied = 0
$missing = @()
$all = @($out.houses + $out.commerces + $out.decorations + $out.wonders)
if ($out.hq) { $all += $out.hq }
foreach ($item in $all) {
  if (-not $item.spriteFile) { $missing += $item.name; continue }
  $leaf = Split-Path $item.spriteFile -Leaf
  $src = Join-Path "c:\Users\nieto\Downloads\Millionaire_City_asset_catalog" $item.spriteFile
  if (-not (Test-Path $src)) { $missing += "$($item.name) ($($item.spriteFile))"; continue }
  Copy-Item $src (Join-Path $assetDir $leaf) -Force
  $copied++
}

Write-Host "Updated economy.json; copied $copied sprites"
Write-Host "Still missing: $($missing.Count)"
$missing | ForEach-Object { Write-Host "  $_" }
$noSprite = ($all | Where-Object { -not $_.spriteFile }).Count
Write-Host "Items without spriteFile: $noSprite / $($all.Count)"
