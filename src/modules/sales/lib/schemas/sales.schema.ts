import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import { optionalTextSchema, pastOrTodayDateSchema } from "@/common/lib/schemas/form-fields.schema"
import { toCaracasMonth } from "@/common/lib/utils/format-date.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

const E = Constants.public.Enums

// Montos que vienen del formulario como texto ("1.234,56").
const amountText = (label: string, { allowZero = false } = {}) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const parsed = typeof value === "number" ? value : parseAmount(value)
    if (parsed === null || parsed < 0 || (!allowZero && parsed === 0)) {
      ctx.addIssue({ code: "custom", message: `Revisa ${label}.` })
      return z.NEVER
    }
    return parsed
  })

const saleItemSchema = z.object({
  variant_id: z.uuid(),
  quantity: z.number().positive().max(10_000),
  source: z.enum(E.sale_line_source),
})

const salePaymentSchema = z.object({
  payment_method_id: z.uuid({ error: "Elige el método de pago." }),
  amount: amountText("el monto del pago"),
})

// La venta llega como JSON (el carrito no cabe bien en campos de formulario).
export const createSaleSchema = z
  .object({
    channel: z.enum(E.sale_channel, { error: "Elige el canal." }),
    price_method_id: z.uuid({ error: "Elige el método de pago." }),
    delivery_method: z.enum(E.delivery_method),
    customer_id: z.uuid().nullable().default(null),
    items: z.array(saleItemSchema).min(1, { error: "Agrega al menos un producto." }).max(100),
    payments: z.array(salePaymentSchema).max(10).default([]),
    delivery_fee_usd: amountText("el delivery", { allowZero: true }).default(0),
    discount_type: z.enum(E.discount_type).nullable().default(null),
    discount_value: amountText("el descuento", { allowZero: true }).nullable().default(null),
    discount_reason: z.string().trim().max(200).nullable().default(null),
    notes: z.string().trim().max(500).nullable().default(null),
    delivered: z.boolean().default(false),
    // Vacío = hoy. La base valida el límite de staff y exige tasas de esa fecha.
    date: pastOrTodayDateSchema,
  })
  .refine((v) => !v.discount_value || v.discount_type !== null, {
    error: "Elige si el descuento es en monto o porcentaje.",
    path: ["discount_value"],
  })
  .refine((v) => !v.discount_value || Boolean(v.discount_reason), {
    error: "Indica el motivo del descuento.",
    path: ["discount_reason"],
  })
  .refine((v) => v.discount_type !== "percent" || !v.discount_value || v.discount_value <= 100, {
    error: "El porcentaje no puede pasar de 100.",
    path: ["discount_value"],
  })

export const addPaymentSchema = z.object({
  sale_id: z.uuid(),
  payment_method_id: z.uuid({ error: "Elige el método de pago." }),
  amount: amountText("el monto"),
  receipt_path: optionalTextSchema(300),
  date: pastOrTodayDateSchema,
})

export const voidSaleSchema = z.object({
  sale_id: z.uuid(),
  reason: z.string().trim().min(3, { error: "Explica el motivo." }).max(300),
})

export const itemStatusSchema = z.object({
  sale_item_id: z.uuid(),
  status: z.enum(E.sale_item_status),
})

export const salesSettingsSchema = z.object({
  staff_max_discount_percent: amountText("el porcentaje", { allowZero: true }).pipe(
    z.number().max(100, { error: "Máximo 100%." })
  ),
  staff_max_backdate_days: z.coerce
    .number({ error: "Indica los días." })
    .int({ error: "Solo días enteros." })
    .min(0)
    .max(365, { error: "Máximo 365 días." }),
})

export const salesFiltersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .catch(() => toCaracasMonth())
    .default(() => toCaracasMonth()),
  channel: z.enum(E.sale_channel).optional().catch(undefined),
  status: z.enum(["pending", "partial", "paid", "voided"]).optional().catch(undefined),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type AddPaymentInput = z.infer<typeof addPaymentSchema>
export type AddPaymentField = keyof AddPaymentInput
export type VoidSaleField = keyof z.infer<typeof voidSaleSchema>
