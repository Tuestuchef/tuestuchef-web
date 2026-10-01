"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { updateProfitPolicy } from "../services/dashboard.service"

const percent = (label: string) =>
  z.coerce.number({ error: `Revisa ${label}.` }).min(0, { error: "Mínimo 0%." }).max(100, { error: "Máximo 100%." })

const profitPolicySchema = z
  .object({
    reserve_account_id: z
      .string()
      .optional()
      .transform((v) => (v && v !== "none" ? v : null))
      .pipe(z.uuid().nullable()),
    reserve_percent: percent("la reserva"),
    reinvestment_percent: percent("la reinversión"),
  })
  .refine((v) => v.reserve_percent + v.reinvestment_percent <= 100, {
    error: "Reserva y reinversión juntas no pueden pasar de 100%.",
    path: ["reinvestment_percent"],
  })

type ProfitPolicyField = keyof z.infer<typeof profitPolicySchema>

// Política de utilidad: owner y admin (RLS lo vuelve a exigir).
export async function saveProfitPolicyAction(
  _prev: ActionState<ProfitPolicyField>,
  formData: FormData
): Promise<ActionState<ProfitPolicyField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = profitPolicySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { data, error } = await updateProfitPolicy({
    reserveAccountId: parsed.data.reserve_account_id,
    reservePercent: parsed.data.reserve_percent,
    reinvestmentPercent: parsed.data.reinvestment_percent,
  })
  if (error || !data?.length) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: "Política guardada.", submissionId: crypto.randomUUID() }
}
