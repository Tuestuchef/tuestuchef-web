import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import { booleanFieldSchema, optionalTextSchema } from "@/common/lib/schemas/form-fields.schema"

import { CUSTOMER_MESSAGES } from "../constants/customers.constants"
import {
  normalizeEmail,
  normalizeIdDocument,
  normalizeInstagram,
  normalizePhone,
} from "../utils/normalize-contact.util"

// Campo opcional normalizado: vacío → null, inválido → error con el mensaje dado.
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

export const contactSchema = z.object({
  phone: normalized(normalizePhone, "Teléfono inválido. Ej.: 0414-123.45.67"),
  email: normalized(normalizeEmail, "Correo inválido."),
  instagram: normalized(normalizeInstagram, "Usuario de Instagram inválido."),
})

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .optional()
    .transform((value) => value || null)

// Persona: nombre y al menos un contacto. Empresa: solo la razón social es obligatoria; si no
// tiene nombre comercial, se la conoce por su razón social.
export const customerSchema = contactSchema
  .extend({
    id: z
      .string()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.uuid().optional()),
    kind: z.enum(Constants.public.Enums.customer_kind).default("person"),
    first_name: optionalText(60),
    last_name: optionalText(60),
    legal_name: optionalText(150),
    tax_id: normalized(normalizeIdDocument, "RIF inválido. Ej.: J-12345678-9"),
    contact_person: optionalText(100),
    address: optionalText(300),
    notes: optionalTextSchema(500),
    id_document: normalized(normalizeIdDocument, "Cédula inválida. Ej.: V-12.345.678"),
    is_active: booleanFieldSchema.default(true),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "company") {
      if (!v.legal_name) ctx.addIssue({ code: "custom", path: ["legal_name"], message: CUSTOMER_MESSAGES.LEGAL_NAME_REQUIRED })
      return
    }
    if (!v.first_name) ctx.addIssue({ code: "custom", path: ["first_name"], message: "Escribe el nombre." })
    if (!(v.phone || v.email || v.instagram)) ctx.addIssue({ code: "custom", path: ["phone"], message: CUSTOMER_MESSAGES.CONTACT_REQUIRED })
  })
  .transform((v) =>
    v.kind === "company"
      ? { ...v, first_name: v.first_name ?? (v.legal_name ?? "").slice(0, 60), last_name: null, id_document: null }
      : { ...v, first_name: v.first_name ?? "", legal_name: null, tax_id: null, contact_person: null }
  )

export const customerFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
})

export type CustomerInput = z.infer<typeof customerSchema>
export type CustomerField = keyof CustomerInput
