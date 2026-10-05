import "server-only"

import { z } from "zod"

// Variables solo del servidor. Si faltan, la app arranca y las funciones que
// las necesitan avisan con un mensaje claro.
const serverEnvSchema = z.object({
  // Clave secreta de Supabase (sb_secret_...). La usan el login (comprobar que el
  // correo está activo antes de enviar el código) y las invitaciones.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  // Protege /api/cron/*: Vercel Cron manda "Authorization: Bearer CRON_SECRET".
  CRON_SECRET: z.string().min(16).optional(),
  // Avisos por correo (Resend). Remitente: NOTIFICATIONS_EMAIL_FROM o, si falta, AUTH_EMAIL_FROM.
  RESEND_API_KEY: z.string().min(10).optional(),
  NOTIFICATIONS_EMAIL_FROM: z.string().min(3).optional(),
  // Avisos push (Web Push con VAPID). La pública va en NEXT_PUBLIC_VAPID_PUBLIC_KEY.
  VAPID_PRIVATE_KEY: z.string().min(20).optional(),
  VAPID_SUBJECT: z.string().min(5).optional(),
})

const parsed = serverEnvSchema.safeParse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY?.trim() || undefined,
  CRON_SECRET: process.env.CRON_SECRET?.trim() || undefined,
  RESEND_API_KEY: process.env.RESEND_API_KEY?.trim() || undefined,
  NOTIFICATIONS_EMAIL_FROM: (process.env.NOTIFICATIONS_EMAIL_FROM ?? process.env.AUTH_EMAIL_FROM)?.trim() || undefined,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY?.trim() || undefined,
  VAPID_SUBJECT: process.env.VAPID_SUBJECT?.trim() || undefined,
})

if (!parsed.success) {
  console.warn(`[env] Variables del servidor inválidas: ${z.prettifyError(parsed.error)}`)
}

export const serverEnv = parsed.success ? parsed.data : {}
