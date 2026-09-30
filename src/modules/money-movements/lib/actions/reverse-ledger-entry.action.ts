"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { MOVEMENT_MESSAGES } from "../constants/money-movements.constants"
import { reverseEntrySchema } from "../schemas/ledger-entry.schema"
import { reverseEntry } from "../services/ledger.service"

// Solo owner y admin, con motivo obligatorio (también lo exige la base).
export async function reverseLedgerEntryAction(
  _prev: ActionState<"reason">,
  formData: FormData
): Promise<ActionState<"reason">> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = reverseEntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const { error } = await reverseEntry(parsed.data.entry_id, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: MOVEMENT_MESSAGES.REVERSED, submissionId: crypto.randomUUID() }
}
