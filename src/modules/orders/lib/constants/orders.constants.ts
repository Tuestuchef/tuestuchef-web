import type { Enums } from "@/common/lib/db/database.types"

export type VolumeDiscountScope = Enums<"volume_discount_scope">
export type OrderStockMode = Enums<"order_stock_mode">
export type ProductionStage = Enums<"sale_item_status">
export type OrderStatus = "waiting" | "in_production" | "ready" | "delivered" | "cancelled"

export const VOLUME_SCOPE_LABELS: Record<VolumeDiscountScope, { title: string; description: string }> = {
  products: {
    title: "Productos",
    description: "Cuenta todas las piezas de la venta o el pedido (un combo cuenta por sus componentes).",
  },
  customization: {
    title: "Personalización",
    description: "Cuenta las piezas de cada tipo de personalización del pedido.",
  },
}

export const STOCK_MODE_LABELS: Record<OrderStockMode, { title: string; description: string }> = {
  reserve_and_produce: {
    title: "Reservar y producir lo que falta",
    description: "Aparta lo que hay en inventario y produce solo el resto.",
  },
  produce_all: {
    title: "Producir todo desde cero",
    description: "No toca el inventario: todas las piezas salen de la misma tela.",
  },
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  waiting: "Por empezar",
  in_production: "En producción",
  ready: "Listo para entregar",
  delivered: "Entregado",
  cancelled: "Cancelado",
}

// Etapas que se asignan a una persona o a un taller.
export const ASSIGNABLE_STAGES: readonly ProductionStage[] = ["cutting", "sewing", "customization", "quality_check", "packing"]

// Columnas del tablero de producción.
export const BOARD_STAGES: readonly ProductionStage[] = ["to_produce", "cutting", "sewing", "customization", "quality_check", "packing"]

export const ORDER_MESSAGES = {
  CUSTOMIZATION_SAVED: "Personalización guardada.",
  TIER_SAVED: "Tramo agregado.",
  TIER_DUPLICATE: "Ya hay un tramo desde esa cantidad: quítalo y agrégalo de nuevo para cambiarlo.",
  SETTINGS_SAVED: "Reglas de pedidos guardadas.",
  ORDER_CREATED: "Pedido registrado.",
  STAGE_ADVANCED: "Etapa actualizada.",
  ASSIGNED: "Etapa asignada.",
  DELIVERED: "Pedido entregado.",
  CANCELLED: "Pedido cancelado.",
  DATE_CHANGED: "Fecha prometida actualizada.",
  OVERRIDE_SAVED: "Autorizado para producir sin el abono completo.",
  RATE_SAVED: "Tarifa guardada.",
  RULE_SAVED: "Regla guardada.",
  PIECEWORK_PAID: "Pago a destajo registrado.",
} as const
