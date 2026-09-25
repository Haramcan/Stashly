# Erzeugt die App-Symbole (PNG) für "Wo ist was".
# Aufruf: powershell -ExecutionPolicy Bypass -File tools\make-icons.ps1
Add-Type -AssemblyName System.Drawing
$iconDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'icons'
New-Item -ItemType Directory -Force $iconDir | Out-Null

function New-Icon([int]$size, [string]$file, [double]$inset) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml('#2F5D50'))
  $s = $size * (1 - 2 * $inset); $o = $size * $inset
  # Kiste (Karton) als Umriss
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml('#EDF0EE')), ([float]($s * 0.055))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $bx = $o + $s * 0.18; $by = $o + $s * 0.30; $bw = $s * 0.64; $bh = $s * 0.50
  $g.DrawRectangle($pen, [float]$bx, [float]$by, [float]$bw, [float]$bh)
  # Deckel-Klappen
  $g.DrawLine($pen, [float]$bx, [float]$by, [float]($bx + $bw * 0.12), [float]($by - $s * 0.10))
  $g.DrawLine($pen, [float]($bx + $bw), [float]$by, [float]($bx + $bw * 0.88), [float]($by - $s * 0.10))
  $g.DrawLine($pen, [float]($bx + $bw * 0.12), [float]($by - $s * 0.10), [float]($bx + $bw * 0.88), [float]($by - $s * 0.10))
  # Gelbes Etikett
  $label = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F3D34A'))
  $lx = $bx + $bw * 0.2; $ly = $by + $bh * 0.32; $lw = $bw * 0.6; $lh = $bh * 0.36
  $g.FillRectangle($label, [float]$lx, [float]$ly, [float]$lw, [float]$lh)
  # Striche auf dem Etikett
  $ink = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#2A2505'))
  $g.FillRectangle($ink, [float]($lx + $lw * 0.14), [float]($ly + $lh * 0.28), [float]($lw * 0.72), [float]($lh * 0.14))
  $g.FillRectangle($ink, [float]($lx + $lw * 0.14), [float]($ly + $lh * 0.58), [float]($lw * 0.46), [float]($lh * 0.14))
  $g.Dispose()
  $bmp.Save((Join-Path $iconDir $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-Icon 180 'apple-touch-icon.png' 0.06
New-Icon 192 'icon-192.png' 0.06
New-Icon 512 'icon-512.png' 0.06
New-Icon 512 'icon-maskable-512.png' 0.16
New-Icon 64 'favicon.png' 0.02
Get-ChildItem $iconDir | Select-Object Name, Length
