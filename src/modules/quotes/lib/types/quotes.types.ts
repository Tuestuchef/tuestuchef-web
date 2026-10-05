import type { Database } from "@/common/lib/db/database.types"
import type { CustomizationType } from "@/modules/orders/lib/types/orders.types"
import type { SaleFormData } from "@/modules/sales/lib/types/sales.types"

export type QuoteCurrencies = Database["public"]["Enums"]["quote_currencies"]
export type QuoteStatus = Database["public"]["Enums"]["quote_status"]
export type QuoteItemKind = Database["public"]["Enums"]["quote_item_kind"]
export type CustomerKind = Database["public"]["Enums"]["customer_kind"]
export type DiscountType = Database["public"]["Enums"]["discount_type"]

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

// Datos del formulario: catálogo de ventas + personalización + configuración de presupuestos.
export type QuoteFormData = Pick<SaleFormData, "variants" | "rates" | "staffMaxDiscountPercent" | "volumeTiers" | "today"> & {
  priceLists: PriceListOption[]
  customizationTypes: CustomizationType[]
  customizationTiers: { minQuantity: number; percent: number }[]
  settings: QuoteSettings
}

export type QuoteCustomerSnapshot = {
  kind: CustomerKind
  name: string
  legalName: string | null
  taxId: string | null
  phone: string | null
  email: string | null
  address: string | null
  contactPerson: string | null
}

export type QuoteItemCustomization = {
  id: string
  typeId: string
  typeName: string
  quantity: number
  sizeCm: number | null
  position: string | null
  text: string | null
  note: string | null
  unitPriceUsd: number
  discountPercent: number
  lineTotalUsd: number
}

export type QuoteItem = {
  id: string
  parentId: string | null
  kind: QuoteItemKind
  variantId: string
  productName: string
  sku: string
  colorName: string | null
  sizeName: string | null
  sizeSort: number | null
  quantity: number
  discountPercent: number
  usdUnitPrice: number
  vesUnitPrice: number
  usdLineTotal: number
  vesLineTotal: number
  customizations: QuoteItemCustomization[]
}

export type QuoteTotals = {
  subtotal: number
  volumeDiscount: number
  lineDiscounts: number
  discount: number
  vat: number
  total: number
}

export type QuoteStatusEvent = { id: string; status: QuoteStatus; note: string | null; at: string; byName: string | null }

export type QuoteDetail = {
  id: string
  code: string
  number: number
  version: number
  status: QuoteStatus
  effectiveStatus: QuoteStatus
  customerId: string | null
  customer: QuoteCustomerSnapshot
  issuedOn: string
  validUntil: string
  currencies: QuoteCurrencies
  usdPriceList: { id: string; name: string } | null
  vesPriceList: { id: string; name: string } | null
  vesRate: number | null
  vatEnabled: boolean
  vatPercent: number
  igtfNoteEnabled: boolean
  igtfNote: string | null
  discount: { type: DiscountType; value: number; reason: string | null } | null
  discountReason: string | null
  groupBySize: boolean
  terms: string | null
  headerImagePath: string | null
  pieces: number
  volumeDiscountPercent: number
  customizationTotalUsd: number
  usd: QuoteTotals
  ves: QuoteTotals & { totalBs: number }
  createdBy: { name: string; email: string | null; phone: string | null }
  createdAt: string
  replacesId: string | null
  supersededBy: string | null
  duplicatedFrom: string | null
  orderSaleId: string | null
  items: QuoteItem[]
  events: QuoteStatusEvent[]
}

export type QuoteListItem = {
  id: string
  code: string
  status: QuoteStatus
  effectiveStatus: QuoteStatus
  customerName: string
  customerLegalName: string | null
  issuedOn: string
  validUntil: string
  currencies: QuoteCurrencies
  usdTotal: number
  vesTotalBs: number
  createdByName: string
  orderSaleId: string | null
}
