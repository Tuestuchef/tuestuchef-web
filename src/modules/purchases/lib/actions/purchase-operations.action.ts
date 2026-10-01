"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PURCHASE_MESSAGES } from "../constants/purchases.constants"
import {
  type AddPurchasePaymentField,
  addPurchasePaymentSchema,
  createPurchaseSchema,
  type VoidPurchaseField,
  voidPurchaseSchema,
} from "../schemas/purchases.schema"
import { addPurchasePayment, createPurchase, voidPurchase } from "../services/purchases.service"

// La compra llega como objeto; Zod la valida entera y la base vuelve a validar todo
// (incluido que staff solo registre compras pagadas en el momento).
export async function createPurchaseAction(
  input: unknown
): Promise<{ ok: true; purchaseId: string } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = createPurchaseSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa la compra." }

  const { data, error } = await createPurchase(parsed.data)
  if (error || !data) return { ok: false, error: toUserError(error, "No se pudo registrar la compra.") }

  refresh()
  return { ok: true, purchaseId: data }
}

// Abonos a proveedores: owner y admin.
export async function addPurchasePaymentAction(
  _prev: ActionState<AddPurchasePaymentField>,
  formData: FormData
): Promise<ActionState<AddPurchasePaymentField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = addPurchasePaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await addPurchasePayment(parsed.data)
  if (error) return { status: "error", message: toUserError(error, "No se pudo registrar el pago.") }

  refresh()
  return { status: "success", message: PURCHASE_MESSAGES.PAYMENT_SAVED, submissionId: crypto.randomUUID() }
}

export async function voidPurchaseAction(
  _prev: ActionState<VoidPurchaseField>,
  formData: FormData
): Promise<ActionState<VoidPurchaseField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = voidPurchaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await voidPurchase(parsed.data.purchase_id, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error, "No se pudo anular la compra.") }

  refresh()
  return { status: "success", message: PURCHASE_MESSAGES.VOIDED, submissionId: crypto.randomUUID() }
}
