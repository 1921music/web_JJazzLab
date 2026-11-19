#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
mkdir -p target
emcc synth.c -O3 --no-entry -o target/synth.wasm \
    -s STANDALONE_WASM=1 -s FILESYSTEM=0 -s MALLOC=emmalloc \
    -s INITIAL_MEMORY=67108864 -s ALLOW_MEMORY_GROWTH=0 \
    -s EXPORTED_FUNCTIONS='["_malloc","_free","_synth_load","_synth_part","_synth_clear_parts","_synth_reset","_synth_silence","_synth_event","_synth_render","_synth_note_supported"]'
