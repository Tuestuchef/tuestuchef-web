"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PURCHASE_MESSAGES } from "../constants/purchases.constants"
import { type SupplierField, supplierSchema } from "../schemas/purchases.schema"
import { saveSupplier } from "../services/suppliers.service"

export type SaveSupplierState = ActionState<SupplierField> & {
  // Para seleccionarlo al crearlo desde una compra.
  supplier?: { id: string; name: string }
}

// Todo el equipo crea proveedores; editar es de owner y admin (RLS lo vuelve a exigir).
export async function saveSupplierAction(_prev: SaveSupplierState, formData: FormData): Promise<SaveSupplierState> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = supplierSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const canManage = isRoleIn(auth.user.role, ROLE_GROUPS.MANAGEMENT)
  if (parsed.data.id && !canManage) return { status: "error", message: "Solo owner y admin editan proveedores." }

  const { data, error } = await saveSupplier(parsed.data, { canManage })
  if (error || !data) {
    return {
      status: "error",
      message: error?.code === "23505" ? "Ya existe un proveedor con ese nombre o RIF." : toUserError(error),
    }
  }

  refresh()
  return { status: "success", message: PURCHASE_MESSAGES.SUPPLIER_SAVED, supplier: data, submissionId: crypto.randomUUID() }
}
