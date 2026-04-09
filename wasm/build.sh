#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Build script: compiles Rust → WebAssembly and places output in /app/src/wasm-pkg
#
# Prerequisites:
#   rustup target add wasm32-unknown-unknown
#   cargo install wasm-pack
#
# Usage:
#   ./wasm/build.sh             (run from repo root)
#   cd wasm && ./build.sh       (run from wasm dir)
#
# Output:  app/src/wasm-pkg/
#   avi_wasm.js        — JS glue (ESM, for Vite import)
#   avi_wasm_bg.wasm   — compiled WASM binary
#   avi_wasm.d.ts      — TypeScript type declarations (auto-generated)
#   package.json       — npm package descriptor
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$REPO_ROOT/app/src/wasm-pkg"

echo "▶ Building avi-wasm → $OUT_DIR"

cd "$SCRIPT_DIR"

wasm-pack build \
  --target web \
  --release \
  --out-dir "$OUT_DIR" \
  --out-name avi_wasm

echo "✓ Done. Output:"
ls -lh "$OUT_DIR"
echo ""
echo "Wasm binary size: $(du -sh "$OUT_DIR/avi_wasm_bg.wasm" | cut -f1)"
