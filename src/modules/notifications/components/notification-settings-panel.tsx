"use client"

import { MailIcon, SendIcon, SmartphoneIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { Input } from "@/common/components/ui/input"
import { Switch } from "@/common/components/ui/switch"
import { type AppRole, ROLE_LABELS } from "@/common/lib/constants/roles.constants"

import { sendTestAction, setChannelAction, setKindAction } from "../lib/actions/notifications.action"
import { NOTIFICATION_KIND_LABELS, NOTIFICATION_KINDS, type NotificationChannel } from "../lib/constants/notifications.constants"
import type { NotificationSettingsView } from "../lib/services/notification-settings.service"

type Props = NotificationSettingsView & { emailConfigured: boolean; pushConfigured: boolean }
type Kind = NotificationSettingsView["kinds"][number]

const ROLES: AppRole[] = ["owner", "admin", "staff"]

// Owner y admin prenden o apagan cada canal y cada aviso; cada cambio se guarda al instante.
const NotificationSettingsPanel = ({ channels, kinds, emailConfigured, pushConfigured }: Props) => {
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState(kinds)

  const run = (action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>, revert?: () => void) =>
    startTransition(async () => {
      const result = await action()
      if (result.ok) toast.success(result.message)
      else {
        toast.error(result.error)
        revert?.()
      }
    })

  const saveKind = (next: Kind) => {
    const previous = rows
    setRows((list) => list.map((k) => (k.kind === next.kind ? next : k)))
    run(() => setKindAction(next), () => setRows(previous))
  }

  const channelRow = (channel: NotificationChannel, enabled: boolean, configured: boolean) => (
    <label className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="flex items-start gap-2">
        {channel === "email" ? <MailIcon className="mt-0.5 size-4" aria-hidden /> : <SmartphoneIcon className="mt-0.5 size-4" aria-hidden />}
        <span>
          {channel === "email" ? "Correo" : "Push (teléfono y computadora)"}
          {!configured && <span className="block text-xs text-muted-foreground">Falta configurarlo en el servidor: aunque esté prendido, no sale.</span>}
        </span>
      </span>
      <Switch defaultChecked={enabled} disabled={pending} onCheckedChange={(value) => run(() => setChannelAction({ channel, enabled: value }))} />
    </label>
  )

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Canales</CardTitle>
          <CardDescription>Apagar un canal detiene todos los avisos por esa vía.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {channelRow("email", channels.email, emailConfigured)}
          {channelRow("push", channels.push, pushConfigured)}
        </CardContent>
      </Card>

      {NOTIFICATION_KINDS.map((kind) => {
        const row = rows.find((r) => r.kind === kind)
        if (!row) return null
        const label = NOTIFICATION_KIND_LABELS[kind]
        return (
          <Card key={kind}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="grid gap-1">
                  <CardTitle>{label.title}</CardTitle>
                  <CardDescription>{label.description}</CardDescription>
                </div>
                <Switch aria-label={`${label.title}: prendido`} checked={row.enabled} disabled={pending} onCheckedChange={(enabled) => saveKind({ ...row, enabled })} />
              </div>
            </CardHeader>
            {row.enabled && (
              <CardContent className="grid gap-3 text-sm">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <Switch checked={row.email} disabled={pending} onCheckedChange={(email) => saveKind({ ...row, email })} />
                    Correo
                  </label>
                  <label className="flex items-center gap-2">
                    <Switch checked={row.push} disabled={pending} onCheckedChange={(push) => saveKind({ ...row, push })} />
                    Push
                  </label>
                </div>
                <fieldset className="grid gap-1.5">
                  <legend className="text-xs text-muted-foreground">Lo reciben</legend>
                  <div className="flex flex-wrap gap-3">
                    {ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="size-4"
                          checked={row.roles.includes(role)}
                          disabled={pending || (row.roles.length === 1 && row.roles.includes(role))}
                          onChange={(e) =>
                            saveKind({ ...row, roles: e.target.checked ? [...row.roles, role] : row.roles.filter((r) => r !== role) })
                          }
                        />
                        {ROLE_LABELS[role]}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {label.leadLabel && (
                  <label className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{label.leadLabel}</span>
                    <Input
                      type="number"
                      min={0}
                      max={90}
                      defaultValue={row.leadDays}
                      className="h-9 w-20"
                      onBlur={(e) => {
                        const leadDays = Math.min(90, Math.max(0, Math.floor(Number(e.target.value) || 0)))
                        if (leadDays !== row.leadDays) saveKind({ ...row, leadDays })
                      }}
                    />
                  </label>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}

      <Card>
        <CardHeader>
          <CardTitle>Probar</CardTitle>
          <CardDescription>Te envía ahora, solo a ti, lo pendiente de cada aviso prendido.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {!emailConfigured && !pushConfigured && (
            <StatusAlert tone="warning" title="Ningún canal está configurado en el servidor">
              Faltan las variables de Resend o de push (ver Puesta en marcha).
            </StatusAlert>
          )}
          <Button variant="outline" className="h-11 w-fit md:h-9" disabled={pending} onClick={() => run(sendTestAction)}>
            <SendIcon aria-hidden />
            Enviarme una prueba
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default NotificationSettingsPanel
