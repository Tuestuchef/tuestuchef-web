import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { createReceiptDownloadUrl } from "@/common/lib/services/receipts.service"
import { getStorage } from "@/common/lib/services/storage.service"
import {
  caracasMonthRange,
  caracasNoonIso,
  toCaracasDate,
} from "@/common/lib/utils/format-date.util"

import {
  EXPENSE_ENTRY_TYPES,
  INCOME_ENTRY_TYPES,
  TRANSFER_ENTRY_TYPES,
} from "../constants/money-movements.constants"
import type { LedgerEntryInput } from "../schemas/ledger-entry.schema"
import type {
  LedgerEntryItem,
  MovementFilters,
  PersonOption,
} from "../types/money-movements.types"

const LIST_LIMIT = 300

// RLS: owner y admin ven todo; staff solo lo que registró.
export async function listEntries(filters: MovementFilters): Promise<LedgerEntryItem[]> {
  const supabase = await createSupabaseServerClient()
  const { from, to } = caracasMonthRange(filters.month)

  let query = supabase
    .from("ledger_entries")
    .select(
      `id, occurred_at, entry_type, amount, currency, usdt_value, description, receipt_path,
       transfer_id, reverses_entry_id,
       account:accounts(name),
       category:movement_categories(name, type),
       person:profiles!ledger_entries_person_id_fkey(full_name),
       author:profiles!ledger_entries_created_by_fkey(full_name)`
    )
    .gte("occurred_at", from)
    .lt("occurred_at", to)
    .order("occurred_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT)

  if (filters.accountId) query = query.eq("account_id", filters.accountId)
  if (filters.direction === "income") query = query.in("entry_type", [...INCOME_ENTRY_TYPES])
  if (filters.direction === "expense") query = query.in("entry_type", [...EXPENSE_ENTRY_TYPES])
  if (filters.direction === "transfer") query = query.in("entry_type", [...TRANSFER_ENTRY_TYPES])

  const { data, error } = await query
  if (error) throw error

  const reversed = new Set(data.map((row) => row.reverses_entry_id).filter((id): id is string => Boolean(id)))
  const missing = data.map((row) => row.id).filter((id) => !reversed.has(id))
  if (missing.length > 0) {
    const { data: reversals, error: reversalsError } = await supabase
      .from("ledger_entries")
      .select("reverses_entry_id")
      .in("reverses_entry_id", missing)
    if (reversalsError) throw reversalsError
    for (const row of reversals) if (row.reverses_entry_id) reversed.add(row.reverses_entry_id)
  }

  return data.map((row) => ({
    id: row.id,
    occurredAt: row.occurred_at,
    entryType: row.entry_type,
    amount: Number(row.amount),
    currency: row.currency,
    usdtValue: Number(row.usdt_value),
    description: row.description,
    hasReceipt: Boolean(row.receipt_path),
    accountName: row.account?.name ?? "—",
    category: row.category,
    personName: row.person?.full_name ?? null,
    authorName: row.author?.full_name ?? null,
    transferId: row.transfer_id,
    reversesEntryId: row.reverses_entry_id,
    isReversed: reversed.has(row.id),
  }))
}

export async function createEntry(input: LedgerEntryInput) {
  const supabase = await createSupabaseServerClient()
  const isBackdated = input.date && input.date !== toCaracasDate()

  return supabase
    .from("ledger_entries")
    .insert({
      account_id: input.account_id,
      entry_type: input.direction,
      category_id: input.category_id,
      amount: input.direction === "expense" ? -input.amount : input.amount,
      description: input.description ?? null,
      person_id: input.person_id ?? null,
      receipt_path: input.receipt_path ?? null,
      ...(isBackdated ? { occurred_at: caracasNoonIso(input.date!) } : {}),
    })
    .select("id")
    .single()
}

export async function reverseEntry(entryId: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("reverse_ledger_entry", { p_entry_id: entryId, p_reason: reason })
}

// Cuenta del último ingreso o gasto que registró esta persona.
export async function getLastUsedAccountId(userId: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("ledger_entries")
    .select("account_id")
    .eq("created_by", userId)
    .in("entry_type", ["income", "expense"])
    .is("reverses_entry_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.account_id ?? null
}

// Personas a las que se les puede asignar un sueldo, retiro, aporte o reparto.
export async function listPeople(): Promise<PersonOption[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .order("full_name")

  if (error) throw error
  return data.map((person) => ({ id: person.id, fullName: person.full_name || person.email || "Sin nombre" }))
}

// URL prefirmada del comprobante. Si la persona no puede ver el movimiento, RLS no lo devuelve.
export async function getEntryReceiptUrl(
  entryId: string
): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("ledger_entries").select("receipt_path").eq("id", entryId).maybeSingle()

  if (!data?.receipt_path) return { ok: false, status: 404, error: "Comprobante no encontrado." }

  const signed = await createReceiptDownloadUrl(getStorage(), data.receipt_path)
  if (!signed.ok) return { ok: false, status: 503, error: signed.error }
  return { ok: true, url: signed.data }
}
