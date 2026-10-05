import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import {
  normalizeEmail,
  normalizeIdDocument,
  normalizePhone,
} from "@/modules/customers/lib/utils/normalize-contact.util"

const E = Constants.public.Enums

export const QUOTE_HEADER_PATH_PATTERN = /^quotes\/header\/[0-9a-f-]{36}\.(png|jpg)$/

// Opcional normalizado: vacío → null, inválido → error.
const normalized = (normalize: (value: string) => string | null | undefined, message: string) =>
  z
    .string()
    .nullish()
    .transform((value, ctx) => {
      const result = normalize(value ?? "")
      if (result === undefined) {
        ctx.addIssue({ code: "custom", message })
        return z.NEVER
      }
      return result
    })

const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((value) => value?.trim() || null)
    .pipe(z.string().max(max, { error: `Máximo ${max} caracteres.` }).nullable())

const optionalId = z
  .string()
  .nullish()
  .transform((value) => value || null)
  .pipe(z.uuid().nullable())

const quantity = z.number({ error: "Cantidad inválida." }).positive({ error: "Cantidad inválida." }).max(100_000)

const customizationSchema = z.object({
  type_id: z.uuid(),
  quantity: z.number().int({ error: "Las piezas van sin decimales." }).positive(),
  size_cm: z.number().positive().max(999).nullish(),
  position: optionalText(60),
  text: optionalText(60),
  note: optionalText(300),
})

const itemSchema = z.object({
  variant_id: z.uuid(),
  quantity,
  discount_percent: z.number().min(0).max(100).default(0),
  components: z.array(z.object({ variant_id: z.uuid(), quantity })).max(50).optional(),
  customizations: z.array(customizationSchema).max(20).default([]),
})

// Lo que se guarda en un borrador. La base vuelve a validar todo y calcula los precios.
export const saveQuoteSchema = z
  .object({
    id: optionalId,
    customer_id: optionalId,
    customer: z
      .object({
        kind: z.enum(E.customer_kind).default("person"),
        name: optionalText(150),
        legal_name: optionalText(150),
        tax_id: normalized(normalizeIdDocument, "RIF inválido. Ej.: J-12345678-9"),
        phone: normalized(normalizePhone, "Teléfono inválido. Ej.: 0414-123.45.67"),
        email: normalized(normalizeEmail, "Correo inválido."),
        address: optionalText(300),
        contact_person: optionalText(100),
      })
      .optional(),
    valid_until: z.iso.date({ error: "Fecha de vencimiento inválida." }),
    currencies: z.enum(E.quote_currencies),
    usd_price_method_id: optionalId,
    ves_price_method_id: optionalId,
    vat_enabled: z.boolean(),
    igtf_note_enabled: z.boolean(),
    group_by_size: z.boolean(),
    discount_type: z.enum(E.discount_type).nullish(),
    discount_value: z.number().positive().max(1_000_000).nullish(),
    discount_reason: optionalText(300),
    terms: optionalText(3000),
    header_image_path: z
      .string()
      .nullish()
      .transform((value) => value || null)
      .pipe(z.string().regex(QUOTE_HEADER_PATH_PATTERN, { error: "Imagen inválida." }).nullable()),
    items: z.array(itemSchema).min(1, { error: "Agrega al menos un producto." }).max(200),
  })
  .refine((v) => Boolean(v.customer_id || v.customer?.name), { error: "Elige un cliente o escribe su nombre.", path: ["customer"] })

export type SaveQuoteInput = z.infer<typeof saveQuoteSchema>

export const quoteFiltersSchema = z.object({
  status: z.enum(E.quote_status).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
})

export type QuoteFilters = z.infer<typeof quoteFiltersSchema>

export const markQuoteSchema = z.object({
  id: z.uuid(),
  status: z.enum(["accepted", "rejected"]),
  note: optionalText(300),
})

export const discardQuoteSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(3, { error: "Escribe el motivo." }).max(300),
})
