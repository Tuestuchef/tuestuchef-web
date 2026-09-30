// Pedir un código de acceso. Las dependencias se inyectan para poder probar la
// regla sin Supabase: un usuario desactivado (o inexistente) nunca recibe código,
// y la respuesta es la misma para no revelar qué correos tienen acceso.

export type LoginCodeDeps = {
  // Consulta con la clave secreta: activo y existente.
  isAllowed: (email: string) => Promise<boolean>
  sendCode: (email: string) => Promise<{ error: { code?: string; status?: number } | null }>
}

export type RequestLoginCodeResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "unexpected" }

export async function requestLoginCode(email: string, deps: LoginCodeDeps): Promise<RequestLoginCodeResult> {
  if (!(await deps.isAllowed(email))) return { ok: true }

  const { error } = await deps.sendCode(email)
  if (!error) return { ok: true }

  const rateLimited = error.status === 429 || error.code === "over_email_send_rate_limit"
  return { ok: false, reason: rateLimited ? "rate_limited" : "unexpected" }
}
