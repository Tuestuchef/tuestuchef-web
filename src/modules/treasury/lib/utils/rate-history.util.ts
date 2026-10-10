// Tasas de un día pasado a partir del historial de DolarAPI.
// · BCV (dólar y euro): la vigente ese día, o sea la última publicada hasta esa fecha (el BCV no
//   publica fines de semana ni feriados: rige la anterior). No es estimada.
// · Paralelo (USDT): la de ese día. Si falta, la del día más cercano ajustada por la variación del
//   BCV entre los dos días (mantiene la brecha), y queda marcada como estimada.

export type HistoryPoint = { date: string; value: number }

export type HistoricalRates = {
  bcvUsd: number
  bcvEur: number
  parallelUsd: number
  // El paralelo no estaba para ese día: se calculó desde el más cercano.
  estimated: boolean
  // Día del paralelo usado (igual a la fecha si no es estimado).
  parallelFrom: string
}

// Hasta cuántos días de distancia se acepta una tasa (más allá, no hay datos).
const MAX_GAP_DAYS = 7

const dayNumber = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 86_400_000

// La última publicada hasta la fecha (dentro del margen).
export function inForceOn(points: HistoryPoint[], date: string): HistoryPoint | null {
  let best: HistoryPoint | null = null
  for (const point of points) {
    if (point.date <= date && (!best || point.date > best.date)) best = point
  }
  return best && dayNumber(date) - dayNumber(best.date) <= MAX_GAP_DAYS ? best : null
}

// La del día, o la más cercana (antes o después; a igual distancia, la anterior).
function nearest(points: HistoryPoint[], date: string): HistoryPoint | null {
  let best: HistoryPoint | null = null
  let bestGap = Infinity
  for (const point of points) {
    const gap = Math.abs(dayNumber(point.date) - dayNumber(date))
    if (gap < bestGap || (gap === bestGap && best && point.date < best.date)) {
      best = point
      bestGap = gap
    }
  }
  return best && bestGap <= MAX_GAP_DAYS ? best : null
}

export function pickHistoricalRates(
  date: string,
  history: { bcvUsd: HistoryPoint[]; bcvEur: HistoryPoint[]; parallelUsd: HistoryPoint[] }
): HistoricalRates | null {
  const bcvUsd = inForceOn(history.bcvUsd, date)
  const bcvEur = inForceOn(history.bcvEur, date)
  const parallel = nearest(history.parallelUsd, date)
  if (!bcvUsd || !bcvEur || !parallel) return null

  if (parallel.date === date) {
    return { bcvUsd: bcvUsd.value, bcvEur: bcvEur.value, parallelUsd: parallel.value, estimated: false, parallelFrom: date }
  }
  // Misma brecha que el día más cercano: paralelo de ese día × (BCV de la fecha ÷ BCV de ese día).
  const bcvThen = inForceOn(history.bcvUsd, parallel.date)
  const parallelUsd = bcvThen ? (parallel.value * bcvUsd.value) / bcvThen.value : parallel.value
  return {
    bcvUsd: bcvUsd.value,
    bcvEur: bcvEur.value,
    parallelUsd: Math.round(parallelUsd * 1e6) / 1e6,
    estimated: true,
    parallelFrom: parallel.date,
  }
}
