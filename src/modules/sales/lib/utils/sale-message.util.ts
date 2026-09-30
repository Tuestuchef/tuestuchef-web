import { brandConfig } from "@/common/lib/config/brand.config"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"

import { formatSaleNumber } from "../constants/sales.constants"
import type { SaleDetail } from "../types/sales.types"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

// Resumen de la venta en texto, para enviarlo por WhatsApp al cliente.
export function buildSaleMessage(sale: SaleDetail): string {
  const usd = (value: number) => formatMoney(value, "USD")
  const lines = [
    `*${brandConfig.name}* · Nota de entrega ${formatSaleNumber(sale.number)}`,
    formatDate(sale.occurredAt),
    "",
    ...sale.items.map(
      (item) =>
        `• ${quantityFormat.format(item.quantity)} × ${item.productName} (${item.variantLabel}) — ${usd(item.lineTotalUsd)}` +
        (item.source === "made_to_order" ? " _por encargo_" : "")
    ),
    "",
  ]
  if (sale.discount) lines.push(`Descuento: −${usd(sale.discount.usd)}`)
  if (sale.deliveryFeeUsd > 0) lines.push(`Delivery: ${usd(sale.deliveryFeeUsd)}`)
  lines.push(`*Total: ${usd(sale.totalUsd)}*`)
  if (sale.paidUsd > 0) lines.push(`Pagado: ${usd(sale.paidUsd)}`)
  if (sale.balanceUsd > 0.01) lines.push(`*Pendiente: ${usd(sale.balanceUsd)}*`)
  lines.push("", "¡Gracias por tu compra!")
  return lines.join("\n")
}

// wa.me con el número del cliente si lo hay; si no, WhatsApp elige el contacto.
export function whatsappShareUrl(message: string, phone?: string | null): string {
  const target = phone ? phone.replace("+", "") : ""
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`
}
