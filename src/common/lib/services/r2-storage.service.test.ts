import { describe, expect, it } from "vitest"

import { createR2Storage } from "@/common/lib/services/r2-storage.service"

const storage = createR2Storage({
  accountId: "0123456789abcdef0123456789abcdef",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret",
  buckets: { public: "tuestuchef-public", private: "tuestuchef-private" },
  publicUrl: "https://media.example.com",
})

describe("URLs prefirmadas de R2 (sin red)", () => {
  it("subida: bucket privado, expira, firma el Content-Type", async () => {
    const url = new URL(
      await storage.createUploadUrl({
        bucket: "private",
        path: "receipts/2026/09/abc.jpg",
        contentType: "image/jpeg",
        expiresInSeconds: 300,
      })
    )
    expect(url.host).toBe("0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com")
    expect(url.pathname).toBe("/tuestuchef-private/receipts/2026/09/abc.jpg")
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300")
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type")
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/)
    expect(url.searchParams.get("X-Amz-Credential")).toContain("/auto/s3/aws4_request")
  })

  it("descarga: GET firmado de corta duración", async () => {
    const url = new URL(
      await storage.createDownloadUrl({ bucket: "private", path: "receipts/2026/09/abc.pdf", expiresInSeconds: 60 })
    )
    expect(url.pathname).toBe("/tuestuchef-private/receipts/2026/09/abc.pdf")
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60")
    expect(url.searchParams.get("X-Amz-Signature")).toBeTruthy()
  })

  it("URL pública solo con dominio propio", () => {
    expect(storage.getPublicUrl("products/filipina 1.jpg")).toBe("https://media.example.com/products/filipina%201.jpg")
    const withoutDomain = createR2Storage({
      accountId: "0123456789abcdef0123456789abcdef",
      accessKeyId: "k",
      secretAccessKey: "s",
      buckets: { public: "p", private: "q" },
      publicUrl: null,
    })
    expect(withoutDomain.getPublicUrl("x.jpg")).toBeNull()
  })
})
