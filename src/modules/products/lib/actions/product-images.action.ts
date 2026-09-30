"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import {
  productImageRegisterSchema,
  productImageUpdateSchema,
  productImageUploadSchema,
} from "../schemas/products.schema"
import {
  createProductImageUpload,
  deleteProductImage,
  moveImage,
  registerProductImage,
  setPrimaryImage,
  updateImageColor,
} from "../services/product-images.service"

type Result<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string }

const idSchema = z.uuid()
const guard = () => authorizeAction(ROLE_GROUPS.MANAGEMENT)

// Firma la subida al bucket público (sesión, rol, tipo y tamaño verificados).
export async function requestProductImageUploadAction(
  input: unknown
): Promise<Result<{ path: string; uploadUrl: string; contentType: string }>> {
  const auth = await guard()
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = productImageUploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  return createProductImageUpload(parsed.data.product_id, parsed.data.contentType)
}

export async function registerProductImageAction(input: unknown): Promise<Result> {
  const auth = await guard()
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = productImageRegisterSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Foto inválida." }
  const result = await registerProductImage(parsed.data.product_id, parsed.data.path, parsed.data.color_id)
  if (!result.ok) return result
  refresh()
  return { ...result, message: PRODUCT_MESSAGES.IMAGE_SAVED }
}

export async function setPrimaryImageAction(id: string): Promise<Result> {
  const auth = await guard()
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Foto inválida." }
  const result = await setPrimaryImage(id)
  if (result.ok) refresh()
  return result
}

export async function updateImageColorAction(input: unknown): Promise<Result> {
  const auth = await guard()
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = productImageUpdateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Foto inválida." }
  const result = await updateImageColor(parsed.data.id, parsed.data.color_id)
  if (result.ok) refresh()
  return result
}

export async function moveImageAction(id: string, direction: "up" | "down"): Promise<Result> {
  const auth = await guard()
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success || (direction !== "up" && direction !== "down")) {
    return { ok: false, error: "Foto inválida." }
  }
  const result = await moveImage(id, direction)
  if (result.ok) refresh()
  return result
}

export async function deleteProductImageAction(id: string): Promise<Result> {
  const auth = await guard()
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Foto inválida." }
  const result = await deleteProductImage(id)
  if (!result.ok) return result
  refresh()
  return { ...result, message: PRODUCT_MESSAGES.IMAGE_DELETED }
}
