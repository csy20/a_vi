import React, { useEffect, useRef } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { TrackPreviewComposition, type TrackPreviewProps } from '../../remotion/compositions/TrackPreviewComposition'
import { useEditorStore } from '../../store/useEditorStore'
import { GhostPreviewBar } from './GhostPreviewBar'

// ── Transport icon components ────────────────────────────────────────────────
const IconPlay      = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
const IconPause     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
const IconSkipBack  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
const IconSkipFwd   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2.5-6L14 7v10z"/><path d="M16 6h2v12h-2z"/></svg>

// ── One player slot ──────────────────────────────────────────────────────────
interface PlayerSlotProps {
  playerRef:    React.RefObject<PlayerRef | null>
  tracks:       TrackPreviewProps['tracks']
  totalFrames:  number
  fps:          number
  label:        string
  isProposed?:  boolean
}

const formatPreviewError = (error: Error) => {
  const firstLine = error.message.split('\n')[0]?.trim()
  return firstLine && firstLine.length > 0
    ? firstLine
    : 'The preview failed while loading media for this frame.'
}

const PreviewErrorState: React.FC<{ error: Error; label: string; isProposed: boolean }> = ({
  error,
  label,
  isProposed,
}) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 28,
      background: 'radial-gradient(circle at top, rgba(48,48,48,0.65), rgba(10,10,10,0.96) 60%)',
      color: '#fff',
    }}
  >
    <div
      style={{
        width: 'min(100%, 460px)',
        borderRadius: 14,
        border: `1px solid ${isProposed ? 'rgba(99,160,255,0.42)' : 'rgba(233,69,96,0.38)'}`,
        background: 'rgba(12,12,12,0.88)',
        boxShadow: '0 20px 48px rgba(0,0,0,0.35)',
        padding: '22px 24px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.3,
          color: isProposed ? '#63a0ff' : '#f87171',
          fontFamily: 'monospace',
        }}
      >
        {label} PREVIEW ERROR
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 20,
          fontWeight: 700,
          color: '#f3f4f6',
        }}
      >
        Unable to render this frame
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#b6b6b6',
        }}
      >
        {formatPreviewError(error)}
      </div>
      <div
        style={{
          marginTop: 14,
          fontSize: 12,
          lineHeight: 1.5,
          color: '#8b8b8b',
        }}
      >
        Check that the clip still has a valid local asset and that the selected frame is inside its media range.
      </div>
    </div>
  </div>
)

const PlayerSlot: React.FC<PlayerSlotProps> = ({
  playerRef, tracks, totalFrames, fps, label, isProposed = false,
}) => {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      {/* Slot label */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: isProposed ? '#63a0ff' : '#666',
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      >
        {isProposed ? '✦ AI PREVIEW' : 'ORIGINAL'}
      </div>

      {/* Player */}
      <div
        style={{
          flex: 1,
          borderRadius: 10,
          overflow: 'hidden',
          outline: isProposed ? '1.5px solid rgba(99,160,255,0.4)' : '1px solid #2a2a2a',
          boxShadow: isProposed ? '0 0 20px rgba(99,160,255,0.12)' : 'none',
          position: 'relative',
        }}
      >
        <Player
          ref={playerRef as React.RefObject<PlayerRef>}
          component={TrackPreviewComposition as unknown as React.ComponentType<Record<string, unknown>>}
          inputProps={{ tracks, totalFrames, label, isProposed } satisfies TrackPreviewProps}
          durationInFrames={totalFrames}
          compositionWidth={1280}
          compositionHeight={720}
          fps={fps}
          initialFrame={0}
          errorFallback={({ error }) => (
            <PreviewErrorState error={error} label={label} isProposed={isProposed} />
          )}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  )
}

// ── Main PlayerPanel ─────────────────────────────────────────────────────────
export const PlayerPanel: React.FC = () => {
  const mainRef     = useRef<PlayerRef>(null)
  const proposedRef = useRef<PlayerRef>(null)
  const fromPlayer  = useRef(false)

  const {
    playheadPosition,
    totalFrames,
    fps,
    isPlaying,
    compositionTree,
    proposedComposition,
    setPlayheadPosition,
    setIsPlaying,
  } = useEditorStore()

  // ── Seek both players when store playheadPosition changes ─────────────────
  useEffect(() => {
    if (fromPlayer.current) { fromPlayer.current = false; return }
    mainRef.current?.seekTo(playheadPosition)
    proposedRef.current?.seekTo(playheadPosition)
  }, [playheadPosition])

  // ── Play / pause both players ─────────────────────────────────────────────
  useEffect(() => {
    if (isPlaying) {
      mainRef.current?.play()
      proposedRef.current?.play()
    } else {
      mainRef.current?.pause()
      proposedRef.current?.pause()
    }
  }, [isPlaying])

  // ── Primary player timeupdate → update store + keep secondary in sync ─────
  useEffect(() => {
    const player = mainRef.current
    if (!player) return

    const onTimeUpdate = ({ detail }: { detail: { frame: number } }) => {
      fromPlayer.current = true
      setPlayheadPosition(detail.frame)
      proposedRef.current?.seekTo(detail.frame)   // keep secondary locked in
    }
    const onPlay  = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => { setIsPlaying(false); setPlayheadPosition(0) }

    player.addEventListener('timeupdate', onTimeUpdate)
    player.addEventListener('play',  onPlay)
    player.addEventListener('pause', onPause)
    player.addEventListener('ended', onEnded)
    return () => {
      player.removeEventListener('timeupdate', onTimeUpdate)
      player.removeEventListener('play',  onPlay)
      player.removeEventListener('pause', onPause)
      player.removeEventListener('ended', onEnded)
    }
  }, [setPlayheadPosition, setIsPlaying])

  const goToStart  = () => { setIsPlaying(false); setPlayheadPosition(0) }
  const goToEnd    = () => { setIsPlaying(false); setPlayheadPosition(totalFrames - 1) }
  const togglePlay = () => setIsPlaying(!isPlaying)

  const progressPct = ((playheadPosition / (totalFrames - 1)) * 100).toFixed(3)
  const currentSec  = (playheadPosition / fps).toFixed(2)
  const totalSec    = ((totalFrames - 1) / fps).toFixed(2)

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect  = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    setPlayheadPosition(Math.round(ratio * (totalFrames - 1)))
  }

  const isSplit = !!proposedComposition

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#111',
        overflow: 'hidden',
      }}
    >
      {/* ── Player area ── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: isSplit ? 12 : 0,
          padding: isSplit ? '12px 12px 0' : '12px 16px 0',
          overflow: 'hidden',
          transition: 'gap 0.2s',
        }}
      >
        {/* Original (always visible) */}
        <PlayerSlot
          playerRef={mainRef}
          tracks={compositionTree}
          totalFrames={totalFrames}
          fps={fps}
          label="ORIGINAL"
          isProposed={false}
        />

        {/* AI Preview (only when proposedComposition is set) */}
        {isSplit && (
          <PlayerSlot
            playerRef={proposedRef}
            tracks={proposedComposition!}
            totalFrames={totalFrames}
            fps={fps}
            label="AI PREVIEW"
            isProposed
          />
        )}
      </div>

      {/* ── Ghost preview accept/reject bar ── */}
      <GhostPreviewBar />

      {/* ── Scrubber ── */}
      <div style={{ padding: '8px 16px 0' }}>
        <div
          onClick={handleScrubberClick}
          style={{
            height: 6,
            background: '#2a2a2a',
            borderRadius: 3,
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${progressPct}%`, background: '#e94560', borderRadius: 3, pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute', top: '50%', left: `${progressPct}%`,
              transform: 'translate(-50%,-50%)', width: 12, height: 12,
              borderRadius: '50%', background: '#e94560', pointerEvents: 'none',
              boxShadow: '0 0 0 2px rgba(233,69,96,0.35)',
            }}
          />
        </div>
      </div>

      {/* ── Transport ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px 12px', flexShrink: 0,
        }}
      >
        <button onClick={goToStart} style={btnStyle} title="Go to start"><IconSkipBack /></button>
        <button
          onClick={togglePlay}
          style={{ ...btnStyle, background: '#e94560', color: '#fff', width: 36, height: 36 }}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
        <button onClick={goToEnd} style={btnStyle} title="Go to end"><IconSkipFwd /></button>

        <div
          style={{
            marginLeft: 'auto', fontFamily: 'monospace', fontSize: 12, color: '#aaa',
            background: '#1a1a1a', padding: '4px 10px', borderRadius: 4, border: '1px solid #2e2e2e',
          }}
        >
          <span style={{ color: '#e94560' }}>{currentSec}s</span>
          &nbsp;/&nbsp;{totalSec}s&nbsp;&nbsp;
          <span style={{ color: '#555' }}>f{playheadPosition}</span>
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: '#2a2a2a', border: '1px solid #3a3a3a', borderRadius: 6,
  color: '#ccc', cursor: 'pointer', flexShrink: 0,
}
