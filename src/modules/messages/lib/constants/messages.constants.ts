import type { MessageKind, MessageStatus } from "../types/messages.types"

export const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  sale_note: "Nota de entrega",
  payment_reminder: "Recordatorio de pago",
  order_confirmed: "Pedido confirmado",
  order_ready: "Pedido listo",
  order_cancelled: "Pedido cancelado",
}

export const MESSAGE_KIND_DESCRIPTIONS: Record<MessageKind, string> = {
  sale_note: "Detalle de cualquier venta o pedido. Desde la venta o el pedido.",
  payment_reminder: "Saldo pendiente de un cliente con sus ventas. Desde Por cobrar (owner y admin).",
  order_confirmed: "Abono para empezar y fecha de entrega. Desde el pedido.",
  order_ready: "El pedido está listo y lo que falta por pagar. Desde el pedido listo.",
  order_cancelled: "Cancelación y reembolso en la moneda en que pagó. Desde el pedido cancelado.",
}

// Datos que se pueden usar en cada mensaje, con un ejemplo para la vista previa.
type Placeholder = { key: string; label: string; sample: string }

const CUSTOMER: Placeholder = { key: "cliente", label: "Nombre del cliente", sample: "Ana" }
const BUSINESS: Placeholder = { key: "negocio", label: "Nombre del negocio", sample: "Tuestuchef" }
const NUMBER: Placeholder = { key: "numero", label: "Número de nota", sample: "NE-000123" }
const TOTAL: Placeholder = { key: "total", label: "Total", sample: "$ 120,00" }
const BALANCE: Placeholder = { key: "pendiente", label: "Saldo pendiente", sample: "$ 48,00" }

export const MESSAGE_PLACEHOLDERS: Record<MessageKind, Placeholder[]> = {
  sale_note: [
    CUSTOMER,
    BUSINESS,
    NUMBER,
    { key: "fecha", label: "Fecha de la venta", sample: "04/10/2026" },
    { key: "detalle", label: "Productos y totales", sample: "• 2 × Filipina (M) — $ 56,00\n\n*Total: $ 56,00*" },
    TOTAL,
    BALANCE,
  ],
  payment_reminder: [
    CUSTOMER,
    BUSINESS,
    BALANCE,
    { key: "ventas", label: "Ventas con saldo", sample: "• NE-000120 (28/09/2026): $ 30,00\n• NE-000123 (01/10/2026): $ 18,00" },
    { key: "dias", label: "Días de la deuda más antigua", sample: "6" },
  ],
  order_confirmed: [
    CUSTOMER,
    BUSINESS,
    NUMBER,
    TOTAL,
    { key: "abono", label: "Abono para empezar", sample: "$ 72,00" },
    { key: "pagado", label: "Pagado", sample: "$ 72,00" },
    BALANCE,
    { key: "fecha_entrega", label: "Fecha de entrega", sample: "20/10/2026" },
  ],
  order_ready: [CUSTOMER, BUSINESS, NUMBER, TOTAL, BALANCE],
  order_cancelled: [
    CUSTOMER,
    BUSINESS,
    NUMBER,
    { key: "reembolso", label: "Reembolso (en la moneda pagada)", sample: "Bs 2.400,00 y $ 20,00" },
  ],
}

export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  opened: "Abierto en WhatsApp",
  queued: "En cola",
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
}

export const MESSAGE_BODY_MAX = 2000
export const OUTBOUND_BODY_MAX = 4096

export const MESSAGES_FEEDBACK = {
  TEMPLATE_SAVED: "Mensaje guardado.",
  OPENED: "Se abrió WhatsApp con el mensaje.",
  NO_PHONE: "El cliente no tiene teléfono: WhatsApp te deja elegir el contacto.",
}
