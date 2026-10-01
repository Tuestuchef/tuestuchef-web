"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { type RecipeLineField, recipeLineSchema } from "../schemas/products.schema"
import { addRecipeLine, deleteRecipeLine } from "../services/recipes.service"

// Recetas: owner y admin (RLS lo vuelve a exigir).
export async function addRecipeLineAction(
  _prev: ActionState<RecipeLineField>,
  formData: FormData
): Promise<ActionState<RecipeLineField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = recipeLineSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await addRecipeLine(parsed.data)
  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Ese material ya está en la receta para esa talla." : toUserError(error),
    }
  }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.RECIPE_SAVED, submissionId: crypto.randomUUID() }
}

export async function deleteRecipeLineAction(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Línea inválida." }

  const { data, error } = await deleteRecipeLine(id)
  if (error || !data?.length) return { ok: false, error: toUserError(error, "No se pudo quitar.") }

  refresh()
  return { ok: true }
}
