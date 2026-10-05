import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"

import { MESSAGE_BODY_MAX, OUTBOUND_BODY_MAX } from "../constants/messages.constants"
import { unknownPlaceholders } from "../utils/render-template.util"

const kind = z.enum(Constants.public.Enums.message_kind)

export const messageTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sale"), saleId: z.uuid() }),
  z.object({ type: z.literal("customer"), customerId: z.uuid() }),
])

export const prepareMessageSchema = z.object({ kind, target: messageTargetSchema })

// El texto puede ajustarse en la vista previa antes de abrir WhatsApp.
export const sendMessageSchema = prepareMessageSchema.extend({
  body: z
    .string()
    .trim()
    .min(1, { error: "Escribe el mensaje." })
    .max(OUTBOUND_BODY_MAX, { error: "El mensaje es muy largo." }),
})

export const messageTemplateSchema = z
  .object({
    kind,
    name: z.string().trim().min(1, { error: "Ponle un nombre." }).max(80),
    body: z
      .string()
      .trim()
      .min(1, { error: "Escribe el mensaje." })
      .max(MESSAGE_BODY_MAX, { error: `Máximo ${MESSAGE_BODY_MAX} caracteres.` }),
    enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const unknown = unknownPlaceholders(value.kind, value.body)
    if (unknown.length > 0) {
      ctx.addIssue({ code: "custom", path: ["body"], message: `Este mensaje no conoce: ${unknown.map((k) => `{${k}}`).join(", ")}.` })
    }
  })
