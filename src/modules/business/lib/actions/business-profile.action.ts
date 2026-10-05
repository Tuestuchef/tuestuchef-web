"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { BUSINESS_MESSAGES } from "../constants/business.constants"
import { businessProfileSchema, headerImagePathSchema, headerImageUploadSchema } from "../schemas/business-profile.schema"
import {
  createHeaderImageUpload,
  registerHeaderImage,
  removeHeaderImage,
  updateBusinessProfile,
} from "../services/business-profile.service"
import type { BusinessProfileField } from "../types/business.types"

type Result<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string }

// Datos de la empresa: owner y admin.
export async function saveBusinessProfileAction(
  _prev: ActionState<BusinessProfileField>,
  formData: FormData
): Promise<ActionState<BusinessProfileField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = businessProfileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { data, error } = await updateBusinessProfile(parsed.data)
  if (error || !data?.length) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: BUSINESS_MESSAGES.SAVED, submissionId: crypto.randomUUID() }
}

// Firma la subida de la imagen del encabezado al bucket público (rol, tipo y tamaño verificados).
export async function requestHeaderImageUploadAction(
  input: unknown
): Promise<Result<{ path: string; uploadUrl: string; contentType: string }>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = headerImageUploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  return createHeaderImageUpload(parsed.data.contentType)
}

export async function registerHeaderImageAction(path: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = headerImagePathSchema.safeParse(path)
  if (!parsed.success) return { ok: false, error: "Imagen inválida." }
  const result = await registerHeaderImage(parsed.data)
  if (!result.ok) return result
  refresh()
  return { ...result, message: BUSINESS_MESSAGES.HEADER_SAVED }
}

export async function removeHeaderImageAction(): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const result = await removeHeaderImage()
  if (!result.ok) return result
  refresh()
  return { ...result, message: BUSINESS_MESSAGES.HEADER_REMOVED }
}
