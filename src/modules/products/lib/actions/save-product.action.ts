"use server"

import { refresh } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { type ProductField, productSchema } from "../schemas/products.schema"
import { saveProduct } from "../services/products.service"

// Crear lleva al detalle (para agregar variantes, precios y fotos); editar se queda.
export async function saveProductAction(
  _prev: ActionState<ProductField>,
  formData: FormData
): Promise<ActionState<ProductField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = productSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { data, error } = await saveProduct(parsed.data)
  if (error || !data) return { status: "error", message: toUserError(error) }

  if (!parsed.data.id) redirect(ROUTES.PRODUCT(data.id))
  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.PRODUCT_SAVED, submissionId: crypto.randomUUID() }
}
