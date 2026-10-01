import { z } from "zod"

import { receiptPathSchema } from "@/common/lib/schemas/receipt-upload.schema"
import {
  optionalTextSchema,
  pastOrTodayDateSchema,
  positiveAmountSchema,
} from "@/common/lib/schemas/form-fields.schema"
import { toCaracasMonth } from "@/common/lib/utils/format-date.util"

const optionalUuid = z
  .string()
  .optional()
  .transform((value) => value || undefined)
  .pipe(z.uuid().optional())

// El monto llega positivo; el signo lo pone el tipo (ingreso o gasto).
export const ledgerEntrySchema = z.object({
  direction: z.enum(["income", "expense"], { error: "Elige si es gasto o ingreso." }),
  account_id: z.uuid({ error: "Elige la cuenta." }),
  category_id: z.uuid({ error: "Elige la categoría." }),
  amount: positiveAmountSchema("el monto"),
  description: optionalTextSchema(200),
  date: pastOrTodayDateSchema,
  // Persona del equipo (sueldos, retiros, aportes y repartos).
  team_member_id: optionalUuid,
  receipt_path: receiptPathSchema,
})

export const reverseEntrySchema = z.object({
  entry_id: z.uuid(),
  reason: z.string().trim().min(3, { error: "Escribe el motivo del reverso." }).max(200),
})

// Filtros del listado (vienen de la URL; lo inválido se ignora).
export const movementFiltersSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .catch(() => toCaracasMonth()),
  account: z.uuid().optional().catch(undefined),
  type: z.enum(["income", "expense", "transfer"]).optional().catch(undefined),
})

export type LedgerEntryInput = z.infer<typeof ledgerEntrySchema>
export type LedgerEntryField = keyof LedgerEntryInput
