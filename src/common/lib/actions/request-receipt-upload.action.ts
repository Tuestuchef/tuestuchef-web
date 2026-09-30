"use server"

import { RECEIPT_MESSAGES } from "@/common/lib/constants/receipts.constants"
import { receiptUploadSchema } from "@/common/lib/schemas/receipt-upload.schema"
import { createReceiptUpload, type ReceiptResult } from "@/common/lib/services/receipts.service"
import { getSessionState } from "@/common/lib/services/session.service"
import { getStorage } from "@/common/lib/services/storage.service"

// Firma una subida al bucket privado. Verifica la sesión antes de firmar.
export async function requestReceiptUploadAction(
  input: unknown
): Promise<ReceiptResult<{ path: string; uploadUrl: string; contentType: string }>> {
  const session = await getSessionState()
  if (session.status !== "active") return { ok: false, error: RECEIPT_MESSAGES.SESSION_EXPIRED }

  const parsed = receiptUploadSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  return createReceiptUpload(getStorage(), parsed.data)
}
