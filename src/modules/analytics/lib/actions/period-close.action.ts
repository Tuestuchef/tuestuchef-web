"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { closePeriod, reopenPeriod } from "../services/period-close.service"

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/)
const reopenSchema = z.object({
  month: monthSchema,
  reason: z.string().trim().min(3, { error: "Explica el motivo." }).max(300),
})

// Cerrar un mes terminado: owner y admin (la base lo vuelve a exigir).
export async function closePeriodAction(month: string): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!monthSchema.safeParse(month).success) return { ok: false, error: "Mes inválido." }
  const { error } = await closePeriod(month)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: "Mes cerrado." }
}

// Reabrir: solo el owner, con motivo.
export async function reopenPeriodAction(
  _prev: ActionState<"month" | "reason">,
  formData: FormData
): Promise<ActionState<"month" | "reason">> {
  const auth = await authorizeAction(ROLE_GROUPS.OWNER)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = reopenSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await reopenPeriod(parsed.data.month, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return { status: "success", message: "Mes reabierto.", submissionId: crypto.randomUUID() }
}
