import type { Currency } from "@/common/lib/constants/currency.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import type { SalaryRateKind } from "../constants/team.constants"

type SalaryAmount = { amount: number; currency: Currency; rateKind: SalaryRateKind }
export type PayrollRates = { bcvUsd: number; bcvEur: number; usdUsdt: number }

const eurFormat = new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// "$ 400,00", "Bs 15.000,00", o a tasa BCV: "$ 400,00 a tasa BCV" / "€ 400,00 a tasa BCV".
export function formatSalary(salary: SalaryAmount): string {
  if (salary.rateKind === "bcv_usd") return `${formatMoney(salary.amount, "USD")} a tasa BCV`
  if (salary.rateKind === "bcv_eur") return `€ ${eurFormat.format(salary.amount)} a tasa BCV`
  return formatMoney(salary.amount, salary.currency)
}

// El sueldo en USD de referencia (Bs con BCV dólar, como la base).
export function salaryInUsd(salary: SalaryAmount, rates: PayrollRates | null): number {
  if (salary.rateKind === "bcv_usd") return salary.amount
  if (!rates) return salary.currency === "USD" ? salary.amount : 0
  if (salary.rateKind === "bcv_eur") return (salary.amount * rates.bcvEur) / rates.bcvUsd
  if (salary.currency === "VES") return salary.amount / rates.bcvUsd
  if (salary.currency === "USDT") return salary.amount / rates.usdUsdt
  return salary.amount
}
