"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { type ComboComponentField, comboComponentSchema } from "../schemas/products.schema"
import { deleteComboComponent, saveComboComponent } from "../services/combos.service"

// Componentes de un combo: owner y admin (RLS y la función lo vuelven a exigir).
export async function saveComboComponentAction(
  _prev: ActionState<ComboComponentField>,
  formData: FormData
): Promise<ActionState<ComboComponentField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  // Los productos llegan como varias casillas con el mismo nombre.
  const parsed = comboComponentSchema.safeParse({ ...Object.fromEntries(formData), product_ids: formData.getAll("product_ids") })
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await saveComboComponent(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.COMBO_SAVED, submissionId: crypto.randomUUID() }
}

export async function deleteComboComponentAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Componente inválido." }

  const { data, error } = await deleteComboComponent(id)
  if (error || !data?.length) return { ok: false, error: toUserError(error, "No se pudo quitar.") }

  refresh()
  return { ok: true }
}
