import "server-only"

import { cache } from "react"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { BusinessProfileInput } from "../schemas/business-profile.schema"
import type { BusinessProfile } from "../types/business.types"

const EMPTY: BusinessProfile = {
  email: null,
  phone: null,
  whatsapp: null,
  instagram: null,
  address: null,
  taxId: null,
  updatedAt: null,
  updatedByName: null,
}

// Una sola lectura por pedido aunque varias partes de la página la pidan.
export const getBusinessProfile = cache(async (): Promise<BusinessProfile> => {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("business_profile")
    .select("*, editor:profiles!business_profile_updated_by_fkey(full_name)")
    .maybeSingle()
  if (!data) return EMPTY
  return {
    email: data.email,
    phone: data.phone,
    whatsapp: data.whatsapp,
    instagram: data.instagram,
    address: data.address,
    taxId: data.tax_id,
    updatedAt: data.updated_at,
    updatedByName: data.editor?.full_name ?? null,
  }
})

export async function updateBusinessProfile(input: BusinessProfileInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("business_profile").update(input).eq("id", true).select("id")
}
