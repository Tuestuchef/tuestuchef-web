import { MESSAGE_PLACEHOLDERS } from "../constants/messages.constants"
import type { MessageKind, MessageValues } from "../types/messages.types"

const PLACEHOLDER = /\{([a-z_]+)\}/g

// Completa {dato} con su valor. Un dato sin valor queda vacío (nunca se envían llaves sueltas).
export function renderTemplate(body: string, values: MessageValues): string {
  return body
    .replace(PLACEHOLDER, (_, key: string) => values[key] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

// Datos entre llaves que ese mensaje no conoce (p. ej. un error de tipeo como {clinte}).
export function unknownPlaceholders(kind: MessageKind, body: string): string[] {
  const allowed = new Set(MESSAGE_PLACEHOLDERS[kind].map((p) => p.key))
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]))].filter((key) => !allowed.has(key))
}

export const sampleValues = (kind: MessageKind): MessageValues =>
  Object.fromEntries(MESSAGE_PLACEHOLDERS[kind].map((p) => [p.key, p.sample]))

// wa.me con el número (sin "+") si lo hay; si no, WhatsApp deja elegir el contacto.
export function whatsappLink(body: string, phone?: string | null): string {
  return `https://wa.me/${phone ? phone.replace("+", "") : ""}?text=${encodeURIComponent(body)}`
}
