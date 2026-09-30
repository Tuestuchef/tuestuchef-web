import "server-only"

import { redirect } from "next/navigation"
import { cache } from "react"

import type { AppRole } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import type { SessionUser } from "@/common/lib/types/session.types"
import {
  checkActionAccess,
  requiresMfa,
  resolveSessionGate,
  type SessionGate,
} from "@/common/lib/utils/session-gate.util"

export type SessionState =
  | { status: Extract<SessionGate, "anonymous" | "inactive"> }
  | { status: "mfa_setup"; user: SessionUser }
  | { status: "mfa_verify"; user: SessionUser; factorId: string }
  | { status: "active"; user: SessionUser }

// Una sola lectura por request (cache de React).
export const getSessionState = cache(async (): Promise<SessionState> => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims

  if (!claims?.sub) return { status: "anonymous" }

  // Su propio perfil siempre es visible (incluso con aal1), para decidir a dónde va.
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, is_active")
    .eq("id", claims.sub)
    .maybeSingle()

  const aal = claims.aal === "aal2" ? "aal2" : "aal1"
  let verifiedTotpId: string | undefined

  // Solo owner/admin con aal1 necesitan saber si ya configuraron la app autenticadora.
  if (profile?.is_active && requiresMfa(profile.role) && aal === "aal1") {
    const { data: factors } = await supabase.auth.mfa.listFactors()
    verifiedTotpId = factors?.totp[0]?.id
  }

  const gate = resolveSessionGate({
    authenticated: true,
    profile: profile ? { role: profile.role, isActive: profile.is_active } : null,
    aal,
    hasVerifiedTotp: Boolean(verifiedTotpId),
  })

  if (gate === "anonymous" || gate === "inactive" || !profile) return { status: "inactive" }

  const user: SessionUser = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: profile.full_name,
    role: profile.role,
  }

  if (gate === "mfa_verify") return { status: "mfa_verify", user, factorId: verifiedTotpId! }
  if (gate === "mfa_setup") return { status: "mfa_setup", user }
  return { status: "active", user }
})

// A dónde va cada sesión: login, salida, 2FA o el panel.
export function redirectForSession(state: SessionState): never {
  if (state.status === "anonymous") redirect(ROUTES.LOGIN)
  if (state.status === "inactive") redirect(ROUTES.SIGN_OUT_INACTIVE)
  if (state.status === "mfa_setup") redirect(ROUTES.MFA_SETUP)
  if (state.status === "mfa_verify") redirect(ROUTES.MFA_VERIFY)
  redirect(ROUTES.HOME)
}

// Para layouts y pantallas del panel. Owner y admin sin aal2 van a configurar o confirmar 2FA.
export async function requireSessionUser(): Promise<SessionUser> {
  const session = await getSessionState()
  if (session.status !== "active") redirectForSession(session)
  return session.user
}

export async function signOut() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
}

// Filtro de interfaz por rol. La protección de los datos la hace RLS.
export async function requireRole(
  allowed: readonly AppRole[]
): Promise<SessionUser> {
  const user = await requireSessionUser()
  if (!allowed.includes(user.role)) redirect(ROUTES.HOME)
  return user
}

// Para server actions: en vez de redirigir, devuelve el error a mostrar.
// Owner y admin sin aal2 son rechazados. Es una primera barrera; RLS vuelve a validar.
export async function authorizeAction(
  allowed: readonly AppRole[]
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const session = await getSessionState()
  const role = "user" in session ? session.user.role : null
  const error = checkActionAccess(session.status, role, allowed)
  if (error || session.status !== "active") return { ok: false, error: error ?? "" }
  return { ok: true, user: session.user }
}
