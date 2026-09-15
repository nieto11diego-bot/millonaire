# Static file server for the Millionaire City web prototype.
# Usage: powershell -ExecutionPolicy Bypass -File tools\serve.ps1
param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$prefix = "http://localhost:$Port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".svg"  = "image/svg+xml"
  ".ico"  = "image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  $alt = $Port + 1
  Write-Host "Puerto $Port ocupado. Probando $alt..."
  $Port = $alt
  $prefix = "http://localhost:$Port/"
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add($prefix)
  try {
    $listener.Start()
  } catch {
    Write-Host "No se pudo abrir el puerto. Prueba: .\serve.ps1 -Port 8090"
    throw
  }
}

Write-Host "Sirviendo $Root"
Write-Host "Abre: $prefix"
Write-Host "Ctrl+C para detener."

# Try open browser
Start-Process $prefix

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  try {
    $path = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
    $full = [IO.Path]::GetFullPath((Join-Path $Root $path))
    if (-not $full.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
      $res.Close()
      continue
    }
    if (-not (Test-Path $full) -or (Get-Item $full).PSIsContainer) {
      $res.StatusCode = 404
      $bytes = [Text.Encoding]::UTF8.GetBytes("Not found: $path")
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
      $res.Close()
      continue
    }
    $ext = [IO.Path]::GetExtension($full).ToLowerInvariant()
    $res.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
    $bytes = [IO.File]::ReadAllBytes($full)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $res.StatusCode = 500
  } finally {
    $res.Close()
  }
}
