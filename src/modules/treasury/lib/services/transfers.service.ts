import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { caracasNoonIso } from "@/common/lib/utils/format-date.util"

import type { AccountTransferInput } from "../schemas/account-transfer.schema"
import type { TransferSummary } from "../types/treasury.types"
import { ensureRatesForDate } from "./rate-history.service"

export async function createTransfer(input: AccountTransferInput) {
  await ensureRatesForDate(input.date)
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("create_account_transfer", {
    p_from_account_id: input.from_account_id,
    p_to_account_id: input.to_account_id,
    p_amount_out: input.amount_out,
    p_amount_in: input.amount_in,
    p_occurred_at: input.date ? caracasNoonIso(input.date) : undefined,
    p_note: input.note,
    p_receipt_path: input.receipt_path,
    p_binance_rate: input.binance_rate,
    p_bcv_usd_rate: input.bcv_usd_rate,
    p_usd_usdt_rate: input.usd_usdt_rate,
  })
}

export async function reverseTransfer(transferId: string, reason: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("reverse_account_transfer", {
    p_transfer_id: transferId,
    p_reason: reason,
  })
}

export async function listRecentTransfers(limit = 10): Promise<TransferSummary[]> {
  const supabase = await createSupabaseServerClient()
  const { data: transfers, error } = await supabase
    .from("account_transfers")
    .select(
      "id, occurred_at, amount_out, amount_in, note, from:accounts!account_transfers_from_account_id_fkey(name, currency), to:accounts!account_transfers_to_account_id_fkey(name, currency)"
    )
    .order("occurred_at", { ascending: false })
    .limit(limit)

  if (error) throw error
  if (transfers.length === 0) return []

  const { data: entries, error: entriesError } = await supabase
    .from("ledger_entries")
    .select("transfer_id, entry_type, amount, reverses_entry_id")
    .in(
      "transfer_id",
      transfers.map((t) => t.id)
    )

  if (entriesError) throw entriesError

  return transfers.map((transfer) => {
    const rows = entries.filter((entry) => entry.transfer_id === transfer.id)
    const fee = rows.find((row) => row.entry_type === "exchange_fee" && !row.reverses_entry_id)
    return {
      id: transfer.id,
      occurredAt: transfer.occurred_at,
      from: transfer.from!,
      to: transfer.to!,
      amountOut: Number(transfer.amount_out),
      amountIn: Number(transfer.amount_in),
      feeAmount: fee ? Number(fee.amount) : 0,
      note: transfer.note,
      isVoided: rows.some((row) => row.reverses_entry_id !== null),
    }
  })
}
