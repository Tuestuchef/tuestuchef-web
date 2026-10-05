import "server-only"

import { createElement } from "react"
import { Resend } from "resend"
import webpush from "web-push"

import { brandConfig } from "@/common/lib/config/brand.config"
import { publicEnv } from "@/common/lib/config/env.config"
import { serverEnv } from "@/common/lib/config/server-env.config"
import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import DigestEmail from "../../components/digest-email"
import { NOTIFICATION_KINDS, type NotificationChannel, type NotificationKind } from "../constants/notifications.constants"
import { buildDigests, dailyKey, type KindSetting, type NotificationItem, type Recipient } from "../utils/digest.util"

export type DispatchSummary = {
  ok: boolean
  error?: string
  emailsSent: number
  pushesSent: number
  skipped: number
  failed: number
}

export const isEmailConfigured = () => Boolean(serverEnv.RESEND_API_KEY && serverEnv.NOTIFICATIONS_EMAIL_FROM)
export const isPushConfigured = () =>
  Boolean(publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY && serverEnv.VAPID_PRIVATE_KEY && serverEnv.VAPID_SUBJECT)

const empty = (error?: string): DispatchSummary => ({ ok: !error, error, emailsSent: 0, pushesSent: 0, skipped: 0, failed: 0 })

// Junta lo pendiente de cada aviso prendido y lo manda a quien corresponde.
// · test: solo a esa persona, ignorando roles y lo ya enviado hoy (botón "Enviarme una prueba").
export async function dispatchNotifications(options: { testProfileId?: string } = {}): Promise<DispatchSummary> {
  const admin = createSupabaseAdminClient()
  if (!admin) return empty("Falta SUPABASE_SECRET_KEY.")

  const today = toCaracasDate()
  const [channelsResult, settingsResult, profilesResult, devicesResult] = await Promise.all([
    admin.from("notification_channel_settings").select("*").maybeSingle(),
    admin.from("notification_settings").select("*"),
    admin.from("profiles").select("id, full_name, email, role, is_active").eq("is_active", true),
    admin.from("push_subscriptions").select("id, profile_id, endpoint, p256dh, auth"),
  ])
  if (settingsResult.error || profilesResult.error) return empty("No se pudo leer la configuración de avisos.")

  const devices = devicesResult.data ?? []
  const channels = {
    email: Boolean(channelsResult.data?.email_enabled) && isEmailConfigured(),
    push: Boolean(channelsResult.data?.push_enabled) && isPushConfigured(),
  }
  const settings: KindSetting[] = settingsResult.data.map((s) => ({
    kind: s.kind,
    enabled: s.enabled,
    emailEnabled: s.email_enabled,
    pushEnabled: s.push_enabled,
    // En la prueba, la persona recibe todos los avisos prendidos sin importar el rol.
    roles: options.testProfileId ? ["owner", "admin", "staff"] : s.roles,
  }))
  const recipients: Recipient[] = profilesResult.data
    .filter((p) => !options.testProfileId || p.id === options.testProfileId)
    .map((p) => ({
      id: p.id,
      role: p.role,
      email: p.email,
      name: p.full_name ?? "",
      pushDevices: devices.filter((d) => d.profile_id === p.id).length,
    }))

  const items: Partial<Record<NotificationKind, NotificationItem[]>> = {}
  for (const kind of NOTIFICATION_KINDS) {
    if (!settings.find((s) => s.kind === kind)?.enabled) continue
    const { data } = await admin.rpc("notification_items", { p_kind: kind })
    items[kind] = (data ?? []).map((r) => ({ key: r.item_key, title: r.title, detail: r.detail, url: r.url }))
  }

  const { emails, pushes } = buildDigests({ channels, settings, recipients, items })
  const summary = empty()
  const key = options.testProfileId ? `test:${Date.now()}` : dailyKey(today)

  // Ya enviado hoy (si el cron se repite): no se vuelve a mandar.
  const { data: sentToday } = await admin.from("notification_log").select("profile_id, kind, channel").eq("dedupe_key", key)
  const alreadySent = new Set((sentToday ?? []).map((l) => `${l.profile_id}:${l.kind}:${l.channel}`))
  const log = async (profileId: string, kind: NotificationKind, channel: NotificationChannel, title: string, body: string, url: string | null, error?: string) => {
    await admin.from("notification_log").insert({
      profile_id: profileId,
      kind,
      channel,
      dedupe_key: key,
      title,
      body: body.slice(0, 1000),
      url,
      status: error ? "failed" : "sent",
      error: error?.slice(0, 500) ?? null,
    })
  }

  // Correos.
  if (emails.length) {
    const resend = new Resend(serverEnv.RESEND_API_KEY)
    const dateLabel = new Intl.DateTimeFormat("es-VE", { dateStyle: "full", timeZone: "America/Caracas" }).format(new Date())
    for (const digest of emails) {
      const sections = digest.sections.filter((s) => !alreadySent.has(`${digest.recipient.id}:${s.kind}:email`))
      if (!sections.length) {
        summary.skipped += 1
        continue
      }
      const subject = `${brandConfig.name}: ${sections.map((s) => `${s.title} (${s.items.length})`).join(", ")}`
      const { error } = await resend.emails.send({
        from: serverEnv.NOTIFICATIONS_EMAIL_FROM!,
        to: digest.recipient.email!,
        subject,
        react: createElement(DigestEmail, { name: digest.recipient.name, dateLabel, sections, siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL }),
      })
      for (const section of sections) {
        await log(digest.recipient.id, section.kind, "email", section.title, `${section.items.length} pendientes`, section.listUrl, error?.message)
      }
      if (error) summary.failed += 1
      else summary.emailsSent += 1
    }
  }

  // Push: a cada dispositivo de la persona. Los vencidos (404/410) se borran.
  if (pushes.length) {
    webpush.setVapidDetails(serverEnv.VAPID_SUBJECT!, publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, serverEnv.VAPID_PRIVATE_KEY!)
    for (const notice of pushes) {
      if (alreadySent.has(`${notice.recipient.id}:${notice.kind}:push`)) {
        summary.skipped += 1
        continue
      }
      let lastError: string | undefined
      let delivered = false
      for (const device of devices.filter((d) => d.profile_id === notice.recipient.id)) {
        try {
          await webpush.sendNotification(
            { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
            JSON.stringify({ title: notice.title, body: notice.body, url: notice.url, tag: notice.kind, icon: brandConfig.icons.pwa192.src })
          )
          delivered = true
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode
          if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", device.id)
          else lastError = (error as Error).message
        }
      }
      await log(notice.recipient.id, notice.kind, "push", notice.title, notice.body, notice.url, delivered ? undefined : (lastError ?? "Sin dispositivos activos."))
      if (delivered) summary.pushesSent += 1
      else summary.failed += 1
    }
  }

  return summary
}
