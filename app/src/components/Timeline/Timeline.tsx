import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { TimelineRuler } from './TimelineRuler'
import { TimelineTrack } from './TimelineTrack'
import { Playhead } from './Playhead'
import { SelectionOverlay } from './SelectionOverlay'
import { toast } from '../../lib/toastStore'
import {
  PIXELS_PER_FRAME,
  TRACK_HEIGHT,
  RULER_HEIGHT,
  TRACK_LABEL_WIDTH,
} from './constants'

const TYPE_COLOR: Record<string, string> = {
  video: '#e94560',
  audio: '#059669',
  overlay: '#7c3aed',
}

const TYPE_ICON: Record<string, string> = {
  video: '▶',
  audio: '♪',
  overlay: '◈',
}

const actionButtonStyle = (enabled: boolean): React.CSSProperties => ({
  background: enabled ? '#252525' : '#1d1d1d',
  border: '1px solid #333',
  borderRadius: 5,
  color: enabled ? '#bbb' : '#555',
  fontSize: 11,
  fontWeight: 600,
  padding: '4px 10px',
  cursor: enabled ? 'pointer' : 'not-allowed',
})

type ResizeDragState = {
  trackId: string
  clipId: string
  edge: 'left' | 'right'
} | null

type SelectionDragState = {
  active: boolean
  startFrame: number
  didSelect: boolean
}

export const Timeline: React.FC = () => {
  const {
    compositionTree,
    totalFrames,
    currentSelection,
    selectedClip,
    playheadPosition,
    setPlayheadPosition,
    setSelection,
    setSelectedClip,
    removeClip,
    duplicateClip,
    splitClip,
    trimClip,
    commitHistoryCheckpoint,
  } = useEditorStore()

  const scrollRef = useRef<HTMLDivElement>(null)
  const selDrag = useRef<SelectionDragState>({ active: false, startFrame: 0, didSelect: false })
  const phDrag = useRef({ active: false })
  const resizeDrag = useRef<ResizeDragState>(null)

  const totalWidth = totalFrames * PIXELS_PER_FRAME
  const totalTracksHeight = compositionTree.length * TRACK_HEIGHT

  const selectedClipData = useMemo(() => {
    if (!selectedClip) return null

    const track = compositionTree.find((item) => item.id === selectedClip.trackId)
    if (!track) return null

    return track.clips.find((clip) => clip.id === selectedClip.clipId) ?? null
  }, [compositionTree, selectedClip])

  useEffect(() => {
    if (!selectedClip || !selectedClipData) return

    setSelection({
      startFrame: selectedClipData.startFrame,
      endFrame: selectedClipData.endFrame,
    })
  }, [selectedClip, selectedClipData, setSelection])

  const clientXToFrame = useCallback(
    (clientX: number): number => {
      const scrollElement = scrollRef.current
      if (!scrollElement) return 0
      const rect = scrollElement.getBoundingClientRect()
      const scrollLeft = scrollElement.scrollLeft
      const x = clientX - rect.left + scrollLeft
      return Math.max(0, Math.min(Math.floor(x / PIXELS_PER_FRAME), totalFrames - 1))
    },
    [totalFrames]
  )

  const beginScrub = useCallback(
    (clientX: number) => {
      phDrag.current.active = true
      setPlayheadPosition(clientXToFrame(clientX))
    },
    [clientXToFrame, setPlayheadPosition]
  )

  const handleSplitSelected = useCallback(() => {
    if (!selectedClip || !selectedClipData) {
      toast.warning('Select a clip to split')
      return
    }

    if (playheadPosition <= selectedClipData.startFrame || playheadPosition > selectedClipData.endFrame) {
      toast.warning('Move the playhead inside the selected clip to split it')
      return
    }

    const didSplit = splitClip(selectedClip.trackId, selectedClip.clipId, playheadPosition)
    if (!didSplit) {
      toast.warning('Unable to split this clip at the current playhead position')
    }
  }, [playheadPosition, selectedClip, selectedClipData, splitClip])

  const handleDuplicateSelected = useCallback(() => {
    if (!selectedClip) {
      toast.warning('Select a clip to duplicate')
      return
    }

    duplicateClip(selectedClip.trackId, selectedClip.clipId)
  }, [duplicateClip, selectedClip])

  const handleDeleteSelected = useCallback(() => {
    if (!selectedClip) {
      toast.warning('Select a clip to delete')
      return
    }

    removeClip(selectedClip.trackId, selectedClip.clipId)
    setSelection(null)
  }, [removeClip, selectedClip, setSelection])

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (phDrag.current.active) {
        setPlayheadPosition(clientXToFrame(event.clientX))
        return
      }

      if (resizeDrag.current) {
        const frame = clientXToFrame(event.clientX)
        const activeTrack = useEditorStore
          .getState()
          .compositionTree
          .find((track) => track.id === resizeDrag.current?.trackId)
        const activeClip = activeTrack?.clips.find((clip) => clip.id === resizeDrag.current?.clipId)
        if (!activeClip) return

        if (resizeDrag.current.edge === 'left') {
          trimClip(activeTrack!.id, activeClip.id, frame, activeClip.endFrame)
        } else {
          trimClip(activeTrack!.id, activeClip.id, activeClip.startFrame, frame)
        }
        return
      }

      if (!selDrag.current.active) return

      const frame = clientXToFrame(event.clientX)
      const { startFrame, didSelect } = selDrag.current
      if (frame === startFrame && !didSelect) return

      selDrag.current.didSelect = true
      setSelection({
        startFrame: Math.min(startFrame, frame),
        endFrame: Math.max(startFrame, frame),
      })
    }

    const onMouseUp = () => {
      if (resizeDrag.current) {
        resizeDrag.current = null
        commitHistoryCheckpoint()
      }

      if (selDrag.current.active && !selDrag.current.didSelect) {
        setSelection(null)
      }

      selDrag.current = { active: false, startFrame: 0, didSelect: false }
      phDrag.current.active = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [clientXToFrame, commitHistoryCheckpoint, setPlayheadPosition, setSelection, trimClip])

  const handleTracksMouseDown = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-clip]') || target.closest('[data-playhead]')) return

    const frame = clientXToFrame(event.clientX)
    selDrag.current = { active: true, startFrame: frame, didSelect: false }
    setSelectedClip(null)
    setSelection(null)
    setPlayheadPosition(frame)
  }

  const handlePlayheadMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    beginScrub(event.clientX)
  }

  const handleRulerMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    beginScrub(event.clientX)
  }

  const handleSelectClip = (trackId: string, clipId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setSelectedClip({ trackId, clipId })
  }

  const handleTrimStart = (
    trackId: string,
    clipId: string,
    edge: 'left' | 'right',
    event: React.MouseEvent
  ) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedClip({ trackId, clipId })
    resizeDrag.current = { trackId, clipId, edge }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#161616',
        borderTop: '1px solid #2e2e2e',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          height: 32,
          background: '#1c1c1c',
          borderBottom: '1px solid #2e2e2e',
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 1 }}>
          TIMELINE
        </span>

        <button onClick={handleSplitSelected} disabled={!selectedClipData} style={actionButtonStyle(Boolean(selectedClipData))}>
          Split (S)
        </button>
        <button onClick={handleDuplicateSelected} disabled={!selectedClipData} style={actionButtonStyle(Boolean(selectedClipData))}>
          Duplicate (D)
        </button>
        <button onClick={handleDeleteSelected} disabled={!selectedClipData} style={actionButtonStyle(Boolean(selectedClipData))}>
          Delete
        </button>

        {selectedClipData && (
          <span style={{ fontSize: 11, color: selectedClipData.isMissingAsset ? '#fbbf24' : '#888' }}>
            {selectedClipData.label} [{selectedClipData.startFrame} - {selectedClipData.endFrame}]
          </span>
        )}

        {currentSelection && (
          <span style={{ fontSize: 11, color: '#63a0ff', marginLeft: 'auto' }}>
            In {currentSelection.startFrame} | Out {currentSelection.endFrame} | {currentSelection.endFrame - currentSelection.startFrame + 1} frames
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            width: TRACK_LABEL_WIDTH,
            flexShrink: 0,
            borderRight: '1px solid #2e2e2e',
            background: '#1a1a1a',
          }}
        >
          <div style={{ height: RULER_HEIGHT, borderBottom: '1px solid #2e2e2e' }} />

          {compositionTree.map((track) => (
            <div
              key={track.id}
              style={{
                height: TRACK_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 8,
                borderBottom: '1px solid #272727',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: TYPE_COLOR[track.type] ?? '#999',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {TYPE_ICON[track.type] ?? '○'}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: '#ccc',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {track.name}
              </span>
            </div>
          ))}
        </div>

        <div
          ref={scrollRef}
          style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden' }}
          className="timeline-scroll"
        >
          <div style={{ width: totalWidth, position: 'relative' }}>
            <TimelineRuler totalFrames={totalFrames} onMouseDown={handleRulerMouseDown} />

            <div
              style={{ position: 'relative', height: totalTracksHeight, cursor: 'crosshair' }}
              onMouseDown={handleTracksMouseDown}
            >
              <SelectionOverlay totalHeight={totalTracksHeight} />

              <Playhead totalHeight={totalTracksHeight} onHandleMouseDown={handlePlayheadMouseDown} />

              {compositionTree.map((track, index) => (
                <TimelineTrack
                  key={track.id}
                  track={track}
                  index={index}
                  selectedClip={selectedClip}
                  onSelectClip={handleSelectClip}
                  onTrimStart={handleTrimStart}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
