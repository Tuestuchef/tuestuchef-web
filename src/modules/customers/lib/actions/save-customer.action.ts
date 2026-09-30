"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { CUSTOMER_MESSAGES } from "../constants/customers.constants"
import { type CustomerField, customerSchema } from "../schemas/customers.schema"
import { saveCustomer } from "../services/customers.service"
import type { DuplicateCustomer } from "../types/customers.types"

export type SaveCustomerState = ActionState<CustomerField> & {
  // Cliente existente con el mismo contacto: la interfaz ofrece abrirlo.
  duplicate?: DuplicateCustomer
  // Id del cliente guardado (para seleccionarlo, p. ej. desde una venta).
  customerId?: string
  customerName?: string
}

export async function saveCustomerAction(_prev: SaveCustomerState, formData: FormData): Promise<SaveCustomerState> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = customerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const result = await saveCustomer(parsed.data, { canManage: isRoleIn(auth.user.role, ROLE_GROUPS.MANAGEMENT) })
  if (!result.ok) {
    if ("duplicate" in result) {
      return {
        status: "error",
        message: CUSTOMER_MESSAGES.DUPLICATE(result.duplicate.field, result.duplicate.name),
        duplicate: result.duplicate,
      }
    }
    return { status: "error", message: toUserError(result.error) }
  }

  refresh()
  return {
    status: "success",
    message: CUSTOMER_MESSAGES.SAVED,
    customerId: result.id,
    customerName: [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" "),
    submissionId: crypto.randomUUID(),
  }
}
