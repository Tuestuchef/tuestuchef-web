import "server-only"

import { getStorageConfig } from "@/common/lib/config/storage.config"
import { createR2Storage } from "@/common/lib/services/r2-storage.service"
import type { StorageProvider } from "@/common/lib/types/storage.types"

let cached: StorageProvider | null | undefined

// null = almacenamiento no configurado (la app sigue funcionando sin comprobantes).
export function getStorage(): StorageProvider | null {
  if (cached === undefined) {
    const config = getStorageConfig()
    cached = config ? createR2Storage(config) : null
  }
  return cached
}

export const isStorageEnabled = () => getStorage() !== null
