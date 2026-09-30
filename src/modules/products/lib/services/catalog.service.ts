import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { CatalogItemInput } from "../schemas/products.schema"
import type { CatalogItem, CatalogKind } from "../types/products.types"

export async function listCatalog(kind: CatalogKind, { activeOnly = false } = {}): Promise<CatalogItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase.from(kind).select("*").order("sort_order").order("name")
  if (activeOnly) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error) throw error
  return data
}

export async function saveCatalogItem(input: CatalogItemInput) {
  const supabase = await createSupabaseServerClient()
  const values = { name: input.name, code: input.code, sort_order: input.sort_order, is_active: input.is_active }
  if (input.id) return supabase.from(input.kind).update(values).eq("id", input.id).select("id")
  return supabase.from(input.kind).insert(values).select("id")
}
