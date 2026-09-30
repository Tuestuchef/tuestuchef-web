"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { TREASURY_MESSAGES } from "../constants/treasury.constants"
import { type PaymentMethodField, paymentMethodSchema } from "../schemas/payment-method.schema"
import { savePaymentMethod } from "../services/payment-methods.service"

export async function savePaymentMethodAction(
  _prev: ActionState<PaymentMethodField>,
  formData: FormData
): Promise<ActionState<PaymentMethodField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const raw = Object.fromEntries(formData)
  const parsed = paymentMethodSchema.safeParse({ ...raw, id: raw.id || undefined })
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const { data, error } = await savePaymentMethod(parsed.data)
  if (error || !data?.length) return { status: "error", message: toUserError(error) }

  refresh()
  return {
    status: "success",
    message: TREASURY_MESSAGES.PAYMENT_METHOD_SAVED,
    submissionId: crypto.randomUUID(),
  }
}
