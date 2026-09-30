import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import { booleanFieldSchema } from "@/common/lib/schemas/form-fields.schema"

const roleSchema = z.enum(Constants.public.Enums.app_role, { error: "Elige un rol." })

export const inviteUserSchema = z.object({
  email: z.email({ error: "Escribe un correo válido." }).trim().toLowerCase(),
  full_name: z.string().trim().min(2, { error: "Escribe el nombre." }).max(80),
  role: roleSchema,
})

export const changeUserRoleSchema = z.object({
  profile_id: z.uuid(),
  role: roleSchema,
})

export const setUserActiveSchema = z.object({
  profile_id: z.uuid(),
  is_active: booleanFieldSchema,
})

export type InviteUserInput = z.infer<typeof inviteUserSchema>
export type InviteUserField = keyof InviteUserInput
