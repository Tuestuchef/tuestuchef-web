import type { AppRole } from "@/common/lib/constants/roles.constants"

// Mismas reglas que aplica la base (RLS + triggers). Aquí sirven para responder
// con un mensaje claro antes de llegar a la base y para mostrar solo lo permitido.

export type UserChange = { kind: "role"; role: AppRole } | { kind: "active"; isActive: boolean }

type Actor = { id: string; role: AppRole }
type Target = { id: string; role: AppRole; isActive: boolean }

export const USER_PERMISSION_ERRORS = {
  SELF: "No puedes cambiar tu propio rol ni desactivarte.",
  NO_PERMISSION: "No tienes permiso para gestionar usuarios.",
  ADMIN_ONLY_STAFF: "Un admin solo gestiona usuarios con rol staff.",
  OWNER_ONLY_ROLES: "Solo un owner asigna o quita los roles owner y admin.",
  NO_CHANGE: "No hay cambios que guardar.",
} as const

// Roles que cada rol puede asignar (al invitar o al cambiar).
export function assignableRoles(actorRole: AppRole): AppRole[] {
  if (actorRole === "owner") return ["owner", "admin", "staff"]
  if (actorRole === "admin") return ["staff"]
  return []
}

export function checkInvite(actorRole: AppRole, role: AppRole): string | null {
  if (actorRole === "staff") return USER_PERMISSION_ERRORS.NO_PERMISSION
  if (!assignableRoles(actorRole).includes(role)) return USER_PERMISSION_ERRORS.OWNER_ONLY_ROLES
  return null
}

// null = permitido; si no, el motivo.
export function checkUserChange(actor: Actor, target: Target, change: UserChange): string | null {
  if (actor.id === target.id) return USER_PERMISSION_ERRORS.SELF
  if (actor.role === "staff") return USER_PERMISSION_ERRORS.NO_PERMISSION

  if (actor.role === "admin") {
    if (target.role !== "staff") return USER_PERMISSION_ERRORS.ADMIN_ONLY_STAFF
    if (change.kind === "role" && change.role !== "staff") return USER_PERMISSION_ERRORS.OWNER_ONLY_ROLES
  }

  if (change.kind === "role" && change.role === target.role) return USER_PERMISSION_ERRORS.NO_CHANGE
  if (change.kind === "active" && change.isActive === target.isActive) return USER_PERMISSION_ERRORS.NO_CHANGE

  return null
}

// Qué acciones mostrar en la fila de un usuario.
export function allowedActions(actor: Actor, target: Target) {
  return {
    changeRole: assignableRoles(actor.role).some(
      (role) => role !== target.role && !checkUserChange(actor, target, { kind: "role", role })
    ),
    toggleActive: !checkUserChange(actor, target, { kind: "active", isActive: !target.isActive }),
  }
}
