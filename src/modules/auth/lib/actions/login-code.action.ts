"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import type { ActionState } from "@/common/lib/types/action-state.types"

import { AUTH_MESSAGES } from "../constants/auth.constants"
import {
  type LoginCodeField,
  requestLoginCodeSchema,
  verifyLoginCodeSchema,
} from "../schemas/login.schema"
import { getLoginCodeDeps, verifyLoginCode } from "../services/auth.service"
import { requestLoginCode } from "../services/login-code.service"

// Paso 1: pedir el código. Un desactivado o inexistente no recibe nada (misma respuesta).
export async function requestLoginCodeAction(
  _prev: ActionState<LoginCodeField>,
  formData: FormData
): Promise<ActionState<LoginCodeField>> {
  const parsed = requestLoginCodeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const deps = getLoginCodeDeps()
  if (!deps) return { status: "error", message: AUTH_MESSAGES.NOT_CONFIGURED }

  try {
    const result = await requestLoginCode(parsed.data.email, deps)
    if (!result.ok) {
      return {
        status: "error",
        message: result.reason === "rate_limited" ? AUTH_MESSAGES.RATE_LIMITED : AUTH_MESSAGES.UNEXPECTED,
      }
    }
  } catch {
    return { status: "error", message: AUTH_MESSAGES.UNEXPECTED }
  }

  return { status: "success", message: AUTH_MESSAGES.CODE_SENT, submissionId: crypto.randomUUID() }
}

// Paso 2: verificar el código. Owner y admin siguen luego con la verificación en dos pasos.
export async function verifyLoginCodeAction(
  _prev: ActionState<LoginCodeField>,
  formData: FormData
): Promise<ActionState<LoginCodeField>> {
  const parsed = verifyLoginCodeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const result = await verifyLoginCode(parsed.data.email, parsed.data.token)
  if (!result.ok) {
    const messages = {
      invalid: AUTH_MESSAGES.CODE_INVALID,
      inactive: AUTH_MESSAGES.INACTIVE,
      unexpected: AUTH_MESSAGES.UNEXPECTED,
    }
    return { status: "error", message: messages[result.reason] }
  }

  redirect(parsed.data.redirectTo)
}
