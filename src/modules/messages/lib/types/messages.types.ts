import type { Database } from "@/common/lib/db/database.types"

export type MessageKind = Database["public"]["Enums"]["message_kind"]
export type MessageChannel = Database["public"]["Enums"]["message_channel"]
export type MessageStatus = Database["public"]["Enums"]["message_status"]

export type MessageTemplate = {
  kind: MessageKind
  name: string
  body: string
  enabled: boolean
  updatedAt: string
  updatedByName: string | null
}

// Sobre qué se manda el mensaje. El servidor arma los datos desde ahí, nunca desde el cliente.
export type MessageTarget = { type: "sale"; saleId: string } | { type: "customer"; customerId: string }

export type MessageValues = Record<string, string>

export type PreparedMessage = {
  kind: MessageKind
  body: string
  phone: string | null
  customerId: string | null
  saleId: string | null
}

export type OutboundMessage = {
  id: string
  kind: MessageKind
  channel: MessageChannel
  status: MessageStatus
  phone: string | null
  body: string
  createdAt: string
  authorName: string | null
}
