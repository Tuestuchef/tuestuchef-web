"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { Constants } from "@/common/lib/db/database.types"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { NOTIFICATION_MESSAGES } from "../constants/notifications.constants"
import { dispatchNotifications } from "../services/notification-dispatch.service"
import { deletePushSubscription, savePushSubscription, updateChannel, updateKind } from "../services/notification-settings.service"

type Result = { ok: true; message: string } | { ok: false; error: string }
const E = Constants.public.Enums

const channelSchema = z.object({ channel: z.enum(E.notification_channel), enabled: z.boolean() })
const kindSchema = z.object({
  kind: z.enum(E.notification_kind),
  enabled: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
  roles: z.array(z.enum(E.app_role)).min(1, { error: "Elige al menos un rol." }),
  leadDays: z.number().int().min(0).max(90),
})
const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
  userAgent: z.string().max(300).optional(),
})

// Prender o apagar un canal completo (correo o push): owner y admin.
export async function setChannelAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = channelSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Datos inválidos." }
  const { error } = await updateChannel(parsed.data.channel, parsed.data.enabled)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: NOTIFICATION_MESSAGES.SAVED }
}

// Un aviso: prendido, canales, roles que lo reciben y anticipación. Owner y admin.
export async function setKindAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = kindSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." }
  const { kind, ...values } = parsed.data
  const { error } = await updateKind(kind, values)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: NOTIFICATION_MESSAGES.SAVED }
}

// Cada persona activa o desactiva el push en su dispositivo.
export async function subscribePushAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = subscriptionSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "El navegador devolvió una suscripción inválida." }
  const { error } = await savePushSubscription({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    userAgent: parsed.data.userAgent,
  })
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: NOTIFICATION_MESSAGES.DEVICE_ON }
}

export async function unsubscribePushAction(endpoint: string): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.url().safeParse(endpoint).success) return { ok: false, error: "Dispositivo inválido." }
  const { error } = await deletePushSubscription(endpoint)
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: NOTIFICATION_MESSAGES.DEVICE_OFF }
}

// Enviarme ahora lo pendiente de cada aviso prendido (para probar). Owner y admin.
export async function sendTestAction(): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const summary = await dispatchNotifications({ testProfileId: auth.user.id })
  if (!summary.ok) return { ok: false, error: summary.error ?? "No se pudo enviar." }
  refresh()
  const sent = summary.emailsSent + summary.pushesSent
  return sent > 0
    ? { ok: true, message: `${NOTIFICATION_MESSAGES.TEST_SENT} ${summary.emailsSent} correo(s), ${summary.pushesSent} push.` }
    : { ok: false, error: summary.failed ? "Falló el envío: revisa el historial." : "No hay nada pendiente en los avisos prendidos, o los canales están apagados." }
}
