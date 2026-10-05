"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { MESSAGES_FEEDBACK } from "../constants/messages.constants"
import { messageTemplateSchema, prepareMessageSchema, sendMessageSchema } from "../schemas/messages.schema"
import { resolveMessageContext } from "../services/message-context.service"
import { getMessageTemplate, updateMessageTemplate } from "../services/message-templates.service"
import { logOutboundMessage } from "../services/outbound-messages.service"
import { getWhatsappProvider } from "../services/whatsapp-provider.service"
import type { MessageKind, MessageTarget } from "../types/messages.types"
import { renderTemplate } from "../utils/render-template.util"

type Fail = { ok: false; error: string }

async function authorizeFor(kind: MessageKind) {
  return authorizeAction(kind === "payment_reminder" ? ROLE_GROUPS.MANAGEMENT : ROLE_GROUPS.ALL)
}

async function buildMessage(kind: MessageKind, target: MessageTarget) {
  const template = await getMessageTemplate(kind)
  if (!template?.enabled) return { ok: false as const, error: "Ese mensaje está apagado en Configuración." }
  const resolved = await resolveMessageContext(kind, target)
  if (!resolved.ok) return resolved
  return { ok: true as const, context: resolved.context, body: renderTemplate(template.body, resolved.context.values) }
}

// Vista previa: el texto ya completado y si el cliente tiene teléfono.
export async function prepareMessageAction(input: unknown): Promise<{ ok: true; body: string; hasPhone: boolean } | Fail> {
  const parsed = prepareMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Mensaje inválido." }
  const auth = await authorizeFor(parsed.data.kind)
  if (!auth.ok) return { ok: false, error: auth.error }
  const built = await buildMessage(parsed.data.kind, parsed.data.target)
  if (!built.ok) return built
  return { ok: true, body: built.body, hasPhone: Boolean(built.context.phone) }
}

// Registra el mensaje (con el texto final) y devuelve el enlace para abrir WhatsApp.
export async function sendMessageAction(input: unknown): Promise<{ ok: true; url: string | null; message: string } | Fail> {
  const parsed = sendMessageSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Mensaje inválido." }
  const auth = await authorizeFor(parsed.data.kind)
  if (!auth.ok) return { ok: false, error: auth.error }
  // Teléfono, cliente y venta salen de la base, no del navegador.
  const built = await buildMessage(parsed.data.kind, parsed.data.target)
  if (!built.ok) return built
  const { phone, customerId, saleId } = built.context

  const { error } = await logOutboundMessage({ kind: parsed.data.kind, body: parsed.data.body, phone, customerId, saleId })
  if (error) return { ok: false, error: toUserError(error, "No se pudo registrar el mensaje.") }

  const delivery = await getWhatsappProvider().deliver({ body: parsed.data.body, phone })
  refresh()
  return delivery.kind === "link"
    ? { ok: true, url: delivery.url, message: phone ? MESSAGES_FEEDBACK.OPENED : MESSAGES_FEEDBACK.NO_PHONE }
    : { ok: true, url: null, message: "Mensaje enviado." }
}

// Editar una plantilla (nombre, texto, prendida): owner y admin.
export async function updateMessageTemplateAction(input: unknown): Promise<{ ok: true; message: string } | Fail> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = messageTemplateSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const { kind, ...values } = parsed.data
  const { error } = await updateMessageTemplate(kind, values)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: MESSAGES_FEEDBACK.TEMPLATE_SAVED }
}
