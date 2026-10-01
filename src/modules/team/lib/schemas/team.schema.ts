import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import {
  booleanFieldSchema,
  optionalTextSchema,
  pastOrTodayDateSchema,
  positiveAmountSchema,
} from "@/common/lib/schemas/form-fields.schema"
import { normalizePhone } from "@/modules/customers/lib/utils/normalize-contact.util"

const E = Constants.public.Enums

const optionalUuid = z
  .string()
  .optional()
  .transform((value) => (value && value !== "none" ? value : undefined))
  .pipe(z.uuid().optional())

export const teamMemberSchema = z.object({
  id: optionalUuid,
  full_name: z.string().trim().min(1, { error: "Escribe el nombre." }).max(120),
  // Usuario del sistema (opcional): vacío = sin cuenta.
  profile_id: optionalUuid,
  job_title: optionalTextSchema(80),
  phone: z
    .string()
    .optional()
    .transform((value, ctx) => {
      const result = normalizePhone(value ?? "")
      if (result === undefined) {
        ctx.addIssue({ code: "custom", message: "Teléfono inválido. Ej.: 0414-123.45.67" })
        return z.NEVER
      }
      return result
    }),
  notes: optionalTextSchema(500),
  is_active: booleanFieldSchema.default(true),
})

export const salaryAgreementSchema = z.object({
  team_member_id: z.uuid(),
  amount: positiveAmountSchema("el sueldo"),
  currency: z.enum(E.currency, { error: "Elige la moneda." }),
  frequency: z.enum(E.salary_frequency, { error: "Elige la frecuencia." }),
  // Desde cuándo rige (puede ser futura: un aumento ya acordado).
  effective_from: z.iso.date({ error: "Indica desde cuándo rige." }),
  notes: optionalTextSchema(300),
})

export const payrollSchema = z.object({
  kind: z.enum(E.payroll_entry_kind),
  team_member_id: z.uuid(),
  account_id: z.uuid({ error: "Elige la cuenta." }),
  amount: positiveAmountSchema("el monto"),
  period_label: optionalTextSchema(60),
  // Pago: adelantos que descuenta (vacío = ninguno).
  settle_advance_ids: z.array(z.uuid()).default([]),
  note: optionalTextSchema(200),
  receipt_path: optionalTextSchema(300),
  date: pastOrTodayDateSchema,
})

export type TeamMemberInput = z.infer<typeof teamMemberSchema>
export type TeamMemberField = keyof TeamMemberInput
export type SalaryAgreementInput = z.infer<typeof salaryAgreementSchema>
export type SalaryAgreementField = keyof SalaryAgreementInput
export type PayrollInput = z.infer<typeof payrollSchema>
export type PayrollField = keyof PayrollInput
