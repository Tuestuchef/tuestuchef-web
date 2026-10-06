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
  productId: string
  sku: string
  productName: string
  variantLabel: string
  fulfillmentType: "stock" | "made_to_order" | "both"
  stock: number
  pricesUsd: Record<string, number>
  // Solo en combos: qué lleva cada combo (la talla y el color se eligen al vender).
  components?: ComboComponentOption[]
}

export type ComboComponentOption = {
  productId: string
  productName: string
  // Cuántas piezas de este producto lleva un combo.
  quantity: number
}

// Descuento al mayor por cantidad de piezas.
export type VolumeTier = { minQuantity: number; percent: number }

export type SaleFormData = {
  variants: SellableVariant[]
  methods: SalePaymentMethod[]
  rates: { bcvUsd: number; bcvEur: number; usdUsdt: number; isCurrent: boolean } | null
  staffMaxDiscountPercent: number
  staffMaxBackdateDays: number
  volumeTiers: VolumeTier[]
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
  // Componente de un combo: la línea del combo a la que pertenece.
  parentId: string | null
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
  volumeDiscount: { percent: number; usd: number } | null
  discount: { type: DiscountType; value: number; usd: number; reason: string; byName: string | null } | null
  deliveryFeeUsd: number
  // IVA sobre el total (después de descuentos); null si la venta no lleva IVA.
  vat: { percent: number; usd: number } | null
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

export type SaleRatesForDate = { bcvUsd: number; bcvEur: number; binance: number; usdUsdt: number } | null

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

export type ReceivableGroup = {
  customerId: string | null
  customerName: string | null
  customerPhone: string | null
  balanceUsd: number
  oldestDays: number
  sales: {
    saleId: string
    number: number
    occurredAt: string
    totalUsd: number
    balanceUsd: number
    daysOutstanding: number
  }[]
}

// Calculadora de precios: un producto (no cada variante: el precio es por producto y método).
export type CalculatorProduct = {
  id: string
  name: string
  isCombo: boolean
  categoryId: string | null
  categoryName: string
  // Colores de sus variantes: para encontrar "filipina vinotinto".
  colors: string[]
  imageUrl: string | null
  pricesUsd: Record<string, number>
  // Piezas que cuenta para el descuento al mayor (un combo, las de sus componentes).
  piecesPerUnit: number
}

export type PriceCalculatorData = {
  products: CalculatorProduct[]
  categories: { id: string; name: string }[]
  methods: SalePaymentMethod[]
  rates: { bcvUsd: number; bcvEur: number; usdUsdt: number; isCurrent: boolean } | null
  volumeTiers: VolumeTier[]
}
