"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { BUSINESS_MESSAGES } from "../constants/business.constants"
import { businessProfileSchema } from "../schemas/business-profile.schema"
import { updateBusinessProfile } from "../services/business-profile.service"
import type { BusinessProfileField } from "../types/business.types"

// Datos de contacto del negocio: owner y admin.
export async function saveBusinessProfileAction(
  _prev: ActionState<BusinessProfileField>,
  formData: FormData
): Promise<ActionState<BusinessProfileField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = businessProfileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { data, error } = await updateBusinessProfile(parsed.data)
  if (error || !data?.length) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: BUSINESS_MESSAGES.SAVED, submissionId: crypto.randomUUID() }
}
