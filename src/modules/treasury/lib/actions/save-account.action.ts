"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { TREASURY_MESSAGES } from "../constants/treasury.constants"
import {
  type AccountField,
  createAccountSchema,
  updateAccountSchema,
} from "../schemas/account.schema"
import { createAccount, updateAccount } from "../services/accounts.service"

// Crea (sin id) o edita (con id) una cuenta. Solo owner y admin.
export async function saveAccountAction(
  _prev: ActionState<AccountField>,
  formData: FormData
): Promise<ActionState<AccountField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const raw = Object.fromEntries(formData)

  if (raw.id) {
    const parsed = updateAccountSchema.safeParse(raw)
    if (!parsed.success) {
      return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
    }
    const { data, error } = await updateAccount(parsed.data)
    if (error || !data?.length) return { status: "error", message: toUserError(error) }
  } else {
    const parsed = createAccountSchema.safeParse(raw)
    if (!parsed.success) {
      return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
    }
    const { error } = await createAccount(parsed.data)
    if (error) return { status: "error", message: toUserError(error) }
  }

  refresh()
  return { status: "success", message: TREASURY_MESSAGES.ACCOUNT_SAVED, submissionId: crypto.randomUUID() }
}
