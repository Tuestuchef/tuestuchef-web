import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import { booleanFieldSchema } from "@/common/lib/schemas/form-fields.schema"

export const paymentMethodSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, { error: "Escribe un nombre." }).max(60),
  account_id: z.uuid({ error: "Elige la cuenta donde cae el dinero." }),
  // Los precios de productos siempre están en USD de referencia.
  price_currency: z.enum(Constants.public.Enums.currency).default("USD"),
  // Tasa que convierte el precio en USD a Bs (solo métodos que cobran en Bs).
  rate_kind: z.enum(Constants.public.Enums.payment_rate_kind).default("none"),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: booleanFieldSchema.default(true),
})

export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>
export type PaymentMethodField = keyof PaymentMethodInput
