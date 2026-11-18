#requires -Version 7.0
[CmdletBinding()]
param(
    [switch] $SyncOnly,
    [switch] $Broad
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$command = @'
set -euo pipefail
group=$(sed -n 's/^0:://p' /proc/self/cgroup)
read -r memory_max < "/sys/fs/cgroup$group/memory.max"
read -r cpus < "/sys/fs/cgroup$group/cpuset.cpus.effective"
if [ "$memory_max" != 12884901888 ] || [ "$cpus" != 0-5 ]; then
    echo "Unexpected sync/build limits: CPUs $cpus, memory $memory_max bytes" >&2
    exit 1
fi
echo "WSL sync/build: CPUs $cpus, memory limit $memory_max bytes"
workspace="$HOME/src/web_jjazzlab"
test -f pom.xml
mkdir -p -- "$workspace"
rsync -rt --delete --exclude=/.git --exclude=/WSL_image --exclude=target/ -- ./ "$workspace/"
if [ "$1" = sync ]; then
    exit 0
fi
cd -- "$workspace"
if [ "$1" = broad ]; then
    classes=$(
        find model/{Harmony,Midi,Phrase,Rhythm,Song,SongImpl}/src/main/java \
            core/{RhythmMusicGeneration,RhythmMusicGenerationSPI,RhythmParametersImpl,RhythmDatabase,OutputSynth}/src/main/java \
            plugins/YamJJazz/src/main/java -type f -name '*.java' \
            ! -name package-info.java ! -name module-info.java \
            ! -path '*/ui/*' ! -path '*/test/*' |
        sed -e 's|^.*/src/main/java/||' -e 's|\.java$||' -e 's|/|.|g' |
        sort -u | paste -sd, -
    )
    test -n "$classes"
    set -- "-Dwasm.diagnostic.classes=$classes"
else
    set --
fi
exec mvn -B -ntp -Pwasm-diagnostics -pl web/engine -am package "$@"
'@
$command = $command -replace "`r`n", "`n"
$action = if ($SyncOnly) { 'sync' } elseif ($Broad) { 'broad' } else { 'build' }
& wsl.exe -d wasm_jjazzlab_dev -u root --cd $repo --exec systemd-run `
    --quiet --wait --pipe --collect --same-dir --expand-environment=no `
    --unit=jjazzlab-sync-build --uid=jjazzdev -p AllowedCPUs=0-5 -p MemoryMax=12G `
    /bin/bash -c $command bash $action
if ($LASTEXITCODE -ne 0) {
    throw "WSL $action failed with exit code $LASTEXITCODE"
}
