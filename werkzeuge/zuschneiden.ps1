param([string]$Quelle, [string]$Ziel)
# Schneidet Fotos mittig auf 3:2 zu (max. 900 x 600 px, JPEG-Qualität 80) und legt sie in den bilder-Ordner
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force $Ziel | Out-Null
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$param = New-Object System.Drawing.Imaging.EncoderParameters 1
$param.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 80L

foreach ($datei in Get-ChildItem $Quelle -Filter *.jpg) {
  $img = [System.Drawing.Image]::FromFile($datei.FullName)
  $qw = [math]::Min($img.Width, $img.Height * 1.5); $qh = $qw / 1.5
  $zw = [int][math]::Min(900, $qw); $zh = [int]($zw / 1.5)
  $bmp = New-Object System.Drawing.Bitmap $zw, $zh
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, (New-Object System.Drawing.RectangleF 0, 0, $zw, $zh),
    (New-Object System.Drawing.RectangleF (($img.Width - $qw) / 2), (($img.Height - $qh) / 2), $qw, $qh), [System.Drawing.GraphicsUnit]::Pixel)
  $bmp.Save((Join-Path $Ziel $datei.Name), $codec, $param)
  "{0,-30} {1}x{2}" -f $datei.Name, $zw, $zh
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
}
