import "server-only"

import { createClient } from "@supabase/supabase-js"

import { publicEnv } from "@/common/lib/config/env.config"
import { serverEnv } from "@/common/lib/config/server-env.config"
import type { Database } from "@/common/lib/db/database.types"

// Cliente con la clave secreta: salta RLS. Úsalo solo para lo que el usuario no
// puede hacer por sí mismo (invitar), después de validar su rol en el servidor.
// null si SUPABASE_SECRET_KEY no está configurada.
export function createSupabaseAdminClient() {
  if (!serverEnv.SUPABASE_SECRET_KEY) return null

  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
