import type { Enums } from "@/common/lib/db/database.types"

export type CategoryType = Enums<"category_type">
export type LedgerEntryType = Enums<"ledger_entry_type">
export type MovementDirection = "income" | "expense"

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
  sales: "Ventas",
  other_income: "Otros ingresos",
  capital_contribution: "Aporte de capital",
  cost: "Costo",
  operating_expense: "Gasto operativo",
  exchange_fee: "Comisión de cambio",
  tax: "Impuesto",
  salary: "Sueldo",
  withdrawal: "Retiro o adelanto",
  reinvestment: "Reinversión",
  profit_distribution: "Reparto de utilidades",
}

// Ayuda al crear categorías: qué va en cada tipo.
export const CATEGORY_TYPE_HINTS: Record<CategoryType, string> = {
  sales: "Dinero que entra por ventas.",
  other_income: "Ingresos que no son ventas.",
  capital_contribution: "Una persona mete dinero propio al negocio. No es ingreso.",
  cost: "Lo necesario para producir y vender este mes: tela, botones, alquiler, publicidad habitual.",
  operating_expense: "Gastos del día a día: delivery, papelería, empaques.",
  exchange_fee: "Comisiones bancarias o de cambio cobradas aparte.",
  tax: "Impuestos y tasas.",
  salary: "Sueldo de una persona del equipo, incluido el dueño.",
  withdrawal: "Retiro o gasto personal pagado con dinero del negocio. Cuenta como adelanto de sueldo.",
  reinvestment: "Para crecer: máquina nueva, línea nueva, stock adelantado. Sale de la utilidad.",
  profit_distribution: "Reparto de utilidades a una persona. Sale de la utilidad.",
}

export const INCOME_CATEGORY_TYPES: readonly CategoryType[] = ["sales", "other_income", "capital_contribution"]

export const EXPENSE_CATEGORY_TYPES: readonly CategoryType[] = [
  "cost",
  "operating_expense",
  "exchange_fee",
  "tax",
  "salary",
  "withdrawal",
  "reinvestment",
  "profit_distribution",
]

// Tipos que exigen indicar la persona (igual que la base).
export const PERSON_CATEGORY_TYPES: readonly CategoryType[] = [
  "salary",
  "withdrawal",
  "capital_contribution",
  "profit_distribution",
]

export const INCOME_ENTRY_TYPES: readonly LedgerEntryType[] = ["income", "sale_payment"]
export const EXPENSE_ENTRY_TYPES: readonly LedgerEntryType[] = ["expense", "purchase_payment"]
export const TRANSFER_ENTRY_TYPES: readonly LedgerEntryType[] = ["transfer_out", "transfer_in", "exchange_fee"]

export const ENTRY_TYPE_LABELS: Record<LedgerEntryType, string> = {
  income: "Ingreso",
  expense: "Gasto",
  sale_payment: "Pago de venta",
  transfer_out: "Traspaso (sale)",
  transfer_in: "Traspaso (entra)",
  exchange_fee: "Comisión de cambio",
  purchase_payment: "Pago de compra",
}

// Categorías visibles de inmediato en el registro rápido (el resto tras "Ver todas").
export const QUICK_CATEGORY_LIMIT = 8

export const MOVEMENT_MESSAGES = {
  EXPENSE_SAVED: "Gasto registrado.",
  INCOME_SAVED: "Ingreso registrado.",
  REVERSED: "Movimiento revertido.",
  CATEGORY_SAVED: "Categoría guardada.",
} as const
