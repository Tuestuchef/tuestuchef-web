import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"

import { MESSAGE_KIND_LABELS, MESSAGE_STATUS_LABELS } from "../lib/constants/messages.constants"
import { listOutboundMessages, type OutboundMessageFilter } from "../lib/services/outbound-messages.service"

// "Mensajes enviados" de una venta o un cliente. No se muestra si no hay ninguno.
const CHANNEL_LABELS = { wa_link: "WhatsApp", wa_api: "WhatsApp", email: "Correo" } as const

const MessageHistory = async ({ filter }: { filter: OutboundMessageFilter }) => {
  const messages = await listOutboundMessages(filter)
  if (messages.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensajes enviados</CardTitle>
        <CardDescription>En WhatsApp, &quot;Abierto&quot; significa que se preparó el mensaje: el envío se confirma en WhatsApp. Los correos los envía el sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {messages.map((m) => (
            <li key={m.id} className="py-2">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium">{MESSAGE_KIND_LABELS[m.kind]}</span>
                  <span className="text-xs text-muted-foreground">
                    {CHANNEL_LABELS[m.channel]} · {formatDate(m.createdAt)} · {formatTime(m.createdAt)} · {m.authorName ?? "—"} · {MESSAGE_STATUS_LABELS[m.status]}
                  </span>
                </summary>
                <p className="mt-2 rounded-md bg-muted p-2 text-sm whitespace-pre-wrap">{m.body}</p>
              </details>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export default MessageHistory
