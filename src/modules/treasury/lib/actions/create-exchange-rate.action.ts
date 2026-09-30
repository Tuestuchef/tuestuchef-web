"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { TREASURY_MESSAGES } from "../constants/treasury.constants"
import { exchangeRateSchema, type ExchangeRateField } from "../schemas/exchange-rate.schema"
import { createExchangeRate } from "../services/exchange-rates.service"

// Todos los roles; staff solo si aún no hay tasa de hoy (lo decide RLS).
export async function createExchangeRateAction(
  _prev: ActionState<ExchangeRateField>,
  formData: FormData
): Promise<ActionState<ExchangeRateField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = exchangeRateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const { error } = await createExchangeRate(parsed.data)
  if (error) {
    return {
      status: "error",
      message:
        auth.user.role === "staff" && /row-level security/i.test(error.message)
          ? "La tasa de hoy ya fue registrada. Solo owner o admin pueden corregirla."
          : toUserError(error),
    }
  }

  refresh()
  return { status: "success", message: TREASURY_MESSAGES.RATE_SAVED, submissionId: crypto.randomUUID() }
}
