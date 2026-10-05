import type { Database } from "@/common/lib/db/database.types"

export type QuoteCurrencies = Database["public"]["Enums"]["quote_currencies"]

export type QuoteSettings = {
  numberPrefix: string
  numberPadding: number
  nextNumber: number
  validityDays: number
  defaultCurrencies: QuoteCurrencies
  defaultUsdPriceMethodId: string | null
  defaultVesPriceMethodId: string | null
  vatPercent: number
  vatDefaultEnabled: boolean
  igtfNoteDefault: boolean
  igtfNote: string
  defaultTerms: string
  updatedAt: string
  updatedByName: string | null
}

// Lista de precios = un método de pago con su moneda de precio.
export type PriceListOption = { id: string; name: string; currency: "USD" | "VES" | "USDT" }

export type QuoteSettingsField =
  | "number_prefix"
  | "number_padding"
  | "next_number"
  | "validity_days"
  | "default_currencies"
  | "default_usd_price_method_id"
  | "default_ves_price_method_id"
  | "vat_percent"
  | "vat_default_enabled"
  | "igtf_note_default"
  | "igtf_note"
  | "default_terms"
