import React from 'react'
import { useEditorStore } from '../../store/useEditorStore'
import { PIXELS_PER_FRAME } from './constants'

interface Props {
  totalHeight: number
  onHandleMouseDown: (e: React.MouseEvent) => void
}

export const Playhead: React.FC<Props> = ({ totalHeight, onHandleMouseDown }) => {
  const playheadPosition = useEditorStore((s) => s.playheadPosition)
  const left = playheadPosition * PIXELS_PER_FRAME
  const hitWidth = 16

  return (
    <div
      data-playhead="handle"
      onMouseDown={onHandleMouseDown}
      style={{
        position: 'absolute',
        left: left - hitWidth / 2,
        top: -4,
        width: hitWidth,
        height: totalHeight + 8,
        zIndex: 20,
        cursor: 'ew-resize',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 13,
          height: 12,
          background: '#e94560',
          clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 12,
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 1,
          background: '#e94560',
          opacity: 0.85,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
