"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { verifyReceipt } from "@/common/lib/services/receipts.service"
import { authorizeAction } from "@/common/lib/services/session.service"
import { getStorage } from "@/common/lib/services/storage.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { MOVEMENT_MESSAGES } from "../constants/money-movements.constants"
import { type LedgerEntryField, ledgerEntrySchema } from "../schemas/ledger-entry.schema"
import { createEntry } from "../services/ledger.service"

// Todos los roles. Qué categorías puede usar cada uno lo decide RLS.
export async function createLedgerEntryAction(
  _prev: ActionState<LedgerEntryField>,
  formData: FormData
): Promise<ActionState<LedgerEntryField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = ledgerEntrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  if (parsed.data.receipt_path) {
    const receipt = await verifyReceipt(getStorage(), parsed.data.receipt_path)
    if (!receipt.ok) return { status: "error", fieldErrors: { receipt_path: [receipt.error] } }
  }

  const { error } = await createEntry(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return {
    status: "success",
    message: parsed.data.direction === "expense" ? MOVEMENT_MESSAGES.EXPENSE_SAVED : MOVEMENT_MESSAGES.INCOME_SAVED,
    submissionId: crypto.randomUUID(),
  }
}
