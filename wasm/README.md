# /wasm — Rust → WebAssembly pixel-processing module

Provides low-level, zero-dependency frame filters compiled to WASM
and consumed by the React frontend via `useWasm()`.

## Exported functions

| Function | Signature | Description |
|---|---|---|
| `grayscale` | `(Uint8Array) → Uint8Array` | ITU-R BT.601 luma greyscale |
| `invert` | `(Uint8Array) → Uint8Array` | 255 − channel per pixel |
| `brightness` | `(Uint8Array, f32) → Uint8Array` | Multiply channels by factor |
| `sepia` | `(Uint8Array) → Uint8Array` | Classic sepia matrix |
| `frame_luma_stats` | `(Uint8Array) → Float32Array` | Returns `[min, max, mean, count]` |

All functions accept/return **RGBA** pixel buffers (4 bytes per pixel, alpha preserved).

## Prerequisites

```bash
# Install Rust toolchain (if not present)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add the WASM compile target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack
```

## Build

From the **repo root**:

```bash
./wasm/build.sh
```

This runs:
```
wasm-pack build --target web --release --out-dir app/src/wasm-pkg --out-name avi_wasm
```

Output lands in `app/src/wasm-pkg/` (gitignored — always regenerate from source):

```
app/src/wasm-pkg/
  avi_wasm.js         ← ESM glue (imported by Vite)
  avi_wasm_bg.wasm    ← compiled binary (~21 KB)
  avi_wasm.d.ts       ← TypeScript declarations (auto-generated)
  package.json
```

## Vite integration

`vite-plugin-wasm` + `vite-plugin-top-level-await` handle the `.wasm` binary
automatically. The React hook `src/hooks/useWasm.ts` loads the module lazily:

```ts
const { status, api } = useWasm()   // 'loading' → 'ready'
const result = api.grayscale(pixelBuffer)
```

## Profile flags (Cargo.toml)

```toml
[profile.release]
opt-level     = 3   # maximum speed optimisation
lto           = true  # link-time optimisation (smaller binary)
codegen-units = 1   # single codegen unit (best LTO)
```
