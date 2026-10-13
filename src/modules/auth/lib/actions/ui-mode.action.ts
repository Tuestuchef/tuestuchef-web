"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { setOwnSimpleMode } from "../services/users.service"

// Modo simple (pestañas abajo en el celular, menú corto) o completo: cada quien elige el suyo.
export async function setSimpleModeAction(simple: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = z.boolean().safeParse(simple)
  if (!parsed.success) return { ok: false, error: "Modo inválido." }
  const { error } = await setOwnSimpleMode(auth.user.id, parsed.data)
  if (error) return { ok: false, error: toUserError(error, "No se pudo cambiar el modo.") }
  refresh()
  return { ok: true }
}
