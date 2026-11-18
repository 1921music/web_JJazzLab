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
$launcher = @'
set -euo pipefail
cg=/sys/fs/cgroup
# Only operate inside the distro's own cgroup. The VM root has no memory.max.
if [ "$(findmnt -n -o FSTYPE -T "$cg")" != cgroup2 ] || [ ! -f "$cg/memory.max" ]; then
    echo 'An isolated WSL cgroup v2 hierarchy is required.' >&2
    exit 1
fi

mkdir -p /run/lock
exec 9>/run/lock/jjazzlab-sync-build.lock
if ! flock -n 9; then
    echo 'A JJazzLab sync or build is already running.' >&2
    exit 1
fi

printf '%s\n' '+memory +cpuset' > "$cg/cgroup.subtree_control"
job=$(mktemp -d "$cg/jjazzlab-sync-build.XXXXXX")
cleanup() {
    if ! rmdir -- "$job" 2>/dev/null; then
        # A failed build can leave child processes in this temporary group.
        printf '1\n' > "$job/cgroup.kill"
        rmdir -- "$job"
    fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
chmod 755 "$job"
printf '%s\n' '0-5' > "$job/cpuset.cpus"
printf '%s\n' '12884901888' > "$job/memory.max"
(
    printf '%s\n' "$BASHPID" > "$job/cgroup.procs"
    exec setpriv --reuid=jjazzdev --regid="$(id -g jjazzdev)" --init-groups --reset-env \
        /bin/bash -c "$1" bash "$2"
)
'@
$launcher = $launcher -replace "`r`n", "`n"
& wsl.exe -d wasm_jjazzlab_dev -u root --cd $repo --exec bash -c $launcher bash $command $action
if ($LASTEXITCODE -ne 0) {
    throw "WSL $action failed with exit code $LASTEXITCODE"
}
