import { z } from "zod"

// Solo rutas internas: evita redirecciones abiertas (//otro-sitio.com).
const safeRedirectSchema = z
  .string()
  .regex(/^\/(?!\/)/)
  .catch("/")

const emailSchema = z.email({ error: "Escribe un correo válido." }).trim().toLowerCase()

const sixDigitsSchema = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: `${label} tiene 6 dígitos.` })

export const requestLoginCodeSchema = z.object({
  email: emailSchema,
})

export const verifyLoginCodeSchema = z.object({
  email: emailSchema,
  token: sixDigitsSchema("El código"),
  redirectTo: safeRedirectSchema,
})

export const verifyMfaSchema = z.object({
  factor_id: z.uuid(),
  code: sixDigitsSchema("El código de la app"),
})

export type LoginCodeField = "email" | "token"
export type MfaField = "code"
