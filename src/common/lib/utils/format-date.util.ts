const TIME_ZONE = "America/Caracas"

const dateFormat = new Intl.DateTimeFormat("es-VE", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "short",
  year: "numeric",
})

const dayHeadingFormat = new Intl.DateTimeFormat("es-VE", {
  timeZone: TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
})

const timeFormat = new Intl.DateTimeFormat("es-VE", {
  timeZone: TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
})

const isoDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

// Una fecha sola ("2026-10-10", columnas date) es ese día en Caracas, no la medianoche UTC: con
// new Date() saldría el día anterior.
const toInstant = (value: string | Date) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(caracasNoonIso(value)) : new Date(value)

export const formatDate = (value: string | Date) => dateFormat.format(toInstant(value))
export const formatDayHeading = (value: string | Date) => dayHeadingFormat.format(toInstant(value))
export const formatTime = (value: string | Date) => timeFormat.format(new Date(value))

// "2026-09-27" en hora de Caracas.
export const toCaracasDate = (value: string | Date = new Date()) => isoDateFormat.format(new Date(value))

// "2026-09" en hora de Caracas.
export const toCaracasMonth = (value: string | Date = new Date()) => toCaracasDate(value).slice(0, 7)

// Mediodía de Caracas (UTC−4) de una fecha AAAA-MM-DD: fecha inequívoca para occurred_at.
export const caracasNoonIso = (date: string) => `${date}T12:00:00-04:00`

// Límites [inicio, fin) de un mes AAAA-MM en hora de Caracas.
export function caracasMonthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number)
  const next = monthIndex === 12 ? `${year + 1}-01` : `${year}-${String(monthIndex + 1).padStart(2, "0")}`
  return { from: `${month}-01T00:00:00-04:00`, to: `${next}-01T00:00:00-04:00` }
}
