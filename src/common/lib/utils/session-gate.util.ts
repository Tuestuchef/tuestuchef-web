import type { AppRole } from "@/common/lib/constants/roles.constants"

// Owner y admin necesitan 2FA (TOTP) para entrar; staff solo el código por correo.
export const MFA_REQUIRED_ROLES: readonly AppRole[] = ["owner", "admin"]

export const requiresMfa = (role: AppRole) => MFA_REQUIRED_ROLES.includes(role)

export type SessionGate =
  | "anonymous"
  | "inactive"
  // Owner o admin sin app autenticadora configurada: debe activarla.
  | "mfa_setup"
  // Owner o admin con 2FA configurado pero la sesión aún es aal1: debe confirmar el código.
  | "mfa_verify"
  | "active"

export type SessionGateInput =
  | { authenticated: false }
  | {
      authenticated: true
      profile: { role: AppRole; isActive: boolean } | null
      aal: "aal1" | "aal2"
      hasVerifiedTotp: boolean
    }

// Misma regla que current_app_role() en la base: owner y admin solo con aal2.
export function resolveSessionGate(input: SessionGateInput): SessionGate {
  if (!input.authenticated) return "anonymous"
  if (!input.profile?.isActive) return "inactive"
  if (!requiresMfa(input.profile.role) || input.aal === "aal2") return "active"
  return input.hasVerifiedTotp ? "mfa_verify" : "mfa_setup"
}

export const ACTION_ACCESS_ERRORS = {
  SESSION_EXPIRED: "Tu sesión expiró. Vuelve a iniciar sesión.",
  INACTIVE: "Tu usuario está desactivado.",
  MFA_REQUIRED: "Confirma tu verificación en dos pasos para continuar.",
  NO_PERMISSION: "No tienes permiso para hacer esto.",
} as const

// Para server actions: null = permitido; si no, el mensaje.
export function checkActionAccess(
  gate: SessionGate,
  role: AppRole | null,
  allowed: readonly AppRole[]
): string | null {
  if (gate === "anonymous") return ACTION_ACCESS_ERRORS.SESSION_EXPIRED
  if (gate === "inactive") return ACTION_ACCESS_ERRORS.INACTIVE
  if (gate === "mfa_setup" || gate === "mfa_verify") return ACTION_ACCESS_ERRORS.MFA_REQUIRED
  if (!role || !allowed.includes(role)) return ACTION_ACCESS_ERRORS.NO_PERMISSION
  return null
}
