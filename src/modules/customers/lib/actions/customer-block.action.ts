"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { setCustomerBlocked } from "../services/customers.service"

const blockSchema = z.object({
  customer_id: z.uuid(),
  action: z.enum(["block", "unblock"]),
  reason: z.string().trim().min(3, { error: "Explica el motivo." }).max(300),
})

type BlockField = keyof z.infer<typeof blockSchema>

// Bloquear o desbloquear: owner y admin, con motivo (la base lo vuelve a exigir y lo registra).
export async function customerBlockAction(_prev: ActionState<BlockField>, formData: FormData): Promise<ActionState<BlockField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = blockSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await setCustomerBlocked(parsed.data.customer_id, parsed.data.action === "block", parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return {
    status: "success",
    message: parsed.data.action === "block" ? "Cliente bloqueado." : "Cliente desbloqueado.",
    submissionId: crypto.randomUUID(),
  }
}
