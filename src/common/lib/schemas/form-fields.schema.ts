import { z } from "zod"

import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

// Monto positivo escrito por la persona ("1.234,56" o "1234.56").
export const positiveAmountSchema = (label: string, maxDecimals = 2) =>
  z
    .string({ error: `Escribe ${label}.` })
    .trim()
    .min(1, { error: `Escribe ${label}.` })
    .transform((value, ctx) => {
      const parsed = parseAmount(value, maxDecimals)
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({
          code: "custom",
          message: `Revisa ${label}: solo números, con coma o punto para los decimales.`,
        })
        return z.NEVER
      }
      return parsed
    })

// Igual que positiveAmountSchema pero opcional (vacío = no enviado).
export const optionalPositiveAmountSchema = (label: string, maxDecimals = 2) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return undefined
      const parsed = parseAmount(value, maxDecimals)
      if (parsed === null || parsed <= 0) {
        ctx.addIssue({ code: "custom", message: `Revisa ${label}.` })
        return z.NEVER
      }
      return parsed
    })

// Fecha AAAA-MM-DD que no sea futura (hora de Caracas). Vacía = hoy.
export const pastOrTodayDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => value === undefined || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    error: "Fecha inválida.",
  })
  .refine((value) => value === undefined || value <= toCaracasDate(), {
    error: "La fecha no puede ser futura.",
  })

export const optionalTextSchema = (max = 300) =>
  z
    .string()
    .trim()
    .max(max, { error: `Máximo ${max} caracteres.` })
    .optional()
    .transform((value) => value || undefined)

// Casillas enviadas como "true"/"false" desde un input oculto.
export const booleanFieldSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
