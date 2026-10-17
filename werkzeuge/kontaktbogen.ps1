param([string]$Kandidaten, [string]$Ausgabe, [int]$ProBogen = 6)
# Legt die Foto-Kandidaten je Gericht nebeneinander (Zeile = Gericht, Nummer 1–6), zum Auswählen
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Ausgabe | Out-Null
$ids = @(Get-ChildItem $Kandidaten -Directory | Sort-Object Name | ForEach-Object { $_.Name })
$w = 220; $h = 150; $kopf = 26
$schrift = New-Object System.Drawing.Font "Segoe UI", 11, ([System.Drawing.FontStyle]::Bold)
$nummer = New-Object System.Drawing.Font "Segoe UI", 14, ([System.Drawing.FontStyle]::Bold)

for ($b = 0; $b -lt [math]::Ceiling($ids.Count / $ProBogen); $b++) {
  $teil = @($ids[($b * $ProBogen)..([math]::Min($ids.Count, ($b + 1) * $ProBogen) - 1)])
  $bmp = New-Object System.Drawing.Bitmap (6 * $w), ($teil.Count * ($h + $kopf))
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(30, 30, 30))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  for ($z = 0; $z -lt $teil.Count; $z++) {
    $y = $z * ($h + $kopf)
    $g.DrawString($teil[$z], $schrift, [System.Drawing.Brushes]::White, 4, $y + 3)
    for ($i = 1; $i -le 6; $i++) {
      $datei = Join-Path (Join-Path $Kandidaten $teil[$z]) "$i.jpg"
      if (-not (Test-Path $datei)) { continue }
      try { $img = [System.Drawing.Image]::FromFile($datei) } catch { continue }
      $sk = [math]::Max($w / $img.Width, $h / $img.Height); $qw = $w / $sk; $qh = $h / $sk
      $quelle = New-Object System.Drawing.RectangleF (($img.Width - $qw) / 2), (($img.Height - $qh) / 2), $qw, $qh
      $zielR = New-Object System.Drawing.RectangleF (($i - 1) * $w + 2), ($y + $kopf), ($w - 4), ($h - 2)
      $g.DrawImage($img, $zielR, $quelle, [System.Drawing.GraphicsUnit]::Pixel)
      $g.FillRectangle([System.Drawing.Brushes]::Black, (($i - 1) * $w + 2), ($y + $kopf), 24, 24)
      $g.DrawString("$i", $nummer, [System.Drawing.Brushes]::Yellow, (($i - 1) * $w + 5), ($y + $kopf - 1))
      $img.Dispose()
    }
  }
  $bmp.Save((Join-Path $Ausgabe "bogen-$($b + 1).png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
