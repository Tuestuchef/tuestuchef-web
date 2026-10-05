import PageHeader from "@/common/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { listCatalog } from "@/modules/products/lib/services/catalog.service"
import { ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import PieceRateForm from "../components/piece-rate-form"
import { listPieceRates } from "../lib/services/production.service"

// Tarifas a destajo por categoría y etapa (owner y admin).
const PieceRatesScreen = async () => {
  const [rates, categories] = await Promise.all([listPieceRates(), listCatalog("product_categories")])

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader help="pieceRates" title="Tarifas a destajo" description="Cuánto se paga por pieza según la categoría y la etapa." />
      <Card>
        <CardHeader>
          <CardTitle>Tarifas vigentes</CardTitle>
          <CardDescription>Un cambio no edita la anterior: se guarda una nueva desde hoy.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {rates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin tarifas: nadie cobra a destajo todavía.</p>
          ) : (
            <ul className="divide-y">
              {rates.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="flex-1">
                    {r.categoryName} · {ITEM_STATUS_LABELS[r.stage]}
                    <span className="block text-xs text-muted-foreground">Desde {formatDate(r.effectiveFrom)}</span>
                  </span>
                  <span className="font-medium tabular-nums">{formatMoney(r.rateUsd, "USD")} por pieza</span>
                </li>
              ))}
            </ul>
          )}
          <PieceRateForm categories={categories.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name }))} />
        </CardContent>
      </Card>
    </div>
  )
}

export default PieceRatesScreen
