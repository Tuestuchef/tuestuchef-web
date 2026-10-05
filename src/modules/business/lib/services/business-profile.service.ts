import "server-only"

import { cache } from "react"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { getStorage } from "@/common/lib/services/storage.service"

import { BUSINESS_MESSAGES, HEADER_IMAGE_MAX_BYTES, HEADER_IMAGE_TYPES, type HeaderImageType } from "../constants/business.constants"
import type { BusinessProfileInput } from "../schemas/business-profile.schema"
import type { BusinessProfile } from "../types/business.types"

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const BUCKET = "public" as const
const DOWNLOAD_TTL_SECONDS = 60 * 60

const EMPTY: BusinessProfile = {
  tradeName: null,
  legalName: null,
  taxId: null,
  email: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  website: null,
  address: null,
  headerImagePath: null,
  headerImageUrl: null,
  updatedAt: null,
  updatedByName: null,
}

// URL de una imagen del bucket público: su dominio si existe; si no, una URL firmada temporal.
export async function resolvePublicImageUrl(path: string): Promise<string | null> {
  const storage = getStorage()
  if (!storage) return null
  return storage.getPublicUrl(path) ?? (await storage.createDownloadUrl({ bucket: BUCKET, path, expiresInSeconds: DOWNLOAD_TTL_SECONDS }))
}

// Una sola lectura por pedido aunque varias partes de la página la pidan.
export const getBusinessProfile = cache(async (): Promise<BusinessProfile> => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("business_profile")
    .select("*, editor:profiles!business_profile_updated_by_fkey(full_name)")
    .maybeSingle()
  if (!data) return EMPTY
  return {
    tradeName: data.trade_name,
    legalName: data.legal_name,
    taxId: data.tax_id,
    email: data.email,
    phone: data.phone,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    website: data.website,
    address: data.address,
    headerImagePath: data.header_image_path,
    headerImageUrl: data.header_image_path ? await resolvePublicImageUrl(data.header_image_path) : null,
    updatedAt: data.updated_at,
    updatedByName: data.editor?.full_name ?? null,
  }
})

export async function updateBusinessProfile(input: BusinessProfileInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("business_profile").update(input).eq("id", true).select("id")
}

// brand/header/<uuid>.<ext>: el nombre lo pone el sistema.
export async function createHeaderImageUpload(
  contentType: HeaderImageType
): Promise<Result<{ path: string; uploadUrl: string; contentType: string }>> {
  const storage = getStorage()
  if (!storage) return { ok: false, error: BUSINESS_MESSAGES.STORAGE_DISABLED }
  const path = `brand/header/${crypto.randomUUID()}.${HEADER_IMAGE_TYPES[contentType]}`
  const uploadUrl = await storage.createUploadUrl({ bucket: BUCKET, path, contentType, expiresInSeconds: 5 * 60 })
  return { ok: true, data: { path, uploadUrl, contentType } }
}

// Verifica la imagen subida (tipo y tamaño), la deja como encabezado y borra la anterior.
export async function registerHeaderImage(path: string): Promise<Result> {
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

  const supabase = await createSupabaseServerClient()
  const { data: current } = await supabase.from("business_profile").select("header_image_path").maybeSingle()
  const { data, error } = await supabase.from("business_profile").update({ header_image_path: path }).eq("id", true).select("id")
  if (error || !data?.length) {
    await storage.deleteObject({ bucket: BUCKET, path })
    return { ok: false, error: "No se pudo guardar la imagen." }
  }
  if (current?.header_image_path && current.header_image_path !== path) {
    await storage.deleteObject({ bucket: BUCKET, path: current.header_image_path })
  }
  return { ok: true, data: undefined }
}

export async function removeHeaderImage(): Promise<Result> {
  const supabase = await createSupabaseServerClient()
  const { data: current } = await supabase.from("business_profile").select("header_image_path").maybeSingle()
  const { data, error } = await supabase.from("business_profile").update({ header_image_path: null }).eq("id", true).select("id")
  if (error || !data?.length) return { ok: false, error: "No se pudo quitar la imagen." }
  if (current?.header_image_path) await getStorage()?.deleteObject({ bucket: BUCKET, path: current.header_image_path })
  return { ok: true, data: undefined }
}
