import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import { booleanFieldSchema } from "@/common/lib/schemas/form-fields.schema"

const optionalId = z
  .string()
  .optional()
  .transform((value) => value || null)
  .pipe(z.uuid().nullable())

const integer = (label: string, min: number, max: number) =>
  z.coerce
    .number({ error: `${label}: escribe un número.` })
    .int({ error: `${label}: sin decimales.` })
    .min(min, { error: `${label}: mínimo ${min}.` })
    .max(max, { error: `${label}: máximo ${max}.` })

export const quoteSettingsSchema = z.object({
  number_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{1,10}$/, { error: "Prefijo: hasta 10 letras, números o guion, sin espacios." }),
  number_padding: integer("Dígitos", 1, 10),
  next_number: integer("Siguiente número", 1, 999_999_999),
  validity_days: integer("Vigencia", 1, 365),
  default_currencies: z.enum(Constants.public.Enums.quote_currencies),
  default_usd_price_method_id: optionalId,
  default_ves_price_method_id: optionalId,
  vat_percent: z.coerce
    .number({ error: "IVA: escribe un número." })
    .min(0, { error: "IVA: mínimo 0%." })
    .max(100, { error: "IVA: máximo 100%." })
    .refine((v) => Number.isInteger(v * 100), { error: "IVA: hasta 2 decimales." }),
  vat_default_enabled: booleanFieldSchema,
  igtf_note_default: booleanFieldSchema,
  igtf_note: z.string().trim().min(1, { error: "Escribe la nota de IGTF." }).max(500),
  default_terms: z.string().trim().min(1, { error: "Escribe las condiciones." }).max(3000),
})

export type QuoteSettingsInput = z.infer<typeof quoteSettingsSchema>
