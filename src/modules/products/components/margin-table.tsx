import ExpandableList from "@/common/components/expandable-list";
import StatusBadge from "@/common/components/status-badge";
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util";

import type { ProductMarginRow } from "../lib/types/products.types";

const COST_SOURCE: Record<
  NonNullable<ProductMarginRow["costSource"]>,
  string
> = {
  average: "promedio",
  recipe: "estimado (receta)",
  components: "promedio de sus productos",
  sales_mix: "típico (lo que más se vende)",
};

// Margen % con otro costo (para el rango de un combo).
const marginPercentWith = (row: ProductMarginRow, cost: number) =>
  row.priceUsdt === 0
    ? null
    : Math.round(((row.priceUsdt - cost) / row.priceUsdt) * 100);

// Margen real por variante y método: precio convertido a valor real (USDT) menos costo
// de materiales (promedio ponderado o receta) y mano de obra por unidad. En un combo, el costo
// típico y el rango del producto más barato al más caro de cada componente.
const MarginTable = ({ rows }: { rows: ProductMarginRow[] }) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Carga precios para ver el margen.
      </p>
    );
  }

  return (
    <ExpandableList total={rows.length} noun="filas">
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
              <tr
                key={`${row.variantId}-${row.methodName}`}
                data-row
                className="border-b last:border-0"
              >
                <td className="py-2">
                  <code className="font-mono text-xs">{row.sku}</code>
                  <span className="block text-xs text-muted-foreground">
                    {row.methodName}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {formatMoney(row.priceUsd, "USD")}
                </td>
                <td className="py-2 text-right">{formatUsdt(row.priceUsdt)}</td>
                <td className="py-2 text-right">
                  {row.materialCostUsdt === null ? (
                    <StatusBadge tone="warning">Sin costo</StatusBadge>
                  ) : (
                    <>
                      {formatUsdt(row.materialCostUsdt + row.laborCostUsdt)}
                      <span className="block text-xs text-muted-foreground">
                        {row.costSource
                          ? COST_SOURCE[row.costSource]
                          : "promedio"}
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
                      <span className="block text-xs font-normal text-muted-foreground">
                        {row.marginPercent}%
                      </span>
                      {row.costMinUsdt !== null &&
                        row.costMaxUsdt !== null &&
                        row.costMinUsdt !== row.costMaxUsdt && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            rango {marginPercentWith(row, row.costMaxUsdt)}% a{" "}
                            {marginPercentWith(row, row.costMinUsdt)}%
                          </span>
                        )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ExpandableList>
  );
};

export default MarginTable;
