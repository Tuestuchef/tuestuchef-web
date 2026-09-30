"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { ROUTES } from "@/common/lib/constants/routes.constants"
import { getSessionState } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"

import { AUTH_MESSAGES } from "../constants/auth.constants"
import { type MfaField, verifyMfaSchema } from "../schemas/login.schema"
import { startTotpEnrollment, verifyTotp } from "../services/auth.service"
import type { TotpEnrollment } from "../types/auth.types"

// Solo para owner/admin que aún no configuraron la app autenticadora.
export async function startMfaEnrollmentAction(): Promise<
  { ok: true; enrollment: TotpEnrollment } | { ok: false; error: string }
> {
  const session = await getSessionState()
  if (session.status !== "mfa_setup") return { ok: false, error: AUTH_MESSAGES.MFA_ENROLL_FAILED }

  const enrollment = await startTotpEnrollment()
  if (!enrollment) return { ok: false, error: AUTH_MESSAGES.MFA_ENROLL_FAILED }
  return { ok: true, enrollment }
}

// Confirma el código de la app (al configurarla o al entrar). La sesión queda en aal2.
export async function verifyMfaAction(
  _prev: ActionState<MfaField>,
  formData: FormData
): Promise<ActionState<MfaField>> {
  const session = await getSessionState()
  if (session.status === "active") redirect(ROUTES.HOME)
  if (session.status !== "mfa_setup" && session.status !== "mfa_verify") redirect(ROUTES.LOGIN)

  const parsed = verifyMfaSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const result = await verifyTotp(parsed.data.factor_id, parsed.data.code)
  if (!result.ok) return { status: "error", message: AUTH_MESSAGES.MFA_CODE_INVALID }

  redirect(ROUTES.HOME)
}
