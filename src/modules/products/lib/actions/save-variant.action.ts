"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { bulkVariantsSchema, type VariantField, variantSchema } from "../schemas/products.schema"
import { createVariantCombinations, saveVariant } from "../services/variants.service"

const variantError = (result: { error: string; code?: string }) =>
  result.code === "23505"
    ? "Ese SKU o esa combinación de color y talla ya existe."
    : toUserError({ code: result.code, message: result.error })

export async function saveVariantAction(
  _prev: ActionState<VariantField>,
  formData: FormData
): Promise<ActionState<VariantField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = variantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const result = await saveVariant(parsed.data)
  if (!result.ok) return { status: "error", message: variantError(result) }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.VARIANT_SAVED, submissionId: crypto.randomUUID() }
}

// Colores × tallas de una vez, con SKU automático.
export async function createVariantCombinationsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = bulkVariantsSchema.safeParse({
    product_id: formData.get("product_id"),
    color_ids: formData.getAll("color_ids"),
    size_ids: formData.getAll("size_ids"),
  })
  if (!parsed.success) return { status: "error", message: "Selección inválida." }

  const result = await createVariantCombinations(parsed.data.product_id, parsed.data.color_ids, parsed.data.size_ids)
  if (!result.ok) return { status: "error", message: variantError(result) }

  refresh()
  return {
    status: "success",
    message: result.data ? `${result.data} variantes creadas.` : "Esas combinaciones ya existían.",
    submissionId: crypto.randomUUID(),
  }
}
