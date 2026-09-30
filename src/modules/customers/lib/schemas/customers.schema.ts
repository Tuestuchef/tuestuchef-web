import { z } from "zod"

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

const nameSchema = z.string().trim().min(1, { error: "Escribe el nombre." }).max(60)

export const contactSchema = z.object({
  phone: normalized(normalizePhone, "Teléfono inválido. Ej.: 0414-123.45.67"),
  email: normalized(normalizeEmail, "Correo inválido."),
  instagram: normalized(normalizeInstagram, "Usuario de Instagram inválido."),
})

export const customerSchema = contactSchema
  .extend({
    id: z
      .string()
      .optional()
      .transform((value) => value || undefined)
      .pipe(z.uuid().optional()),
    first_name: nameSchema,
    last_name: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((value) => value || null),
    notes: optionalTextSchema(500),
    id_document: normalized(normalizeIdDocument, "Cédula inválida. Ej.: V-12.345.678"),
    is_active: booleanFieldSchema.default(true),
  })
  .refine((v) => Boolean(v.phone || v.email || v.instagram), {
    error: CUSTOMER_MESSAGES.CONTACT_REQUIRED,
    path: ["phone"],
  })

export const customerFiltersSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
})

export type CustomerInput = z.infer<typeof customerSchema>
export type CustomerField = keyof CustomerInput
