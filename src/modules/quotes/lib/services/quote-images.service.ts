import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { getStorage } from "@/common/lib/services/storage.service"
import { resolveImageUrl } from "@/modules/products/lib/services/product-images.service"

import { QUOTE_IMAGE_MAX_BYTES, QUOTE_IMAGE_TYPES, type QuoteImageType } from "../constants/quotes.constants"
import type { CatalogImageOption, QuoteImage } from "../types/quotes.types"

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

// Las subidas van al bucket privado: pueden ser diseños o logos de clientes.
const BUCKET = "private" as const
const VIEW_TTL_SECONDS = 10 * 60
const STORAGE_DISABLED = "El almacenamiento de archivos no está configurado."

// Firma la subida de una imagen libre: quotes/images/<uuid>.<ext>.
export async function createQuoteImageUpload(contentType: QuoteImageType): Promise<Result<{ path: string; uploadUrl: string; contentType: string }>> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: STORAGE_DISABLED }
  const path = `quotes/images/${crypto.randomUUID()}.${QUOTE_IMAGE_TYPES[contentType]}`
  const uploadUrl = await storage.createUploadUrl({ bucket: BUCKET, path, contentType, expiresInSeconds: 5 * 60 })
  return { ok: true, data: { path, uploadUrl, contentType } }
}

// Revisa lo subido (tipo y tamaño) y devuelve una URL para verla. Si no sirve, se borra.
export async function verifyQuoteImage(path: string): Promise<Result<{ url: string }>> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: STORAGE_DISABLED }
  const info = await storage.getObjectInfo({ bucket: BUCKET, path })
  const extension = path.slice(path.lastIndexOf(".") + 1)
  const expected = Object.entries(QUOTE_IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0]
  if (!info) return { ok: false, error: "La imagen no terminó de subir. Intenta de nuevo." }
  if (info.size <= 0 || info.size > QUOTE_IMAGE_MAX_BYTES || info.contentType !== expected) {
    await storage.deleteObject({ bucket: BUCKET, path })
    return { ok: false, error: "La imagen no es válida (JPG, PNG o WEBP de hasta 8 MB)." }
  }
  return { ok: true, data: { url: await storage.createDownloadUrl({ bucket: BUCKET, path, expiresInSeconds: VIEW_TTL_SECONDS }) } }
}

// URL para ver una imagen: las del catálogo, públicas; las subidas, firmadas por poco tiempo.
export async function quoteImageUrl(image: Pick<QuoteImage, "bucket" | "path">): Promise<string | null> {
  if (image.bucket === "public") return resolveImageUrl(image.path)
  const storage = getStorage()
  if (!storage) return null
  return storage.createDownloadUrl({ bucket: BUCKET, path: image.path, expiresInSeconds: VIEW_TTL_SECONDS })
}

export async function listQuoteImages(quoteId: string): Promise<QuoteImage[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("quote_images")
    .select("id, source, bucket, path, label, product_image_id")
    .eq("quote_id", quoteId)
    .order("position")
  if (error) return []
  return Promise.all(
    data.map(async (row) => {
      const image = {
        id: row.id,
        source: row.source as QuoteImage["source"],
        bucket: row.bucket as QuoteImage["bucket"],
        path: row.path,
        label: row.label,
        productImageId: row.product_image_id,
      }
      return { ...image, url: await quoteImageUrl(image) }
    })
  )
}

// Fotos del catálogo para elegir: las de los productos terminados activos, con su color.
export async function listCatalogImageOptions(): Promise<CatalogImageOption[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("product_images")
    .select("id, path, product_id, is_primary, sort_order, color:colors(name), product:products!inner(name, kind, is_active)")
    .eq("product.kind", "finished_good")
    .eq("product.is_active", true)
  if (error) return []
  const sorted = [...data].sort(
    (a, b) =>
      a.product.name.localeCompare(b.product.name, "es") || Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
  )
  return Promise.all(
    sorted.map(async (row) => ({
      id: row.id,
      productId: row.product_id,
      productName: row.product.name,
      colorName: row.color?.name ?? null,
      url: await resolveImageUrl(row.path),
    }))
  )
}
