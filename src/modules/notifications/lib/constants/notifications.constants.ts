import type { Enums } from "@/common/lib/db/database.types"

export type NotificationKind = Enums<"notification_kind">
export type NotificationChannel = Enums<"notification_channel">

export const NOTIFICATION_KINDS: readonly NotificationKind[] = [
  "late_orders",
  "late_workshops",
  "missing_rate",
  "receivables_due",
  "payables_due",
  "low_stock",
]

export const NOTIFICATION_KIND_LABELS: Record<
  NotificationKind,
  { title: string; description: string; leadLabel?: string; listUrl: string }
> = {
  late_orders: { title: "Pedidos atrasados", description: "Pedidos que pasaron su fecha prometida sin entregarse.", listUrl: "/pedidos?estado=late" },
  late_workshops: { title: "Talleres atrasados", description: "Etapas en un taller que pasaron su fecha estimada.", listUrl: "/produccion/asignaciones" },
  missing_rate: { title: "Falta la tasa del día", description: "Si a la hora del aviso no hay tasa de hoy.", listUrl: "/cuentas" },
  receivables_due: {
    title: "Cobros pendientes",
    description: "Ventas con saldo (los pedidos abiertos no cuentan: cobran al entregar).",
    leadLabel: "Avisar desde los días de deuda",
    listUrl: "/ventas/por-cobrar",
  },
  payables_due: {
    title: "Pagos por vencer o vencidos",
    description: "Compras a crédito con saldo, antes de su vencimiento y después.",
    leadLabel: "Días antes del vencimiento",
    listUrl: "/compras/por-pagar",
  },
  low_stock: { title: "Stock bajo", description: "Variantes que llegaron a su stock mínimo.", listUrl: "/productos/stock" },
}

export const NOTIFICATION_MESSAGES = {
  SAVED: "Avisos actualizados.",
  DEVICE_ON: "Avisos activados en este dispositivo.",
  DEVICE_OFF: "Avisos desactivados en este dispositivo.",
  TEST_SENT: "Prueba enviada.",
} as const
