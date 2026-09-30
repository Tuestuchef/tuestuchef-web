import { describe, expect, it } from "vitest"

import {
  RECEIPT_MAX_BYTES,
  RECEIPT_MESSAGES,
  RECEIPT_PATH_PATTERN,
} from "@/common/lib/constants/receipts.constants"
import {
  receiptPathSchema,
  receiptUploadSchema,
} from "@/common/lib/schemas/receipt-upload.schema"
import { createMemoryStorage } from "@/common/lib/services/memory-storage.service"
import {
  buildReceiptPath,
  createReceiptDownloadUrl,
  createReceiptUpload,
  verifyReceipt,
} from "@/common/lib/services/receipts.service"

describe("validación de la subida", () => {
  it.each([
    ["image/jpeg", 1000, true],
    ["image/png", RECEIPT_MAX_BYTES, true],
    ["application/pdf", 50_000, true],
    ["image/gif", 1000, false],
    ["image/heic", 1000, false],
    ["text/html", 10, false],
    ["image/jpeg", 0, false],
    ["image/jpeg", RECEIPT_MAX_BYTES + 1, false],
  ])("%s de %i bytes → %s", (contentType, size, valid) => {
    expect(receiptUploadSchema.safeParse({ contentType, size }).success).toBe(valid)
  })

  it("mensajes claros en español", () => {
    const tooLarge = receiptUploadSchema.safeParse({ contentType: "image/jpeg", size: RECEIPT_MAX_BYTES + 1 })
    const badType = receiptUploadSchema.safeParse({ contentType: "image/gif", size: 10 })
    expect(tooLarge.error?.issues[0].message).toBe(RECEIPT_MESSAGES.TOO_LARGE)
    expect(badType.error?.issues[0].message).toBe(RECEIPT_MESSAGES.INVALID_TYPE)
  })
})

describe("ruta generada por el sistema", () => {
  it("receipts/AAAA/MM/<uuid>.<ext> con el mes de Caracas", () => {
    // 1 de octubre 02:00 UTC = 30 de septiembre 22:00 en Caracas.
    const path = buildReceiptPath("jpg", new Date("2026-10-01T02:00:00Z"))
    expect(path).toMatch(/^receipts\/2026\/09\//)
    expect(path).toMatch(RECEIPT_PATH_PATTERN)
  })

  it("el nombre del archivo del usuario nunca llega a la ruta", async () => {
    const { provider } = createMemoryStorage()
    const result = await createReceiptUpload(provider, { contentType: "application/pdf", size: 10 })
    expect(result.ok && result.data.path).toMatch(/^receipts\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/)
  })

  it("el campo del formulario solo acepta rutas con el formato del sistema", () => {
    expect(receiptPathSchema.safeParse("").data).toBeUndefined()
    expect(receiptPathSchema.safeParse(undefined).success).toBe(true)
    expect(receiptPathSchema.safeParse("https://evil.com/x.jpg").success).toBe(false)
    expect(receiptPathSchema.safeParse("receipts/2026/09/../../secreto.pdf").success).toBe(false)
    expect(receiptPathSchema.safeParse(buildReceiptPath("png")).success).toBe(true)
  })
})

describe("subida", () => {
  it("sin almacenamiento configurado responde deshabilitado, sin romper", async () => {
    const result = await createReceiptUpload(null, { contentType: "image/jpeg", size: 10 })
    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.DISABLED })
  })

  it("firma una URL de corta duración al bucket privado con el tipo fijo", async () => {
    const { provider } = createMemoryStorage()
    const result = await createReceiptUpload(provider, { contentType: "image/png", size: 10 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.uploadUrl).toContain("memory://private/receipts/")
    expect(result.data.uploadUrl).toContain("contentType=image%2Fpng")
    expect(result.data.uploadUrl).toContain("expires=300")
  })
})

describe("verificación antes de guardar la ruta", () => {
  it("rechaza si el archivo no se subió", async () => {
    const { provider } = createMemoryStorage()
    const result = await verifyReceipt(provider, buildReceiptPath("jpg"))
    expect(result).toEqual({ ok: false, error: RECEIPT_MESSAGES.NOT_UPLOADED })
  })

  it("acepta un archivo que coincide en tipo y tamaño", async () => {
    const storage = createMemoryStorage()
    const path = buildReceiptPath("jpg")
    storage.putObject("private", path, { size: 2048, contentType: "image/jpeg" })
    expect(await verifyReceipt(storage.provider, path)).toEqual({ ok: true, data: undefined })
  })

  it("borra y rechaza un archivo con otro tipo o demasiado grande", async () => {
    const storage = createMemoryStorage()
    const wrongType = buildReceiptPath("jpg")
    const tooLarge = buildReceiptPath("pdf")
    storage.putObject("private", wrongType, { size: 2048, contentType: "text/html" })
    storage.putObject("private", tooLarge, { size: RECEIPT_MAX_BYTES + 1, contentType: "application/pdf" })

    expect(await verifyReceipt(storage.provider, wrongType)).toEqual({ ok: false, error: RECEIPT_MESSAGES.INVALID_TYPE })
    expect(await verifyReceipt(storage.provider, tooLarge)).toEqual({ ok: false, error: RECEIPT_MESSAGES.TOO_LARGE })
    expect(storage.hasObject("private", wrongType)).toBe(false)
    expect(storage.hasObject("private", tooLarge)).toBe(false)
  })

  it("rechaza rutas fuera del formato del sistema", async () => {
    const { provider } = createMemoryStorage()
    expect(await verifyReceipt(provider, "products/foto.jpg")).toEqual({
      ok: false,
      error: RECEIPT_MESSAGES.INVALID_PATH,
    })
  })

  it("sin almacenamiento, deshabilitado", async () => {
    expect(await verifyReceipt(null, buildReceiptPath("jpg"))).toEqual({ ok: false, error: RECEIPT_MESSAGES.DISABLED })
  })
})

describe("descarga", () => {
  it("URL prefirmada de corta duración del bucket privado", async () => {
    const { provider } = createMemoryStorage()
    const path = buildReceiptPath("pdf")
    const result = await createReceiptDownloadUrl(provider, path)
    expect(result.ok && result.data).toBe(`memory://private/${path}?method=GET&expires=300`)
  })
})
