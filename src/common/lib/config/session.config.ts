// La sesión vive 30 días en el dispositivo: no se pide el código en cada uso.
// La cookie se renueva cada vez que se refresca la sesión (al usar el panel), así que
// caduca tras 30 días sin uso. El tope absoluto de 30 días lo pone Supabase Auth
// (auth.sessions.timebox en config.toml; en la nube es una opción del plan Pro).
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export const SESSION_COOKIE_OPTIONS = {
  maxAge: SESSION_MAX_AGE_SECONDS,
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const
