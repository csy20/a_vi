import { type Track } from '../store/useEditorStore'

export interface Asset {
  id: string
  project_id: string
  name: string
  file_type: 'video' | 'audio' | 'image'
  file_size: number | null
  duration_seconds: number | null
  playback_url: string
  thumbnail_url: string | null
  created_at: string
}

interface StoredAssetRecord {
  id: string
  project_id: string
  name: string
  file_type: Asset['file_type']
  file_size: number | null
  duration_seconds: number | null
  thumbnail_url: string | null
  created_at: string
  blob: Blob
}

export interface UploadAssetOptions {
  file: File
  projectId?: string
  onProgress?: (progress: number) => void
}

const DB_NAME = 'avi-local-assets'
const DB_VERSION = 1
const STORE_NAME = 'assets'

let dbPromise: Promise<IDBDatabase> | null = null
const objectUrlCache = new Map<string, string>()

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })

const transactionToPromise = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })

const getDatabase = async () => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const database = request.result

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('project_id', 'project_id', { unique: false })
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
    })
  }

  return dbPromise
}

const getPlaybackUrl = (record: StoredAssetRecord) => {
  const cached = objectUrlCache.get(record.id)
  if (cached) return cached

  const url = URL.createObjectURL(record.blob)
  objectUrlCache.set(record.id, url)
  return url
}

const revokePlaybackUrl = (assetId: string) => {
  const cached = objectUrlCache.get(assetId)
  if (!cached) return

  URL.revokeObjectURL(cached)
  objectUrlCache.delete(assetId)
}

const toAsset = (record: StoredAssetRecord): Asset => ({
  id: record.id,
  project_id: record.project_id,
  name: record.name,
  file_type: record.file_type,
  file_size: record.file_size,
  duration_seconds: record.duration_seconds,
  playback_url: getPlaybackUrl(record),
  thumbnail_url: record.thumbnail_url,
  created_at: record.created_at,
})

const createAssetId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const detectFileType = (file: File): Asset['file_type'] => {
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('image/')) return 'image'

  throw new Error('Unsupported file type. Please upload video, audio, or image files.')
}

const detectMediaDuration = (file: File, fileType: Asset['file_type']) =>
  new Promise<number | null>((resolve) => {
    if (fileType === 'image') {
      resolve(null)
      return
    }

    const media = document.createElement(fileType === 'audio' ? 'audio' : 'video')
    const objectUrl = URL.createObjectURL(file)

    media.preload = 'metadata'
    media.onloadedmetadata = () => {
      const duration = Number.isFinite(media.duration) ? media.duration : null
      URL.revokeObjectURL(objectUrl)
      resolve(duration)
    }

    media.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }

    media.src = objectUrl
  })

const getAssetRecord = async (assetId: string): Promise<StoredAssetRecord | null> => {
  const database = await getDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const store = transaction.objectStore(STORE_NAME)
  const record = await requestToPromise(store.get(assetId))
  await transactionToPromise(transaction)
  return record ?? null
}

export async function uploadAsset({
  file,
  projectId,
  onProgress,
}: UploadAssetOptions): Promise<Asset> {
  if (!projectId) {
    throw new Error('Project must be initialized before uploading assets')
  }

  const fileType = detectFileType(file)
  onProgress?.(15)

  const [durationSeconds, thumbnailUrl] = await Promise.all([
    detectMediaDuration(file, fileType),
    fileType === 'video' ? generateVideoThumbnail(file) : Promise.resolve(null),
  ])

  onProgress?.(65)

  const record: StoredAssetRecord = {
    id: createAssetId(),
    project_id: projectId,
    name: file.name,
    file_type: fileType,
    file_size: file.size,
    duration_seconds: durationSeconds,
    thumbnail_url: thumbnailUrl,
    created_at: new Date().toISOString(),
    blob: file,
  }

  const database = await getDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).put(record)
  await transactionToPromise(transaction)

  onProgress?.(100)
  return toAsset(record)
}

export async function getProjectAssets(projectId: string): Promise<Asset[]> {
  const database = await getDatabase()
  const transaction = database.transaction(STORE_NAME, 'readonly')
  const index = transaction.objectStore(STORE_NAME).index('project_id')
  const records = await requestToPromise(index.getAll(projectId))
  await transactionToPromise(transaction)

  return (records ?? [])
    .map(toAsset)
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
}

export async function deleteAsset(assetId: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  transaction.objectStore(STORE_NAME).delete(assetId)
  await transactionToPromise(transaction)

  revokePlaybackUrl(assetId)
}

export async function deleteProjectAssets(projectId: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index('project_id')
  const records = await requestToPromise(index.getAll(projectId))

  for (const record of records ?? []) {
    store.delete(record.id)
    revokePlaybackUrl(record.id)
  }

  await transactionToPromise(transaction)
}

export async function resolveTracksWithAssets(tracks: Track[], fps: number): Promise<Track[]> {
  const assetIds = Array.from(
    new Set(
      tracks.flatMap((track) => track.clips.map((clip) => clip.assetId).filter(Boolean)) as string[]
    )
  )

  const records = await Promise.all(assetIds.map((assetId) => getAssetRecord(assetId)))
  const recordMap = new Map(
    records
      .filter((record): record is StoredAssetRecord => Boolean(record))
      .map((record) => [record.id, record])
  )

  return tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) => {
      if (!clip.assetId) return { ...clip }

      const record = recordMap.get(clip.assetId)
      if (!record) {
        return {
          ...clip,
          assetUrl: undefined,
          isMissingAsset: true,
        }
      }

      const mediaDurationFrames =
        clip.mediaDurationFrames ??
        (record.duration_seconds != null ? Math.max(1, Math.round(record.duration_seconds * fps)) : undefined)

      return {
        ...clip,
        assetUrl: getPlaybackUrl(record),
        isMissingAsset: false,
        mediaDurationFrames,
      }
    }),
  }))
}

export async function generateVideoThumbnail(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2)
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 180
      const context = canvas.getContext('2d')

      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      } else {
        resolve(null)
      }

      URL.revokeObjectURL(video.src)
    }

    video.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(video.src)
    }

    video.src = URL.createObjectURL(file)
  })
}
