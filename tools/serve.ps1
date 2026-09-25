# Kleiner lokaler Webserver zum Testen (http://localhost:8080).
# Aufruf: powershell -ExecutionPolicy Bypass -File tools\serve.ps1
param([int]$Port = 8080)
$root = [System.IO.Path]::GetFullPath((Split-Path $PSScriptRoot -Parent))
$types = @{
  '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8';
  '.json'='application/json'; '.webmanifest'='application/manifest+json'; '.png'='image/png'; '.svg'='image/svg+xml';
  '.woff2'='font/woff2'; '.ico'='image/x-icon'; '.txt'='text/plain; charset=utf-8'; '.md'='text/plain; charset=utf-8'
}
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Server laeuft auf http://localhost:$Port/ (Ordner: $root)"
while ($listener.IsListening) {
  $ctx = $null
  try {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($path -eq '') { $path = 'index.html' }
    $full = [System.IO.Path]::GetFullPath((Join-Path $root $path))
    $res = $ctx.Response
    $res.KeepAlive = $false
    if ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $ext = [System.IO.Path]::GetExtension($full).ToLower()
      $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
      $res.AddHeader('Cache-Control', 'no-cache')
      [byte[]]$bytes = [System.IO.File]::ReadAllBytes($full)
      if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      $code = 200
    } else {
      $res.StatusCode = 404
      $code = 404
    }
    $res.OutputStream.Close()
    Write-Host "$code /$path"
  } catch {
    Write-Host "Fehler: $($_.Exception.Message)"
    try { if ($ctx) { $ctx.Response.Abort() } } catch { }
  }
}
