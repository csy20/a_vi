// FIX: 2 - persist uploaded media blobs in IndexedDB so reloads can restore local playback URLs.
import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'avi-media-storage'
const STORE_NAME = 'blobs'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase> | null = null
const objectUrlCache = new Map<string, string>()

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  return dbPromise
}

const rememberObjectUrl = (assetId: string, blob: Blob) => {
  const cached = objectUrlCache.get(assetId)
  if (cached) {
    return cached
  }

  const url = URL.createObjectURL(blob)
  objectUrlCache.set(assetId, url)
  return url
}

const persistMediaBlob = async (assetId: string, blob: Blob): Promise<string> => {
  const db = await getDB()
  revokeMediaBlobUrl(assetId)
  await db.put(STORE_NAME, blob, assetId)
  return rememberObjectUrl(assetId, blob)
}

export function revokeMediaBlobUrl(assetId: string): void {
  const cached = objectUrlCache.get(assetId)
  if (!cached) return

  URL.revokeObjectURL(cached)
  objectUrlCache.delete(assetId)
}

export async function saveMediaBlob(assetId: string, file: File): Promise<string> {
  return persistMediaBlob(assetId, file)
}

export async function restoreMediaBlob(assetId: string, blob: Blob): Promise<string> {
  return persistMediaBlob(assetId, blob)
}

export async function loadMediaBlob(assetId: string): Promise<string | null> {
  const cached = objectUrlCache.get(assetId)
  if (cached) {
    return cached
  }

  const db = await getDB()
  const blob = await db.get(STORE_NAME, assetId)
  if (!blob) return null
  return rememberObjectUrl(assetId, blob)
}

export async function deleteMediaBlob(assetId: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, assetId)
  revokeMediaBlobUrl(assetId)
}

export async function getAllStoredAssetIds(): Promise<string[]> {
  const db = await getDB()
  return db.getAllKeys(STORE_NAME) as Promise<string[]>
}
