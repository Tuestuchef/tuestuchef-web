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
})

const parsed = serverEnvSchema.safeParse({
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY?.trim() || undefined,
  CRON_SECRET: process.env.CRON_SECRET?.trim() || undefined,
})

if (!parsed.success) {
  console.warn(`[env] Variables del servidor inválidas: ${z.prettifyError(parsed.error)}`)
}

export const serverEnv = parsed.success ? parsed.data : {}
