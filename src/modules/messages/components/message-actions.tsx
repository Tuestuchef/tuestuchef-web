import { listMessageTemplates } from "../lib/services/message-templates.service"
import type { MessageKind, MessageTarget } from "../lib/types/messages.types"
import MessageButton from "./message-button"

// Muestra el botón de WhatsApp con los mensajes que aplican y están prendidos.
const MessageActions = async ({ target, kinds, size }: { target: MessageTarget; kinds: MessageKind[]; size?: "default" | "sm" }) => {
  const templates = await listMessageTemplates()
  const options = templates.filter((t) => t.enabled && kinds.includes(t.kind)).map((t) => ({ kind: t.kind, label: t.name }))
  if (options.length === 0) return null
  return <MessageButton target={target} options={options} size={size} />
}

export default MessageActions
