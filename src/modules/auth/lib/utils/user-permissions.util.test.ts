import { describe, expect, it } from "vitest"

import {
  allowedActions,
  assignableRoles,
  checkInvite,
  checkUserChange,
  USER_PERMISSION_ERRORS,
} from "@/modules/auth/lib/utils/user-permissions.util"

const owner = { id: "o", role: "owner" as const }
const admin = { id: "a", role: "admin" as const }
const staff = { id: "s", role: "staff" as const }
const target = (role: "owner" | "admin" | "staff", isActive = true) => ({ id: `t-${role}`, role, isActive })

describe("invitar", () => {
  it("owner invita cualquier rol; admin solo staff; staff nadie", () => {
    expect(assignableRoles("owner")).toEqual(["owner", "admin", "staff"])
    expect(checkInvite("admin", "staff")).toBeNull()
    expect(checkInvite("admin", "admin")).toBe(USER_PERMISSION_ERRORS.OWNER_ONLY_ROLES)
    expect(checkInvite("staff", "staff")).toBe(USER_PERMISSION_ERRORS.NO_PERMISSION)
  })
})

describe("cambiar rol o estado", () => {
  it("nadie se cambia a sí mismo", () => {
    expect(checkUserChange(owner, { ...target("owner"), id: "o" }, { kind: "role", role: "admin" })).toBe(
      USER_PERMISSION_ERRORS.SELF
    )
    expect(checkUserChange(admin, { ...target("admin"), id: "a" }, { kind: "active", isActive: false })).toBe(
      USER_PERMISSION_ERRORS.SELF
    )
  })

  it("admin solo gestiona staff y no asigna owner ni admin", () => {
    expect(checkUserChange(admin, target("staff"), { kind: "active", isActive: false })).toBeNull()
    expect(checkUserChange(admin, target("staff"), { kind: "role", role: "admin" })).toBe(
      USER_PERMISSION_ERRORS.OWNER_ONLY_ROLES
    )
    expect(checkUserChange(admin, target("admin"), { kind: "active", isActive: false })).toBe(
      USER_PERMISSION_ERRORS.ADMIN_ONLY_STAFF
    )
    expect(checkUserChange(admin, target("owner"), { kind: "role", role: "staff" })).toBe(
      USER_PERMISSION_ERRORS.ADMIN_ONLY_STAFF
    )
  })

  it("owner gestiona todos los roles", () => {
    expect(checkUserChange(owner, target("staff"), { kind: "role", role: "owner" })).toBeNull()
    expect(checkUserChange(owner, target("owner"), { kind: "role", role: "admin" })).toBeNull()
    expect(checkUserChange(owner, target("admin"), { kind: "active", isActive: false })).toBeNull()
  })

  it("staff no gestiona a nadie", () => {
    expect(checkUserChange(staff, target("staff"), { kind: "active", isActive: false })).toBe(
      USER_PERMISSION_ERRORS.NO_PERMISSION
    )
  })

  it("sin cambios no hay nada que guardar", () => {
    expect(checkUserChange(owner, target("admin"), { kind: "role", role: "admin" })).toBe(
      USER_PERMISSION_ERRORS.NO_CHANGE
    )
  })
})

describe("acciones visibles por fila", () => {
  it("admin frente a staff: solo activar/desactivar", () => {
    expect(allowedActions(admin, target("staff"))).toEqual({ changeRole: false, toggleActive: true })
  })
  it("admin frente a owner: nada", () => {
    expect(allowedActions(admin, target("owner"))).toEqual({ changeRole: false, toggleActive: false })
  })
  it("owner frente a admin: todo", () => {
    expect(allowedActions(owner, target("admin"))).toEqual({ changeRole: true, toggleActive: true })
  })
  it("nadie frente a sí mismo", () => {
    expect(allowedActions(owner, { ...target("owner"), id: "o" })).toEqual({ changeRole: false, toggleActive: false })
  })
})
