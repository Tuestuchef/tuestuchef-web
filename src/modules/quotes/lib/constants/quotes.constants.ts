import type { StatusTone } from "@/common/lib/constants/status.constants"

import type { QuoteCurrencies, QuoteStatus } from "../types/quotes.types"

export const QUOTE_CURRENCIES_LABELS: Record<QuoteCurrencies, string> = {
  usd: "Solo USD",
  ves: "Solo Bs",
  both: "USD y Bs",
}

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  expired: "Vencido",
  discarded: "Descartado",
  superseded: "Reemplazado",
}

// El estado se distingue por icono y texto, no solo por color.
export const QUOTE_STATUS_TONES: Record<QuoteStatus, StatusTone> = {
  draft: "info",
  sent: "info",
  accepted: "success",
  rejected: "error",
  expired: "warning",
  discarded: "info",
  superseded: "info",
}

export const QUOTE_LIST_LIMIT = 100

export const QUOTE_MESSAGES = {
  SETTINGS_SAVED: "Configuración de presupuestos guardada.",
  SAVED: "Borrador guardado.",
  SENT: "Presupuesto marcado como enviado.",
  ACCEPTED: "Presupuesto aceptado.",
  REJECTED: "Presupuesto rechazado.",
  DISCARDED: "Borrador descartado.",
  VERSION: "Versión nueva creada como borrador.",
  DUPLICATED: "Copia creada como borrador.",
  CONVERTED: "Pedido creado desde el presupuesto.",
}
