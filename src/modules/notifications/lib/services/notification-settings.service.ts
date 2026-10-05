import "server-only"

import type { AppRole } from "@/common/lib/constants/roles.constants"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { NotificationChannel, NotificationKind } from "../constants/notifications.constants"

export type NotificationSettingsView = {
  channels: { email: boolean; push: boolean }
  kinds: { kind: NotificationKind; enabled: boolean; email: boolean; push: boolean; roles: AppRole[]; leadDays: number }[]
}

export async function getNotificationSettings(): Promise<NotificationSettingsView> {
  const supabase = await createSupabaseServerClient()
  const [channels, kinds] = await Promise.all([
    supabase.from("notification_channel_settings").select("*").maybeSingle(),
    supabase.from("notification_settings").select("*"),
  ])
  if (kinds.error) throw kinds.error
  return {
    channels: { email: Boolean(channels.data?.email_enabled), push: Boolean(channels.data?.push_enabled) },
    kinds: kinds.data.map((k) => ({
      kind: k.kind,
      enabled: k.enabled,
      email: k.email_enabled,
      push: k.push_enabled,
      roles: k.roles,
      leadDays: k.lead_days,
    })),
  }
}

export async function updateChannel(channel: NotificationChannel, enabled: boolean) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("notification_channel_settings")
    .update(channel === "email" ? { email_enabled: enabled } : { push_enabled: enabled })
    .eq("id", true)
    .select("id")
    .single()
}

export async function updateKind(kind: NotificationKind, values: { enabled: boolean; email: boolean; push: boolean; roles: AppRole[]; leadDays: number }) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("notification_settings")
    .update({ enabled: values.enabled, email_enabled: values.email, push_enabled: values.push, roles: values.roles, lead_days: values.leadDays })
    .eq("kind", kind)
    .select("kind")
    .single()
}

export async function savePushSubscription(input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) {
  const supabase = await createSupabaseServerClient()
  // Si el dispositivo ya estaba registrado (por otra persona o antes), se reemplaza.
  await supabase.from("push_subscriptions").delete().eq("endpoint", input.endpoint)
  return supabase
    .from("push_subscriptions")
    .insert({ endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth, user_agent: input.userAgent?.slice(0, 300) ?? null })
    .select("id")
    .single()
}

export async function deletePushSubscription(endpoint: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("push_subscriptions").delete().eq("endpoint", endpoint)
}

export async function countMyDevices(): Promise<number> {
  const supabase = await createSupabaseServerClient()
  const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true })
  return count ?? 0
}

export type NotificationLogItem = {
  id: string
  kind: NotificationKind
  channel: NotificationChannel
  title: string
  body: string
  url: string | null
  failed: boolean
  error: string | null
  at: string
}

export async function listMyNotifications(profileId: string, limit = 30): Promise<NotificationLogItem[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("notification_log")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data.map((l) => ({
    id: l.id,
    kind: l.kind,
    channel: l.channel,
    title: l.title,
    body: l.body,
    url: l.url,
    failed: l.status === "failed",
    error: l.error,
    at: l.created_at,
  }))
}
