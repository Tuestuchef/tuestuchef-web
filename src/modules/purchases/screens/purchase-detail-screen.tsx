import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import SignedAmount from "@/common/components/signed-amount"
import PageHeader from "@/common/components/page-header"
import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import { formatDate, formatTime, toCaracasDate } from "@/common/lib/utils/format-date.util"
import { formatMoney, formatRate, formatUsdt } from "@/common/lib/utils/format-money.util"

import AddPurchasePaymentDialog from "../components/add-purchase-payment-dialog"
import PurchaseStatusBadge from "../components/purchase-status-badge"
import VoidPurchaseDialog from "../components/void-purchase-dialog"
import { formatPurchaseNumber, SUPPLIER_RATE_LABELS } from "../lib/constants/purchases.constants"
import { getPurchaseDetail, getPurchaseFormData } from "../lib/services/purchases.service"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const usd = (value: number) => formatMoney(value, "USD")

const PurchaseDetailScreen = async ({ user, id }: { user: SessionUser; id: string }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [purchase, formData] = await Promise.all([getPurchaseDetail(id), canManage ? getPurchaseFormData() : Promise.resolve(null)])
  if (!purchase) notFound()

  const label = formatPurchaseNumber(purchase.number)
  const isVoided = Boolean(purchase.void)
  const hasBalance = !isVoided && purchase.balanceUsd > 0.01
  const overdue = hasBalance && purchase.dueDate !== null && purchase.dueDate < toCaracasDate()

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.PURCHASES}>
          <ChevronLeftIcon aria-hidden />
          Compras
        </Link>
      </Button>
      <PageHeader
        className="pt-0"
        title={label}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {formatDate(purchase.occurredAt)} ·{" "}
            <Link href={ROUTES.SUPPLIER(purchase.supplier.id)} className="underline-offset-4 hover:underline">
              {purchase.supplier.name}
            </Link>
            <PurchaseStatusBadge status={purchase.status} overdue={overdue} />
            {purchase.isBackdated && <StatusBadge tone="info">Retroactiva</StatusBadge>}
          </span>
        }
      />

      {purchase.isBackdated && (
        <StatusAlert tone="info" title="Compra retroactiva">
          Registrada el {formatDate(purchase.createdAt)} a las {formatTime(purchase.createdAt)} con fecha{" "}
          {formatDate(purchase.occurredAt)}. Usa las tasas de esa fecha.
        </StatusAlert>
      )}
      {purchase.void && (
        <StatusAlert tone="error" title="Compra anulada">
          {purchase.void.reason} · {purchase.void.byName ?? "—"}, {formatDate(purchase.void.at)}. Los pagos se revirtieron
          y el inventario se corrigió.
        </StatusAlert>
      )}

      {canManage && formData && !isVoided && (
        <div className="flex flex-wrap gap-2">
          {hasBalance && (
            <AddPurchasePaymentDialog
              purchaseId={purchase.id}
              balanceUsd={purchase.balanceUsd}
              accounts={formData.accounts}
              rates={formData.rates}
              today={formData.today}
              receiptsEnabled={isStorageEnabled()}
            />
          )}
          <VoidPurchaseDialog purchaseId={purchase.id} label={label} />
        </div>
      )}

      <Card>
        <CardContent className="grid gap-4">
          <ul className="divide-y">
            {purchase.items.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-2.5">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-medium">
                    {quantityFormat.format(item.quantity)} × {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.sku && <code className="font-mono">{item.sku} · </code>}
                    {usd(item.unitCostUsd)} c/u · {item.categoryName}
                    {item.lineType === "concept" && " · sin stock"}
                  </span>
                </div>
                <span className="text-sm tabular-nums">{usd(item.lineTotalUsd)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid gap-1 border-t pt-3 text-sm tabular-nums">
            <div className="flex justify-between text-base font-semibold">
              <dt>Total</dt>
              <dd className={isVoided ? "line-through" : undefined}>{usd(purchase.totalUsd)}</dd>
            </div>
            {!isVoided && (
              <div className="flex justify-between">
                <dt>{hasBalance ? "Pendiente" : "Pagado"}</dt>
                <dd>{hasBalance ? usd(purchase.balanceUsd) : usd(purchase.paidUsd)}</dd>
              </div>
            )}
            {purchase.dueDate && hasBalance && (
              <div className="flex justify-between">
                <dt>Vence</dt>
                <dd>{formatDate(`${purchase.dueDate}T12:00:00-04:00`)}</dd>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <dt>Tasas de la compra (BCV · paralelo)</dt>
              <dd>
                {formatRate(purchase.rates.bcvUsd)} · {formatRate(purchase.rates.binance)}
              </dd>
            </div>
          </dl>
          {purchase.notes && <p className="text-sm whitespace-pre-line text-muted-foreground">{purchase.notes}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          {purchase.payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay pagos.</p>
          ) : (
            <ul className="divide-y">
              {purchase.payments.map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-2.5">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <span className="text-sm font-medium">{p.accountName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(p.occurredAt)}
                      {p.appliedRate !== null && ` · ${SUPPLIER_RATE_LABELS[p.rateKind].toLowerCase()} ${formatRate(p.appliedRate)}`}
                      {p.authorName && ` · por ${p.authorName}`}
                      {p.isBackdated && " · retroactivo"}
                    </span>
                  </div>
                  <div className="grid justify-items-end gap-0.5 text-sm tabular-nums">
                    <SignedAmount value={p.amount} currency={p.currency} tone="expense" className="font-medium" />
                    <span className="text-xs text-muted-foreground">
                      = {usd(p.usdAmount)}
                      {canManage && ` · ${formatUsdt(p.usdtValue)}`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {purchase.authorName && (
        <p className="text-center text-xs text-muted-foreground">
          Registrada por {purchase.authorName}
          {purchase.hasReceipt && " · con comprobante"}
        </p>
      )}
    </div>
  )
}

export default PurchaseDetailScreen
