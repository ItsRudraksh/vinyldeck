# Optional: Re-cut high-res clips directly from your local 182s app recording (20261124-1359-04.3026467.mp4)
# Usage: .\scripts\extract-from-full-video.ps1 -VideoPath "C:\path\to\20261124-1359-04.3026467.mp4"
param(
  [Parameter(Mandatory=$true)]
  [string]$VideoPath
)

$Out = Join-Path $PSScriptRoot "..\public\media"
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# Noir Split View 60fps Karaoke (00:09 - 00:22)
ffmpeg -y -ss 9 -t 13 -i $VideoPath -an -vf "scale=1280:-2,fps=30" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "$Out\karaoke-noir.mp4"

# Compact Strip 3-Line Focus (00:24 - 00:29)
ffmpeg -y -ss 24 -t 5 -i $VideoPath -an -vf "scale=1280:-2,fps=30" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "$Out\compact-strip.mp4"

# Japanese + Russian Auto-Romanize & Noir->Glass Morph (00:52 - 01:18)
ffmpeg -y -ss 52 -t 26 -i $VideoPath -an -vf "scale=1280:-2,fps=30" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "$Out\multilingual-jp.mp4"

# Resizable Mini Mode Shrink (02:38 - 02:56)
ffmpeg -y -ss 158 -t 18 -i $VideoPath -an -vf "scale=1280:-2,fps=30" -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -movflags +faststart "$Out\ambient-pressings.mp4"

Write-Host "Updated clips in $Out" -ForegroundColor Green
