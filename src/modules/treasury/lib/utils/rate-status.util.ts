import { toCaracasDate } from "@/common/lib/utils/format-date.util"

// La tasa vale para hoy si su fecha BCV es hoy (o después) o si se guardó hoy.
// El BCV no publica fines de semana ni feriados, y DolarAPI puede mostrar la fecha
// anterior durante horas: la tasa sincronizada hoy es la vigente aunque su fecha sea de ayer.
export function isRateCurrent(rate: { rate_date: string; created_at: string } | null, today: string): boolean {
  if (!rate) return false
  return rate.rate_date >= today || toCaracasDate(rate.created_at) === today
}
