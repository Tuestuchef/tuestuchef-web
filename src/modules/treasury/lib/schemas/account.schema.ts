import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import {
  booleanFieldSchema,
  optionalTextSchema,
} from "@/common/lib/schemas/form-fields.schema"

import { ACCOUNT_KIND_CURRENCIES } from "../constants/treasury.constants"

const nameSchema = z.string().trim().min(1, { error: "Escribe un nombre." }).max(60)
const kindSchema = z.enum(Constants.public.Enums.account_kind, { error: "Elige el tipo de cuenta." })

export const createAccountSchema = z
  .object({
    name: nameSchema,
    kind: kindSchema,
    currency: z.enum(Constants.public.Enums.currency, { error: "Elige la moneda." }),
    notes: optionalTextSchema(200),
  })
  .refine((value) => ACCOUNT_KIND_CURRENCIES[value.kind].includes(value.currency), {
    error: "Esa moneda no corresponde a ese tipo de cuenta.",
    path: ["currency"],
  })

// La moneda no se cambia después de creada.
export const updateAccountSchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  kind: kindSchema,
  notes: optionalTextSchema(200),
  is_active: booleanFieldSchema,
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
export type AccountField = keyof CreateAccountInput | keyof UpdateAccountInput
