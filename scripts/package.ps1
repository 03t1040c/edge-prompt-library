$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$extensionPath = Join-Path $workspacePath 'extension'
$outputPath = Join-Path $workspacePath 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $extensionPath 'manifest.json') -Raw | ConvertFrom-Json
$zipPath = Join-Path $outputPath ('edge-prompt-library-' + $manifest.version + '.zip')
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Open the destination directly instead of deleting an existing ZIP first.
$outputStream = [IO.File]::Open($zipPath, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None)
try {
  $archive = [IO.Compression.ZipArchive]::new($outputStream, [IO.Compression.ZipArchiveMode]::Create, $true)
  try {
    $files = Get-ChildItem -LiteralPath $extensionPath -File -Recurse | Sort-Object FullName
    foreach ($file in $files) {
      $entryName = $file.FullName.Substring($extensionPath.Length + 1).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $archive.Dispose() }
} finally { $outputStream.Dispose() }
Write-Output $zipPath
