import "server-only"

import { cache } from "react"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { QuoteSettingsInput } from "../schemas/quote-settings.schema"
import type { PriceListOption, QuoteSettings } from "../types/quotes.types"

export const getQuoteSettings = cache(async (): Promise<QuoteSettings> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("quote_settings")
    .select("*, editor:profiles!quote_settings_updated_by_fkey(full_name)")
    .single()
  if (error) throw error
  return {
    numberPrefix: data.number_prefix,
    numberPadding: data.number_padding,
    nextNumber: data.next_number,
    validityDays: data.validity_days,
    defaultCurrencies: data.default_currencies,
    defaultUsdPriceMethodId: data.default_usd_price_method_id,
    defaultVesPriceMethodId: data.default_ves_price_method_id,
    vatPercent: Number(data.vat_percent),
    vatDefaultEnabled: data.vat_default_enabled,
    igtfNoteDefault: data.igtf_note_default,
    igtfNote: data.igtf_note,
    defaultTerms: data.default_terms,
    updatedAt: data.updated_at,
    updatedByName: data.editor?.full_name ?? null,
  }
})

// Métodos de pago activos: cada uno es una lista de precios. Todos los precios están en USD; la
// moneda de la lista es la que cobra el método: con tasa BCV cobra en Bs, sin tasa en divisas.
export async function listPriceLists(): Promise<PriceListOption[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, name, rate_kind")
    .eq("is_active", true)
    .order("sort_order")
    .order("name")
  if (error) throw error
  return data.map((m) => ({ id: m.id, name: m.name, currency: m.rate_kind === "none" ? "USD" : "VES" }))
}

export async function updateQuoteSettings(input: QuoteSettingsInput) {
  const supabase = await createSupabaseServerClient()
  return supabase.from("quote_settings").update(input).eq("id", true).select("id")
}
