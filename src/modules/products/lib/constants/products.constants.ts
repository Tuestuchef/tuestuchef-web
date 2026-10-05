import type { Enums } from "@/common/lib/db/database.types"

export type FulfillmentType = Enums<"fulfillment_type">
export type ProductGender = Enums<"product_gender">
export type ProductClosure = Enums<"product_closure">
export type ProductFit = Enums<"product_fit">
export type ProductUnit = Enums<"product_unit">
export type ProductKind = Enums<"product_kind">
export type StockMovementType = Enums<"stock_movement_type">

export const FULFILLMENT_LABELS: Record<FulfillmentType, string> = {
  stock: "Despacho inmediato",
  made_to_order: "Bajo pedido",
  both: "Inmediato y bajo pedido",
}

export const GENDER_LABELS: Record<ProductGender, string> = { women: "Dama", men: "Caballero", unisex: "Unisex" }
export const CLOSURE_LABELS: Record<ProductClosure, string> = { snap: "Broche", zipper: "Cierre", buttons: "Botones" }
export const FIT_LABELS: Record<ProductFit, string> = { jogger: "Jogger", straight: "Recto" }
export const UNIT_LABELS: Record<ProductUnit, string> = { unit: "Unidad", meter: "Metro", kg: "Kilo" }

// Códigos para el SKU (CAT-GÉNERO-CIERRE/CORTE-COLOR-TALLA).
export const GENDER_CODES: Record<ProductGender, string> = { women: "D", men: "C", unisex: "U" }
export const CLOSURE_CODES: Record<ProductClosure, string> = { snap: "BR", zipper: "CI", buttons: "BO" }
export const FIT_CODES: Record<ProductFit, string> = { jogger: "JG", straight: "RE" }

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  initial_count: "Carga inicial",
  purchase: "Compra",
  production: "Producción",
  adjustment: "Ajuste",
  sale: "Venta",
  sale_reversal: "Devolución",
  purchase_reversal: "Compra anulada",
  consumption: "Consumo en producción",
}

// Lo que cada rol puede registrar a mano. Las compras vienen del módulo de compras
// (con proveedor) y las ventas del módulo de ventas.
export const STAFF_MOVEMENT_TYPES: readonly StockMovementType[] = ["production"]
export const MANAGEMENT_MOVEMENT_TYPES: readonly StockMovementType[] = ["production", "adjustment"]

// Fotos de producto (bucket público).
export const PRODUCT_IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const
export type ProductImageType = keyof typeof PRODUCT_IMAGE_TYPES
export const PRODUCT_IMAGE_ACCEPT = Object.keys(PRODUCT_IMAGE_TYPES).join(",")
export const PRODUCT_IMAGE_MAX_BYTES = 8 * 1024 * 1024

export const PRODUCT_MESSAGES = {
  PRODUCT_SAVED: "Producto guardado.",
  VARIANT_SAVED: "Variante guardada.",
  PRICES_SAVED: "Precios guardados.",
  MOVEMENT_SAVED: "Movimiento de stock registrado.",
  CATALOG_SAVED: "Guardado.",
  IMAGE_SAVED: "Foto guardada.",
  IMAGE_DELETED: "Foto eliminada.",
  RECIPE_SAVED: "Receta actualizada.",
  COMBO_SAVED: "Combo actualizado.",
  INITIAL_STOCK_LOADED: (count: number) => `Carga inicial lista: ${count} variantes.`,
} as const
