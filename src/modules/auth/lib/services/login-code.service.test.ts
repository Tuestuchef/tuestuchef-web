import { describe, expect, it, vi } from "vitest"

import { requestLoginCode } from "@/modules/auth/lib/services/login-code.service"

const deps = (allowed: boolean, error: { code?: string; status?: number } | null = null) => ({
  isAllowed: vi.fn(async () => allowed),
  sendCode: vi.fn(async () => ({ error })),
})

describe("pedir código de acceso", () => {
  it("usuario activo: se envía el código", async () => {
    const d = deps(true)
    expect(await requestLoginCode("staff@t.test", d)).toEqual({ ok: true })
    expect(d.sendCode).toHaveBeenCalledWith("staff@t.test")
  })

  it("usuario desactivado: no se envía nada y la respuesta es igual (no revela nada)", async () => {
    const d = deps(false)
    expect(await requestLoginCode("inactivo@t.test", d)).toEqual({ ok: true })
    expect(d.sendCode).not.toHaveBeenCalled()
  })

  it("límite de envíos", async () => {
    expect(await requestLoginCode("a@t.test", deps(true, { status: 429 }))).toEqual({
      ok: false,
      reason: "rate_limited",
    })
    expect(await requestLoginCode("a@t.test", deps(true, { code: "over_email_send_rate_limit" }))).toEqual({
      ok: false,
      reason: "rate_limited",
    })
  })

  it("otro error", async () => {
    expect(await requestLoginCode("a@t.test", deps(true, { status: 500 }))).toEqual({
      ok: false,
      reason: "unexpected",
    })
  })
})
