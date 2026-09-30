"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { type CatalogField, catalogItemSchema } from "../schemas/products.schema"
import { saveCatalogItem } from "../services/catalog.service"

// Categorías de producto, tallas y colores (owner y admin).
export async function saveCatalogItemAction(
  _prev: ActionState<CatalogField>,
  formData: FormData
): Promise<ActionState<CatalogField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = catalogItemSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { data, error } = await saveCatalogItem(parsed.data)
  if (error || !data?.length) {
    return {
      status: "error",
      message: error?.code === "23505" ? "Ya existe uno con ese nombre o código." : toUserError(error),
    }
  }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.CATALOG_SAVED, submissionId: crypto.randomUUID() }
}
