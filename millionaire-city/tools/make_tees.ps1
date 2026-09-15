Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = "Stop"

$srcPath = "C:\Users\nieto\.cursor\projects\c-Users-nieto-Desktop-CURSOR\assets\c__Users_nieto_AppData_Roaming_Cursor_User_workspaceStorage_6da48cecf036d0c2b5f0e3d46e1b7c88_images_image-89249295-f671-4b7a-911b-4fcfc9f56582.png"
$outDir = "c:\Users\nieto\Desktop\CURSOR\millionaire-city\assets\roads"

$src = New-Object System.Drawing.Bitmap $srcPath
$pf = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$crop = New-Object System.Drawing.Bitmap 96, 96, $pf
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, 96, 96), 0, 2, 96, 96, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$src.Dispose()

for ($y = 0; $y -lt 96; $y++) {
  for ($x = 0; $x -lt 96; $x++) {
    $c = $crop.GetPixel($x, $y)
    if ((([int]$c.R + [int]$c.G + [int]$c.B) / 3.0) -lt 50) {
      $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    }
  }
}

function Scale-NN([System.Drawing.Bitmap]$img) {
  $out = New-Object System.Drawing.Bitmap 32, 32, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gr = [System.Drawing.Graphics]::FromImage($out)
  $gr.Clear([System.Drawing.Color]::Transparent)
  $gr.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $gr.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $gr.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $gr.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, 32, 32))
  $gr.Dispose()
  return $out
}

function Copy-Bmp([System.Drawing.Bitmap]$img) {
  return $img.Clone((New-Object System.Drawing.Rectangle 0, 0, $img.Width, $img.Height), $img.PixelFormat)
}

$specs = @(
  @{ Name = "tee_nsw.png"; Flip = $null },
  @{ Name = "tee_new.png"; Flip = [System.Drawing.RotateFlipType]::Rotate90FlipNone },
  @{ Name = "tee_nes.png"; Flip = [System.Drawing.RotateFlipType]::Rotate180FlipNone },
  @{ Name = "tee_esw.png"; Flip = [System.Drawing.RotateFlipType]::Rotate270FlipNone }
)

foreach ($spec in $specs) {
  $hi = Copy-Bmp $crop
  if ($null -ne $spec.Flip) { $hi.RotateFlip($spec.Flip) }
  $lo = Scale-NN $hi
  # Match straight/cross palette: asphalt 151, markings 191
  $asphalt = [System.Drawing.Color]::FromArgb(255, 151, 151, 151)
  $mark = [System.Drawing.Color]::FromArgb(255, 191, 191, 191)
  for ($y = 0; $y -lt 32; $y++) {
    for ($x = 0; $x -lt 32; $x++) {
      $c = $lo.GetPixel($x, $y)
      if ($c.A -lt 128) { continue }
      if ($c.R -ge 170) { $lo.SetPixel($x, $y, $mark) }
      else { $lo.SetPixel($x, $y, $asphalt) }
    }
  }
  $lo.Save((Join-Path $outDir $spec.Name), [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "saved $($spec.Name)"
  $hi.Dispose()
  $lo.Dispose()
}

$crop.Dispose()
Write-Host "done"
