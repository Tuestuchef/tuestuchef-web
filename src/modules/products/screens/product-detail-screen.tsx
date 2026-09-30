import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import { listPaymentMethods } from "@/modules/treasury/lib/services/payment-methods.service"

import PriceGrid from "../components/price-grid"
import ProductFormDialog from "../components/product-form-dialog"
import ProductImageManager from "../components/product-image-manager"
import StockMovementList from "../components/stock-movement-list"
import VariantCombinationsDialog from "../components/variant-combinations-dialog"
import VariantFormDialog from "../components/variant-form-dialog"
import VariantTable from "../components/variant-table"
import {
  CLOSURE_LABELS,
  FIT_LABELS,
  FULFILLMENT_LABELS,
  GENDER_LABELS,
} from "../lib/constants/products.constants"
import { listCatalog } from "../lib/services/catalog.service"
import { getProductDetail } from "../lib/services/products.service"
import { listStockMovements } from "../lib/services/stock.service"

const ProductDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [detail, categories, colors, sizes, methods, movements] = await Promise.all([
    getProductDetail(id),
    listCatalog("product_categories"),
    listCatalog("colors"),
    listCatalog("sizes"),
    listPaymentMethods(),
    listStockMovements({ productId: id, limit: 15 }),
  ])
  if (!detail) notFound()

  const { product, variants, prices, images } = detail
  const madeToOrder = product.fulfillment_type === "made_to_order"
  const attributes = [
    product.gender && GENDER_LABELS[product.gender],
    product.closure && CLOSURE_LABELS[product.closure],
    product.fit && FIT_LABELS[product.fit],
  ].filter(Boolean)
  // Métodos activos, y los inactivos que aún tengan precio (para poder quitarlo).
  const priceMethods = methods.filter((m) => m.is_active || m.id in prices).map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.PRODUCTS}>
          <ChevronLeftIcon aria-hidden />
          Productos
        </Link>
      </Button>
      <PageHeader
        className="pt-0"
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>{product.categoryName}</span>
            {attributes.length > 0 && <span>· {attributes.join(" · ")}</span>}
            <span>· {FULFILLMENT_LABELS[product.fulfillment_type]}</span>
            {!product.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
          </span>
        }
        actions={canManage && <ProductFormDialog categories={categories} product={product} />}
      />
      {product.description && <p className="text-sm">{product.description}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Variantes</CardTitle>
          <CardDescription>Color × talla, con su SKU y existencia.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <VariantTable
            productId={product.id}
            variants={variants}
            colors={colors}
            sizes={sizes}
            canManage={canManage}
            madeToOrder={madeToOrder}
          />
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <VariantCombinationsDialog productId={product.id} colors={colors} sizes={sizes} />
              <VariantFormDialog productId={product.id} colors={colors} sizes={sizes} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Precios</CardTitle>
          <CardDescription>En USD de referencia. El monto en Bs se calcula al vender con la tasa BCV del día.</CardDescription>
        </CardHeader>
        <CardContent>
          <PriceGrid productId={product.id} methods={priceMethods} prices={prices} canManage={canManage} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fotos</CardTitle>
          <CardDescription>La principal se muestra en la lista. Cada foto puede ir asociada a un color.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProductImageManager
            productId={product.id}
            images={images}
            colors={colors}
            canManage={canManage}
            enabled={isStorageEnabled()}
          />
        </CardContent>
      </Card>

      {!madeToOrder && (
        <Card>
          <CardHeader>
            <CardTitle>Últimos movimientos de stock</CardTitle>
          </CardHeader>
          <CardContent>
            <StockMovementList movements={movements} showProduct={false} showAuthor={canManage} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ProductDetailScreen
