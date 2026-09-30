import { z } from "zod"

import {
  RECEIPT_CONTENT_TYPES,
  RECEIPT_MAX_BYTES,
  RECEIPT_MESSAGES,
  RECEIPT_PATH_PATTERN,
  type ReceiptContentType,
} from "@/common/lib/constants/receipts.constants"

const contentTypes = Object.keys(RECEIPT_CONTENT_TYPES) as [
  ReceiptContentType,
  ...ReceiptContentType[],
]

export const receiptUploadSchema = z.object({
  contentType: z.enum(contentTypes, { error: RECEIPT_MESSAGES.INVALID_TYPE }),
  size: z
    .number()
    .int()
    .positive({ error: RECEIPT_MESSAGES.EMPTY })
    .max(RECEIPT_MAX_BYTES, { error: RECEIPT_MESSAGES.TOO_LARGE }),
})

export type ReceiptUploadInput = z.infer<typeof receiptUploadSchema>

// Campo opcional de formularios: vacío = sin comprobante.
export const receiptPathSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .refine((value) => value === undefined || RECEIPT_PATH_PATTERN.test(value), {
    error: RECEIPT_MESSAGES.INVALID_PATH,
  })
