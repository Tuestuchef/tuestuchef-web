import type { Currency } from "@/common/lib/constants/currency.constants"

import type {
  DeliveryMethod,
  DiscountType,
  PaymentRateKind,
  PaymentStatus,
  SaleChannel,
  SaleItemStatus,
  SaleLineSource,
} from "../constants/sales.constants"

export type SalePaymentMethod = {
  id: string
  name: string
  currency: Currency
  rateKind: PaymentRateKind
}

// Variante vendible, con sus precios en USD por método.
export type SellableVariant = {
  id: string
  sku: string
  productName: string
  variantLabel: string
  fulfillmentType: "stock" | "made_to_order" | "both"
  stock: number
  pricesUsd: Record<string, number>
}

export type SaleFormData = {
  variants: SellableVariant[]
  methods: SalePaymentMethod[]
  rates: { bcvUsd: number; bcvEur: number; usdUsdt: number; isCurrent: boolean } | null
  staffMaxDiscountPercent: number
  staffMaxBackdateDays: number
  today: string
}

export type SaleListItem = {
  id: string
  number: number
  occurredAt: string
  channel: SaleChannel
  customerName: string | null
  totalUsd: number
  balanceUsd: number
  paymentStatus: PaymentStatus
  itemsSummary: string
  pendingProduction: boolean
  isBackdated: boolean
  createdAt: string
}

export type SaleDetailItem = {
  id: string
  sku: string
  productName: string
  variantLabel: string
  quantity: number
  unitPriceUsd: number
  lineTotalUsd: number
  source: SaleLineSource
  status: SaleItemStatus | null
}

export type SaleDetailPayment = {
  id: string
  methodName: string
  currency: Currency
  amount: number
  appliedRate: number | null
  usdAmount: number
  usdtValue: number
  occurredAt: string
  authorName: string | null
  hasReceipt: boolean
  isBackdated: boolean
}

export type SaleDetail = {
  id: string
  number: number
  occurredAt: string
  channel: SaleChannel
  deliveryMethod: DeliveryMethod
  priceMethodName: string
  customer: { id: string; name: string; phone: string | null } | null
  subtotalUsd: number
  discount: { type: DiscountType; value: number; usd: number; reason: string; byName: string | null } | null
  deliveryFeeUsd: number
  totalUsd: number
  paidUsd: number
  balanceUsd: number
  paymentStatus: PaymentStatus
  bcvUsdRate: number
  notes: string | null
  isBackdated: boolean
  createdAt: string
  authorName: string | null
  items: SaleDetailItem[]
  payments: SalePaymentWithLedger[]
  void: { reason: string; at: string; byName: string | null } | null
}

export type SalePaymentWithLedger = SaleDetailPayment & { ledgerEntryId: string }

export type SaleRatesForDate = { bcvUsd: number; bcvEur: number; usdUsdt: number } | null

export type SalesTotals = {
  salesCount: number
  totalUsd: number
  paidUsd: number
  balanceUsd: number
  collectedUsdt: number
}

export type SalesFilters = {
  month: string
  channel?: SaleChannel
  status?: PaymentStatus
}
