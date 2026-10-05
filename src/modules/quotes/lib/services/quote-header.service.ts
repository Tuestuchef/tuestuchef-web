import "server-only"

import { getStorage } from "@/common/lib/services/storage.service"
import {
  BUSINESS_MESSAGES,
  HEADER_IMAGE_MAX_BYTES,
  HEADER_IMAGE_TYPES,
  type HeaderImageType,
} from "@/modules/business/lib/constants/business.constants"
import { resolvePublicImageUrl } from "@/modules/business/lib/services/business-profile.service"

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const BUCKET = "public" as const

// Imagen de encabezado solo para un presupuesto: quotes/header/<uuid>.<ext> en el bucket público.
export async function createQuoteHeaderUpload(
  contentType: HeaderImageType
): Promise<Result<{ path: string; uploadUrl: string; contentType: string }>> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: BUSINESS_MESSAGES.STORAGE_DISABLED }
  const path = `quotes/header/${crypto.randomUUID()}.${HEADER_IMAGE_TYPES[contentType]}`
  const uploadUrl = await storage.createUploadUrl({ bucket: BUCKET, path, contentType, expiresInSeconds: 5 * 60 })
  return { ok: true, data: { path, uploadUrl, contentType } }
}

// Revisa la imagen subida (tipo y tamaño) y devuelve su URL para la vista previa. Si no sirve, se borra.
export async function verifyQuoteHeaderImage(path: string): Promise<Result<{ url: string | null }>> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: BUSINESS_MESSAGES.STORAGE_DISABLED }
  const info = await storage.getObjectInfo({ bucket: BUCKET, path })
  const extension = path.slice(path.lastIndexOf(".") + 1)
  const expected = Object.entries(HEADER_IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0]
  if (!info) return { ok: false, error: "La imagen no terminó de subir. Intenta de nuevo." }
  if (info.size <= 0 || info.size > HEADER_IMAGE_MAX_BYTES || info.contentType !== expected) {
    await storage.deleteObject({ bucket: BUCKET, path })
    return { ok: false, error: "La imagen no es válida (PNG o JPG de hasta 2 MB)." }
  }
  return { ok: true, data: { url: await resolvePublicImageUrl(path) } }
}
