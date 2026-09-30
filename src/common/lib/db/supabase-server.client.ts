import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { publicEnv } from "@/common/lib/config/env.config"
import { SESSION_COOKIE_OPTIONS } from "@/common/lib/config/session.config"
import type { Database } from "@/common/lib/db/database.types"

// Cliente con la sesión del usuario: toda consulta pasa por RLS.
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Llamado desde un Server Component: el proxy ya refresca la sesión.
          }
        },
      },
    }
  )
}
