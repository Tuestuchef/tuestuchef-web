// Comprobantes (bucket privado). Tipo y extensión los fija el sistema, nunca el usuario.
export const RECEIPT_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
} as const

export type ReceiptContentType = keyof typeof RECEIPT_CONTENT_TYPES

export const RECEIPT_ACCEPT = Object.keys(RECEIPT_CONTENT_TYPES).join(",")

export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024

// URLs prefirmadas de corta duración.
export const RECEIPT_UPLOAD_URL_TTL_SECONDS = 5 * 60
export const RECEIPT_DOWNLOAD_URL_TTL_SECONDS = 5 * 60

// receipts/2026/09/<uuid>.jpg
export const RECEIPT_PATH_PATTERN =
  /^receipts\/\d{4}\/(0[1-9]|1[0-2])\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|pdf)$/

export const RECEIPT_MESSAGES = {
  DISABLED:
    "Los comprobantes todavía no están disponibles (falta configurar el almacenamiento). Puedes registrar sin comprobante.",
  INVALID_TYPE: "Solo se aceptan fotos JPG o PNG y archivos PDF.",
  TOO_LARGE: "El archivo pesa más de 10 MB.",
  EMPTY: "El archivo está vacío.",
  NOT_UPLOADED: "El comprobante no terminó de subir. Vuelve a adjuntarlo.",
  INVALID_PATH: "El comprobante no es válido. Vuelve a adjuntarlo.",
  SESSION_EXPIRED: "Tu sesión expiró. Vuelve a iniciar sesión.",
  UPLOAD_FAILED: "No se pudo subir el comprobante. Revisa tu conexión e intenta de nuevo.",
} as const
