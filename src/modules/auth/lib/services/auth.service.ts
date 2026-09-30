import "server-only"

import type { EmailOtpType } from "@supabase/supabase-js"

import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import { TOTP_FRIENDLY_NAME } from "../constants/auth.constants"
import type { TotpEnrollment } from "../types/auth.types"
import type { LoginCodeDeps } from "./login-code.service"

// null si falta SUPABASE_SECRET_KEY: sin ella no se puede comprobar quién puede pedir código.
export function getLoginCodeDeps(): LoginCodeDeps | null {
  const admin = createSupabaseAdminClient()
  if (!admin) return null

  return {
    async isAllowed(email) {
      const { data, error } = await admin.rpc("can_request_login_code", { p_email: email })
      if (error) throw error
      return data === true
    },
    async sendCode(email) {
      const supabase = await createSupabaseServerClient()
      // shouldCreateUser: false → nadie se registra solo; los usuarios se invitan.
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      return { error }
    },
  }
}

type VerifyResult = { ok: true } | { ok: false; reason: "invalid" | "inactive" | "unexpected" }

export async function verifyLoginCode(email: string, token: string): Promise<VerifyResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" })

  if (error || !data.user) {
    // El hook de Auth rechaza a los usuarios desactivados.
    if (error && /desactivado/i.test(error.message)) return { ok: false, reason: "inactive" }
    if (!error || error.code === "otp_expired" || error.status === 403 || error.status === 400) {
      return { ok: false, reason: "invalid" }
    }
    return { ok: false, reason: "unexpected" }
  }

  // Segunda barrera por si el hook no está activo en el proyecto.
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle()
  if (!profile?.is_active) {
    await supabase.auth.signOut()
    return { ok: false, reason: "inactive" }
  }

  return { ok: true }
}

// Enlace de invitación (token_hash): crea la sesión.
export async function verifyEmailLink(tokenHash: string, type: EmailOtpType) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  return { ok: !error }
}

// Prepara la app autenticadora. Borra intentos anteriores sin verificar para no acumularlos.
export async function startTotpEnrollment(): Promise<TotpEnrollment | null> {
  const supabase = await createSupabaseServerClient()
  const { data: factors, error } = await supabase.auth.mfa.listFactors()
  if (error) return null

  const pending = factors.all.filter((factor) => factor.factor_type === "totp" && factor.status !== "verified")
  for (const factor of pending) await supabase.auth.mfa.unenroll({ factorId: factor.id })

  const { data, error: enrollError } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: TOTP_FRIENDLY_NAME,
  })
  if (enrollError) return null

  const qr = data.totp.qr_code
  return {
    factorId: data.id,
    qrCodeUrl: qr.startsWith("data:") ? qr : `data:image/svg+xml;utf-8,${encodeURIComponent(qr)}`,
    secret: data.totp.secret,
  }
}

// Verifica el código de la app. Al acertar, la sesión sube a aal2 (se guarda en las cookies).
export async function verifyTotp(factorId: string, code: string) {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
  return { ok: !error }
}
