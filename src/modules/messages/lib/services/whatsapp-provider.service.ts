import "server-only"

import { whatsappLink } from "../utils/render-template.util"
import type { MessageChannel } from "../types/messages.types"

// Cómo sale un mensaje. Hoy solo "link": se abre WhatsApp con el texto y la persona toca enviar.
// Para la API de WhatsApp Business se agrega otro proveedor (channel "wa_api") que envía directo
// y devuelve el id del mensaje; los estados llegan por webhook a set_outbound_message_status.
export type WhatsappDelivery = { kind: "link"; url: string } | { kind: "sent"; providerMessageId: string }

export interface WhatsappProvider {
  channel: MessageChannel
  deliver(message: { body: string; phone: string | null }): Promise<WhatsappDelivery>
}

const linkProvider: WhatsappProvider = {
  channel: "wa_link",
  deliver: async ({ body, phone }) => ({ kind: "link", url: whatsappLink(body, phone) }),
}

export const getWhatsappProvider = (): WhatsappProvider => linkProvider
