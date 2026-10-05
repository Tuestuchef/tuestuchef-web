import { z } from "zod"

import {
  normalizeEmail,
  normalizeIdDocument,
  normalizeInstagram,
  normalizePhone,
} from "@/modules/customers/lib/utils/normalize-contact.util"

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

export const businessProfileSchema = z.object({
  email: normalized(normalizeEmail, "Correo inválido."),
  phone: normalized(normalizePhone, "Teléfono inválido. Ej.: 0414-123.45.67"),
  whatsapp: normalized(normalizePhone, "Número de WhatsApp inválido. Ej.: 0414-123.45.67"),
  instagram: normalized(normalizeInstagram, "Usuario de Instagram inválido."),
  address: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null)
    .pipe(z.string().max(300, { error: "Máximo 300 caracteres." }).nullable()),
  tax_id: normalized(normalizeIdDocument, "RIF inválido. Ej.: J-12345678-9"),
})

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>
