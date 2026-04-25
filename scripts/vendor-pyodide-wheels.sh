#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
OUTPUT_DIR=${1:-"$ROOT_DIR"}

mkdir -p "$OUTPUT_DIR/src/vendor"

docker buildx build \
  --network host \
  --file "$ROOT_DIR/Dockerfile" \
  --target export \
  --output "type=local,dest=$OUTPUT_DIR" \
  "$ROOT_DIR"

if [[ -f "$OUTPUT_DIR/src/index.ts" ]]; then
  (
    cd "$ROOT_DIR"
    pnpm exec tsx scripts/update-index.ts "$OUTPUT_DIR/src/vendor" "$OUTPUT_DIR/src/index.ts"
  )
fi
