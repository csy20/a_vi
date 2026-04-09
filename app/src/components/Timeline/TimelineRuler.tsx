import React from 'react'
import { PIXELS_PER_FRAME, RULER_HEIGHT } from './constants'

interface Props {
  totalFrames: number
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void
}

export const TimelineRuler: React.FC<Props> = ({ totalFrames, onMouseDown }) => {
  const ticks: React.ReactNode[] = []

  for (let f = 0; f <= totalFrames; f++) {
    const x       = f * PIXELS_PER_FRAME
    const isMajor = f % 30 === 0
    const isMed   = f % 10 === 0
    if (!isMed) continue // skip single-frame ticks at default zoom

    ticks.push(
      <React.Fragment key={f}>
        {/* Tick mark */}
        <div
          style={{
            position: 'absolute',
            left: x,
            bottom: 0,
            width: 1,
            height: isMajor ? 14 : 8,
            background: isMajor ? '#555' : '#333',
          }}
        />
        {/* Frame label — only on major ticks */}
        {isMajor && (
          <span
            style={{
              position: 'absolute',
              left: x + 3,
              top: 5,
              fontSize: 10,
              color: '#777',
              fontFamily: 'monospace',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {f}
          </span>
        )}
      </React.Fragment>
    )
  }

  return (
    <div
      data-ruler="timeline"
      onMouseDown={onMouseDown}
      style={{
        height: RULER_HEIGHT,
        background: '#181818',
        borderBottom: '1px solid #2e2e2e',
        position: 'relative',
        userSelect: 'none',
        flexShrink: 0,
        cursor: 'ew-resize',
      }}
    >
      {ticks}
    </div>
  )
}
