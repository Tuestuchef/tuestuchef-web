import "server-only"

import { z } from "zod"

import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import type { ApiRates } from "../types/treasury.types"
import type { HistoryPoint } from "../utils/rate-history.util"

// DolarAPI Venezuela: BCV oficial (USD, EUR) y paralelo (lo usamos como tasa USDT).
// Docs: https://dolarapi.com/docs/venezuela/
export const DOLAR_API_BASE_URL = "https://ve.dolarapi.com/v1"

const ENDPOINTS = {
  bcvUsd: "/dolares/oficial",
  bcvEur: "/euros/oficial",
  parallelUsd: "/dolares/paralelo",
} as const

const quoteSchema = z.object({
  promedio: z.number().positive(),
  fechaActualizacion: z.string().min(1),
})

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

async function fetchQuote(fetchImpl: FetchLike, path: string) {
  const response = await fetchImpl(`${DOLAR_API_BASE_URL}${path}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`DolarAPI respondió ${response.status} en ${path}`)
  const parsed = quoteSchema.safeParse(await response.json())
  if (!parsed.success) throw new Error(`Respuesta inesperada de DolarAPI en ${path}`)
  return parsed.data
}

// El día de la tasa es el que publica el BCV (fecha valor), en hora de Caracas.
export async function fetchDolarApiRates(fetchImpl: FetchLike = fetch): Promise<ApiRates> {
  const [bcvUsd, bcvEur, parallelUsd] = await Promise.all([
    fetchQuote(fetchImpl, ENDPOINTS.bcvUsd),
    fetchQuote(fetchImpl, ENDPOINTS.bcvEur),
    fetchQuote(fetchImpl, ENDPOINTS.parallelUsd),
  ])

  return {
    rateDate: toCaracasDate(bcvUsd.fechaActualizacion),
    bcvUsd: bcvUsd.promedio,
    bcvEur: bcvEur.promedio,
    parallelUsd: parallelUsd.promedio,
  }
}

const HISTORY_ENDPOINTS = {
  bcvUsd: "/historicos/dolares/oficial",
  bcvEur: "/historicos/euros/oficial",
  parallelUsd: "/historicos/dolares/paralelo",
} as const

const historySchema = z.array(z.object({ promedio: z.number().positive().nullable(), fecha: z.string().min(10) }))

async function fetchHistory(fetchImpl: FetchLike, path: string): Promise<HistoryPoint[]> {
  const response = await fetchImpl(`${DOLAR_API_BASE_URL}${path}`, {
    // El historial de días pasados no cambia: basta con pedirlo una vez por hora.
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15_000),
  } as RequestInit)
  if (!response.ok) throw new Error(`DolarAPI respondió ${response.status} en ${path}`)
  const parsed = historySchema.safeParse(await response.json())
  if (!parsed.success) throw new Error(`Respuesta inesperada de DolarAPI en ${path}`)
  return parsed.data.flatMap((p) => (p.promedio ? [{ date: p.fecha.slice(0, 10), value: p.promedio }] : []))
}

// Historial diario: BCV dólar y euro (desde 2023) y paralelo (desde feb. 2026).
export async function fetchDolarApiHistory(fetchImpl: FetchLike = fetch) {
  const [bcvUsd, bcvEur, parallelUsd] = await Promise.all([
    fetchHistory(fetchImpl, HISTORY_ENDPOINTS.bcvUsd),
    fetchHistory(fetchImpl, HISTORY_ENDPOINTS.bcvEur),
    fetchHistory(fetchImpl, HISTORY_ENDPOINTS.parallelUsd),
  ])
  return { bcvUsd, bcvEur, parallelUsd }
}
