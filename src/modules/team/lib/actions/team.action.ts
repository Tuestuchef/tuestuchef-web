"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { TEAM_MESSAGES } from "../constants/team.constants"
import {
  type PayrollField,
  payrollSchema,
  type SalaryAgreementField,
  salaryAgreementSchema,
  type TeamMemberField,
  teamMemberSchema,
} from "../schemas/team.schema"
import { addSalaryAgreement, registerPayroll, saveTeamMember } from "../services/team.service"

// Equipo: solo owner y admin (RLS y las funciones lo vuelven a exigir).
const guard = () => authorizeAction(ROLE_GROUPS.MANAGEMENT)
const ok = (message: string) => ({ status: "success" as const, message, submissionId: crypto.randomUUID() })

export async function saveTeamMemberAction(
  _prev: ActionState<TeamMemberField>,
  formData: FormData
): Promise<ActionState<TeamMemberField>> {
  const auth = await guard()
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = teamMemberSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await saveTeamMember(parsed.data)
  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Ese usuario ya está vinculado a otra persona del equipo." : toUserError(error),
    }
  }

  refresh()
  return ok(TEAM_MESSAGES.MEMBER_SAVED)
}

export async function addSalaryAgreementAction(
  _prev: ActionState<SalaryAgreementField>,
  formData: FormData
): Promise<ActionState<SalaryAgreementField>> {
  const auth = await guard()
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = salaryAgreementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await addSalaryAgreement(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return ok(TEAM_MESSAGES.AGREEMENT_SAVED)
}

export async function registerPayrollAction(
  _prev: ActionState<PayrollField>,
  formData: FormData
): Promise<ActionState<PayrollField>> {
  const auth = await guard()
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = payrollSchema.safeParse({
    ...Object.fromEntries(formData),
    settle_advance_ids: formData.getAll("settle_advance_ids"),
  })
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await registerPayroll(parsed.data)
  if (error) return { status: "error", message: toUserError(error, "No se pudo registrar.") }

  refresh()
  return ok(parsed.data.kind === "advance" ? TEAM_MESSAGES.ADVANCE_SAVED : TEAM_MESSAGES.PAYMENT_SAVED)
}
