import type { Currency } from "@/common/lib/constants/currency.constants"
import { brandConfig } from "@/common/lib/config/brand.config"
import { caracasNoonIso, formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import type { OrderDetail } from "@/modules/orders/lib/types/orders.types"
import { formatSaleNumber } from "@/modules/sales/lib/constants/sales.constants"
import type { ReceivableGroup, SaleDetail } from "@/modules/sales/lib/types/sales.types"
import { buildSaleDetailText } from "@/modules/sales/lib/utils/sale-message.util"

import type { MessageValues } from "../types/messages.types"

const usd = (value: number) => formatMoney(value, "USD")

const base = (customerName: string | null | undefined): MessageValues => ({
  cliente: customerName ?? "",
  negocio: brandConfig.name,
})

export function saleNoteValues(sale: SaleDetail): MessageValues {
  return {
    ...base(sale.customer?.name),
    numero: formatSaleNumber(sale.number),
    fecha: formatDate(sale.occurredAt),
    detalle: buildSaleDetailText(sale),
    total: usd(sale.totalUsd),
    pendiente: usd(Math.max(sale.balanceUsd, 0)),
  }
}

export function receivableValues(group: ReceivableGroup): MessageValues {
  return {
    ...base(group.customerName),
    pendiente: usd(group.balanceUsd),
    ventas: group.sales.map((s) => `• ${formatSaleNumber(s.number)} (${formatDate(s.occurredAt)}): ${usd(s.balanceUsd)}`).join("\n"),
    dias: String(group.oldestDays),
  }
}

// Lo devuelto en cada moneda: cada pago se reembolsa en su moneda, en la misma proporción.
export function refundText(sale: SaleDetail, refundedUsdt: number): string {
  const paidUsdt = sale.payments.reduce((sum, p) => sum + p.usdtValue, 0)
  if (refundedUsdt <= 0 || paidUsdt <= 0) return formatMoney(0, "USD")
  const factor = Math.min(refundedUsdt / paidUsdt, 1)
  const byCurrency = new Map<Currency, number>()
  for (const p of sale.payments) byCurrency.set(p.currency, (byCurrency.get(p.currency) ?? 0) + Math.round(p.amount * factor * 100) / 100)
  const parts = [...byCurrency].filter(([, amount]) => amount > 0).map(([currency, amount]) => formatMoney(amount, currency))
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} y ${parts.at(-1)}` : (parts[0] ?? formatMoney(0, "USD"))
}

export function orderValues(order: OrderDetail, sale: SaleDetail): MessageValues {
  return {
    ...base(order.customer?.name),
    numero: formatSaleNumber(order.number),
    total: usd(order.totalUsd),
    abono: usd(order.depositRequiredUsd),
    pagado: usd(order.paidUsd),
    pendiente: usd(Math.max(order.balanceUsd, 0)),
    fecha_entrega: formatDate(caracasNoonIso(order.promisedDate)),
    reembolso: order.cancellation ? refundText(sale, order.cancellation.refundedUsdt) : "",
  }
}
