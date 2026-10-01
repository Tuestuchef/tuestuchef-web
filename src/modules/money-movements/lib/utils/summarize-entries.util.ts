import { INCOME_ENTRY_TYPES } from "../constants/money-movements.constants"
import type { LedgerEntryItem, MovementTotals } from "../types/money-movements.types"

// Neto del período en USDT (los reversos restan solos). Los traspasos no cuentan;
// sus comisiones sí, como egreso.
export function summarizeEntries(entries: LedgerEntryItem[]): MovementTotals {
  return entries.reduce<MovementTotals>(
    (totals, entry) => {
      if (INCOME_ENTRY_TYPES.includes(entry.entryType)) totals.incomeUsdt += entry.usdtValue
      else if (entry.entryType === "expense" || entry.entryType === "purchase_payment" || entry.entryType === "exchange_fee") {
        totals.expenseUsdt -= entry.usdtValue
      }
      return totals
    },
    { incomeUsdt: 0, expenseUsdt: 0 }
  )
}
