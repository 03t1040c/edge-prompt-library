$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$extensionPath = Join-Path $workspacePath 'extension'
$outputPath = Join-Path $workspacePath 'dist'
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
Compress-Archive -Path (Join-Path $extensionPath '*') -DestinationPath (Join-Path $outputPath 'edge-prompt-library-0.1.0.zip') -Force
Write-Output (Join-Path $outputPath 'edge-prompt-library-0.1.0.zip')
