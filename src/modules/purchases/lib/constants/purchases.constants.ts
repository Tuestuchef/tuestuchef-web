import type { Enums } from "@/common/lib/db/database.types"

export type SupplierRateKind = Enums<"supplier_rate_kind">
export type PurchaseLineType = Enums<"purchase_line_type">
export type PurchaseStatus = "pending" | "partial" | "paid" | "voided"

// Pagos en Bs a proveedores: el valor real siempre se calcula con Binance.
export const SUPPLIER_RATE_LABELS: Record<SupplierRateKind, string> = {
  bcv_usd: "Tasa BCV",
  parallel: "Tasa paralela",
  none: "Sin conversión",
}

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  pending: "Por pagar",
  partial: "Abono",
  paid: "Pagada",
  voided: "Anulada",
}

// Categorías de dinero que acepta una línea de compra.
export const PURCHASE_CATEGORY_TYPES = ["cost", "operating_expense", "reinvestment", "tax"] as const

export const formatPurchaseNumber = (number: number) => `C-${String(number).padStart(6, "0")}`

export const PURCHASE_MESSAGES = {
  CREATED: "Compra registrada.",
  PAYMENT_SAVED: "Pago registrado.",
  VOIDED: "Compra anulada.",
  SUPPLIER_SAVED: "Proveedor guardado.",
  EMPTY: "Agrega al menos una línea.",
  STAFF_MUST_PAY: "Staff registra solo compras pagadas completas en el momento.",
} as const
