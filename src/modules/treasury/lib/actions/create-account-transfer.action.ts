"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { verifyReceipt } from "@/common/lib/services/receipts.service"
import { authorizeAction } from "@/common/lib/services/session.service"
import { getStorage } from "@/common/lib/services/storage.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { accountTransferSchema, type AccountTransferField } from "../schemas/account-transfer.schema"
import { createTransfer } from "../services/transfers.service"

export async function createAccountTransferAction(
  _prev: ActionState<AccountTransferField>,
  formData: FormData
): Promise<ActionState<AccountTransferField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = accountTransferSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  if (parsed.data.receipt_path) {
    const receipt = await verifyReceipt(getStorage(), parsed.data.receipt_path)
    if (!receipt.ok) return { status: "error", fieldErrors: { receipt_path: [receipt.error] } }
  }

  const { error } = await createTransfer(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  redirect(`${ROUTES.TREASURY}?traspaso=ok`)
}
