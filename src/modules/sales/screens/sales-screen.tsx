import { PlusIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"

import SaleFilters from "../components/sale-filters"
import SaleList from "../components/sale-list"
import { getSalesTotals, listSales } from "../lib/services/sales.service"
import type { SalesFilters } from "../lib/types/sales.types"

const SalesScreen = async ({ user, filters }: { user: SessionUser; filters: SalesFilters }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [sales, totals] = await Promise.all([
    listSales(filters),
    // Staff no ve totales (la vista tampoco se los devuelve).
    canManage ? getSalesTotals(filters.month) : Promise.resolve(null),
  ])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        title="Ventas"
        description="Notas de entrega, cobros y encargos."
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href={ROUTES.NEW_SALE}>
              <PlusIcon aria-hidden />
              Nueva venta
            </Link>
          </Button>
        }
      />

      <SaleFilters filters={filters} />

      {canManage && totals && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 tabular-nums sm:grid-cols-4">
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Ventas del mes</span>
              <span className="text-lg font-semibold">{totals.salesCount}</span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Vendido (USD ref.)</span>
              <span className="text-lg font-semibold">{formatMoney(totals.totalUsd, "USD")}</span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Cobrado (valor real)</span>
              <span className="text-lg font-semibold">{formatUsdt(totals.collectedUsdt)}</span>
            </div>
            <div className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">Por cobrar</span>
              <span className="text-lg font-semibold">{formatMoney(totals.balanceUsd, "USD")}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <SaleList sales={sales} />
    </div>
  )
}

export default SalesScreen
