import React, { useState, useCallback } from 'react'
import { useWasm } from '../../hooks/useWasm'

// ── Frame dimensions used for the benchmark ───────────────────────────────────
const FRAME_W = 1280
const FRAME_H = 720

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterName = 'grayscale' | 'invert' | 'brightness' | 'sepia'

interface BenchResult {
  filter:       FilterName
  timeMs:       number
  pixelCount:   number
  throughputMp: number        // megapixels / second
  before: LumaStats
  after:  LumaStats
}

interface LumaStats { min: number; max: number; mean: number }

// ── Generate a realistic gradient frame ───────────────────────────────────────
function makeTestFrame(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i   = (y * width + x) * 4
      buf[i]    = Math.floor((x / width)  * 255)   // R: horizontal gradient
      buf[i + 1] = Math.floor((y / height) * 255)  // G: vertical gradient
      buf[i + 2] = 128                              // B: constant mid
      buf[i + 3] = 255                              // A: fully opaque
    }
  }
  return buf
}

// ── Component ─────────────────────────────────────────────────────────────────
export const WasmPanel: React.FC = () => {
  const { status, error, api } = useWasm()
  const [result,   setResult]   = useState<BenchResult | null>(null)
  const [running,  setRunning]  = useState<FilterName | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)

  const run = useCallback(async (filter: FilterName) => {
    if (!api || running) return
    setRunning(filter)
    setResult(null)
    setRuntimeError(null)

    // Yield to the browser so the button state renders before we block the thread
    await new Promise<void>((r) => setTimeout(r, 0))

    const frame  = makeTestFrame(FRAME_W, FRAME_H)
    const before = parseStats(api.frame_luma_stats(frame))

    try {
      const t0 = performance.now()
      let filteredFrame: Uint8Array

      switch (filter) {
        case 'grayscale':
          filteredFrame = api.grayscale(frame)
          break
        case 'invert':
          filteredFrame = api.invert(frame)
          break
        case 'brightness':
          filteredFrame = api.brightness(frame, 1.5)
          break
        case 'sepia':
          filteredFrame = api.sepia(frame)
          break
      }

      const timeMs = performance.now() - t0
      const after = parseStats(api.frame_luma_stats(filteredFrame))
      const pixelCount = FRAME_W * FRAME_H
      const throughputMp = pixelCount / 1_000_000 / (timeMs / 1000)

      console.log(`[wasm] ${filter} — ${timeMs.toFixed(2)}ms | ${throughputMp.toFixed(0)} MP/s`)

      setResult({ filter, timeMs, pixelCount, throughputMp, before, after })
    } catch (wasmError) {
      const message = wasmError instanceof Error ? wasmError.message : String(wasmError)
      console.error(`[wasm] ${filter} failed`, wasmError)
      setRuntimeError(message)
    } finally {
      setRunning(null)
    }
  }, [api, running])

  const isReady = status === 'ready'

  return (
    <div
      style={{
        background: '#141414',
        borderBottom: '1px solid #2a2a2a',
        padding: '6px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexShrink: 0,
        flexWrap: 'wrap',
        minHeight: 40,
      }}
    >
      {/* ── Status badge ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#555', fontFamily: 'monospace', letterSpacing: 1 }}>
          ⬡ WASM
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            fontFamily: 'monospace',
            background: status === 'ready'   ? 'rgba(5,150,105,0.15)'
                      : status === 'error'   ? 'rgba(233,69,96,0.15)'
                      :                        'rgba(255,255,255,0.05)',
            color:      status === 'ready'   ? '#6ee7b7'
                      : status === 'error'   ? '#e94560'
                      :                        '#777',
            border: `1px solid ${
              status === 'ready' ? 'rgba(5,150,105,0.3)' :
              status === 'error' ? 'rgba(233,69,96,0.3)' :
              '#2a2a2a'
            }`,
          }}
        >
          {status === 'ready' ? '● ready' : status === 'error' ? '● error' : '◌ loading…'}
        </span>
        <span style={{ fontSize: 10, color: '#444', fontFamily: 'monospace' }}>
          {FRAME_W}×{FRAME_H}
        </span>
      </div>

      {/* ── Filter buttons ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        {(['grayscale', 'invert', 'brightness', 'sepia'] as FilterName[]).map((f) => (
          <button
            key={f}
            onClick={() => run(f)}
            disabled={!isReady || running !== null}
            style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '4px 10px',
              borderRadius: 5,
              border: '1px solid #333',
              background: running === f ? '#333' : '#222',
              color: isReady ? '#ccc' : '#444',
              cursor: isReady && running === null ? 'pointer' : 'not-allowed',
              fontFamily: 'monospace',
            }}
          >
            {running === f ? '…' : f}
            {f === 'brightness' && ' ×1.5'}
          </button>
        ))}
      </div>

      {/* ── Error message ── */}
      {(error || runtimeError) && (
        <span style={{ fontSize: 11, color: '#e94560', fontFamily: 'monospace' }}>
          {runtimeError || error}
        </span>
      )}

      {/* ── Benchmark result ── */}
      {result && (
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {/* Timing */}
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#6ee7b7', fontFamily: 'monospace' }}>
              {result.timeMs.toFixed(2)} ms
            </span>
            <span style={{ fontSize: 10, color: '#555', marginLeft: 6, fontFamily: 'monospace' }}>
              {result.throughputMp.toFixed(0)} MP/s
            </span>
          </div>

          {/* Pixel count */}
          <div style={{ fontSize: 10, color: '#555', fontFamily: 'monospace' }}>
            {(result.pixelCount / 1_000_000).toFixed(2)}M px
          </div>

          {/* Luma before → after */}
          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#666' }}>
            luma avg&nbsp;
            <span style={{ color: '#aaa' }}>{result.before.mean.toFixed(1)}</span>
            <span style={{ color: '#444' }}> → </span>
            <span style={{ color: '#63a0ff' }}>{result.after.mean.toFixed(1)}</span>
            <span style={{ color: '#444' }}> / 255</span>
          </div>

          {/* Filter tag */}
          <span
            style={{
              fontSize: 10,
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 4,
              padding: '2px 7px',
              color: '#888',
              fontFamily: 'monospace',
            }}
          >
            {result.filter}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────
function parseStats(arr: Float32Array): LumaStats {
  return { min: arr[0], max: arr[1], mean: arr[2] }
}
