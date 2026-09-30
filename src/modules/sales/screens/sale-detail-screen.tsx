import { ChevronLeftIcon, MessageCircleIcon, PrinterIcon } from "lucide-react"
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
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"
import { formatMoney, formatRate, formatUsdt } from "@/common/lib/utils/format-money.util"

import AddPaymentDialog from "../components/add-payment-dialog"
import { AdvanceItemButton, DeliverReadyButton } from "../components/item-status-controls"
import PaymentStatusBadge from "../components/payment-status-badge"
import VoidSaleDialog from "../components/void-sale-dialog"
import {
  CHANNEL_LABELS,
  DELIVERY_LABELS,
  formatSaleNumber,
  ITEM_STATUS_LABELS,
} from "../lib/constants/sales.constants"
import { getSaleDetail, getSaleFormData } from "../lib/services/sales.service"
import { buildSaleMessage, whatsappShareUrl } from "../lib/utils/sale-message.util"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const usd = (value: number) => formatMoney(value, "USD")

const SaleDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [sale, formData] = await Promise.all([getSaleDetail(id), getSaleFormData()])
  if (!sale) notFound()

  const label = formatSaleNumber(sale.number)
  const isVoided = Boolean(sale.void)
  const hasBalance = !isVoided && sale.balanceUsd > 0.01
  const readyItems = sale.items.filter((i) => i.status === "ready").map((i) => i.id)

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.SALES}>
          <ChevronLeftIcon aria-hidden />
          Ventas
        </Link>
      </Button>
      <PageHeader
        className="pt-0"
        title={label}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {formatDate(sale.occurredAt)} · {formatTime(sale.occurredAt)} · {CHANNEL_LABELS[sale.channel]} ·{" "}
            {DELIVERY_LABELS[sale.deliveryMethod]}
            <PaymentStatusBadge status={sale.paymentStatus} />
            {sale.isBackdated && <StatusBadge tone="info">Retroactiva</StatusBadge>}
          </span>
        }
      />

      {sale.isBackdated && (
        <StatusAlert tone="info" title="Venta retroactiva">
          Registrada el {formatDate(sale.createdAt)} a las {formatTime(sale.createdAt)} con fecha{" "}
          {formatDate(sale.occurredAt)}. Usa las tasas de esa fecha.
        </StatusAlert>
      )}

      {sale.void && (
        <StatusAlert tone="error" title="Venta anulada">
          {sale.void.reason} · {sale.void.byName ?? "—"}, {formatDate(sale.void.at)}. Los pagos se revirtieron y el
          inventario volvió.
        </StatusAlert>
      )}

      <div className="flex flex-wrap gap-2">
        {hasBalance && (
          <AddPaymentDialog
            saleId={sale.id}
            balanceUsd={sale.balanceUsd}
            methods={formData.methods}
            rates={formData.rates}
            receiptsEnabled={isStorageEnabled()}
            today={formData.today}
            maxDaysBack={canManage ? null : formData.staffMaxBackdateDays}
          />
        )}
        {!isVoided && <DeliverReadyButton itemIds={readyItems} />}
        <Button asChild variant="outline" className="h-11 md:h-9">
          <a href={whatsappShareUrl(buildSaleMessage(sale), sale.customer?.phone)} target="_blank" rel="noreferrer">
            <MessageCircleIcon aria-hidden />
            WhatsApp
          </a>
        </Button>
        <Button asChild variant="outline" className="h-11 md:h-9">
          <Link href={ROUTES.SALE_NOTE(sale.id)}>
            <PrinterIcon aria-hidden />
            Nota de entrega
          </Link>
        </Button>
        {canManage && !isVoided && <VoidSaleDialog saleId={sale.id} label={label} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{sale.customer ? sale.customer.name : "Venta rápida (sin cliente)"}</CardTitle>
          {sale.customer && (
            <Link href={ROUTES.CUSTOMER(sale.customer.id)} className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline">
              Ver cliente
            </Link>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="divide-y">
            {sale.items.map((item) => (
              <li key={item.id} className="grid gap-1.5 py-2.5">
                <div className="flex items-start gap-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm font-medium">
                      {quantityFormat.format(item.quantity)} × {item.productName}{" "}
                      <span className="font-normal text-muted-foreground">· {item.variantLabel}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      <code className="font-mono">{item.sku}</code> · {usd(item.unitPriceUsd)} c/u
                    </span>
                  </div>
                  <span className="text-sm tabular-nums">{usd(item.lineTotalUsd)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.source === "made_to_order" && <StatusBadge tone="info">Por encargo</StatusBadge>}
                  {item.status && (
                    <StatusBadge tone={item.status === "delivered" ? "success" : "warning"}>
                      {ITEM_STATUS_LABELS[item.status]}
                    </StatusBadge>
                  )}
                  {!isVoided && <AdvanceItemButton itemId={item.id} status={item.status} />}
                </div>
              </li>
            ))}
          </ul>

          <dl className="grid gap-1 border-t pt-3 text-sm tabular-nums">
            <div className="flex justify-between text-muted-foreground">
              <dt>Subtotal ({sale.priceMethodName})</dt>
              <dd>{usd(sale.subtotalUsd)}</dd>
            </div>
            {sale.discount && (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt>
                  Descuento{sale.discount.type === "percent" ? ` ${sale.discount.value}%` : ""} · {sale.discount.reason}
                  {sale.discount.byName ? ` (${sale.discount.byName})` : ""}
                </dt>
                <dd>−{usd(sale.discount.usd)}</dd>
              </div>
            )}
            {sale.deliveryFeeUsd > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <dt>Delivery</dt>
                <dd>{usd(sale.deliveryFeeUsd)}</dd>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className={isVoided ? "line-through" : undefined}>{usd(sale.totalUsd)}</dd>
            </div>
            {!isVoided && (
              <div className="flex justify-between">
                <dt>{hasBalance ? "Pendiente" : "Pagado"}</dt>
                <dd>{hasBalance ? usd(sale.balanceUsd) : usd(sale.paidUsd)}</dd>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <dt>Tasa BCV del día de la venta</dt>
              <dd>{formatRate(sale.bcvUsdRate)}</dd>
            </div>
          </dl>
          {sale.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{sale.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {sale.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay pagos.</p>
          ) : (
            <ul className="divide-y">
              {sale.payments.map((payment) => (
                <li key={payment.id} className="flex items-start gap-3 py-2.5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm font-medium">{payment.methodName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(payment.occurredAt)}
                      {payment.appliedRate !== null && ` · tasa ${formatRate(payment.appliedRate)}`}
                      {payment.authorName && ` · por ${payment.authorName}`}
                      {payment.hasReceipt && " · con comprobante"}
                      {payment.isBackdated && " · retroactivo"}
                    </span>
                  </div>
                  <div className="grid justify-items-end gap-0.5 text-sm tabular-nums">
                    <span className="font-medium">{formatMoney(payment.amount, payment.currency)}</span>
                    <span className="text-xs text-muted-foreground">
                      = {usd(payment.usdAmount)}
                      {canManage && ` · ${formatUsdt(payment.usdtValue)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {sale.authorName && (
        <p className="text-center text-xs text-muted-foreground">Registrada por {sale.authorName}</p>
      )}
    </div>
  )
}

export default SaleDetailScreen
