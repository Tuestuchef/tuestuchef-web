import type { Enums } from "@/common/lib/db/database.types"

export type SalaryFrequency = Enums<"salary_frequency">
export type PayrollEntryKind = Enums<"payroll_entry_kind">

export const FREQUENCY_LABELS: Record<SalaryFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
}

export const PAYROLL_KIND_LABELS: Record<PayrollEntryKind, string> = {
  payment: "Pago de sueldo",
  advance: "Adelanto",
}

export const TEAM_MESSAGES = {
  MEMBER_SAVED: "Persona guardada.",
  AGREEMENT_SAVED: "Sueldo registrado.",
  PAYMENT_SAVED: "Pago registrado.",
  ADVANCE_SAVED: "Adelanto registrado.",
} as const
