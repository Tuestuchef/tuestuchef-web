"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"

import { syncExchangeRatesFromApi } from "../services/rate-sync.service"

const MESSAGES = {
  insert: "Tasas actualizadas desde el BCV.",
  skip_same: "Las tasas ya estaban al día.",
  skip_manual: "Hoy ya hay una tasa corregida a mano; no se reemplazó.",
} as const

// Lo mismo que hace el cron cada mañana, a demanda (owner y admin).
export async function syncExchangeRatesAction(): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const result = await syncExchangeRatesFromApi()
  if (!result.ok) return { status: "error", message: result.error }

  refresh()
  return { status: "success", message: MESSAGES[result.decision], submissionId: crypto.randomUUID() }
}
