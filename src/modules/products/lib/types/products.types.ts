import type { Tables } from "@/common/lib/db/database.types"

import type {
  FulfillmentType,
  ProductClosure,
  ProductFit,
  ProductGender,
  ProductUnit,
  StockMovementType,
} from "../constants/products.constants"

// Listas editables con la misma forma: categorías de producto, tallas y colores.
export type CatalogKind = "product_categories" | "sizes" | "colors"
export type CatalogItem = Tables<"sizes">

export type Product = Tables<"products">
export type ProductImage = Tables<"product_images"> & { url: string | null }

export type ProductListItem = {
  id: string
  name: string
  categoryName: string
  fulfillmentType: FulfillmentType
  isActive: boolean
  imageUrl: string | null
  variantCount: number
  totalStock: number
  lowStockCount: number
  priceFromUsd: number | null
}

export type VariantWithStock = {
  id: string
  sku: string
  colorId: string | null
  colorName: string | null
  sizeId: string | null
  sizeName: string | null
  unitCostUsdt: number | null
  minStock: number
  isActive: boolean
  quantity: number
  isLow: boolean
  hasMovements: boolean
}

export type ProductDetail = {
  product: Product & { categoryName: string; categoryCode: string }
  variants: VariantWithStock[]
  prices: Record<string, number>
  images: ProductImage[]
}

export type ProductAttributes = {
  gender: ProductGender | null
  closure: ProductClosure | null
  fit: ProductFit | null
}

export type StockMovementItem = {
  id: string
  occurredAt: string
  movementType: StockMovementType
  quantity: number
  unitCostUsdt: number | null
  note: string | null
  sku: string
  productName: string
  authorName: string | null
}

// Variante elegible para registrar stock (buscador).
export type StockVariantOption = {
  id: string
  sku: string
  label: string
  quantity: number
  isRawMaterial: boolean
  // Producción: con receta el costo se calcula solo.
  hasRecipe: boolean
}

export type InitialStockPreviewRow = {
  line: number
  sku: string
  quantity: number
  unitCostUsdt: number | null
  productName: string | null
  variantLabel: string | null
  error: string | null
}

export type RecipeLine = {
  id: string
  // Variante o producto de materia prima (para agrupar sus cantidades por talla).
  materialKey: string
  materialLabel: string
  unit: ProductUnit
  sizeName: string | null
  quantity: number
}

export type MaterialOption = {
  // "variant:<id>" (material específico) o "product:<id>" (mismo color que la prenda).
  value: string
  label: string
  unit: ProductUnit
}

export type ProductMarginRow = {
  variantId: string
  sku: string
  methodName: string
  priceUsd: number
  priceUsdt: number
  materialCostUsdt: number | null
  laborCostUsdt: number
  marginUsdt: number | null
  marginPercent: number | null
  costSource: "average" | "recipe" | null
}
