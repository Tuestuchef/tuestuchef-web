import type { AppRole } from "@/common/lib/constants/roles.constants"

import { NOTIFICATION_KIND_LABELS, NOTIFICATION_KINDS, type NotificationKind } from "../constants/notifications.constants"

export type NotificationItem = { key: string; title: string; detail: string; url: string }

export type KindSetting = {
  kind: NotificationKind
  enabled: boolean
  emailEnabled: boolean
  pushEnabled: boolean
  roles: AppRole[]
}

export type Recipient = { id: string; role: AppRole; email: string | null; name: string; pushDevices: number }

export type DigestSection = { kind: NotificationKind; title: string; items: NotificationItem[]; listUrl: string }

export type EmailDigest = { recipient: Recipient; sections: DigestSection[] }

export type PushNotice = { recipient: Recipient; kind: NotificationKind; title: string; body: string; url: string }

const MAX_ITEMS_PER_SECTION = 15

// Qué recibe cada persona y por qué canal. Respeta los interruptores generales, los de cada aviso
// y los roles de cada aviso. Un correo por persona con una sección por aviso; un push por aviso.
export function buildDigests(input: {
  channels: { email: boolean; push: boolean }
  settings: KindSetting[]
  recipients: Recipient[]
  items: Partial<Record<NotificationKind, NotificationItem[]>>
}): { emails: EmailDigest[]; pushes: PushNotice[] } {
  const emails: EmailDigest[] = []
  const pushes: PushNotice[] = []
  const settingByKind = new Map(input.settings.map((s) => [s.kind, s]))

  for (const recipient of input.recipients) {
    const sections: DigestSection[] = []
    for (const kind of NOTIFICATION_KINDS) {
      const setting = settingByKind.get(kind)
      const items = input.items[kind] ?? []
      if (!setting?.enabled || !setting.roles.includes(recipient.role) || items.length === 0) continue
      const label = NOTIFICATION_KIND_LABELS[kind]

      if (input.channels.email && setting.emailEnabled && recipient.email) {
        sections.push({ kind, title: label.title, items: items.slice(0, MAX_ITEMS_PER_SECTION), listUrl: label.listUrl })
      }
      if (input.channels.push && setting.pushEnabled && recipient.pushDevices > 0) {
        pushes.push({
          recipient,
          kind,
          title: items.length === 1 ? label.title : `${label.title}: ${items.length}`,
          body: items.length === 1 ? `${items[0].title} · ${items[0].detail}` : items.slice(0, 3).map((i) => i.title).join(" · "),
          url: items.length === 1 ? items[0].url : label.listUrl,
        })
      }
    }
    if (sections.length > 0) emails.push({ recipient, sections })
  }
  return { emails, pushes }
}

// Clave del día: el mismo aviso no se manda dos veces el mismo día a la misma persona.
export const dailyKey = (date: string) => `day:${date}`
