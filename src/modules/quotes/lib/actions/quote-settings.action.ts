"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { QUOTE_MESSAGES } from "../constants/quotes.constants"
import { quoteSettingsSchema } from "../schemas/quote-settings.schema"
import { updateQuoteSettings } from "../services/quote-settings.service"
import type { QuoteSettingsField } from "../types/quotes.types"

// Numeración, vigencia, listas de precios, IVA y condiciones: owner y admin.
export async function saveQuoteSettingsAction(
  _prev: ActionState<QuoteSettingsField>,
  formData: FormData
): Promise<ActionState<QuoteSettingsField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = quoteSettingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  // La base revisa que el número solo suba y que cada lista sea de su moneda.
  const { data, error } = await updateQuoteSettings(parsed.data)
  if (error || !data?.length) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: QUOTE_MESSAGES.SETTINGS_SAVED, submissionId: crypto.randomUUID() }
}
