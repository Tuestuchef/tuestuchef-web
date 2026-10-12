import { z } from "zod"

const percent = z.number({ error: "Indica el %." }).gt(0, { error: "El % va de 0 a 100." }).lt(100, { error: "El % va de 0 a 100." })

export const agreementSettingsSchema = z.object({
  customer_id: z.uuid(),
  general_discount_percent: percent.nullable(),
  notes: z.string().trim().max(500).nullable(),
})

export type AgreementSettingsInput = z.infer<typeof agreementSettingsSchema>

// Por producto o combo: un % de descuento o un precio fijo en USD.
export const agreementPriceSchema = z
  .object({
    customer_id: z.uuid(),
    product_id: z.uuid({ error: "Elige el producto o combo." }),
    kind: z.enum(["percent", "fixed"]),
    value: z.number({ error: "Indica el valor." }).positive({ error: "Indica el valor." }).max(1_000_000),
  })
  .refine((v) => v.kind === "fixed" || v.value < 100, { error: "El % va de 0 a 100.", path: ["value"] })

export type AgreementPriceInput = z.infer<typeof agreementPriceSchema>
