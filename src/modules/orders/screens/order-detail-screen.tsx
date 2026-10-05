import { ChevronLeftIcon, ImageIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import { cn } from "@/common/lib/utils"
import { formatDate, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"
import MessageActions from "@/modules/messages/components/message-actions"
import MessageHistory from "@/modules/messages/components/message-history"
import type { MessageKind } from "@/modules/messages/lib/types/messages.types"
import AddPaymentDialog from "@/modules/sales/components/add-payment-dialog"
import { formatSaleNumber, ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"
import { getSaleFormData } from "@/modules/sales/lib/services/sales.service"

import {
  AllowWithoutDepositDialog,
  CancelOrderDialog,
  DeliverOrderDialog,
  PromisedDateDialog,
} from "../components/order-action-dialogs"
import { AdvanceStageButton, AssignStageDialog } from "../components/order-stage-controls"
import { ASSIGNABLE_STAGES, ORDER_STATUS_LABELS, STOCK_MODE_LABELS, type ProductionStage } from "../lib/constants/orders.constants"
import { getCancellationQuote, getOrderDetail, listAssignees } from "../lib/services/orders.service"

const usd = (v: number) => formatMoney(v, "USD")
const STAGE_INDEX = (s: ProductionStage | null) => (s ? ASSIGNABLE_STAGES.indexOf(s) : -1)

const OrderDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [order, formData, assignees, quote] = await Promise.all([
    getOrderDetail(id),
    getSaleFormData(),
    listAssignees(),
    getCancellationQuote(id),
  ])
  if (!order) notFound()

  const today = toCaracasDate()
  const open = order.status !== "delivered" && order.status !== "cancelled"
  // Mensajes que aplican según el estado del pedido.
  const messageKinds: MessageKind[] =
    order.status === "cancelled"
      ? ["order_cancelled"]
      : [...(open ? (["order_confirmed"] as const) : []), ...(order.status === "ready" ? (["order_ready"] as const) : []), "sale_note"]
  const depositMissing = Math.max(order.depositRequiredUsd - order.paidUsd, 0)

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.ORDERS}>
          <ChevronLeftIcon aria-hidden />
          Pedidos
        </Link>
      </Button>
      <PageHeader
        help="order"
        className="pt-0"
        title={`Pedido ${formatSaleNumber(order.number)}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {order.customer?.name ?? "—"} · {STOCK_MODE_LABELS[order.stockMode].title}
            <StatusBadge tone={order.status === "cancelled" ? "error" : order.status === "waiting" ? "warning" : "info"}>
              {ORDER_STATUS_LABELS[order.status]}
            </StatusBadge>
            {order.isLate && <StatusBadge tone="error">Atrasado</StatusBadge>}
          </span>
        }
      />

      {order.fromQuote && (
        <p className="text-sm text-muted-foreground">
          Desde el presupuesto{" "}
          <Link href={ROUTES.QUOTE(order.fromQuote.id)} className="font-mono text-foreground underline-offset-4 hover:underline">
            {order.fromQuote.code}
          </Link>
        </p>
      )}
      {order.cancellation && (
        <StatusAlert tone="error" title="Pedido cancelado">
          {order.cancellation.reason} · {formatDate(order.cancellation.at)}. Se reembolsó {formatUsdt(order.cancellation.refundedUsdt)}
          {order.cancellation.deductionUsdt > 0 && ` y se retuvo ${formatUsdt(order.cancellation.deductionUsdt)} por materiales`}.
        </StatusAlert>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-6 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Prometido para el <strong>{formatDate(order.promisedDate)}</strong>
            </span>
            {open && <PromisedDateDialog saleId={order.saleId} current={order.promisedDate} today={today} />}
          </div>
          <dl className="grid gap-1 tabular-nums">
            <div className="flex justify-between">
              <dt>Total</dt>
              <dd>{usd(order.totalUsd)}</dd>
            </div>
            {order.vat && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Incluye IVA {order.vat.percent}%</dt>
                <dd>{usd(order.vat.usd)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Para empezar a producir</dt>
              <dd>{usd(order.depositRequiredUsd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Pagado</dt>
              <dd>{usd(order.paidUsd)}</dd>
            </div>
            {order.balanceUsd > 0.01 && order.status !== "cancelled" && (
              <div className="flex justify-between font-medium">
                <dt>Saldo</dt>
                <dd>{usd(order.balanceUsd)}</dd>
              </div>
            )}
          </dl>
          {open && !order.canStart && (
            <StatusAlert tone="warning" title={`Falta ${usd(depositMissing)} para empezar a producir`}>
              Registra el pago, o pide a owner o admin que autoricen producir sin el abono completo.
            </StatusAlert>
          )}
          {order.overrides.map((o) => (
            <p key={o.kind} className="text-xs text-muted-foreground">
              {o.kind === "start_without_deposit" ? "Autorizado sin abono" : "Entregado con saldo"}: {o.reason}
              {o.byName ? ` (${o.byName})` : ""}
            </p>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {open && order.balanceUsd > 0.01 && (
          <AddPaymentDialog
            saleId={order.saleId}
            balanceUsd={order.balanceUsd}
            methods={formData.methods}
            rates={formData.rates}
            receiptsEnabled={isStorageEnabled()}
            today={formData.today}
            maxDaysBack={canManage ? null : formData.staffMaxBackdateDays}
          />
        )}
        {order.status === "ready" && <DeliverOrderDialog saleId={order.saleId} balanceUsd={order.balanceUsd} canManage={canManage} />}
        {open && canManage && !order.canStart && <AllowWithoutDepositDialog saleId={order.saleId} />}
        <MessageActions target={{ type: "sale", saleId: order.saleId }} kinds={messageKinds} />
        {open && <CancelOrderDialog saleId={order.saleId} quote={quote} canManage={canManage} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Producción</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {order.lines.map((line) => {
              const assignable = ASSIGNABLE_STAGES.filter(
                (s) => STAGE_INDEX(s) >= STAGE_INDEX(line.stage) || line.stage === "to_produce"
              )
              return (
                <li key={line.id} className={cn("grid gap-2 py-3", line.parentId && "ml-4 border-l-2 pl-3")}>
                  <div className="flex items-start gap-3">
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <span className="text-sm font-medium">
                        {line.quantity} × {line.productName}
                        {!line.isCombo && <span className="font-normal text-muted-foreground"> · {line.variantLabel}</span>}
                      </span>
                      {line.reservedQuantity > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {line.reservedQuantity} del inventario · {line.quantity - line.reservedQuantity} a producir
                        </span>
                      )}
                    </div>
                    {!line.parentId && <span className="text-sm tabular-nums">{usd(line.lineTotalUsd)}</span>}
                  </div>

                  {line.customizations.map((c) => (
                    <div key={c.id} className="grid gap-1 rounded-lg bg-muted/50 p-2 text-xs">
                      <span className="font-medium">
                        {c.quantity} × {c.typeName}
                        {c.sizeCm ? ` · ${c.sizeCm} cm` : ""}
                        {c.position ? ` · ${c.position}` : ""} · {usd(c.lineTotalUsd)}
                      </span>
                      {c.text && <span>Texto: “{c.text}”</span>}
                      {c.names.length > 0 && <span>Nombres: {c.names.join(", ")}</span>}
                      {c.note && <span className="text-muted-foreground">{c.note}</span>}
                      {c.hasLogo && (
                        <a href={ROUTES.CUSTOMIZATION_LOGO(c.id)} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 underline-offset-4 hover:underline">
                          <ImageIcon className="size-3.5" aria-hidden />
                          Ver logo
                        </a>
                      )}
                    </div>
                  ))}

                  {!line.isCombo && line.stage && (
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={line.stage === "delivered" || line.stage === "ready" ? "success" : "warning"}>
                        {ITEM_STATUS_LABELS[line.stage]}
                      </StatusBadge>
                      {line.assignee && (
                        <span className="text-xs text-muted-foreground">
                          {line.assignee.name}
                          {line.assignee.expectedDate && ` · entrega ${formatDate(line.assignee.expectedDate)}`}
                        </span>
                      )}
                      {line.assignee?.isLate && <StatusBadge tone="error">Taller atrasado</StatusBadge>}
                      {open && (
                        <>
                          <AdvanceStageButton itemId={line.id} nextStage={line.nextStage} />
                          <AssignStageDialog itemId={line.id} stages={assignable} assignees={assignees} defaultStage={line.nextStage ?? undefined} />
                        </>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      {order.dateChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cambios de fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">
              {order.dateChanges.map((d) => (
                <li key={d.at}>
                  {formatDate(d.previous)} → {formatDate(d.next)}
                  {d.reason && <span className="text-muted-foreground"> · {d.reason}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <MessageHistory filter={{ saleId: order.saleId }} />
    </div>
  )
}

export default OrderDetailScreen
