import Link from "next/link"

import SignedAmount from "@/common/components/signed-amount"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"

import type { ProductSalesMargin } from "../lib/types/analytics.types"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const percent = new Intl.NumberFormat("es-VE", { style: "percent", maximumFractionDigits: 1 })

// Margen por producto vendido en el período (sin ventas anuladas).
const ProductMarginTable = ({ rows }: { rows: ProductSalesMargin[] }) => {
  const total = rows.reduce((sum, r) => sum + r.marginUsdt, 0)
  const withoutCost = rows.filter((r) => r.linesWithoutCost > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Margen por producto</CardTitle>
        <CardDescription>
          Ingreso real (con descuento y la tasa de cada venta) menos materiales y mano de obra. Margen total{" "}
          {formatUsdt(total)}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {withoutCost.length > 0 && (
          <StatusBadge tone="warning" className="w-fit">
            {withoutCost.length} {withoutCost.length === 1 ? "producto tiene" : "productos tienen"} ventas sin costo registrado: su margen está inflado
          </StatusBadge>
        )}
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin ventas en el período.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="w-full min-w-[36rem] text-sm tabular-nums">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Producto</th>
                  <th className="py-2 text-right font-medium">Vendido</th>
                  <th className="py-2 text-right font-medium">Ingreso real</th>
                  <th className="py-2 text-right font-medium">Costo</th>
                  <th className="py-2 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId} className="border-b last:border-0">
                    <td className="py-2">
                      <Link href={ROUTES.PRODUCT(r.productId)} className="underline-offset-4 hover:underline">
                        {r.productName}
                      </Link>
                      {r.linesWithoutCost > 0 && <span className="block text-xs text-muted-foreground">Sin costo en {r.linesWithoutCost} línea(s)</span>}
                    </td>
                    <td className="py-2 text-right">
                      {quantityFormat.format(r.units)}
                      <span className="block text-xs text-muted-foreground">{formatMoney(r.revenueUsd, "USD")}</span>
                    </td>
                    <td className="py-2 text-right">{formatUsdt(r.revenueUsdt)}</td>
                    <td className="py-2 text-right">
                      {formatUsdt(r.materialCostUsdt + r.laborCostUsdt)}
                      {r.laborCostUsdt > 0 && <span className="block text-xs text-muted-foreground">mano de obra {formatUsdt(r.laborCostUsdt)}</span>}
                    </td>
                    <td className="py-2 text-right font-medium">
                      <SignedAmount value={r.marginUsdt} className="justify-end" />
                      {r.revenueUsdt > 0 && (
                        <span className="block text-xs font-normal text-muted-foreground">{percent.format(r.marginUsdt / r.revenueUsdt)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ProductMarginTable
