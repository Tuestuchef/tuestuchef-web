import "server-only"

import {
  RECEIPT_CONTENT_TYPES,
  RECEIPT_DOWNLOAD_URL_TTL_SECONDS,
  RECEIPT_MAX_BYTES,
  RECEIPT_MESSAGES,
  RECEIPT_PATH_PATTERN,
  RECEIPT_UPLOAD_URL_TTL_SECONDS,
} from "@/common/lib/constants/receipts.constants"
import type { ReceiptUploadInput } from "@/common/lib/schemas/receipt-upload.schema"
import type { StorageProvider } from "@/common/lib/types/storage.types"

export type ReceiptResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

const BUCKET = "private" as const

// receipts/AAAA/MM/<uuid>.<ext>, con el mes de Caracas. El nombre lo genera el sistema.
export function buildReceiptPath(extension: string, now = new Date()) {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
  })
    .format(now)
    .split("-")
  return `receipts/${year}/${month}/${crypto.randomUUID()}.${extension}`
}

// El input ya viene validado con receiptUploadSchema.
export async function createReceiptUpload(
  storage: StorageProvider | null,
  input: ReceiptUploadInput,
  now = new Date()
): Promise<ReceiptResult<{ path: string; uploadUrl: string; contentType: string }>> {
  if (!storage) return { ok: false, error: RECEIPT_MESSAGES.DISABLED }

  const path = buildReceiptPath(RECEIPT_CONTENT_TYPES[input.contentType], now)
  const uploadUrl = await storage.createUploadUrl({
    bucket: BUCKET,
    path,
    contentType: input.contentType,
    expiresInSeconds: RECEIPT_UPLOAD_URL_TTL_SECONDS,
  })

  return { ok: true, data: { path, uploadUrl, contentType: input.contentType } }
}

// Antes de guardar la ruta en la base: el archivo existe, pesa lo permitido y
// su tipo coincide con la extensión que generamos. Si no, se borra.
export async function verifyReceipt(
  storage: StorageProvider | null,
  path: string
): Promise<ReceiptResult> {
  if (!storage) return { ok: false, error: RECEIPT_MESSAGES.DISABLED }
  if (!RECEIPT_PATH_PATTERN.test(path)) return { ok: false, error: RECEIPT_MESSAGES.INVALID_PATH }

  const info = await storage.getObjectInfo({ bucket: BUCKET, path })
  if (!info) return { ok: false, error: RECEIPT_MESSAGES.NOT_UPLOADED }

  const extension = path.slice(path.lastIndexOf(".") + 1)
  const expectedType = Object.entries(RECEIPT_CONTENT_TYPES).find(([, ext]) => ext === extension)?.[0]

  let error: string | null = null
  if (info.size <= 0) error = RECEIPT_MESSAGES.EMPTY
  else if (info.size > RECEIPT_MAX_BYTES) error = RECEIPT_MESSAGES.TOO_LARGE
  else if (info.contentType !== expectedType) error = RECEIPT_MESSAGES.INVALID_TYPE

  if (error) {
    await storage.deleteObject({ bucket: BUCKET, path })
    return { ok: false, error }
  }

  return { ok: true, data: undefined }
}

export async function createReceiptDownloadUrl(
  storage: StorageProvider | null,
  path: string
): Promise<ReceiptResult<string>> {
  if (!storage) return { ok: false, error: RECEIPT_MESSAGES.DISABLED }
  if (!RECEIPT_PATH_PATTERN.test(path)) return { ok: false, error: RECEIPT_MESSAGES.INVALID_PATH }

  const url = await storage.createDownloadUrl({
    bucket: BUCKET,
    path,
    expiresInSeconds: RECEIPT_DOWNLOAD_URL_TTL_SECONDS,
  })
  return { ok: true, data: url }
}
