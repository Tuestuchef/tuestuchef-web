import { ImageIcon } from "lucide-react"
import Link from "next/link"

import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import type { ProductListItem } from "../lib/types/products.types"
import StockBadge from "./stock-badge"

const ProductList = ({ products }: { products: ProductListItem[] }) => {
  if (products.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No hay productos con estos filtros.</p>
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <li key={product.id}>
          <Link
            href={ROUTES.PRODUCT(product.id)}
            className="flex gap-3 rounded-xl border bg-card p-3 transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- fotos del bucket público (dominio configurable)
                <img src={product.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" aria-hidden />
              )}
            </div>
            <div className="grid min-w-0 flex-1 content-start gap-1">
              <span className="line-clamp-2 font-medium leading-snug">{product.name}</span>
              <span className="text-xs text-muted-foreground">
                {product.categoryName} · {product.variantCount} variantes
                {product.priceFromUsd !== null && <> · desde {formatMoney(product.priceFromUsd, "USD")}</>}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <StockBadge
                  quantity={product.totalStock}
                  isLow={false}
                  madeToOrder={product.fulfillmentType === "made_to_order"}
                />
                {product.lowStockCount > 0 && (
                  <StatusBadge tone="warning">
                    {product.lowStockCount} {product.lowStockCount === 1 ? "variante baja" : "variantes bajas"}
                  </StatusBadge>
                )}
                {!product.isActive && <StatusBadge tone="info">Inactivo</StatusBadge>}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default ProductList
