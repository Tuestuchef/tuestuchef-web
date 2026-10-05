import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { SupplierInput } from "../schemas/purchases.schema"
import type { Supplier, SupplierListItem } from "../types/purchases.types"

const sanitize = (value: string) => value.replace(/[,()%*"\\]/g, " ").trim()

// Saldos por proveedor desde cuentas por pagar (la vista devuelve 0 filas a staff).
async function supplierBalances(): Promise<Map<string, number> | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("payables").select("supplier_id, balance_usd")
  if (error) throw error
  if (!data) return null
  const balances = new Map<string, number>()
  for (const row of data) {
    if (row.supplier_id) balances.set(row.supplier_id, (balances.get(row.supplier_id) ?? 0) + Number(row.balance_usd ?? 0))
  }
  return balances
}

export async function listSuppliers(
  { search, withBalances = false }: { search?: string; withBalances?: boolean } = {}
): Promise<SupplierListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("suppliers")
    .select("id, name, rif, phone, contact_name, is_active")
    .order("is_active", { ascending: false })
    .order("name")
  const term = sanitize(search ?? "")
  if (term) query = query.or(`name.ilike.%${term}%,rif.ilike.%${term}%,contact_name.ilike.%${term}%`)

  const [{ data, error }, balances] = await Promise.all([query, withBalances ? supplierBalances() : Promise.resolve(null)])
  if (error) throw error
  return data.map((s) => ({ ...s, balanceUsd: balances ? (balances.get(s.id) ?? 0) : null }))
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle()
  if (error) throw error
  return data
}

export async function saveSupplier(input: SupplierInput, { canManage }: { canManage: boolean }) {
  const supabase = await createSupabaseServerClient()
  const values = {
    name: input.name,
    rif: input.rif,
    contact_name: input.contact_name ?? null,
    phone: input.phone,
    email: input.email,
    notes: input.notes ?? null,
    kind: input.kind,
    ...(canManage ? { is_active: input.is_active } : {}),
  }
  return input.id
    ? supabase.from("suppliers").update(values).eq("id", input.id).select("id, name").single()
    : supabase.from("suppliers").insert(values).select("id, name").single()
}
