"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { surchargesSchema } from "../schemas/products.schema"
import { saveSurcharges } from "../services/surcharges.service"

const SURCHARGE_PREFIX = "surcharge_"

// Recargos de una talla o un color. Campos surcharge_<producto>: monto en USD; vacío quita el recargo.
export async function saveSurchargesAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const surcharges = Object.fromEntries(
    [...formData.entries()]
      .filter(([key]) => key.startsWith(SURCHARGE_PREFIX))
      .map(([key, value]) => [key.slice(SURCHARGE_PREFIX.length), String(value)])
  )
  const parsed = surchargesSchema.safeParse({ kind: formData.get("kind"), target_id: formData.get("target_id"), surcharges })
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? "Revisa los montos." }

  const { error } = await saveSurcharges(parsed.data.kind, parsed.data.target_id, parsed.data.surcharges)
  if (error) return { status: "error", message: toUserError(error) }

  refresh()
  return { status: "success", message: PRODUCT_MESSAGES.SURCHARGES_SAVED, submissionId: crypto.randomUUID() }
}
