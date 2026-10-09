import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { toCaracasDate } from "@/common/lib/utils/format-date.util"

import type { ProductionStage } from "../constants/orders.constants"
import type { PieceRateInput } from "../schemas/orders.schema"
import type { MaterialRequirement, PieceRate, ProductionCard } from "../types/orders.types"
import { variantLabel } from "@/modules/products/lib/utils/variant-label.util"

// Todo lo que está en producción, con su etapa y quién lo tiene.
export async function listProductionCards(): Promise<ProductionCard[]> {
  const supabase = await createSupabaseServerClient()
  const { data: queue, error } = await supabase.from("production_queue").select("*").order("promised_date")
  if (error) throw error
  if (!queue.length) return []

  const itemIds = queue.map((q) => q.sale_item_id!)
  const saleIds = [...new Set(queue.map((q) => q.sale_id!))]
  const memberIds = queue.flatMap((q) => (q.team_member_id ? [q.team_member_id] : []))
  const supplierIds = queue.flatMap((q) => (q.supplier_id ? [q.supplier_id] : []))
  const [items, sales, members, suppliers, customs, nexts] = await Promise.all([
    supabase
      .from("sale_items")
      .select("id, variant:product_variants(gender, color:colors(name), size:sizes(name), product:products(name))")
      .in("id", itemIds),
    supabase.from("sales").select("id, customer:customers(first_name, last_name)").in("id", saleIds),
    memberIds.length ? supabase.from("team_members").select("id, full_name").in("id", memberIds) : Promise.resolve({ data: [] }),
    supplierIds.length ? supabase.from("suppliers").select("id, name").in("id", supplierIds) : Promise.resolve({ data: [] }),
    supabase.from("sale_item_customizations").select("sale_item_id").in("sale_item_id", itemIds),
    Promise.all(itemIds.map((id) => supabase.rpc("next_line_stage", { p_item_id: id }).then((r) => [id, r.data] as const))),
  ])
  const itemById = new Map((items.data ?? []).map((i) => [i.id, i]))
  const saleById = new Map((sales.data ?? []).map((s) => [s.id, s]))
  const memberById = new Map((members.data ?? []).map((m) => [m.id, m.full_name]))
  const supplierById = new Map((suppliers.data ?? []).map((s) => [s.id, s.name]))
  const customized = new Set((customs.data ?? []).map((c) => c.sale_item_id))
  const nextById = new Map(nexts)

  return queue.map((q) => {
    const item = itemById.get(q.sale_item_id!)
    const customer = saleById.get(q.sale_id!)?.customer
    const stage = q.stage as ProductionStage
    const pieces = ["cutting", "sewing"].includes(stage) ? Number(q.quantity) - Number(q.reserved_quantity) : Number(q.quantity)
    return {
      saleItemId: q.sale_item_id!,
      saleId: q.sale_id!,
      number: q.number!,
      customerName: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : null,
      productName: item?.variant?.product?.name ?? "—",
      variantLabel: variantLabel(item?.variant ?? null),
      pieces,
      stage,
      nextStage: (nextById.get(q.sale_item_id!) as ProductionStage | null | undefined) ?? null,
      promisedDate: q.promised_date!,
      orderLate: Boolean(q.order_late),
      assignee: q.team_member_id
        ? { kind: "member", id: q.team_member_id, name: memberById.get(q.team_member_id) ?? "—", expectedDate: q.expected_date, isLate: false }
        : q.supplier_id
          ? {
              kind: "workshop",
              id: q.supplier_id,
              name: supplierById.get(q.supplier_id) ?? "—",
              expectedDate: q.expected_date,
              isLate: Boolean(q.workshop_late),
            }
          : null,
      hasCustomization: customized.has(q.sale_item_id!),
    }
  })
}

export async function listMaterialRequirements(): Promise<MaterialRequirement[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("material_requirements")
  if (error) throw error
  return (data ?? []).map((r) => ({
    rawVariantId: r.raw_variant_id,
    sku: r.sku,
    materialName: r.material_name,
    colorName: r.color_name,
    unit: r.unit,
    required: Number(r.required),
    available: Number(r.available),
    shortage: Number(r.shortage),
    lines: r.lines,
  }))
}

// Materiales que no alcanzan para los pedidos abiertos.
export async function countMaterialShortages(): Promise<number> {
  return (await listMaterialRequirements()).filter((r) => r.shortage > 0).length
}

// Tarifa vigente de cada categoría y etapa (la más reciente que ya aplica).
export async function listPieceRates(): Promise<PieceRate[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("piece_rates")
    .select("id, product_category_id, stage, rate_usd, effective_from, category:product_categories(name)")
    .lte("effective_from", toCaracasDate())
    .order("effective_from", { ascending: false })
  if (error) throw error
  const seen = new Set<string>()
  return data
    .filter((r) => {
      const key = `${r.product_category_id}:${r.stage}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .map((r) => ({
      id: r.id,
      categoryId: r.product_category_id,
      categoryName: r.category?.name ?? "—",
      stage: r.stage,
      rateUsd: Number(r.rate_usd),
      effectiveFrom: r.effective_from,
    }))
}

export async function addPieceRate(input: PieceRateInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("piece_rates").insert({ ...input, effective_from: toCaracasDate() }).select("id").single()
}

export type PendingPiecework = { id: string; label: string; stage: ProductionStage; pieces: number; amountUsd: number; completedAt: string }

export async function listPendingPiecework(teamMemberId: string): Promise<PendingPiecework[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("pending_piecework")
    .select("*")
    .eq("team_member_id", teamMemberId)
    .order("completed_at")
  if (error) throw error
  if (!data.length) return []
  const { data: items } = await supabase
    .from("sale_items")
    .select("id, sale:sales(number), variant:product_variants(product:products(name))")
    .in("id", data.map((d) => d.sale_item_id!))
  const byId = new Map((items ?? []).map((i) => [i.id, i]))
  return data.map((d) => {
    const item = byId.get(d.sale_item_id!)
    return {
      id: d.id!,
      label: `NE-${String(item?.sale?.number ?? 0).padStart(6, "0")} · ${item?.variant?.product?.name ?? "—"}`,
      stage: d.stage as ProductionStage,
      pieces: Number(d.pieces),
      amountUsd: Number(d.amount_usd),
      completedAt: d.completed_at!,
    }
  })
}

export async function registerPieceworkPayment(input: {
  teamMemberId: string
  accountId: string
  amount: number
  pieceworkIds: string[]
  advanceIds: string[]
}) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("register_piecework_payment", {
    p_team_member_id: input.teamMemberId,
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_piecework_ids: input.pieceworkIds,
    p_settle_advance_ids: input.advanceIds.length ? input.advanceIds : undefined,
  })
}
