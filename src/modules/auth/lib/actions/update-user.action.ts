"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"

import { USER_MESSAGES } from "../constants/users.constants"
import { changeUserRoleSchema, setUserActiveSchema } from "../schemas/users.schema"
import { changeUserRole, getTeamMember, setUserActive } from "../services/users.service"
import { checkUserChange } from "../utils/user-permissions.util"

// Reglas validadas aquí y otra vez en la base (RLS + triggers).
export async function changeUserRoleAction(
  _prev: ActionState<"role">,
  formData: FormData
): Promise<ActionState<"role">> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = changeUserRoleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const target = await getTeamMember(parsed.data.profile_id)
  if (!target) return { status: "error", message: USER_MESSAGES.NOT_FOUND }

  const denied = checkUserChange(auth.user, target, { kind: "role", role: parsed.data.role })
  if (denied) return { status: "error", message: denied }

  const result = await changeUserRole(target.id, parsed.data.role)
  if (!result.ok) return { status: "error", message: result.error }

  refresh()
  return { status: "success", message: USER_MESSAGES.ROLE_CHANGED, submissionId: crypto.randomUUID() }
}

export async function setUserActiveAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = setUserActiveSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", message: "Solicitud inválida." }

  const target = await getTeamMember(parsed.data.profile_id)
  if (!target) return { status: "error", message: USER_MESSAGES.NOT_FOUND }

  const denied = checkUserChange(auth.user, target, { kind: "active", isActive: parsed.data.is_active })
  if (denied) return { status: "error", message: denied }

  const result = await setUserActive(target.id, parsed.data.is_active)
  if (!result.ok) return { status: "error", message: result.error }

  refresh()
  return {
    status: "success",
    message: parsed.data.is_active ? USER_MESSAGES.ACTIVATED : USER_MESSAGES.DEACTIVATED,
    submissionId: crypto.randomUUID(),
  }
}
