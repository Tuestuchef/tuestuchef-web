import type { Enums } from "@/common/lib/db/database.types"

export type SaleChannel = Enums<"sale_channel">
export type DeliveryMethod = Enums<"delivery_method">
export type SaleLineSource = Enums<"sale_line_source">
export type SaleItemStatus = Enums<"sale_item_status">
export type DiscountType = Enums<"discount_type">
export type PaymentRateKind = Enums<"payment_rate_kind">
export type PaymentStatus = "pending" | "partial" | "paid" | "voided"

export const CHANNEL_LABELS: Record<SaleChannel, string> = {
  in_person: "En tienda",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  online_store: "Tienda online",
}

// La tienda online registra sus ventas sola (Fase 3).
export const MANUAL_CHANNELS: readonly SaleChannel[] = ["in_person", "whatsapp", "instagram"]

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  pickup: "Retira",
  delivery: "Delivery",
  national_shipping: "Envío nacional",
}

export const DELIVERY_METHODS: readonly DeliveryMethod[] = ["pickup", "delivery", "national_shipping"]

// Delivery y envío nacional pueden llevar cobro aparte; retiro no.
export const chargesShipping = (method: DeliveryMethod) => method !== "pickup"

// Cómo se llama ese cobro en la venta, la nota y el mensaje.
export const SHIPPING_FEE_LABELS: Record<DeliveryMethod, string> = {
  pickup: "Delivery",
  delivery: "Delivery",
  national_shipping: "Envío",
}

export const SOURCE_LABELS: Record<SaleLineSource, string> = {
  stock: "Inventario",
  made_to_order: "Por encargo",
  combo: "Combo",
}

export const ITEM_STATUS_LABELS: Record<SaleItemStatus, string> = {
  to_produce: "Por producir",
  cutting: "Corte",
  sewing: "Confección",
  customization: "Personalización",
  quality_check: "Revisión",
  packing: "Empaque",
  ready: "Listo para entregar",
  delivered: "Entregado",
}

// Venta normal (sin pedido): flujo corto. Los pedidos usan todas las etapas.
export const ITEM_STATUS_ORDER: readonly SaleItemStatus[] = ["to_produce", "sewing", "ready", "delivered"]

// Línea de inventario: solo falta entregarla.
export const STOCK_ITEM_STATUS_ORDER: readonly SaleItemStatus[] = ["ready", "delivered"]

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Por cobrar",
  partial: "Abono",
  paid: "Pagada",
  voided: "Anulada",
}

// Margen de redondeo al convertir a Bs (igual que en la base).
export const BALANCE_TOLERANCE_USD = 0.01

// Canal usado la última vez en este dispositivo.
export const LAST_CHANNEL_STORAGE_KEY = "tuestuchef:last-sale-channel"

export const formatSaleNumber = (number: number) => `NE-${String(number).padStart(6, "0")}`

export const SALES_MESSAGES = {
  CREATED: "Venta registrada.",
  PAYMENT_SAVED: "Pago registrado.",
  VOIDED: "Venta anulada.",
  EDITED: "Venta actualizada.",
  PAYMENT_CORRECTED: "Pago corregido.",
  PAYMENT_REMOVED: "Pago quitado: la venta queda por cobrar.",
  STATUS_SAVED: "Estado actualizado.",
  SETTINGS_SAVED: "Configuración guardada.",
  EMPTY_CART: "Agrega al menos un producto.",
  NO_PRICE: (product: string, method: string) =>
    `"${product}" no tiene precio para ${method}. Pide a owner o admin que lo cargue.`,
} as const

// Calculadora de precios: la lista se guarda solo en este navegador mientras está abierto.
export const PRICE_CALCULATOR_STORAGE_KEY = "tuestuchef:price-calculator"

export const PRICE_CALCULATOR_MESSAGES = {
  COPIED: "Copiado. Pégalo en WhatsApp.",
  COPY_FAILED: "No se pudo copiar. Selecciona el texto y cópialo a mano.",
}
