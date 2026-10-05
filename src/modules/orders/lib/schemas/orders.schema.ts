import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import {
  booleanFieldSchema,
  optionalPositiveAmountSchema,
  optionalTextSchema,
  positiveAmountSchema,
} from "@/common/lib/schemas/form-fields.schema"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

const E = Constants.public.Enums

// El código, y si pide texto o logo, son del sistema: aquí solo se editan nombre, precio y medidas.
export const customizationTypeSchema = z
  .object({
    id: z.uuid(),
    name: z.string().trim().min(2, { error: "Escribe el nombre." }).max(80),
    description: optionalTextSchema(300),
    unit_price_usd: optionalPositiveAmountSchema("el precio"),
    min_quantity: z.coerce
      .number({ error: "Indica el mínimo." })
      .int({ error: "Solo unidades enteras." })
      .min(1, { error: "Mínimo 1." })
      .max(1000),
    max_size_cm: optionalPositiveAmountSchema("la medida máxima", 1),
    default_size_cm: optionalPositiveAmountSchema("la medida de referencia", 1),
    is_active: booleanFieldSchema.default(true),
  })
  .refine((v) => !v.max_size_cm || !v.default_size_cm || v.default_size_cm <= v.max_size_cm, {
    error: "La medida de referencia no puede pasar la máxima.",
    path: ["default_size_cm"],
  })

export const volumeTierSchema = z.object({
  scope: z.enum(E.volume_discount_scope),
  min_quantity: z.coerce
    .number({ error: "Indica desde cuántas piezas." })
    .int({ error: "Solo piezas enteras." })
    .min(2, { error: "Desde 2 piezas." })
    .max(100_000),
  percent: positiveAmountSchema("el porcentaje").pipe(z.number().max(100, { error: "Máximo 100%." })),
})

export type CustomizationTypeInput = z.infer<typeof customizationTypeSchema>
export type CustomizationTypeField = keyof CustomizationTypeInput
export type VolumeTierInput = z.infer<typeof volumeTierSchema>
export type VolumeTierField = keyof VolumeTierInput

// ---- Pedidos ----

const amountText = (label: string) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const parsed = typeof value === "number" ? value : parseAmount(value)
    if (parsed === null || parsed <= 0) {
      ctx.addIssue({ code: "custom", message: `Revisa ${label}.` })
      return z.NEVER
    }
    return parsed
  })

const orderCustomizationSchema = z.object({
  type_id: z.uuid(),
  quantity: z.number().positive().max(10_000).optional(),
  text: z.string().trim().max(60).optional(),
  logo_path: z.string().trim().max(300).optional(),
  position: z.string().trim().max(60).optional(),
  size_cm: z.number().positive().max(100).optional(),
  note: z.string().trim().max(300).optional(),
  names: z.array(z.string().trim().min(1).max(40)).max(1000).optional(),
})

const orderItemSchema = z.object({
  variant_id: z.uuid(),
  quantity: z.number().positive().max(10_000),
  components: z
    .array(z.object({ variant_id: z.uuid(), quantity: z.number().positive().max(10_000), source: z.enum(["stock", "made_to_order"]) }))
    .max(500)
    .optional(),
  customizations: z.array(orderCustomizationSchema).max(10).optional(),
})

// El pedido llega como JSON (como la venta).
export const createOrderSchema = z.object({
  customer_id: z.uuid({ error: "Un pedido necesita cliente." }),
  price_method_id: z.uuid({ error: "Elige el método de pago." }),
  channel: z.enum(E.sale_channel),
  delivery_method: z.enum(E.delivery_method),
  stock_mode: z.enum(E.order_stock_mode),
  promised_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Indica la fecha prometida." }),
  items: z.array(orderItemSchema).min(1, { error: "Agrega al menos un producto." }).max(100),
  payments: z.array(z.object({ payment_method_id: z.uuid(), amount: amountText("el monto del pago") })).max(10).default([]),
  delivery_fee_usd: z.number().min(0).default(0),
  // IVA sobre el total: la tasa la pone el servidor (Configuración → Presupuestos).
  vat_enabled: z.boolean().default(false),
  notes: z.string().trim().max(500).nullable().default(null),
})

export const assignStageSchema = z
  .object({
    sale_item_id: z.uuid(),
    stage: z.enum(["cutting", "sewing", "customization", "quality_check", "packing"]),
    assignee: z.string().regex(/^(member|workshop):[0-9a-f-]{36}$/, { error: "Elige a quién se asigna." }),
    expected_date: z
      .string()
      .optional()
      .transform((v) => v || undefined)
      .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    note: optionalTextSchema(300),
  })

export const reasonSchema = z.object({
  sale_id: z.uuid(),
  reason: z.string().trim().min(3, { error: "Explica el motivo." }).max(300),
})

export const deliverOrderSchema = z.object({
  sale_id: z.uuid(),
  reason: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || undefined),
})

export const cancelOrderSchema = reasonSchema.extend({
  deduction_usdt: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return undefined
      const parsed = parseAmount(value, 6)
      if (parsed === null || parsed < 0) {
        ctx.addIssue({ code: "custom", message: "Revisa el monto que no se devuelve." })
        return z.NEVER
      }
      return parsed
    }),
})

export const promisedDateSchema = z.object({
  sale_id: z.uuid(),
  promised_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Indica la fecha." }),
  reason: optionalTextSchema(300),
})

export const orderSettingsSchema = z.object({
  deposit_threshold_usd: positiveAmountSchema("el umbral"),
  deposit_percent: positiveAmountSchema("el porcentaje").pipe(z.number().max(100, { error: "Máximo 100%." })),
  default_lead_days: z.coerce.number({ error: "Indica los días." }).int().min(0).max(365),
})

export const pieceRateSchema = z.object({
  product_category_id: z.uuid({ error: "Elige la categoría." }),
  stage: z.enum(["cutting", "sewing", "customization", "quality_check", "packing"], { error: "Elige la etapa." }),
  rate_usd: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const parsed = parseAmount(value)
      if (parsed === null || parsed < 0) {
        ctx.addIssue({ code: "custom", message: "Revisa la tarifa." })
        return z.NEVER
      }
      return parsed
    }),
})

export const businessRuleSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((v) => v || undefined)
    .pipe(z.uuid().optional()),
  title: z.string().trim().min(3, { error: "Escribe el título." }).max(120),
  body: z.string().trim().min(3, { error: "Escribe la regla." }).max(2000),
  enforced_by_system: booleanFieldSchema.default(false),
  is_active: booleanFieldSchema.default(true),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
})

export const piecePaymentSchema = z.object({
  team_member_id: z.uuid(),
  account_id: z.uuid({ error: "Elige la cuenta." }),
  amount: positiveAmountSchema("el monto"),
  piecework_ids: z.array(z.uuid()).min(1, { error: "Elige las piezas a pagar." }),
  advance_ids: z.array(z.uuid()).default([]),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type AssignStageInput = z.infer<typeof assignStageSchema>
export type AssignStageField = keyof AssignStageInput
export type ReasonField = keyof z.infer<typeof reasonSchema>
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>
export type CancelOrderField = keyof CancelOrderInput
export type DeliverOrderField = keyof z.infer<typeof deliverOrderSchema>
export type PromisedDateField = keyof z.infer<typeof promisedDateSchema>
export type OrderSettingsInput = z.infer<typeof orderSettingsSchema>
export type OrderSettingsField = keyof OrderSettingsInput
export type PieceRateInput = z.infer<typeof pieceRateSchema>
export type PieceRateField = keyof PieceRateInput
export type BusinessRuleInput = z.infer<typeof businessRuleSchema>
export type BusinessRuleField = keyof BusinessRuleInput
