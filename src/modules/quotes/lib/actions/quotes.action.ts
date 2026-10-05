"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { QUOTE_MESSAGES } from "../constants/quotes.constants"
import { discardQuoteSchema, markQuoteSchema, saveQuoteSchema } from "../schemas/quote.schema"
import { discardQuote, duplicateQuote, markQuote, newQuoteVersion, saveQuoteDraft, sendQuote } from "../services/quotes.service"

type Fail = { ok: false; error: string }
type Done = { ok: true; message: string } | Fail
type WithId = { ok: true; id: string; message: string } | Fail

const idSchema = z.uuid()

// Guardar un borrador (nuevo o existente). Todos los roles; la base valida y calcula precios.
export async function saveQuoteDraftAction(input: unknown): Promise<WithId> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = saveQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Presupuesto inválido." }
  const { data, error } = await saveQuoteDraft(parsed.data)
  if (error || !data) return { ok: false, error: toUserError(error, "No se pudo guardar el presupuesto.") }
  refresh()
  return { ok: true, id: data, message: QUOTE_MESSAGES.SAVED }
}

// Marcar como enviado: queda congelado. El envío por correo y WhatsApp usa esta misma acción.
export async function sendQuoteAction(id: string): Promise<Done> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Presupuesto inválido." }
  const { error } = await sendQuote(id)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: QUOTE_MESSAGES.SENT }
}

export async function markQuoteAction(input: unknown): Promise<Done> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = markQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const { error } = await markQuote(parsed.data.id, parsed.data.status, parsed.data.note)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: parsed.data.status === "accepted" ? QUOTE_MESSAGES.ACCEPTED : QUOTE_MESSAGES.REJECTED }
}

export async function discardQuoteAction(input: unknown): Promise<Done> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = discardQuoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const { error } = await discardQuote(parsed.data.id, parsed.data.reason)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: QUOTE_MESSAGES.DISCARDED }
}

export async function newQuoteVersionAction(id: string): Promise<WithId> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Presupuesto inválido." }
  const { data, error } = await newQuoteVersion(id)
  if (error || !data) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, id: data, message: QUOTE_MESSAGES.VERSION }
}

export async function duplicateQuoteAction(id: string): Promise<WithId> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Presupuesto inválido." }
  const { data, error } = await duplicateQuote(id)
  if (error || !data) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, id: data, message: QUOTE_MESSAGES.DUPLICATED }
}
