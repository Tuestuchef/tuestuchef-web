import { z } from "zod"

import { receiptPathSchema } from "@/common/lib/schemas/receipt-upload.schema"
import {
  optionalPositiveAmountSchema,
  optionalTextSchema,
  pastOrTodayDateSchema,
  positiveAmountSchema,
} from "@/common/lib/schemas/form-fields.schema"

export const accountTransferSchema = z
  .object({
    from_account_id: z.uuid({ error: "Elige la cuenta de origen." }),
    to_account_id: z.uuid({ error: "Elige la cuenta de destino." }),
    amount_out: positiveAmountSchema("lo que sale"),
    amount_in: positiveAmountSchema("lo que llega"),
    date: pastOrTodayDateSchema,
    note: optionalTextSchema(200),
    receipt_path: receiptPathSchema,
    // Tasas propias de esta operación. Vacías = las del día.
    binance_rate: optionalPositiveAmountSchema("la tasa Binance", 8),
    bcv_usd_rate: optionalPositiveAmountSchema("la tasa BCV", 8),
    usd_usdt_rate: optionalPositiveAmountSchema("USD → USDT", 8),
  })
  .refine((value) => value.from_account_id !== value.to_account_id, {
    error: "Las cuentas deben ser distintas.",
    path: ["to_account_id"],
  })

export const reverseTransferSchema = z.object({
  transfer_id: z.uuid(),
  reason: z.string().trim().min(3, { error: "Escribe el motivo de la anulación." }).max(200),
})

export type AccountTransferInput = z.infer<typeof accountTransferSchema>
export type AccountTransferField = keyof AccountTransferInput
