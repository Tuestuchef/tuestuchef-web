import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { CreateAccountInput, UpdateAccountInput } from "../schemas/account.schema"
import type { Account, AccountBalance } from "../types/treasury.types"

export async function listAccounts({ activeOnly = false } = {}): Promise<Account[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase.from("accounts").select("*").order("name")
  if (activeOnly) query = query.eq("is_active", true)

  const { data, error } = await query
  if (error) throw error
  return data
}

// Solo owner y admin reciben filas (la vista filtra por rol).
export async function listAccountBalances(): Promise<AccountBalance[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("account_balances")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name")

  if (error) throw error
  return data.map((row) => ({
    accountId: row.account_id!,
    name: row.name!,
    currency: row.currency!,
    kind: row.kind!,
    isActive: row.is_active!,
    balance: Number(row.balance ?? 0),
    entriesCount: Number(row.entries_count ?? 0),
    lastMovementAt: row.last_movement_at,
  }))
}

export async function createAccount(input: CreateAccountInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("accounts").insert({
    name: input.name,
    kind: input.kind,
    currency: input.currency,
    notes: input.notes ?? null,
  })
}

export async function updateAccount(input: UpdateAccountInput) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("accounts")
    .update({
      name: input.name,
      kind: input.kind,
      notes: input.notes ?? null,
      is_active: input.is_active,
    })
    .eq("id", input.id)
    .select("id")
}
