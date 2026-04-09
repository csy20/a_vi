import React, { useEffect, useState } from 'react'
import { AbsoluteFill, Html5Audio, Img, Html5Video, Sequence, interpolate, useCurrentFrame } from 'remotion'
import { type Clip, type Track } from '../../store/useEditorStore'
import { getSafeMediaTrimProps, validateClip } from '../../lib/clipValidation'

const getMediaFailureMessage = (clip: Clip, error?: string) => {
  if (error && error.trim().length > 0) {
    return error.trim()
  }

  return `Unable to load ${clip.mediaType ?? 'media'} for "${clip.label}".`
}

const MediaFailureOverlay: React.FC<{
  clip: Clip
  message: string
  opacity: number
}> = ({ clip, message, opacity }) => (
  <AbsoluteFill
    style={{
      opacity,
      background: 'linear-gradient(135deg, rgba(18,18,18,0.76), rgba(6,6,6,0.9))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 36px',
    }}
  >
    <div
      style={{
        width: 'min(100%, 520px)',
        borderRadius: 14,
        border: '1px solid rgba(251,191,36,0.42)',
        background: 'rgba(10,10,10,0.84)',
        boxShadow: '0 16px 44px rgba(0,0,0,0.32)',
        padding: '20px 24px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.1,
          color: '#fbbf24',
          fontFamily: 'monospace',
        }}
      >
        MEDIA ERROR
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 18,
          fontWeight: 700,
          color: '#f3f4f6',
        }}
      >
        {clip.label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 13,
          lineHeight: 1.5,
          color: '#c6c6c6',
        }}
      >
        {message}
      </div>
    </div>
  </AbsoluteFill>
)

const VideoClipRenderer: React.FC<{
  clip: Clip
  opacity: number
  trimBefore?: number
  trimAfter?: number
}> = ({ clip, opacity, trimBefore, trimAfter }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setErrorMessage(null)
  }, [clip.id, clip.assetUrl, clip.mediaStart, clip.mediaEnd])

  if (errorMessage) {
    return (
      <MediaFailureOverlay
        clip={clip}
        message={getMediaFailureMessage(clip, errorMessage)}
        opacity={opacity}
      />
    )
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <Html5Video
        src={clip.assetUrl!}
        trimBefore={trimBefore}
        trimAfter={trimAfter}
        onError={(error) => setErrorMessage(error.message)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  )
}

const AudioClipRenderer: React.FC<{
  clip: Clip
  trimBefore?: number
  trimAfter?: number
}> = ({ clip, trimBefore, trimAfter }) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setErrorMessage(null)
  }, [clip.id, clip.assetUrl, clip.mediaStart, clip.mediaEnd])

  if (errorMessage) {
    return (
      <MediaFailureOverlay
        clip={clip}
        message={getMediaFailureMessage(clip, errorMessage)}
        opacity={1}
      />
    )
  }

  return (
    <Html5Audio
      src={clip.assetUrl!}
      trimBefore={trimBefore}
      trimAfter={trimAfter}
      onError={(error) => setErrorMessage(error.message)}
    />
  )
}

const ImageClipRenderer: React.FC<{ clip: Clip; opacity: number }> = ({ clip, opacity }) => {
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setHasError(false)
  }, [clip.id, clip.assetUrl])

  if (hasError) {
    return (
      <MediaFailureOverlay
        clip={clip}
        message={getMediaFailureMessage(clip)}
        opacity={opacity}
      />
    )
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={clip.assetUrl!}
        onError={() => setHasError(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </AbsoluteFill>
  )
}

const ClipRenderer: React.FC<{ clip: Clip }> = ({ clip }) => {
  if (!validateClip(clip)) {
    return null
  }

  const opacity = clip.opacity ?? 1

  if (clip.mediaType === 'text' && clip.text) {
    return (
      <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity }}>
        <div
          style={{
            fontSize: clip.fontSize || 48,
            fontWeight: 800,
            color: clip.fontColor || '#ffffff',
            textAlign: 'center',
            textShadow: '2px 2px 8px rgba(0,0,0,0.7)',
            padding: '0 40px',
          }}
        >
          {clip.text}
        </div>
      </AbsoluteFill>
    )
  }

  if (clip.isMissingAsset) {
    return (
      <AbsoluteFill
        style={{
          background: 'linear-gradient(135deg, rgba(42,42,42,0.95), rgba(22,22,22,0.95))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity,
        }}
      >
        <div
          style={{
            padding: '18px 24px',
            borderRadius: 12,
            border: '1px dashed rgba(251,191,36,0.55)',
            color: '#fbbf24',
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 0.6,
          }}
        >
          Missing media: {clip.label}
        </div>
      </AbsoluteFill>
    )
  }

  const trimProps = getSafeMediaTrimProps(clip)

  if (clip.mediaType === 'video' && clip.assetUrl) {
    return (
      <VideoClipRenderer
        clip={clip}
        opacity={opacity}
        trimBefore={trimProps.trimBefore}
        trimAfter={trimProps.trimAfter}
      />
    )
  }

  if (clip.mediaType === 'audio' && clip.assetUrl) {
    return (
      <AudioClipRenderer clip={clip} trimBefore={trimProps.trimBefore} trimAfter={trimProps.trimAfter} />
    )
  }

  if (clip.mediaType === 'image' && clip.assetUrl) {
    return (
      <ImageClipRenderer clip={clip} opacity={opacity} />
    )
  }

  return null
}

export interface TrackPreviewProps {
  tracks: Track[]
  totalFrames: number
  label?: string
  isProposed?: boolean
}

export const TrackPreviewComposition: React.FC<TrackPreviewProps> = ({
  tracks,
  totalFrames,
  label = 'ORIGINAL',
  isProposed = false,
}) => {
  const frame = useCurrentFrame()
  const progress = frame / Math.max(totalFrames - 1, 1)
  const glowOpacity = isProposed ? interpolate(frame % 60, [0, 30, 60], [0.4, 1, 0.4]) : 0
  // FIX: 1 - validate clips before preview render so bad trim values never hit Remotion.
  const safeTracks = tracks.map((track) => ({
    ...track,
    clips: track.clips.filter(validateClip),
  }))

  const activeClips = safeTracks.flatMap((track) =>
    track.clips.filter((clip) => frame >= clip.startFrame && frame <= clip.endFrame)
  )

  const trackRowHeight = 18
  const miniTimelineHeight = safeTracks.length * trackRowHeight + 16

  const hasMediaClips = safeTracks.some((track) =>
    track.clips.some((clip) => clip.assetUrl || clip.isMissingAsset || (clip.mediaType === 'text' && clip.text))
  )

  return (
    <AbsoluteFill
      style={{
        background: '#0e0e0e',
        outline: isProposed ? `2px solid rgba(99,160,255,${glowOpacity})` : 'none',
        boxShadow: isProposed ? `inset 0 0 60px rgba(99,160,255,${glowOpacity * 0.15})` : 'none',
      }}
    >
      {hasMediaClips && (
        <AbsoluteFill style={{ zIndex: 0 }}>
          {safeTracks.map((track) =>
            track.clips
              .filter((clip) => clip.assetUrl || clip.isMissingAsset || (clip.mediaType === 'text' && clip.text))
              .map((clip) => (
                <Sequence
                  key={clip.id}
                  from={clip.startFrame}
                  durationInFrames={clip.endFrame - clip.startFrame + 1}
                  layout="none"
                >
                  <ClipRenderer clip={clip} />
                </Sequence>
              ))
          )}
        </AbsoluteFill>
      )}

      <AbsoluteFill
        style={{
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '36px 48px',
          gap: 28,
          background: hasMediaClips ? 'rgba(14,14,14,0.6)' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 2,
              color: isProposed ? '#63a0ff' : '#aaa',
              fontFamily: 'monospace',
            }}
          >
            {label}
          </span>
          {isProposed && (
            <span
              style={{
                fontSize: 10,
                background: 'rgba(99,160,255,0.15)',
                border: '1px solid rgba(99,160,255,0.4)',
                color: '#63a0ff',
                borderRadius: 4,
                padding: '2px 8px',
                fontFamily: 'monospace',
                letterSpacing: 1,
              }}
            >
              GHOST PREVIEW
            </span>
          )}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: '#444',
              fontFamily: 'monospace',
            }}
          >
            f{frame} / f{totalFrames - 1}
          </span>
        </div>

        <div
          style={{
            position: 'relative',
            height: miniTimelineHeight,
            background: '#161616',
            borderRadius: 8,
            padding: '8px 12px',
            border: '1px solid #252525',
          }}
        >
          {safeTracks.map((track, trackIndex) => (
            <div
              key={track.id}
              style={{
                position: 'absolute',
                top: 8 + trackIndex * trackRowHeight,
                left: 12,
                right: 12,
                height: trackRowHeight - 3,
              }}
            >
              {track.clips.map((clip) => {
                const isActive = frame >= clip.startFrame && frame <= clip.endFrame
                const left = (clip.startFrame / totalFrames) * 100
                const width = ((clip.endFrame - clip.startFrame + 1) / totalFrames) * 100

                return (
                  <div
                    key={clip.id}
                    style={{
                      position: 'absolute',
                      left: `${left}%`,
                      width: `${width}%`,
                      height: '100%',
                      background: clip.isMissingAsset ? '#6b7280' : clip.color,
                      opacity: isActive ? 1 : 0.28,
                      borderRadius: 3,
                      border: clip.isMissingAsset ? '1px dashed rgba(251,191,36,0.6)' : 'none',
                      transition: 'opacity 0.08s',
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden',
                      paddingLeft: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: '#fff',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {clip.label}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `calc(12px + ${progress * 100}% * (100% - 24px) / 100%)`,
              width: 1.5,
              background: '#e94560',
              zIndex: 10,
            }}
          />
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              color: '#444',
              fontFamily: 'monospace',
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            ACTIVE AT f{frame}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {activeClips.length === 0 ? (
              <div
                style={{
                  fontSize: 14,
                  color: '#333',
                  fontStyle: 'italic',
                  padding: '12px 0',
                }}
              >
                no clips at this frame
              </div>
            ) : (
              activeClips.map((clip) => (
                <div
                  key={clip.id}
                  style={{
                    background: clip.isMissingAsset ? 'rgba(107,114,128,0.18)' : `${clip.color}22`,
                    border: clip.isMissingAsset
                      ? '1.5px dashed rgba(251,191,36,0.55)'
                      : `1.5px solid ${clip.color}88`,
                    borderRadius: 10,
                    padding: '14px 20px',
                    flex: '1 1 180px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>
                    {clip.label}
                  </span>
                  <span style={{ fontSize: 11, color: clip.isMissingAsset ? '#fbbf24' : '#888', fontFamily: 'monospace' }}>
                    {clip.startFrame} → {clip.endFrame}
                    {clip.isMissingAsset ? '  missing media' : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
