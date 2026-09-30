// "public": fotos de productos (dominio propio + caché).
// "private": comprobantes, facturas y documentos (solo URLs prefirmadas).
export type StorageBucket = "public" | "private"

export type StoredObjectInfo = {
  size: number
  contentType: string | null
}

// Interfaz de almacenamiento. En producción la implementa R2;
// en pruebas, la versión en memoria.
export interface StorageProvider {
  createUploadUrl(input: {
    bucket: StorageBucket
    path: string
    contentType: string
    expiresInSeconds: number
  }): Promise<string>

  createDownloadUrl(input: {
    bucket: StorageBucket
    path: string
    expiresInSeconds: number
  }): Promise<string>

  getObjectInfo(input: {
    bucket: StorageBucket
    path: string
  }): Promise<StoredObjectInfo | null>

  deleteObject(input: { bucket: StorageBucket; path: string }): Promise<void>

  // URL pública (solo bucket público). null si no hay dominio configurado.
  getPublicUrl(path: string): string | null
}
