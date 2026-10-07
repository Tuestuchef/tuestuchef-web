import { formatMoney } from "@/common/lib/utils/format-money.util"

import type { SaleDetail } from "../types/sales.types"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

// Productos y totales de la venta en texto de WhatsApp (el dato {detalle} de la nota de entrega).
export function buildSaleDetailText(sale: SaleDetail): string {
  const usd = (value: number) => formatMoney(value, "USD")
  const lines = [
    ...sale.items.map((item) =>
      item.parentId
        ? `   ◦ ${quantityFormat.format(item.quantity)} × ${item.productName} (${item.variantLabel})` +
          (item.lineTotalUsd > 0 ? ` +${usd(item.lineTotalUsd)}` : "") +
          (item.source === "made_to_order" ? " _por encargo_" : "")
        : item.source === "combo"
          ? `• ${quantityFormat.format(item.quantity)} × ${item.productName} — ${usd(item.lineTotalUsd)}`
          : `• ${quantityFormat.format(item.quantity)} × ${item.productName} (${item.variantLabel}) — ${usd(item.lineTotalUsd)}` +
            (item.source === "made_to_order" ? " _por encargo_" : "")
    ),
    "",
  ]
  if (sale.volumeDiscount) lines.push(`Al mayor ${sale.volumeDiscount.percent}%: −${usd(sale.volumeDiscount.usd)}`)
  if (sale.discount) lines.push(`Descuento: −${usd(sale.discount.usd)}`)
  if (sale.deliveryFeeUsd > 0) lines.push(`Delivery: ${usd(sale.deliveryFeeUsd)}`)
  if (sale.vat) lines.push(`IVA ${sale.vat.percent}%: ${usd(sale.vat.usd)}`)
  lines.push(`*Total: ${usd(sale.totalUsd)}*`)
  if (sale.paidUsd > 0) lines.push(`Pagado: ${usd(sale.paidUsd)}`)
  if (sale.balanceUsd > 0.01) lines.push(`*Pendiente: ${usd(sale.balanceUsd)}*`)
  return lines.join("\n")
}
