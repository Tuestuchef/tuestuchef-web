import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { getStorage } from "@/common/lib/services/storage.service"

import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_TYPES, type ProductImageType } from "../constants/products.constants"
import type { ProductImage } from "../types/products.types"

const BUCKET = "public" as const
const DOWNLOAD_TTL_SECONDS = 60 * 60

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const DISABLED = "Las fotos no están disponibles: falta configurar el almacenamiento (R2)."

// URL de la foto: el dominio público del bucket si existe; si no, una URL firmada temporal.
export async function resolveImageUrl(path: string): Promise<string | null> {
  const storage = getStorage()
  if (!storage) return null
  return (
    storage.getPublicUrl(path) ??
    (await storage.createDownloadUrl({ bucket: BUCKET, path, expiresInSeconds: DOWNLOAD_TTL_SECONDS }))
  )
}

export async function listProductImages(productId: string): Promise<ProductImage[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("product_images")
    .select("*")
    .eq("product_id", productId)
    .order("is_primary", { ascending: false })
    .order("sort_order")
  if (error) throw error
  return Promise.all(data.map(async (image) => ({ ...image, url: await resolveImageUrl(image.path) })))
}

// products/<producto>/<uuid>.<ext>: el nombre lo pone el sistema.
export async function createProductImageUpload(
  productId: string,
  contentType: ProductImageType
): Promise<Result<{ path: string; uploadUrl: string; contentType: string }>> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: DISABLED }
  const path = `products/${productId}/${crypto.randomUUID()}.${PRODUCT_IMAGE_TYPES[contentType]}`
  const uploadUrl = await storage.createUploadUrl({ bucket: BUCKET, path, contentType, expiresInSeconds: 5 * 60 })
  return { ok: true, data: { path, uploadUrl, contentType } }
}

// Verifica el archivo en R2 y lo registra. La primera foto queda como principal.
export async function registerProductImage(productId: string, path: string, colorId?: string): Promise<Result> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: DISABLED }

  const info = await storage.getObjectInfo({ bucket: BUCKET, path })
  const extension = path.slice(path.lastIndexOf(".") + 1)
  const expected = Object.entries(PRODUCT_IMAGE_TYPES).find(([, ext]) => ext === extension)?.[0]
  if (!info) return { ok: false, error: "La foto no terminó de subir. Intenta de nuevo." }
  if (info.size <= 0 || info.size > PRODUCT_IMAGE_MAX_BYTES || info.contentType !== expected) {
    await storage.deleteObject({ bucket: BUCKET, path })
    return { ok: false, error: "La foto no es válida (tipo o tamaño)." }
  }

  const supabase = await createSupabaseServerClient()
  const { data: existing } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: false })
  const { error } = await supabase.from("product_images").insert({
    product_id: productId,
    path,
    color_id: colorId ?? null,
    sort_order: (existing?.[0]?.sort_order ?? -1) + 1,
    is_primary: !existing?.length,
  })
  if (error) {
    await storage.deleteObject({ bucket: BUCKET, path })
    return { ok: false, error: "No se pudo guardar la foto." }
  }
  return { ok: true, data: undefined }
}

export async function setPrimaryImage(imageId: string): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data: image } = await supabase.from("product_images").select("product_id").eq("id", imageId).maybeSingle()
  if (!image) return { ok: false, error: "La foto no existe." }
  // Primero se quita la actual: solo puede haber una principal.
  await supabase.from("product_images").update({ is_primary: false }).eq("product_id", image.product_id).eq("is_primary", true)
  const { data, error } = await supabase.from("product_images").update({ is_primary: true }).eq("id", imageId).select("id")
  if (error || !data?.length) return { ok: false, error: "No se pudo marcar como principal." }
  return { ok: true, data: undefined }
}

export async function updateImageColor(imageId: string, colorId?: string): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("product_images")
    .update({ color_id: colorId ?? null })
    .eq("id", imageId)
    .select("id")
  if (error || !data?.length) return { ok: false, error: "No se pudo guardar el color." }
  return { ok: true, data: undefined }
}

// Mueve la foto un lugar antes o después en el orden.
export async function moveImage(imageId: string, direction: "up" | "down"): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data: image } = await supabase.from("product_images").select("product_id").eq("id", imageId).maybeSingle()
  if (!image) return { ok: false, error: "La foto no existe." }
  const { data: images } = await supabase
    .from("product_images")
    .select("id, sort_order")
    .eq("product_id", image.product_id)
    .order("sort_order")
  const list = images ?? []
  const index = list.findIndex((item) => item.id === imageId)
  const swap = direction === "up" ? index - 1 : index + 1
  if (index < 0 || swap < 0 || swap >= list.length) return { ok: true, data: undefined }

  const reordered = [...list]
  ;[reordered[index], reordered[swap]] = [reordered[swap], reordered[index]]
  for (const [position, item] of reordered.entries()) {
    if (item.sort_order !== position) {
      await supabase.from("product_images").update({ sort_order: position }).eq("id", item.id)
    }
  }
  return { ok: true, data: undefined }
}

// Borra la foto de la base y del bucket. Si era la principal, pasa a serlo la siguiente.
export async function deleteProductImage(imageId: string): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data: image } = await supabase.from("product_images").select("*").eq("id", imageId).maybeSingle()
  if (!image) return { ok: false, error: "La foto no existe." }

  const { data, error } = await supabase.from("product_images").delete().eq("id", imageId).select("id")
  if (error || !data?.length) return { ok: false, error: "No se pudo eliminar la foto." }

  await getStorage()?.deleteObject({ bucket: BUCKET, path: image.path })

  if (image.is_primary) {
    const { data: next } = await supabase
      .from("product_images")
      .select("id")
      .eq("product_id", image.product_id)
      .order("sort_order")
      .limit(1)
    if (next?.[0]) await supabase.from("product_images").update({ is_primary: true }).eq("id", next[0].id)
  }
  return { ok: true, data: undefined }
}
