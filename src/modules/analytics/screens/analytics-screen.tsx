import PageHeader from "@/common/components/page-header"
import SignedAmount from "@/common/components/signed-amount"
import StatusBadge from "@/common/components/status-badge"
import { toCaracasMonth } from "@/common/lib/utils/format-date.util"
import { formatUsdt } from "@/common/lib/utils/format-money.util"
import { listAccounts } from "@/modules/treasury/lib/services/accounts.service"

import AllocationsCard from "../components/allocations-card"
import CashFlowTable from "../components/cash-flow-table"
import DashboardTabs from "../components/dashboard-tabs"
import IncomeExpenseChart from "../components/income-expense-chart"
import KpiCard from "../components/kpi-card"
import OutflowBreakdown from "../components/outflow-breakdown"
import PeriodSelect from "../components/period-select"
import PersonFlowsCard from "../components/person-flows-card"
import ProductMarginTable from "../components/product-margin-table"
import RateEffectCard from "../components/rate-effect-card"
import type { DashboardView, PeriodValue } from "../lib/constants/analytics.constants"
import { getAnalytics } from "../lib/services/analytics.service"
import {
  getCashFlow,
  getProductSalesMargins,
  getProfitPolicy,
  getRateEffect,
  getReserveActivity,
  periodRange,
} from "../lib/services/dashboard.service"
import { periodMonths } from "../lib/utils/build-analytics.util"

const percent = new Intl.NumberFormat("es-VE", { style: "percent", maximumFractionDigits: 1 })

// Utilidad real (libro) + asignaciones de la utilidad.
const ProfitView = async ({ period }: { period: PeriodValue }) => {
  const data = await getAnalytics(period)
  const range = periodRange(data.periodMonths)
  const [policy, reserve, accounts] = await Promise.all([getProfitPolicy(), getReserveActivity(range), listAccounts({ activeOnly: true })])
  const { kpis } = data
  const inTheGreen = kpis.profit >= 0

  return (
    <>
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
              <StatusBadge tone={inTheGreen ? "success" : "error"}>{inTheGreen ? "En verde" : "En rojo"}</StatusBadge>
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

      <AllocationsCard
        profit={kpis.profit}
        reinvestmentSpent={kpis.reinvestment}
        policy={policy}
        reserve={reserve}
        usdtAccounts={accounts.filter((a) => a.currency === "USDT").map((a) => ({ id: a.id, name: a.name }))}
      />

      <IncomeExpenseChart data={data.monthly} />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <OutflowBreakdown items={data.outflowsByCategory} />
        <PersonFlowsCard people={data.personFlows} />
      </div>
    </>
  )
}

// Rango del período (las vistas de caja, margen y tasa no necesitan el resumen del libro).
const rangeFor = (period: PeriodValue) => periodRange(periodMonths(period, toCaracasMonth()))

const AnalyticsScreen = async ({ period, view }: { period: PeriodValue; view: DashboardView }) => {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 md:gap-6">
      <PageHeader
        help="analytics"
        title="Dashboard"
        description="Cómo va el negocio en valor real (USDT). Solo owner y admin."
        actions={<PeriodSelect value={period} />}
      />
      <DashboardTabs view={view} period={period} />

      {view === "utilidad" && <ProfitView period={period} />}
      {view === "caja" && <CashFlowTable rows={await getCashFlow(rangeFor(period))} />}
      {view === "margen" && <ProductMarginTable rows={await getProductSalesMargins(rangeFor(period))} />}
      {view === "tasa" && <RateEffectCard rows={await getRateEffect(rangeFor(period))} />}
    </div>
  )
}

export default AnalyticsScreen
