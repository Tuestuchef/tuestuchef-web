import StatusBadge from "@/common/components/status-badge"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import { GENDER_LABELS, type ProductGender } from "../lib/constants/products.constants"
import type { CatalogItem, VariantWithStock } from "../lib/types/products.types"
import StockBadge from "./stock-badge"
import VariantFormDialog from "./variant-form-dialog"

type VariantTableProps = {
  productId: string
  genders: ProductGender[]
  variants: VariantWithStock[]
  colors: CatalogItem[]
  sizes: CatalogItem[]
  canManage: boolean
  madeToOrder: boolean
}

// Lista de variantes: en el celular cada una es una fila compacta (SKU arriba, stock a la derecha).
const VariantTable = ({ productId, genders, variants, colors, sizes, canManage, madeToOrder }: VariantTableProps) => {
  if (variants.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no tiene variantes. Crea las combinaciones de color y talla.</p>
  }

  return (
    <ul className="divide-y">
      {variants.map((variant) => (
        <li key={variant.id} className="flex items-center gap-3 py-2.5">
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-sm font-medium">
              {[variant.gender && GENDER_LABELS[variant.gender], variant.colorName, variant.sizeName].filter(Boolean).join(" · ") || "Única"}
            </span>
            <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <code className="font-mono">{variant.sku}</code>
              {variant.unitCostUsdt !== null && <span>Costo {formatUsdt(variant.unitCostUsdt)}</span>}
              {variant.minStock > 0 && <span>Mín. {variant.minStock}</span>}
            </span>
          </div>
          {!variant.isActive && <StatusBadge tone="info">Inactiva</StatusBadge>}
          <StockBadge quantity={variant.quantity} isLow={variant.isLow} madeToOrder={madeToOrder} />
          {canManage && <VariantFormDialog productId={productId} genders={genders} colors={colors} sizes={sizes} variant={variant} />}
        </li>
      ))}
    </ul>
  )
}

export default VariantTable
