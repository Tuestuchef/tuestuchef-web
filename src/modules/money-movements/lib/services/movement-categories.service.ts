import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { CreateCategoryInput, UpdateCategoryInput } from "../schemas/movement-category.schema"
import type { CategoryOption, MovementCategory } from "../types/money-movements.types"

// RLS decide cuáles ve cada rol (staff: solo las que puede usar).
export async function listCategories({ activeOnly = false } = {}): Promise<MovementCategory[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase.from("movement_categories").select("*").order("name")
  if (activeOnly) query = query.eq("is_active", true)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Categorías activas ordenadas por lo que más usa esta persona, luego por nombre.
export async function listCategoryOptions(): Promise<CategoryOption[]> {
  const supabase = await createSupabaseServerClient()
  const [categories, { data: usage, error }] = await Promise.all([
    listCategories({ activeOnly: true }),
    supabase.rpc("my_category_usage"),
  ])
  if (error) throw error

  const uses = new Map((usage ?? []).map((row, index) => [row.category_id, { uses: Number(row.uses), rank: index }]))

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      uses: uses.get(category.id)?.uses ?? 0,
      rank: uses.get(category.id)?.rank ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "es"))
    .map(({ id, name, type, uses }) => ({ id, name, type, uses }))
}

export async function createCategory(input: CreateCategoryInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("movement_categories").insert({ name: input.name, type: input.type })
}

export async function updateCategory(input: UpdateCategoryInput) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("movement_categories")
    .update({ name: input.name, is_active: input.is_active })
    .eq("id", input.id)
    .select("id")
}
