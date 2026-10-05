import "server-only"

import { getOrderDetail } from "@/modules/orders/lib/services/orders.service"
import { getSaleDetail, listReceivables } from "@/modules/sales/lib/services/sales.service"

import type { MessageKind, MessageTarget, MessageValues } from "../types/messages.types"
import { orderValues, receivableValues, saleNoteValues } from "../utils/message-values.util"

type Context = { values: MessageValues; phone: string | null; customerId: string | null; saleId: string | null }
type Resolved = { ok: true; context: Context } | { ok: false; error: string }

const ORDER_KINDS: MessageKind[] = ["order_confirmed", "order_ready", "order_cancelled"]

// Arma los datos del mensaje desde la base (con la sesión de quien envía), nunca desde el navegador.
export async function resolveMessageContext(kind: MessageKind, target: MessageTarget): Promise<Resolved> {
  if (kind === "payment_reminder") {
    if (target.type !== "customer") return { ok: false, error: "El recordatorio de pago se envía a un cliente." }
    const group = (await listReceivables()).find((g) => g.customerId === target.customerId)
    if (!group) return { ok: false, error: "Ese cliente no tiene saldo pendiente." }
    return { ok: true, context: { values: receivableValues(group), phone: group.customerPhone, customerId: group.customerId, saleId: null } }
  }

  if (target.type !== "sale") return { ok: false, error: "Ese mensaje se envía desde una venta o un pedido." }
  const sale = await getSaleDetail(target.saleId)
  if (!sale) return { ok: false, error: "La venta no existe." }
  const context = { phone: sale.customer?.phone ?? null, customerId: sale.customer?.id ?? null, saleId: sale.id }

  if (kind === "sale_note") return { ok: true, context: { ...context, values: saleNoteValues(sale) } }

  if (ORDER_KINDS.includes(kind)) {
    const order = await getOrderDetail(sale.id)
    if (!order) return { ok: false, error: "Esa venta no es un pedido." }
    if (kind === "order_ready" && order.status !== "ready") return { ok: false, error: "El pedido aún no está listo." }
    if (kind === "order_cancelled" && order.status !== "cancelled") return { ok: false, error: "El pedido no está cancelado." }
    if (kind === "order_confirmed" && order.status === "cancelled") return { ok: false, error: "El pedido está cancelado." }
    return { ok: true, context: { ...context, values: orderValues(order, sale) } }
  }

  return { ok: false, error: "Mensaje desconocido." }
}
