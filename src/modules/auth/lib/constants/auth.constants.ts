export const AUTH_MESSAGES = {
  // Misma respuesta exista o no el correo: no revela quién tiene acceso.
  CODE_SENT: "Si el correo tiene acceso al panel, te enviamos un código de 6 dígitos. Revisa también el spam.",
  CODE_INVALID: "El código no es correcto o ya venció. Pide uno nuevo.",
  RATE_LIMITED: "Espera un momento antes de pedir otro código.",
  UNEXPECTED: "No pudimos iniciar sesión. Intenta de nuevo.",
  NOT_CONFIGURED: "El inicio de sesión no está configurado en el servidor (falta SUPABASE_SECRET_KEY).",
  INACTIVE: "Tu usuario está desactivado. Habla con el dueño o un administrador.",
  LINK_INVALID: "El enlace no es válido o ya venció. Pide que te inviten de nuevo.",
  MFA_CODE_INVALID: "El código de la app no es correcto. Revisa que la hora del teléfono esté bien.",
  MFA_ENROLL_FAILED: "No se pudo preparar la app autenticadora. Intenta de nuevo.",
} as const

// Motivos que el login sabe explicar (?reason=…).
export const SIGN_OUT_REASONS: Record<string, string> = {
  inactive: AUTH_MESSAGES.INACTIVE,
  link_invalid: AUTH_MESSAGES.LINK_INVALID,
}

// Tipos de enlace de correo que acepta /auth/confirm.
export const EMAIL_LINK_TYPES = ["invite", "email", "magiclink"] as const

// Nombre con el que aparece la cuenta en la app autenticadora.
export const TOTP_FRIENDLY_NAME = "Tuestuchef"
