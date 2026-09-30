import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { publicEnv } from "@/common/lib/config/env.config"
import { SESSION_COOKIE_OPTIONS } from "@/common/lib/config/session.config"
import type { Database } from "@/common/lib/db/database.types"

// Refresca la sesión en cada request y devuelve la respuesta con las cookies al día.
export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value)
          )
        },
      },
    }
  )

  // getClaims valida el JWT; no usar getSession en el servidor.
  const { data } = await supabase.auth.getClaims()

  return { response, isAuthenticated: Boolean(data?.claims?.sub) }
}
