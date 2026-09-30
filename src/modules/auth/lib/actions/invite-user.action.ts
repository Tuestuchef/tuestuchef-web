"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"

import { USER_MESSAGES } from "../constants/users.constants"
import { type InviteUserField, inviteUserSchema } from "../schemas/users.schema"
import { inviteUser } from "../services/users.service"
import { checkInvite } from "../utils/user-permissions.util"

export async function inviteUserAction(
  _prev: ActionState<InviteUserField>,
  formData: FormData
): Promise<ActionState<InviteUserField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = inviteUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  // Antes de crear el usuario: un admin no puede invitar owners ni admins.
  const denied = checkInvite(auth.user.role, parsed.data.role)
  if (denied) return { status: "error", fieldErrors: { role: [denied] } }

  const result = await inviteUser(parsed.data, auth.user.id)
  if (!result.ok) return { status: "error", message: result.error }

  refresh()
  return { status: "success", message: USER_MESSAGES.INVITED, submissionId: crypto.randomUUID() }
}
