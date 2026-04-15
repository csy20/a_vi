import React from 'react'
import { type SelectedClip, type Track } from '../../store/useEditorStore'
import { ClipBlock } from './Clip'
import { TRACK_HEIGHT } from './constants'

interface Props {
  track: Track
  index: number
  selectedClip: SelectedClip | null
  onSelectClip: (trackId: string, clipId: string, event: React.MouseEvent) => void
  onTrimStart: (trackId: string, clipId: string, edge: 'left' | 'right', event: React.MouseEvent) => void
}

export const TimelineTrack: React.FC<Props> = ({
  track,
  index,
  selectedClip,
  onSelectClip,
  onTrimStart,
}) => {
  // FIX: BUG-B - hide missing clips from timeline rows so they no longer consume visual space.
  const visibleClips = track.clips.filter((clip) => !clip.isMissingAsset && clip.status !== 'missing')

  return (
    <div
      style={{
        position: 'absolute',
        top: index * TRACK_HEIGHT,
        left: 0,
        right: 0,
        height: TRACK_HEIGHT,
        background: index % 2 === 0 ? '#1e1e1e' : '#1b1b1b',
        borderBottom: '1px solid #272727',
      }}
    >
      {visibleClips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          isSelected={selectedClip?.trackId === track.id && selectedClip.clipId === clip.id}
          onSelect={(event) => onSelectClip(track.id, clip.id, event)}
          onTrimStart={(event, edge) => onTrimStart(track.id, clip.id, edge, event)}
        />
      ))}
    </div>
  )
}
