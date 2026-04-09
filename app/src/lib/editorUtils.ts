import { type Clip, type Track } from '../store/useEditorStore'

export const flattenClips = (tracks: Track[]) => tracks.flatMap((track) => track.clips)

export const hasVideoClips = (tracks: Track[]) =>
  flattenClips(tracks).some((clip) => clip.mediaType === 'video')

export const hasUsableVideoClips = (tracks: Track[]) =>
  flattenClips(tracks).some((clip) => clip.mediaType === 'video' && clip.assetUrl && !clip.isMissingAsset)

export const hasMissingRenderableMedia = (tracks: Track[]) =>
  flattenClips(tracks).some(
    (clip) =>
      clip.mediaType !== 'text' &&
      Boolean(clip.assetId) &&
      (!clip.assetUrl || clip.isMissingAsset)
  )

export const hasRenderableContent = (tracks: Track[]) =>
  flattenClips(tracks).some((clip) => {
    if (clip.mediaType === 'text') {
      return Boolean(clip.text)
    }

    return Boolean(clip.assetUrl) && !clip.isMissingAsset
  })

export const getClipDurationFrames = (clip: Clip) => clip.endFrame - clip.startFrame + 1
