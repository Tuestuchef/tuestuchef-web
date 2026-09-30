import "server-only"

import { z } from "zod"

import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import type { ApiRates } from "../types/treasury.types"

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
