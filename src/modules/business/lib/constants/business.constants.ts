export const BUSINESS_MESSAGES = {
  SAVED: "Datos de la empresa guardados.",
  HEADER_SAVED: "Imagen del encabezado guardada.",
  HEADER_REMOVED: "Imagen del encabezado quitada.",
  STORAGE_DISABLED: "Las imágenes no están disponibles: falta configurar el almacenamiento (R2).",
}

// Imagen del encabezado de presupuestos y recibos. Solo PNG o JPG: es lo que acepta el PDF.
export const HEADER_IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg" } as const
export type HeaderImageType = keyof typeof HEADER_IMAGE_TYPES
export const HEADER_IMAGE_ACCEPT = Object.keys(HEADER_IMAGE_TYPES).join(",")
export const HEADER_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const HEADER_IMAGE_PATH_PATTERN = /^brand\/header\/[0-9a-f-]{36}\.(png|jpg)$/
