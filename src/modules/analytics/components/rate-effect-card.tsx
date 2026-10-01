import SignedAmount from "@/common/components/signed-amount"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import type { RateEffectRow } from "../lib/types/analytics.types"

const Section = ({ title, items, hint }: { title: string; items: RateEffectRow[]; hint: string }) => (
  <section className="grid gap-2">
    <h3 className="text-sm font-medium">{title}</h3>
    {items.length === 0 ? (
      <p className="text-sm text-muted-foreground">Sin pagos en Bs en el período.</p>
    ) : (
      <ul className="divide-y rounded-lg border">
        {items.map((r) => (
          <li key={r.methodName} className="flex items-center gap-3 p-3 text-sm tabular-nums">
            <div className="grid min-w-0 flex-1 gap-0.5">
              <span className="font-medium">{r.methodName}</span>
              <span className="text-xs text-muted-foreground">
                {r.paymentsCount} pagos · {formatUsdt(r.nominalUsdt)} nominales = {formatUsdt(r.realUsdt)} reales
              </span>
            </div>
            <SignedAmount value={r.differenceUsdt} />
          </li>
        ))}
      </ul>
    )}
    <p className="text-xs text-muted-foreground">{hint}</p>
  </section>
)

// Efecto de la tasa: diferencia entre lo cobrado/pagado en Bs (a tasa BCV) y su valor real (Binance).
const RateEffectCard = ({ rows }: { rows: RateEffectRow[] }) => {
  const sales = rows.filter((r) => r.source === "sale")
  const purchases = rows.filter((r) => r.source === "purchase")
  const net = rows.reduce((sum, r) => sum + r.differenceUsdt, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Efecto de la tasa</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-1">
          Neto del período: <SignedAmount value={net} />
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Section
          title="Ventas cobradas en Bs"
          items={sales}
          hint="Se cobra a tasa BCV (por ley) y el dinero vale a tasa paralela: la diferencia es lo que se pierde por cobrar en Bs."
        />
        <Section
          title="Pagos a proveedores en Bs"
          items={purchases}
          hint="Pagar una deuda en dólares con Bs a tasa BCV cuesta menos en valor real: la diferencia es ganancia."
        />
      </CardContent>
    </Card>
  )
}

export default RateEffectCard
