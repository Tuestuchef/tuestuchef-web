import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import type { PaymentMethodInput } from "../schemas/payment-method.schema"
import type { PaymentMethod } from "../types/treasury.types"

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*, account:accounts(name, currency)")
    .order("sort_order")
    .order("name")

  if (error) throw error
  return data
}

export async function savePaymentMethod(input: PaymentMethodInput) {
  const supabase = await createSupabaseServerClient()
  const values = {
    name: input.name,
    account_id: input.account_id,
    price_currency: input.price_currency,
    rate_kind: input.rate_kind,
    sort_order: input.sort_order,
    is_active: input.is_active,
  }

  if (input.id) {
    return supabase.from("payment_methods").update(values).eq("id", input.id).select("id")
  }
  return supabase.from("payment_methods").insert(values).select("id")
}
