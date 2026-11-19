#requires -Version 7.0
[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'
$name = 'wasm_jjazzlab_dev'
$devUser = 'jjazzdev'
$repo = Split-Path -Parent $PSScriptRoot
$imageDirectory = Join-Path $repo "WSL_image/$name"
$vhd = Join-Path $imageDirectory 'ext4.vhdx'
$registry = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss'

function Invoke-Wsl {
    & wsl.exe @args
    if ($LASTEXITCODE -ne 0) {
        throw "wsl.exe exited with code $LASTEXITCODE"
    }
}

function Get-Distro {
    if (Test-Path -LiteralPath $registry) {
        Get-ChildItem -LiteralPath $registry |
            Where-Object { $_.GetValue('DistributionName') -eq $name }
    }
}

function Assert-ImageLocation($distro) {
    $base = $distro.GetValue('BasePath')
    $disk = $distro.GetValue('VhdFileName', 'ext4.vhdx')
    if ($base.StartsWith('\\?\')) {
        $base = $base.Substring(4)
    }
    if ($distro.GetValue('Version') -ne 2 -or
            [IO.Path]::GetFullPath((Join-Path $base $disk)) -ne [IO.Path]::GetFullPath($vhd)) {
        throw "$name is not registered as WSL 2 at $vhd"
    }
}

$distro = Get-Distro
if ($distro) {
    Assert-ImageLocation $distro
}

if ($Remove) {
    if (!$distro) {
        if (Test-Path -LiteralPath $vhd) {
            throw "Unregistered disk at $vhd. Its ownership could not be verified."
        }
        Write-Output "$name is already absent."
        return
    }
    if ($PSCmdlet.ShouldProcess("$name ($vhd and all Linux files)", 'Unregister')) {
        Invoke-Wsl --unregister $name
        if ((Get-Distro) -or (Test-Path -LiteralPath $vhd)) {
            throw "WSL did not completely remove $name or $vhd"
        }
    }
    return
}

if (!$distro) {
    if ((Test-Path -LiteralPath $imageDirectory) -and
            (Get-ChildItem -LiteralPath $imageDirectory -Force | Select-Object -First 1)) {
        throw "Installation directory is not empty: $imageDirectory"
    }
    if (!$PSCmdlet.ShouldProcess($imageDirectory, "Install Ubuntu 24.04 as $name")) {
        return
    }
    New-Item -ItemType Directory -Path $imageDirectory -Force | Out-Null
    Invoke-Wsl --install -d Ubuntu-24.04 --name $name --location $imageDirectory --no-launch --web-download
    $distro = Get-Distro
    if (!$distro) {
        throw "$name was not registered"
    }
    Assert-ImageLocation $distro
}

if (!(Test-Path -LiteralPath $vhd -PathType Leaf)) {
    throw "Missing WSL disk: $vhd"
}
if (!$PSCmdlet.ShouldProcess($name, 'Install the development tools and configure the Linux user')) {
    return
}

Invoke-Wsl -d $name -u root --cd / --exec apt-get update
Invoke-Wsl -d $name -u root --cd / --exec env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openjdk-25-jdk-headless maven git rsync curl ca-certificates python3
Invoke-Wsl -d $name -u root --cd / --exec bash -ec 'id jjazzdev >/dev/null 2>&1 || useradd --create-home --shell /bin/bash jjazzdev'
Invoke-Wsl --manage $name --set-default-user $devUser
Invoke-Wsl -d $name -u $devUser --cd / --exec mvn --version
