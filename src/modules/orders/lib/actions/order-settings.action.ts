"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { ORDER_MESSAGES } from "../constants/orders.constants"
import {
  type CustomizationTypeField,
  customizationTypeSchema,
  type VolumeTierField,
  volumeTierSchema,
} from "../schemas/orders.schema"
import { addVolumeTier, deleteVolumeTier, updateCustomizationType } from "../services/order-settings.service"

// Configuración de pedidos: owner y admin (RLS lo vuelve a exigir).
export async function saveCustomizationTypeAction(
  _prev: ActionState<CustomizationTypeField>,
  formData: FormData
): Promise<ActionState<CustomizationTypeField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = customizationTypeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await updateCustomizationType(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: ORDER_MESSAGES.CUSTOMIZATION_SAVED, submissionId: crypto.randomUUID() }
}

export async function addVolumeTierAction(
  _prev: ActionState<VolumeTierField>,
  formData: FormData
): Promise<ActionState<VolumeTierField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = volumeTierSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await addVolumeTier(parsed.data)
  if (error) {
    return { status: "error", message: error.code === "23505" ? ORDER_MESSAGES.TIER_DUPLICATE : toUserError(error) }
  }

  refresh()
  return { status: "success", message: ORDER_MESSAGES.TIER_SAVED, submissionId: crypto.randomUUID() }
}

export async function deleteVolumeTierAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Tramo inválido." }

  const { data, error } = await deleteVolumeTier(id)
  if (error || !data?.length) return { ok: false, error: toUserError(error, "No se pudo quitar.") }

  refresh()
  return { ok: true }
}
