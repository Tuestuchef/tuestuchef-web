import { MailIcon, SmartphoneIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { publicEnv } from "@/common/lib/config/env.config"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"

import PushDeviceToggle from "../components/push-device-toggle"
import { listMyNotifications } from "../lib/services/notification-settings.service"

// Mis avisos: activar el push en este dispositivo y ver lo que me llegó.
const MyNotificationsScreen = async ({ user }: { user: SessionUser }) => {
  const log = await listMyNotifications(user.id)
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="myNotifications"
        title="Mis avisos"
        description="Recordatorios diarios de lo que necesita atención."
        actions={
          canManage && (
            <Link href={ROUTES.SETTINGS_NOTIFICATIONS} className="text-sm underline-offset-4 hover:underline">
              Configurar avisos
            </Link>
          )
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Este dispositivo</CardTitle>
          <CardDescription>Actívalo en cada teléfono o computadora donde quieras recibir los avisos.</CardDescription>
        </CardHeader>
        <CardContent>
          <PushDeviceToggle vapidPublicKey={publicEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lo que me llegó</CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no te ha llegado ningún aviso.</p>
          ) : (
            <ul className="divide-y">
              {log.map((item) => (
                <li key={item.id} className="flex items-start gap-3 py-2.5">
                  {item.channel === "email" ? (
                    <MailIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Correo" />
                  ) : (
                    <SmartphoneIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label="Push" />
                  )}
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    {item.url ? (
                      <Link href={item.url} className="text-sm font-medium underline-offset-4 hover:underline">
                        {item.title}
                      </Link>
                    ) : (
                      <span className="text-sm font-medium">{item.title}</span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">{item.body}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.at)} · {formatTime(item.at)}
                    </span>
                  </div>
                  {item.failed && <StatusBadge tone="error">No se envió</StatusBadge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default MyNotificationsScreen
