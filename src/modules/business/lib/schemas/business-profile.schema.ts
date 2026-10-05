import { z } from "zod"

import {
  normalizeEmail,
  normalizeIdDocument,
  normalizeInstagram,
  normalizePhone,
} from "@/modules/customers/lib/utils/normalize-contact.util"

import { HEADER_IMAGE_MAX_BYTES, HEADER_IMAGE_PATH_PATTERN, HEADER_IMAGE_TYPES } from "../constants/business.constants"

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

const optionalText = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) => value?.trim() || null)
    .pipe(z.string().max(max, { error: `Máximo ${max} caracteres.` }).nullable())

// Sitio web: se acepta sin "https://" y se guarda con él.
export function normalizeWebsite(value: string | null | undefined): string | null | undefined {
  const raw = value?.trim() ?? ""
  if (!raw) return null
  const url = /^https?:\/\//i.test(raw) ? raw.replace(/^http:\/\//i, "https://") : `https://${raw}`
  return /^https:\/\/[^\s/]+\.[^\s]{2,}$/.test(url) && url.length <= 208 ? url : undefined
}

export const businessProfileSchema = z.object({
  trade_name: optionalText(80),
  legal_name: optionalText(150),
  tax_id: normalized(normalizeIdDocument, "RIF inválido. Ej.: J-12345678-9"),
  email: normalized(normalizeEmail, "Correo inválido."),
  phone: normalized(normalizePhone, "Teléfono inválido. Ej.: 0414-123.45.67"),
  whatsapp: normalized(normalizePhone, "Número de WhatsApp inválido. Ej.: 0414-123.45.67"),
  instagram: normalized(normalizeInstagram, "Usuario de Instagram inválido."),
  website: normalized(normalizeWebsite, "Sitio web inválido. Ej.: tuestuchef.com"),
  address: optionalText(300),
})

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>

export const headerImageUploadSchema = z.object({
  contentType: z.enum(Object.keys(HEADER_IMAGE_TYPES) as [keyof typeof HEADER_IMAGE_TYPES], {
    error: "Solo PNG o JPG.",
  }),
  size: z.number().int().positive().max(HEADER_IMAGE_MAX_BYTES, { error: "La imagen pesa más de 2 MB." }),
})

export const headerImagePathSchema = z.string().regex(HEADER_IMAGE_PATH_PATTERN)
