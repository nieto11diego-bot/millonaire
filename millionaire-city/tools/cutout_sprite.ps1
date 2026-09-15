# Edge-only background cutout: never punches holes in the subject interior.
param(
  [Parameter(Mandatory = $true)][string]$Src,
  [Parameter(Mandatory = $true)][string]$Out,
  [ValidateSet("statue", "house")][string]$Mode = "statue"
)

Add-Type -AssemblyName System.Drawing
$srcPath = (Resolve-Path $Src).Path
$srcImg = New-Object System.Drawing.Bitmap $srcPath
$w = $srcImg.Width
$h = $srcImg.Height

function Get-SatAvg([int]$r, [int]$g, [int]$b) {
  $d1 = [Math]::Abs($r - $g)
  $d2 = [Math]::Abs($g - $b)
  $d3 = [Math]::Abs($r - $b)
  $sat = $d1
  if ($d2 -gt $sat) { $sat = $d2 }
  if ($d3 -gt $sat) { $sat = $d3 }
  $avg = ($r + $g + $b) / 3.0
  return @($sat, $avg)
}

function Test-Background([int]$r, [int]$g, [int]$b, [string]$mode) {
  # Near-black padding
  if ($r -lt 10 -and $g -lt 10 -and $b -lt 10) { return $true }

  $sa = Get-SatAvg $r $g $b
  $sat = [double]$sa[0]
  $avg = [double]$sa[1]

  # Bright lawn grass (not dark cypress / topiary)
  $brightLawn = ($g -gt 95 -and ($g - $r) -gt 18 -and ($g - $b) -gt 22 -and $b -lt 140 -and $avg -gt 90)
  # Mid park green strips
  $parkGreen = ($g -gt 70 -and ($g - $b) -gt 28 -and ($g - $r) -gt 10 -and $b -lt 110 -and $avg -gt 70 -and $avg -lt 160)

  # Asphalt / cool grey road
  $road = ($sat -le 28 -and $avg -ge 45 -and $avg -le 150 -and $b -ge ($r - 8))
  # White dashed road marks / crosswalk
  $mark = ($avg -ge 175 -and $sat -le 28)

  # Yellow UI circle leftover
  $uiYellow = ($r -gt 180 -and $g -gt 160 -and $b -lt 120 -and ($r - $b) -gt 50)

  if ($mode -eq "statue") {
    if ($brightLawn -or $parkGreen -or $road -or $mark -or $uiYellow) { return $true }
    return $false
  }

  # house mode
  if ($brightLawn -or $parkGreen) { return $true }
  # road behind / beside house
  if ($road -and $avg -lt 135) { return $true }
  if ($mark) { return $true }
  return $false
}

# Flood-fill ONLY from borders through background colors
$kill = New-Object 'bool[,]' $w, $h
$q = New-Object System.Collections.Generic.Queue[object]
for ($x = 0; $x -lt $w; $x++) {
  $q.Enqueue(@($x, 0))
  $q.Enqueue(@($x, ($h - 1)))
}
for ($y = 0; $y -lt $h; $y++) {
  $q.Enqueue(@(0, $y))
  $q.Enqueue(@(($w - 1), $y))
}

while ($q.Count -gt 0) {
  $p = $q.Dequeue()
  $x = [int]$p[0]
  $y = [int]$p[1]
  if ($x -lt 0 -or $y -lt 0 -or $x -ge $w -or $y -ge $h) { continue }
  if ($kill[$x, $y]) { continue }
  $c = $srcImg.GetPixel($x, $y)
  if (-not (Test-Background $c.R $c.G $c.B $Mode)) { continue }
  $kill[$x, $y] = $true
  $q.Enqueue(@(($x + 1), $y))
  $q.Enqueue(@(($x - 1), $y))
  $q.Enqueue(@($x, ($y + 1)))
  $q.Enqueue(@($x, ($y - 1)))
}

$dst = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$minX = $w; $minY = $h; $maxX = -1; $maxY = -1; $kept = 0
for ($y = 0; $y -lt $h; $y++) {
  for ($x = 0; $x -lt $w; $x++) {
    if ($kill[$x, $y]) {
      $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    } else {
      $c = $srcImg.GetPixel($x, $y)
      # Also drop remaining near-black padding not reached (interior black voids stay if any)
      if ($c.R -lt 8 -and $c.G -lt 8 -and $c.B -lt 8) {
        $dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      } else {
        $dst.SetPixel($x, $y, $c)
        $kept++
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
}
$srcImg.Dispose()

if ($kept -lt 200) {
  throw "Cutout failed for $Src (kept=$kept)"
}

$pad = 1
$minX = [Math]::Max(0, $minX - $pad)
$minY = [Math]::Max(0, $minY - $pad)
$maxX = [Math]::Min($w - 1, $maxX + $pad)
$maxY = [Math]::Min($h - 1, $maxY + $pad)
$cw = $maxX - $minX + 1
$ch = $maxY - $minY + 1
$crop = New-Object System.Drawing.Bitmap $cw, $ch, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.DrawImage(
  $dst,
  (New-Object System.Drawing.Rectangle 0, 0, $cw, $ch),
  (New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch),
  [System.Drawing.GraphicsUnit]::Pixel
)
$g.Dispose()
$dst.Dispose()

$dir = Split-Path $Out -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$crop.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output "OK $Mode $($crop.Width)x$($crop.Height) kept=$kept -> $Out"
$crop.Dispose()
