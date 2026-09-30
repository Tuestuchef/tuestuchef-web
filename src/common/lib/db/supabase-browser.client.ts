"use client"

import { createBrowserClient } from "@supabase/ssr"

import { publicEnv } from "@/common/lib/config/env.config"
import { SESSION_COOKIE_OPTIONS } from "@/common/lib/config/session.config"
import type { Database } from "@/common/lib/db/database.types"

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: SESSION_COOKIE_OPTIONS }
  )
}
