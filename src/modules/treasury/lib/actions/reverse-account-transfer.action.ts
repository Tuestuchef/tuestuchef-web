"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { TREASURY_MESSAGES } from "../constants/treasury.constants"
import { reverseTransferSchema } from "../schemas/account-transfer.schema"
import { reverseTransfer } from "../services/transfers.service"

export async function reverseAccountTransferAction(
  _prev: ActionState<"reason">,
  formData: FormData
): Promise<ActionState<"reason">> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = reverseTransferSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const { error } = await reverseTransfer(parsed.data.transfer_id, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: TREASURY_MESSAGES.TRANSFER_VOIDED, submissionId: crypto.randomUUID() }
}
