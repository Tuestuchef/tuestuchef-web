"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { agreementPriceSchema, agreementSettingsSchema } from "../schemas/agreements.schema"
import { deleteAgreement, deleteAgreementPrice, saveAgreementPrice, saveAgreementSettings } from "../services/agreements.service"

type Result = { ok: true; message: string } | { ok: false; error: string }

const firstIssue = (error: z.ZodError) => error.issues[0]?.message ?? "Revisa los datos."

// Acuerdos: solo owner y admin (la base lo vuelve a exigir).
export async function saveAgreementSettingsAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = agreementSettingsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { error } = await saveAgreementSettings(parsed.data)
  if (error) return { ok: false, error: toUserError(error, "No se pudo guardar el acuerdo.") }
  refresh()
  return { ok: true, message: "Acuerdo guardado." }
}

export async function deleteAgreementAction(customerId: string): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(customerId).success) return { ok: false, error: "Cliente inválido." }
  const { error } = await deleteAgreement(customerId)
  if (error) return { ok: false, error: toUserError(error, "No se pudo quitar el acuerdo.") }
  refresh()
  return { ok: true, message: "Acuerdo quitado: vuelve a precios normales." }
}

export async function saveAgreementPriceAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = agreementPriceSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) }
  const { error } = await saveAgreementPrice(parsed.data)
  if (error) return { ok: false, error: toUserError(error, "No se pudo guardar el precio.") }
  refresh()
  return { ok: true, message: "Precio del acuerdo guardado." }
}

export async function deleteAgreementPriceAction(id: string): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Precio inválido." }
  const { error } = await deleteAgreementPrice(id)
  if (error) return { ok: false, error: toUserError(error, "No se pudo quitar el precio.") }
  refresh()
  return { ok: true, message: "Precio quitado del acuerdo." }
}
