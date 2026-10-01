import type { Currency } from "@/common/lib/constants/currency.constants"
import type { Tables } from "@/common/lib/db/database.types"
import type { CategoryType } from "@/modules/money-movements/lib/constants/money-movements.constants"

import type { PurchaseLineType, PurchaseStatus, SupplierRateKind } from "../constants/purchases.constants"

export type Supplier = Tables<"suppliers">

export type SupplierListItem = Pick<Supplier, "id" | "name" | "rif" | "phone" | "contact_name" | "is_active"> & {
  // Solo owner y admin (null para staff).
  balanceUsd: number | null
}

export type PurchaseVariantOption = {
  id: string
  sku: string
  productName: string
  variantLabel: string
  isRawMaterial: boolean
  unit: string
  stock: number
  lastCostUsdt: number | null
}

export type PurchaseAccount = { id: string; name: string; currency: Currency }
export type PurchaseCategory = { id: string; name: string; type: CategoryType }

export type PurchaseRates = { bcvUsd: number; binance: number; usdUsdt: number }

export type PurchaseFormData = {
  suppliers: { id: string; name: string }[]
  variants: PurchaseVariantOption[]
  accounts: PurchaseAccount[]
  categories: PurchaseCategory[]
  rates: (PurchaseRates & { isCurrent: boolean }) | null
  staffMaxBackdateDays: number
  today: string
}

export type PurchaseListItem = {
  id: string
  number: number
  occurredAt: string
  createdAt: string
  isBackdated: boolean
  supplierName: string
  totalUsd: number
  balanceUsd: number
  dueDate: string | null
  status: PurchaseStatus
  itemsSummary: string
}

export type PurchaseDetail = {
  id: string
  number: number
  occurredAt: string
  createdAt: string
  isBackdated: boolean
  supplier: { id: string; name: string }
  totalUsd: number
  paidUsd: number
  balanceUsd: number
  status: PurchaseStatus
  dueDate: string | null
  notes: string | null
  hasReceipt: boolean
  authorName: string | null
  rates: PurchaseRates
  items: {
    id: string
    lineType: PurchaseLineType
    label: string
    sku: string | null
    categoryName: string
    quantity: number
    unitCostUsd: number
    lineTotalUsd: number
  }[]
  payments: {
    id: string
    accountName: string
    currency: Currency
    amount: number
    rateKind: SupplierRateKind
    appliedRate: number | null
    usdAmount: number
    usdtValue: number
    occurredAt: string
    isBackdated: boolean
    authorName: string | null
  }[]
  void: { reason: string; at: string; byName: string | null } | null
}

export type PayableItem = {
  purchaseId: string
  number: number
  supplierId: string
  supplierName: string
  occurredAt: string
  dueDate: string | null
  totalUsd: number
  balanceUsd: number
  daysOverdue: number | null
}

export type PurchaseFilters = {
  month: string
  supplierId?: string
  status?: PurchaseStatus
}
