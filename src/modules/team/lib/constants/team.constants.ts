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

// Cómo se paga un sueldo: en su moneda, o acordado en USD / EUR y pagado en Bs a tasa BCV.
export type SalaryRateKind = Enums<"payment_rate_kind">
export const SALARY_PAY_OPTIONS = [
  { value: "VES", label: "Bolívares", currency: "VES", rateKind: "none" },
  { value: "USD", label: "Dólares", currency: "USD", rateKind: "none" },
  { value: "USDT", label: "USDT", currency: "USDT", rateKind: "none" },
  { value: "USD_BCV", label: "Dólares a tasa BCV (en Bs)", currency: "VES", rateKind: "bcv_usd" },
  { value: "EUR_BCV", label: "Euros a tasa BCV (en Bs)", currency: "VES", rateKind: "bcv_eur" },
] as const
export type SalaryPayOption = (typeof SALARY_PAY_OPTIONS)[number]["value"]
