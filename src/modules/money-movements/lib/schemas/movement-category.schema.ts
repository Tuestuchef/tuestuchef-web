import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import { booleanFieldSchema } from "@/common/lib/schemas/form-fields.schema"

const nameSchema = z.string().trim().min(1, { error: "Escribe un nombre." }).max(60)

export const createCategorySchema = z.object({
  name: nameSchema,
  type: z.enum(Constants.public.Enums.category_type, { error: "Elige el tipo." }),
})

// El tipo no cambia después de creada (cambiaría el significado de su historial).
export const updateCategorySchema = z.object({
  id: z.uuid(),
  name: nameSchema,
  is_active: booleanFieldSchema,
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CategoryField = keyof CreateCategoryInput | keyof UpdateCategoryInput
