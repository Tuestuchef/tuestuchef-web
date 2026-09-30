import { describe, expect, it } from "vitest"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import {
  ACTION_ACCESS_ERRORS,
  checkActionAccess,
  resolveSessionGate,
} from "@/common/lib/utils/session-gate.util"

const session = (role: "owner" | "admin" | "staff", aal: "aal1" | "aal2", hasVerifiedTotp = false, isActive = true) =>
  resolveSessionGate({ authenticated: true, profile: { role, isActive }, aal, hasVerifiedTotp })

describe("acceso al panel", () => {
  it("sin sesión → login", () => {
    expect(resolveSessionGate({ authenticated: false })).toBe("anonymous")
  })

  it("usuario desactivado → fuera, aunque tenga aal2", () => {
    expect(session("owner", "aal2", true, false)).toBe("inactive")
    expect(session("staff", "aal1", false, false)).toBe("inactive")
  })

  it("sesión sin perfil → fuera", () => {
    expect(resolveSessionGate({ authenticated: true, profile: null, aal: "aal1", hasVerifiedTotp: false })).toBe(
      "inactive"
    )
  })

  it.each(["owner", "admin"] as const)("%s sin 2FA configurado → debe activarlo antes de entrar", (role) => {
    expect(session(role, "aal1", false)).toBe("mfa_setup")
  })

  it.each(["owner", "admin"] as const)("%s con 2FA pero sesión aal1 → debe confirmar el código", (role) => {
    expect(session(role, "aal1", true)).toBe("mfa_verify")
  })

  it.each(["owner", "admin"] as const)("%s con aal2 → entra", (role) => {
    expect(session(role, "aal2", true)).toBe("active")
  })

  it("staff entra solo con el código por correo", () => {
    expect(session("staff", "aal1")).toBe("active")
  })
})

describe("acciones de owner/admin sin aal2 son rechazadas", () => {
  it.each(["mfa_setup", "mfa_verify"] as const)("sesión en %s", (gate) => {
    expect(checkActionAccess(gate, "owner", ROLE_GROUPS.MANAGEMENT)).toBe(ACTION_ACCESS_ERRORS.MFA_REQUIRED)
    expect(checkActionAccess(gate, "admin", ROLE_GROUPS.ALL)).toBe(ACTION_ACCESS_ERRORS.MFA_REQUIRED)
  })

  it("con aal2 se permiten", () => {
    expect(checkActionAccess("active", "admin", ROLE_GROUPS.MANAGEMENT)).toBeNull()
  })

  it("staff no ejecuta acciones de owner/admin", () => {
    expect(checkActionAccess("active", "staff", ROLE_GROUPS.MANAGEMENT)).toBe(ACTION_ACCESS_ERRORS.NO_PERMISSION)
  })

  it("sin sesión o desactivado", () => {
    expect(checkActionAccess("anonymous", null, ROLE_GROUPS.ALL)).toBe(ACTION_ACCESS_ERRORS.SESSION_EXPIRED)
    expect(checkActionAccess("inactive", null, ROLE_GROUPS.ALL)).toBe(ACTION_ACCESS_ERRORS.INACTIVE)
  })
})
