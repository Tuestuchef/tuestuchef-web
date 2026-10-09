import type { Tables } from "@/common/lib/db/database.types"

import type {
  FulfillmentType,
  ProductClosure,
  ProductFit,
  ProductGender,
  ProductKind,
  ProductUnit,
  StockMovementType,
} from "../constants/products.constants"

// Listas editables con la misma forma: categorías de producto, tallas y colores.
// Recargo por talla (p. ej. 3XL) o por color (p. ej. pata de gallo): se suma al precio del producto.
export type SurchargeKind = "size" | "color"

// Producto que puede llevar recargo (terminado y activo).
export type SurchargeProduct = { id: string; name: string; categoryName: string }

// Recargos de un producto, para mostrarlos en su página.
export type ProductSurcharges = {
  sizes: { name: string; amountUsd: number }[]
  colors: { name: string; amountUsd: number }[]
}

// Recargo de una talla para un género (null = todos los géneros), en USD.
export type SizeSurchargeRow = { sizeId: string; gender: ProductGender | null; amountUsd: number }

export type CatalogKind = "product_categories" | "sizes" | "colors"
export type CatalogItem = Tables<"sizes">

export type Product = Tables<"products">
export type ProductImage = Tables<"product_images"> & { url: string | null }

export type ProductListItem = {
  id: string
  kind: ProductKind
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
  gender: ProductGender | null
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

// Componente de un combo: cuántas piezas lleva cada combo y qué productos acepta (se elige uno al vender).
export type ComboComponent = {
  id: string
  label: string | null
  quantity: number
  products: { id: string; name: string; variantCount: number }[]
}

export type ComboComponentOption = { id: string; name: string }

export type ProductAttributes = {
  genders: ProductGender[]
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
  gender: ProductGender | null
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
  // Combos: "components" (promedio simple) o "sales_mix" (por lo que más se vende en 90 días).
  costSource: "average" | "recipe" | "components" | "sales_mix" | null
  // Solo combos: costo total con el producto más barato y el más caro de cada componente.
  costMinUsdt: number | null
  costMaxUsdt: number | null
}
