import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { AgreementPriceInput, AgreementSettingsInput } from "../schemas/agreements.schema"
import type { AgreementVesRateKind, CustomerAgreement } from "../types/agreements.types"

const toNumber = (value: number | null) => (value === null ? null : Number(value))

// Todos los acuerdos (son pocos: clientes fijos). Para vender, cotizar y la calculadora.
export async function listAgreements(): Promise<CustomerAgreement[]> {
  const supabase = await createSupabaseServerClient()
  const [agreements, prices] = await Promise.all([
    supabase
      .from("customer_agreements")
      .select("customer_id, general_discount_percent, ves_rate_kind, notes, customer:customers(first_name, last_name, legal_name)"),
    supabase.from("customer_agreement_prices").select("customer_id, product_id, discount_percent, fixed_price_usd"),
  ])
  if (agreements.error) throw agreements.error
  if (prices.error) throw prices.error
  return agreements.data.map((a) => ({
    customerId: a.customer_id,
    customerName: a.customer ? a.customer.legal_name || [a.customer.first_name, a.customer.last_name].filter(Boolean).join(" ") : "—",
    generalDiscountPercent: toNumber(a.general_discount_percent),
    vesRateKind: a.ves_rate_kind === "bcv_eur" ? "bcv_eur" : "bcv_usd",
    notes: a.notes,
    rules: prices.data
      .filter((p) => p.customer_id === a.customer_id)
      .map((p) => ({ productId: p.product_id, discountPercent: toNumber(p.discount_percent), fixedPriceUsd: toNumber(p.fixed_price_usd) })),
  }))
}

// El acuerdo de un cliente con el nombre de cada producto y sus exclusivos (ficha del cliente).
export async function getCustomerAgreement(customerId: string) {
  const supabase = await createSupabaseServerClient()
  const [agreement, prices, exclusives] = await Promise.all([
    supabase.from("customer_agreements").select("general_discount_percent, ves_rate_kind, notes").eq("customer_id", customerId).maybeSingle(),
    supabase
      .from("customer_agreement_prices")
      .select("id, product_id, discount_percent, fixed_price_usd, product:products(name, kind)")
      .eq("customer_id", customerId),
    supabase.from("products").select("id, name, kind, is_active").eq("exclusive_customer_id", customerId).order("name"),
  ])
  if (agreement.error) throw agreement.error
  return {
    exists: Boolean(agreement.data),
    generalDiscountPercent: toNumber(agreement.data?.general_discount_percent ?? null),
    vesRateKind: (agreement.data?.ves_rate_kind === "bcv_eur" ? "bcv_eur" : "bcv_usd") as AgreementVesRateKind,
    notes: agreement.data?.notes ?? null,
    prices: (prices.data ?? [])
      .map((p) => ({
        id: p.id,
        productId: p.product_id,
        productName: p.product?.name ?? "—",
        isCombo: p.product?.kind === "combo",
        discountPercent: toNumber(p.discount_percent),
        fixedPriceUsd: toNumber(p.fixed_price_usd),
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, "es")),
    exclusives: (exclusives.data ?? []).map((p) => ({ id: p.id, name: p.name, isCombo: p.kind === "combo", isActive: p.is_active })),
  }
}

export type CustomerAgreementDetail = Awaited<ReturnType<typeof getCustomerAgreement>>

export async function saveAgreementSettings(input: AgreementSettingsInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("customer_agreements").upsert(
    {
      customer_id: input.customer_id,
      general_discount_percent: input.general_discount_percent,
      ves_rate_kind: input.ves_rate_kind,
      notes: input.notes,
    },
    { onConflict: "customer_id" }
  )
}

// Quitar el acuerdo: sus precios se borran con él (el cliente vuelve a precios normales y al mayor).
export async function deleteAgreement(customerId: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("customer_agreements").delete().eq("customer_id", customerId)
}

export async function saveAgreementPrice(input: AgreementPriceInput) {
  const supabase = await createSupabaseServerClient()
  // El acuerdo existe antes que sus precios.
  const { error } = await supabase.from("customer_agreements").upsert({ customer_id: input.customer_id }, { onConflict: "customer_id", ignoreDuplicates: true })
  if (error) return { error }
  return supabase.from("customer_agreement_prices").upsert(
    {
      customer_id: input.customer_id,
      product_id: input.product_id,
      discount_percent: input.kind === "percent" ? input.value : null,
      fixed_price_usd: input.kind === "fixed" ? input.value : null,
    },
    { onConflict: "customer_id,product_id" }
  )
}

export async function deleteAgreementPrice(id: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("customer_agreement_prices").delete().eq("id", id)
}

// Productos y combos que pueden llevar precio de acuerdo (no la materia prima), con su precio base.
export async function listAgreementProductOptions() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("products")
    .select("id, name, kind, exclusive_customer_id")
    .neq("kind", "raw_material")
    .eq("is_active", true)
    .order("name")
  if (error) throw error
  return data.map((p) => ({ id: p.id, name: p.name, isCombo: p.kind === "combo", exclusiveCustomerId: p.exclusive_customer_id }))
}

export type AgreementProductOption = Awaited<ReturnType<typeof listAgreementProductOptions>>[number]
