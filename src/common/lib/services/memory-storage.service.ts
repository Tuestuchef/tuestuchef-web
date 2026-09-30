import type {
  StorageBucket,
  StoredObjectInfo,
  StorageProvider,
} from "@/common/lib/types/storage.types"

// Almacenamiento en memoria para pruebas: mismas firmas que R2, sin red.
export function createMemoryStorage() {
  const objects = new Map<string, StoredObjectInfo>()
  const key = (bucket: StorageBucket, path: string) => `${bucket}/${path}`

  const provider: StorageProvider = {
    createUploadUrl: async ({ bucket, path, contentType, expiresInSeconds }) =>
      `memory://${key(bucket, path)}?method=PUT&contentType=${encodeURIComponent(contentType)}&expires=${expiresInSeconds}`,
    createDownloadUrl: async ({ bucket, path, expiresInSeconds }) =>
      `memory://${key(bucket, path)}?method=GET&expires=${expiresInSeconds}`,
    getObjectInfo: async ({ bucket, path }) => objects.get(key(bucket, path)) ?? null,
    deleteObject: async ({ bucket, path }) => {
      objects.delete(key(bucket, path))
    },
    getPublicUrl: (path) => `memory://public/${path}`,
  }

  return {
    provider,
    // Simula que el navegador subió un archivo con la URL prefirmada.
    putObject: (bucket: StorageBucket, path: string, info: StoredObjectInfo) => {
      objects.set(key(bucket, path), info)
    },
    hasObject: (bucket: StorageBucket, path: string) => objects.has(key(bucket, path)),
  }
}
