import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import {
  booleanFieldSchema,
  optionalTextSchema,
  pastOrTodayDateSchema,
} from "@/common/lib/schemas/form-fields.schema"
import { toCaracasMonth } from "@/common/lib/utils/format-date.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import {
  normalizeEmail,
  normalizeIdDocument,
  normalizePhone,
} from "@/modules/customers/lib/utils/normalize-contact.util"

const E = Constants.public.Enums

// Campo opcional normalizado: vacío → null, inválido → error.
const normalized = (normalize: (value: string) => string | null | undefined, message: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const result = normalize(value ?? "")
      if (result === undefined) {
        ctx.addIssue({ code: "custom", message })
        return z.NEVER
      }
      return result
    })

// Montos escritos por la persona ("1.234,56") o ya numéricos.
const amount = (label: string, maxDecimals = 2) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const parsed = typeof value === "number" ? value : parseAmount(value, maxDecimals)
    if (parsed === null || parsed <= 0) {
      ctx.addIssue({ code: "custom", message: `Revisa ${label}.` })
      return z.NEVER
    }
    return parsed
  })

export const supplierSchema = z.object({
  id: z
    .string()
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.uuid().optional()),
  name: z.string().trim().min(1, { error: "Escribe el nombre." }).max(120),
  rif: normalized(normalizeIdDocument, "RIF inválido. Ej.: J-40123456-7"),
  contact_name: optionalTextSchema(120),
  phone: normalized(normalizePhone, "Teléfono inválido. Ej.: 0414-123.45.67"),
  email: normalized(normalizeEmail, "Correo inválido."),
  notes: optionalTextSchema(500),
  is_active: booleanFieldSchema.default(true),
})

const inventoryLineSchema = z.object({
  line_type: z.literal("inventory"),
  variant_id: z.uuid({ error: "Elige el producto." }),
  quantity: amount("la cantidad", 3),
  unit_cost_usd: amount("el costo unitario", 4),
  category_id: z.uuid({ error: "Elige la categoría." }),
})

const conceptLineSchema = z.object({
  line_type: z.literal("concept"),
  description: z.string().trim().min(1, { error: "Describe el concepto." }).max(200),
  quantity: amount("la cantidad", 3),
  unit_cost_usd: amount("el monto", 4),
  category_id: z.uuid({ error: "Elige la categoría." }),
})

const paymentSchema = z.object({
  account_id: z.uuid({ error: "Elige la cuenta." }),
  amount: amount("el monto del pago"),
  rate_kind: z.enum(E.supplier_rate_kind).default("none"),
})

// La compra llega como JSON (las líneas no caben bien en campos de formulario).
export const createPurchaseSchema = z.object({
  supplier_id: z.uuid({ error: "Elige el proveedor." }),
  items: z
    .array(z.discriminatedUnion("line_type", [inventoryLineSchema, conceptLineSchema]))
    .min(1, { error: "Agrega al menos una línea." })
    .max(100),
  payments: z.array(paymentSchema).max(10).default([]),
  due_date: z.iso.date().nullable().default(null),
  notes: z.string().trim().max(500).nullable().default(null),
  receipt_path: z.string().max(300).nullable().default(null),
  date: pastOrTodayDateSchema,
})

export const addPurchasePaymentSchema = z.object({
  purchase_id: z.uuid(),
  account_id: z.uuid({ error: "Elige la cuenta." }),
  amount: amount("el monto"),
  rate_kind: z.enum(E.supplier_rate_kind).default("none"),
  receipt_path: optionalTextSchema(300),
  date: pastOrTodayDateSchema,
})

export const voidPurchaseSchema = z.object({
  purchase_id: z.uuid(),
  reason: z.string().trim().min(3, { error: "Explica el motivo." }).max(300),
})

export const purchaseFiltersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .catch(() => toCaracasMonth())
    .default(() => toCaracasMonth()),
  supplier: z.uuid().optional().catch(undefined),
  status: z.enum(["pending", "partial", "paid", "voided"]).optional().catch(undefined),
})

export type SupplierInput = z.infer<typeof supplierSchema>
export type SupplierField = keyof SupplierInput
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>
export type AddPurchasePaymentInput = z.infer<typeof addPurchasePaymentSchema>
export type AddPurchasePaymentField = keyof AddPurchasePaymentInput
export type VoidPurchaseField = keyof z.infer<typeof voidPurchaseSchema>
