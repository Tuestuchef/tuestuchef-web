"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { MOVEMENT_MESSAGES } from "../constants/money-movements.constants"
import {
  type CategoryField,
  createCategorySchema,
  updateCategorySchema,
} from "../schemas/movement-category.schema"
import { createCategory, updateCategory } from "../services/movement-categories.service"

export async function saveMovementCategoryAction(
  _prev: ActionState<CategoryField>,
  formData: FormData
): Promise<ActionState<CategoryField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const raw = Object.fromEntries(formData)

  if (raw.id) {
    const parsed = updateCategorySchema.safeParse(raw)
    if (!parsed.success) {
      return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
    }
    const { data, error } = await updateCategory(parsed.data)
    if (error || !data?.length) return { status: "error", message: toUserError(error) }
  } else {
    const parsed = createCategorySchema.safeParse(raw)
    if (!parsed.success) {
      return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
    }
    const { error } = await createCategory(parsed.data)
    if (error) return { status: "error", message: toUserError(error) }
  }

  refresh()
  return { status: "success", message: MOVEMENT_MESSAGES.CATEGORY_SAVED, submissionId: crypto.randomUUID() }
}
