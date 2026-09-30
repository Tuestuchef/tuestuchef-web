import PageHeader from "@/common/components/page-header"
import SignedAmount from "@/common/components/signed-amount"
import StatusBadge from "@/common/components/status-badge"
import { formatUsdt } from "@/common/lib/utils/format-money.util"

import IncomeExpenseChart from "../components/income-expense-chart"
import KpiCard from "../components/kpi-card"
import OutflowBreakdown from "../components/outflow-breakdown"
import PeriodSelect from "../components/period-select"
import PersonFlowsCard from "../components/person-flows-card"
import type { PeriodValue } from "../lib/constants/analytics.constants"
import { getAnalytics } from "../lib/services/analytics.service"

const percent = new Intl.NumberFormat("es-VE", { style: "percent", maximumFractionDigits: 1 })

const AnalyticsScreen = async ({ period }: { period: PeriodValue }) => {
  const data = await getAnalytics(period)
  const { kpis } = data
  const inTheGreen = kpis.profit >= 0

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 md:gap-6">
      <PageHeader
        help="analytics"
        title="Analítica"
        description="Utilidad real y a dónde va el dinero, en USDT. Sale del libro de movimientos."
        actions={<PeriodSelect value={period} />}
      />

      <div className="@container/card grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Ingresos" value={<SignedAmount value={kpis.income} tone="income" />} hint="Ventas y otros ingresos" />
        <KpiCard
          title="Egresos"
          value={<SignedAmount value={kpis.expenses} tone="expense" />}
          hint="Costos, gastos, comisiones, impuestos, sueldos y retiros"
        />
        <KpiCard
          title="Utilidad real"
          value={<SignedAmount value={kpis.profit} />}
          hint={
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={inTheGreen ? "success" : "error"}>
                {inTheGreen ? "En verde" : "En rojo"}
              </StatusBadge>
              {kpis.margin !== null && <span>Margen {percent.format(kpis.margin)}</span>}
            </span>
          }
        />
        <KpiCard
          title="Usos de la utilidad"
          value={<span className="tabular-nums">{formatUsdt(kpis.profitUses)}</span>}
          hint={
            kpis.contributions > 0
              ? `Reinversión y reparto. Aportes de capital: ${formatUsdt(kpis.contributions)} (no son ingreso).`
              : "Reinversión y reparto: salen después de la utilidad."
          }
        />
      </div>

      <IncomeExpenseChart data={data.monthly} />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <OutflowBreakdown items={data.outflowsByCategory} />
        <PersonFlowsCard people={data.personFlows} />
      </div>
    </div>
  )
}

export default AnalyticsScreen
