import StatusBadge from "@/common/components/status-badge"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"

import type { ProductMarginRow } from "../lib/types/products.types"

// Margen real por variante y método: precio convertido a valor real (USDT) menos costo
// de materiales (promedio ponderado o receta) y mano de obra por unidad.
const MarginTable = ({ rows }: { rows: ProductMarginRow[] }) => {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Carga precios para ver el margen.</p>
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[34rem] text-sm tabular-nums">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 font-medium">Variante · método</th>
            <th className="py-2 text-right font-medium">Precio</th>
            <th className="py-2 text-right font-medium">Valor real</th>
            <th className="py-2 text-right font-medium">Costo</th>
            <th className="py-2 text-right font-medium">Margen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.variantId}-${row.methodName}`} className="border-b last:border-0">
              <td className="py-2">
                <code className="font-mono text-xs">{row.sku}</code>
                <span className="block text-xs text-muted-foreground">{row.methodName}</span>
              </td>
              <td className="py-2 text-right">{formatMoney(row.priceUsd, "USD")}</td>
              <td className="py-2 text-right">{formatUsdt(row.priceUsdt)}</td>
              <td className="py-2 text-right">
                {row.materialCostUsdt === null ? (
                  <StatusBadge tone="warning">Sin costo</StatusBadge>
                ) : (
                  <>
                    {formatUsdt(row.materialCostUsdt + row.laborCostUsdt)}
                    <span className="block text-xs text-muted-foreground">
                      {row.costSource === "recipe" ? "estimado (receta)" : "promedio"}
                      {row.laborCostUsdt > 0 && " + mano de obra"}
                    </span>
                  </>
                )}
              </td>
              <td className="py-2 text-right font-medium">
                {row.marginUsdt === null ? (
                  "—"
                ) : (
                  <>
                    {formatUsdt(row.marginUsdt, { signed: true })}
                    <span className="block text-xs font-normal text-muted-foreground">{row.marginPercent}%</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default MarginTable
