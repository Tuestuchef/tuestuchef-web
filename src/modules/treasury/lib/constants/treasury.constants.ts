import type { Currency } from "@/common/lib/constants/currency.constants"
import type { Enums } from "@/common/lib/db/database.types"

export type AccountKind = Enums<"account_kind">

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  bank: "Banco",
  cash: "Efectivo",
  zelle: "Zelle",
  crypto_wallet: "Billetera cripto",
}

// Monedas válidas por tipo de cuenta (igual que el check de la base).
export const ACCOUNT_KIND_CURRENCIES: Record<AccountKind, readonly Currency[]> = {
  bank: ["VES", "USD"],
  cash: ["VES", "USD"],
  zelle: ["USD"],
  crypto_wallet: ["USDT"],
}

export const TREASURY_MESSAGES = {
  RATE_SAVED: "Tasa registrada.",
  ACCOUNT_SAVED: "Cuenta guardada.",
  PAYMENT_METHOD_SAVED: "Método de pago guardado.",
  TRANSFER_SAVED: "Traspaso registrado.",
  TRANSFER_VOIDED: "Traspaso anulado.",
} as const
