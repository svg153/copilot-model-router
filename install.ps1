<#
.SYNOPSIS
    Instala la extensión model-router en la app de escritorio GitHub Copilot.

.DESCRIPTION
    Copia la carpeta model-router/ dentro de <COPILOT_HOME>\extensions\.
    Si ya existe una instalación previa, se guarda una copia de seguridad
    de su artifacts/routing.json y se restaura después, para no perder la
    configuración de modelos.

.PARAMETER CopilotHome
    Ruta de COPILOT_HOME. Por defecto $env:COPILOT_HOME o ~/.copilot.

.PARAMETER Force
    Sobrescribe sin preguntar.

.EXAMPLE
    ./install.ps1
#>
[CmdletBinding()]
param(
    [string]$CopilotHome = $(if ($env:COPILOT_HOME) { $env:COPILOT_HOME } else { Join-Path $HOME ".copilot" }),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "model-router"
if (-not (Test-Path $source)) {
    throw "No se encuentra la carpeta de la extensión: $source"
}

$extensionsDir = Join-Path $CopilotHome "extensions"
$target = Join-Path $extensionsDir "model-router"

Write-Host "Origen : $source"
Write-Host "Destino: $target"

if (Test-Path $target) {
    if (-not $Force) {
        $answer = Read-Host "Ya existe una instalación. ¿Sobrescribir? (s/N)"
        if ($answer -notmatch '^[sSyY]') {
            Write-Host "Cancelado."
            exit 0
        }
    }

    $savedRouting = $null
    $existingRouting = Join-Path $target "artifacts\routing.json"
    if (Test-Path $existingRouting) {
        $savedRouting = Get-Content $existingRouting -Raw
        Write-Host "Se conservará tu routing.json actual."
    }

    Remove-Item -Recurse -Force $target
}

New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item (Join-Path $source "*.mjs") $target
Copy-Item (Join-Path $source "artifacts") $target -Recurse

if ($savedRouting) {
    Set-Content -Path (Join-Path $target "artifacts\routing.json") -Value $savedRouting -NoNewline
}

Write-Host ""
Write-Host "Instalada en $target" -ForegroundColor Green
Write-Host "Recarga las extensiones desde la app (o reiníciala) para que se active."
