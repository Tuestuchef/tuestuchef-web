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
import { formatUsdt } from "@/common/lib/utils/format-money.util"
import { listPaymentMethods } from "@/modules/treasury/lib/services/payment-methods.service"

import ComboComponentsEditor from "../components/combo-components-editor"
import PriceGrid from "../components/price-grid"
import ProductFormDialog from "../components/product-form-dialog"
import MarginTable from "../components/margin-table"
import ProductImageManager from "../components/product-image-manager"
import RecipeEditor from "../components/recipe-editor"
import StockMovementList from "../components/stock-movement-list"
import VariantCombinationsDialog from "../components/variant-combinations-dialog"
import VariantFormDialog from "../components/variant-form-dialog"
import VariantTable from "../components/variant-table"
import {
  CLOSURE_LABELS,
  FIT_LABELS,
  FULFILLMENT_LABELS,
  GENDER_LABELS,
  UNIT_LABELS,
} from "../lib/constants/products.constants"
import { listCatalog } from "../lib/services/catalog.service"
import { listComboComponentOptions, listComboComponents } from "../lib/services/combos.service"
import { getProductDetail } from "../lib/services/products.service"
import { listMaterialOptions, listProductMargins, listRecipe } from "../lib/services/recipes.service"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { listProductSurcharges } from "../lib/services/surcharges.service"
import { listStockMovements } from "../lib/services/stock.service"

const ProductDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [detail, categories, colors, sizes, methods, movements, recipe, materials, margins, surcharges] = await Promise.all([
    getProductDetail(id),
    listCatalog("product_categories"),
    listCatalog("colors"),
    listCatalog("sizes"),
    listPaymentMethods(),
    listStockMovements({ productId: id, limit: 15 }),
    listRecipe(id),
    canManage ? listMaterialOptions() : Promise.resolve([]),
    // Márgenes: solo owner y admin (la función devuelve 0 filas a staff).
    canManage ? listProductMargins(id) : Promise.resolve([]),
    listProductSurcharges(id),
  ])
  if (!detail) notFound()

  const { product, variants, prices, images } = detail
  const isRaw = product.kind === "raw_material"
  const isCombo = product.kind === "combo"
  // Un combo no lleva stock propio: el stock es de cada componente.
  const madeToOrder = product.fulfillment_type === "made_to_order" || isCombo
  const [components, componentOptions] = isCombo
    ? await Promise.all([listComboComponents(id), canManage ? listComboComponentOptions() : Promise.resolve([])])
    : [[], []]
  const backTo = isRaw
    ? { url: ROUTES.RAW_MATERIALS, label: "Materia prima" }
    : isCombo
      ? { url: ROUTES.COMBOS, label: "Combos" }
      : { url: ROUTES.PRODUCTS, label: "Productos" }
  const attributes = [
    product.model_code && `Modelo ${product.model_code}`,
    product.gender && GENDER_LABELS[product.gender],
    product.closure && CLOSURE_LABELS[product.closure],
    product.fit && FIT_LABELS[product.fit],
  ].filter(Boolean)
  // Métodos activos, y los inactivos que aún tengan precio (para poder quitarlo).
  const priceMethods = methods.filter((m) => m.is_active || m.id in prices).map((m) => ({ id: m.id, name: m.name }))

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={backTo.url}>
          <ChevronLeftIcon aria-hidden />
          {backTo.label}
        </Link>
      </Button>
      <PageHeader
        help={isCombo ? "combo" : "product"}
        className="pt-0"
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span>{product.categoryName}</span>
            {attributes.length > 0 && <span>· {attributes.join(" · ")}</span>}
            <span>
              ·{" "}
              {isRaw
                ? `Materia prima · por ${UNIT_LABELS[product.unit].toLowerCase()}`
                : isCombo
                  ? "Combo"
                  : FULFILLMENT_LABELS[product.fulfillment_type]}
            </span>
            {!product.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
          </span>
        }
        actions={canManage && <ProductFormDialog categories={categories} product={product} />}
      />
      {product.description && <p className="text-sm">{product.description}</p>}

      {isCombo ? (
        <Card>
          <CardHeader>
            <CardTitle>Componentes</CardTitle>
            <CardDescription>
              Lo que trae cada combo. Un componente puede aceptar varios productos: al vender se elige el modelo, la talla y
              el color de cada pieza, y el stock se descuenta de cada una.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ComboComponentsEditor comboId={product.id} components={components} options={componentOptions} canManage={canManage} />
          </CardContent>
        </Card>
      ) : (
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
      )}

      {!isRaw && (
        <Card>
          <CardHeader>
            <CardTitle>Precios</CardTitle>
            <CardDescription>
              En USD de referencia. El monto en Bs se calcula al vender con la tasa BCV del día.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PriceGrid productId={product.id} methods={priceMethods} prices={prices} canManage={canManage} />
            {(surcharges.sizes.length > 0 || surcharges.colors.length > 0) && (
              <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
                {surcharges.sizes.length > 0 && (
                  <p>
                    <span className="font-medium text-foreground">Recargo por talla:</span>{" "}
                    {surcharges.sizes.map((s) => `${s.name} +${formatMoney(s.amountUsd, "USD")}`).join(" · ")}
                  </p>
                )}
                {surcharges.colors.length > 0 && (
                  <p>
                    <span className="font-medium text-foreground">Recargo por color:</span>{" "}
                    {surcharges.colors.map((s) => `${s.name} +${formatMoney(s.amountUsd, "USD")}`).join(" · ")}
                  </p>
                )}
                <p className="text-xs">Se suman al precio en todos los métodos (talla y color, si la variante tiene los dos). Se cambian en Configuración → Tallas y Colores.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!isRaw && !isCombo && (
        <Card>
          <CardHeader>
            <CardTitle>Receta</CardTitle>
            <CardDescription>
              Materia prima por prenda. Al producir se descuenta del inventario y define el costo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecipeEditor productId={product.id} lines={recipe} materials={materials} sizes={sizes} canManage={canManage} />
          </CardContent>
        </Card>
      )}

      {!isRaw && canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Margen</CardTitle>
            <CardDescription>
              {isCombo
                ? "Precio en valor real (con las tasas de hoy) menos el costo y la mano de obra de sus componentes."
                : `Precio en valor real (con las tasas de hoy) menos materiales y mano de obra${
                    product.labor_cost_usdt > 0 ? ` (${formatUsdt(product.labor_cost_usdt)} por unidad)` : ""
                  }.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MarginTable rows={margins} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Fotos</CardTitle>
          <CardDescription>
            La principal se muestra en la lista. Cada foto puede ir asociada a un color.
          </CardDescription>
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
