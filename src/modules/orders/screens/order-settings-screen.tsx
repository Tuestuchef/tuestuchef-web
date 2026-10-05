import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import CustomizationTypeDialog from "../components/customization-type-dialog"
import OrderSettingsForm from "../components/order-settings-form"
import VolumeTiersEditor from "../components/volume-tiers-editor"
import { listCustomizationTypes, listVolumeTiers } from "../lib/services/order-settings.service"
import { getOrderSettings } from "../lib/services/orders.service"

const number = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 })

// Precios de personalización y descuento al mayor (owner y admin).
const OrderSettingsScreen = async () => {
  const [types, tiers, settings] = await Promise.all([listCustomizationTypes(), listVolumeTiers(), getOrderSettings()])

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="orderSettings"
        title="Pedidos y personalización"
        description="Abono, fecha prometida, precios de bordados y logos, y el descuento al mayor."
      />

      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardDescription>Cuánto se cobra para empezar a producir y en cuántos días se promete por defecto.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrderSettingsForm settings={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personalización</CardTitle>
          <CardDescription>Precio por unidad en USD de referencia y mínimo de piezas por pedido.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {types.map((type) => (
              <li key={type.id} className="flex items-start gap-3 py-2.5">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {type.name}
                    {!type.isActive && <StatusBadge tone="info">Inactiva</StatusBadge>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {type.unitPriceUsd === null ? "Sin precio: no se puede usar todavía" : `${formatMoney(type.unitPriceUsd, "USD")} c/u`}
                    {` · desde ${type.minQuantity} ${type.minQuantity === 1 ? "pieza" : "piezas"}`}
                    {type.maxSizeCm !== null && ` · hasta ${number.format(type.maxSizeCm)} cm`}
                    {type.maxSizeCm === null && type.defaultSizeCm !== null && ` · aprox. ${number.format(type.defaultSizeCm)} cm`}
                  </span>
                  {type.description && <span className="text-xs text-muted-foreground">{type.description}</span>}
                </div>
                {type.unitPriceUsd === null && type.isActive && <StatusBadge tone="warning">Falta precio</StatusBadge>}
                <CustomizationTypeDialog type={type} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Descuento al mayor</CardTitle>
          <CardDescription>
            Se aplica solo, según las piezas, aparte del descuento manual. Cuenta el tramo más alto alcanzado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <VolumeTiersEditor scope="products" tiers={tiers.filter((t) => t.scope === "products")} />
          <VolumeTiersEditor scope="customization" tiers={tiers.filter((t) => t.scope === "customization")} />
        </CardContent>
      </Card>
    </div>
  )
}

export default OrderSettingsScreen
