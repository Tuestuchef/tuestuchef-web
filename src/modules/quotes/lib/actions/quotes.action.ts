"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { QUOTE_MESSAGES } from "../constants/quotes.constants"
import { headerImageUploadSchema } from "@/modules/business/lib/schemas/business-profile.schema"

import { discardQuoteSchema, markQuoteSchema, QUOTE_HEADER_PATH_PATTERN, saveQuoteSchema } from "../schemas/quote.schema"
import { createQuoteHeaderUpload, verifyQuoteHeaderImage } from "../services/quote-header.service"
import { storeQuotePdf } from "../services/quote-pdf.service"
import {
  discardQuote,
  duplicateQuote,
  getQuoteDetail,
  markQuote,
  newQuoteVersion,
  saveQuoteDraft,
  sendQuote,
} from "../services/quotes.service"

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

// Marcar como enviado: queda congelado y se guarda su PDF oficial (una sola vez).
// El envío por correo y WhatsApp usa esta misma acción.
export async function sendQuoteAction(id: string): Promise<Done> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!idSchema.safeParse(id).success) return { ok: false, error: "Presupuesto inválido." }
  const { error } = await sendQuote(id)
  if (error) return { ok: false, error: toUserError(error) }

  const quote = await getQuoteDetail(id)
  const stored = quote ? await storeQuotePdf(quote) : { ok: true as const, stored: false }
  refresh()
  // El presupuesto ya quedó enviado; si el PDF no se pudo guardar, se genera al pedirlo con los mismos datos.
  if (!stored.ok) console.error(`[quotes] PDF de ${quote?.code} no guardado: ${stored.error}`)
  return { ok: true, message: QUOTE_MESSAGES.SENT }
}

// Firma la subida de una imagen de encabezado solo para un presupuesto.
export async function requestQuoteHeaderUploadAction(
  input: unknown
): Promise<{ ok: true; data: { path: string; uploadUrl: string; contentType: string } } | Fail> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = headerImageUploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }
  return createQuoteHeaderUpload(parsed.data.contentType)
}

export async function verifyQuoteHeaderImageAction(path: unknown): Promise<{ ok: true; data: { url: string | null } } | Fail> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = z.string().regex(QUOTE_HEADER_PATH_PATTERN).safeParse(path)
  if (!parsed.success) return { ok: false, error: "Imagen inválida." }
  return verifyQuoteHeaderImage(parsed.data)
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
