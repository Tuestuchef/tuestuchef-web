import { PlusIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { cn } from "@/common/lib/utils"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { formatSaleNumber } from "@/modules/sales/lib/constants/sales.constants"

import { ORDER_STATUS_LABELS, type OrderStatus } from "../lib/constants/orders.constants"
import { listOrders } from "../lib/services/orders.service"

export type OrdersFilter = OrderStatus | "late" | "open"

const FILTERS: { value: OrdersFilter; label: string }[] = [
  { value: "open", label: "Abiertos" },
  { value: "late", label: "Atrasados" },
  { value: "waiting", label: "Por empezar" },
  { value: "in_production", label: "En producción" },
  { value: "ready", label: "Listos" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
]

const STATUS_TONE: Record<OrderStatus, "info" | "warning" | "success" | "error"> = {
  waiting: "warning",
  in_production: "info",
  ready: "success",
  delivered: "success",
  cancelled: "error",
}

const OrdersScreen = async ({ filter }: { filter: OrdersFilter }) => {
  const orders = await listOrders({ status: filter })

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <PageHeader
        help="orders"
        title="Pedidos"
        description="Lo que se produce por encargo, con su fecha prometida y su abono."
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href={ROUTES.NEW_ORDER}>
              <PlusIcon aria-hidden />
              Nuevo pedido
            </Link>
          </Button>
        }
      />
      <nav aria-label="Filtrar pedidos" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`${ROUTES.ORDERS}?estado=${f.value}`}
            aria-current={f.value === filter ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-full border px-3 text-sm transition-colors",
              f.value === filter ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos con este filtro.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {orders.map((o) => (
            <li key={o.saleId}>
              <Link href={ROUTES.ORDER(o.saleId)} className="flex items-start gap-3 p-3 transition-colors hover:bg-accent">
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {formatSaleNumber(o.number)} · {o.customerName ?? "—"}
                    <StatusBadge tone={STATUS_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</StatusBadge>
                    {o.isLate && <StatusBadge tone="error">Atrasado</StatusBadge>}
                    {o.status === "waiting" && !o.canStart && <StatusBadge tone="warning">Falta abono</StatusBadge>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{o.itemsSummary}</span>
                  <span className="text-xs text-muted-foreground">Prometido: {formatDate(o.promisedDate)}</span>
                </div>
                <div className="grid justify-items-end gap-0.5 text-sm tabular-nums">
                  <span>{formatMoney(o.totalUsd, "USD")}</span>
                  {o.balanceUsd > 0.01 && o.status !== "cancelled" && (
                    <span className="text-xs text-muted-foreground">Debe {formatMoney(o.balanceUsd, "USD")}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OrdersScreen
