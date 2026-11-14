#!/bin/sh
# Lunar scene models: the one entry point. Rebuilds public/models/lunar/ from the raw NASA 3D Resources GLBs.
#   sh scripts/models/lunar/build.sh RAW_DIR
# RAW_DIR holds hdu_part1.glb, hdu_part2.glb, sev.glb, astronaut.glb as downloaded (see docs/lane-reports/g.md).
# Needs Blender 5.x (set BLENDER if it is not on PATH) and npx (fetches @gltf-transform/cli 4.5.1).
set -eu
RAW=${1:?usage: build.sh RAW_DIR}
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../../.." && pwd)
OUT="$ROOT/public/models/lunar"
WORK=${WORK:-$(mktemp -d)}
BLENDER=${BLENDER:-blender}
GT="npx --yes @gltf-transform/cli@4.5.1"

mkdir -p "$OUT/draco"
"$BLENDER" -b --factory-startup --python "$HERE/build.py" -- "$RAW" "$WORK" 2>&1 | grep -E "LUNARJSON|Error|Traceback" || true
test -f "$WORK/astronaut.glb" || { echo "Blender step failed"; exit 1; }

# Draco geometry, WebP textures, no extra simplification (Blender already decimated the SEV).
opt() { # name texture-size
  $GT optimize "$WORK/$1.glb" "$OUT/$1.glb" --compress draco --texture-compress webp \
    --texture-size "$2" --simplify false --prune true
}
opt hdu 1024
opt sev 1024
opt astronaut 512

# The Draco decoder is self-hosted next to the models (no CDN at runtime). Copied from three.
cp "$ROOT/node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm" \
   "$ROOT/node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js" "$OUT/draco/"

for m in hdu sev astronaut; do
  echo "== $m: $(wc -c < "$OUT/$m.glb") bytes"
done
echo "repainted textures for checking by eye: $WORK/*_repainted.png"
