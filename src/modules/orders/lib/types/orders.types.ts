import type { SaleFormData } from "@/modules/sales/lib/types/sales.types"

import type { OrderStatus, OrderStockMode, ProductionStage, VolumeDiscountScope } from "../constants/orders.constants"

export type CustomizationType = {
  id: string
  code: string
  name: string
  description: string | null
  // Vacío = todavía sin precio: no se puede usar en pedidos.
  unitPriceUsd: number | null
  minQuantity: number
  maxSizeCm: number | null
  defaultSizeCm: number | null
  requiresText: boolean
  requiresLogo: boolean
  isActive: boolean
}

export type VolumeTier = {
  id: string
  scope: VolumeDiscountScope
  minQuantity: number
  percent: number
}

export type OrderSettings = {
  depositThresholdUsd: number
  depositPercent: number
  defaultLeadDays: number
}

export type OrderFormData = SaleFormData & {
  customizationTypes: CustomizationType[]
  customizationTiers: { minQuantity: number; percent: number }[]
  settings: OrderSettings
  // Tasa de IVA de la configuración (la misma de los presupuestos).
  vatPercent: number
}

export type OrderListItem = {
  saleId: string
  number: number
  customerName: string | null
  occurredAt: string
  promisedDate: string
  status: OrderStatus
  isLate: boolean
  totalUsd: number
  balanceUsd: number
  canStart: boolean
  itemsSummary: string
}

export type Assignee = { kind: "member" | "workshop"; id: string; name: string }

export type OrderLineCustomization = {
  id: string
  typeName: string
  quantity: number
  text: string | null
  names: string[]
  position: string | null
  sizeCm: number | null
  note: string | null
  hasLogo: boolean
  lineTotalUsd: number
}

export type OrderLine = {
  id: string
  parentId: string | null
  productName: string
  variantLabel: string
  sku: string
  quantity: number
  reservedQuantity: number
  isCombo: boolean
  stage: ProductionStage | null
  nextStage: ProductionStage | null
  lineTotalUsd: number
  unitPriceUsd: number
  customizations: OrderLineCustomization[]
  // Asignación de la etapa actual, si la hay.
  assignee: (Assignee & { expectedDate: string | null; isLate: boolean }) | null
}

export type OrderDetail = {
  saleId: string
  number: number
  status: OrderStatus
  isLate: boolean
  occurredAt: string
  promisedDate: string
  stockMode: OrderStockMode
  customer: { id: string; name: string; phone: string | null } | null
  totalUsd: number
  // IVA incluido en el total (null si el pedido no lleva IVA).
  vat: { percent: number; usd: number } | null
  paidUsd: number
  balanceUsd: number
  depositRequiredUsd: number
  canStart: boolean
  overrides: { kind: string; reason: string; byName: string | null }[]
  cancellation: { reason: string; deductionUsdt: number; refundedUsdt: number; at: string } | null
  deliveredAt: string | null
  lines: OrderLine[]
  dateChanges: { previous: string; next: string; reason: string | null; at: string }[]
  // Presupuesto del que salió (si se convirtió de uno).
  fromQuote: { id: string; code: string } | null
}

export type ProductionCard = {
  saleItemId: string
  saleId: string
  number: number
  customerName: string | null
  productName: string
  variantLabel: string
  pieces: number
  stage: ProductionStage
  nextStage: ProductionStage | null
  promisedDate: string
  orderLate: boolean
  assignee: (Assignee & { expectedDate: string | null; isLate: boolean }) | null
  hasCustomization: boolean
}

export type MaterialRequirement = {
  rawVariantId: string | null
  sku: string | null
  materialName: string
  colorName: string | null
  unit: string
  required: number
  available: number
  shortage: number
  lines: number
}

export type PieceRate = {
  id: string
  categoryName: string
  categoryId: string
  stage: ProductionStage
  rateUsd: number
  effectiveFrom: string
}

export type BusinessRule = {
  id: string
  title: string
  body: string
  enforcedBySystem: boolean
  isActive: boolean
  sortOrder: number
  updatedAt: string
}
