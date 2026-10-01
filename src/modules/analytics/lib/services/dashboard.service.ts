import "server-only"

import type { Currency } from "@/common/lib/constants/currency.constants"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import type {
  CashFlowRow,
  DashboardRange,
  ProductSalesMargin,
  ProfitPolicy,
  RateEffectRow,
  ReserveActivity,
} from "../types/analytics.types"

// Todas las funciones devuelven 0 filas a staff (la pantalla además es solo de owner y admin).

// Período: desde el primer día del primer mes hasta hoy.
export const periodRange = (months: string[]): DashboardRange => ({ from: `${months[0]}-01`, to: toCaracasDate() })

const args = (range: DashboardRange) => ({ p_from: range.from, p_to: range.to })

export async function getCashFlow(range: DashboardRange): Promise<CashFlowRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("cash_flow_by_account", args(range))
  if (error) throw error
  return data.map((r) => ({
    accountId: r.account_id,
    name: r.name,
    currency: r.currency as Currency,
    isActive: r.is_active,
    opening: Number(r.opening),
    inflows: Number(r.inflows),
    outflows: Number(r.outflows),
    closing: Number(r.closing),
    inflowsUsdt: Number(r.inflows_usdt),
    outflowsUsdt: Number(r.outflows_usdt),
  }))
}

export async function getProductSalesMargins(range: DashboardRange): Promise<ProductSalesMargin[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("product_sales_margin", args(range))
  if (error) throw error
  return data.map((r) => ({
    productId: r.product_id,
    productName: r.product_name,
    units: Number(r.units),
    revenueUsd: Number(r.revenue_usd),
    revenueUsdt: Number(r.revenue_usdt),
    materialCostUsdt: Number(r.material_cost_usdt),
    laborCostUsdt: Number(r.labor_cost_usdt),
    marginUsdt: Number(r.margin_usdt),
    linesWithoutCost: Number(r.lines_without_cost),
  }))
}

export async function getRateEffect(range: DashboardRange): Promise<RateEffectRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("exchange_rate_effect", args(range))
  if (error) throw error
  return data.map((r) => ({
    source: r.source as RateEffectRow["source"],
    methodName: r.method_name,
    paymentsCount: Number(r.payments_count),
    nominalUsdt: Number(r.nominal_usdt),
    realUsdt: Number(r.real_usdt),
    differenceUsdt: Number(r.difference_usdt),
  }))
}

export async function getProfitPolicy(): Promise<ProfitPolicy> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("profit_policy").select("reserve_account_id, reserve_percent, reinvestment_percent").maybeSingle()
  return {
    reserveAccountId: data?.reserve_account_id ?? null,
    reservePercent: Number(data?.reserve_percent ?? 0),
    reinvestmentPercent: Number(data?.reinvestment_percent ?? 0),
  }
}

export async function getReserveActivity(range: DashboardRange): Promise<ReserveActivity | null> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("reserve_activity", args(range))
  if (error) throw error
  const row = data[0]
  return row
    ? { accountName: row.account_name, transferredUsdt: Number(row.transferred_usdt), balanceUsdt: Number(row.balance_usdt) }
    : null
}

export async function updateProfitPolicy(policy: ProfitPolicy) {
  const supabase = await createSupabaseServerClient()
  return supabase
    .from("profit_policy")
    .update({
      reserve_account_id: policy.reserveAccountId,
      reserve_percent: policy.reservePercent,
      reinvestment_percent: policy.reinvestmentPercent,
    })
    .eq("id", true)
    .select("id")
}
