import "server-only"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"

import { CUSTOMER_LIST_LIMIT } from "../constants/customers.constants"
import type { CustomerInput } from "../schemas/customers.schema"
import type { CustomerDetail, CustomerListItem, DuplicateCustomer } from "../types/customers.types"
import { findCustomersByContact } from "./customer-lookup.service"

const LIST_COLUMNS =
  "id, kind, first_name, last_name, legal_name, phone, email, instagram, is_active, has_id_document, blocked_at, blocked_reason"

// Quita lo que rompería el filtro de PostgREST.
const sanitize = (value: string) => value.replace(/[,()%*"\\]/g, " ").trim()

// Busca por nombre, apellido, razón social, RIF, correo, Instagram o dígitos del teléfono (0414… o 414…).
export async function listCustomers({ search }: { search?: string } = {}): Promise<CustomerListItem[]> {
  const supabase = await createSupabaseServerClient()
  let query = supabase
    .from("customers")
    .select(LIST_COLUMNS)
    .order("is_active", { ascending: false })
    .order("first_name")
    .order("last_name")
    .limit(CUSTOMER_LIST_LIMIT)

  const term = sanitize(search ?? "")
  if (term) {
    const filters = [
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `legal_name.ilike.%${term}%`,
      `tax_id.ilike.%${term.toUpperCase().replace(/[\s.-]/g, "")}%`,
      `email.ilike.%${term}%`,
      `instagram.ilike.%${term.replace(/^@/, "")}%`,
    ]
    const digits = term.replace(/\D/g, "").replace(/^0/, "")
    if (digits.length >= 4) filters.push(`phone.ilike.%${digits}%`)
    // "Ana Pérez": nombre y apellido a la vez.
    const [first, ...rest] = term.split(/\s+/)
    if (rest.length) filters.push(`and(first_name.ilike.%${first}%,last_name.ilike.%${rest.join(" ")}%)`)
    query = query.or(filters.join(","))
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getCustomer(id: string, { withIdDocument }: { withIdDocument: boolean }): Promise<CustomerDetail | null> {
  const supabase = await createSupabaseServerClient()
  const [{ data: customer, error }, privateResult] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    withIdDocument
      ? supabase.from("customer_private").select("id_document").eq("customer_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (error) throw error
  if (!customer) return null
  return { ...customer, idDocument: privateResult.data?.id_document ?? null }
}

type SaveResult =
  | { ok: true; id: string }
  | { ok: false; duplicate: DuplicateCustomer }
  | { ok: false; error: { code?: string; message?: string } }

// Crea o edita. Antes de guardar revisa si el contacto ya es de otro cliente, para
// ofrecer abrirlo en vez de solo mostrar un error.
export async function saveCustomer(input: CustomerInput, { canManage }: { canManage: boolean }): Promise<SaveResult> {
  const supabase = await createSupabaseServerClient()

  const [duplicate] = await findCustomersByContact(supabase, input, { excludeId: input.id })
  if (duplicate) return { ok: false, duplicate }

  const values = {
    kind: input.kind,
    first_name: input.first_name,
    last_name: input.last_name,
    legal_name: input.legal_name,
    tax_id: input.tax_id,
    contact_person: input.contact_person,
    address: input.address,
    phone: input.phone,
    email: input.email,
    instagram: input.instagram,
    notes: input.notes ?? null,
    // Activar o desactivar es de owner y admin (también lo exige la base).
    ...(canManage ? { is_active: input.is_active } : {}),
  }

  const { data, error } = input.id
    ? await supabase.from("customers").update(values).eq("id", input.id).select("id").single()
    : await supabase.from("customers").insert(values).select("id").single()

  if (error?.code === "23505") {
    // Alguien lo registró justo ahora.
    const [raced] = await findCustomersByContact(supabase, input, { excludeId: input.id })
    if (raced) return { ok: false, duplicate: raced }
  }
  if (error) return { ok: false, error }

  // La cédula va por su función: staff la registra pero no la lee.
  // Al editar, staff no la ve; un campo vacío suyo significa "no cambiar".
  const touchDocument = input.id_document !== null || (canManage && Boolean(input.id))
  if (touchDocument) {
    const { error: docError } = await supabase.rpc("set_customer_id_document", {
      p_customer_id: data.id,
      p_id_document: input.id_document,
    })
    if (docError) return { ok: false, error: docError }
  }

  return { ok: true, id: data.id }
}

export async function setCustomerBlocked(customerId: string, blocked: boolean, reason: string) {
  const supabase = await createSupabaseServerClient()
  return blocked
    ? supabase.rpc("block_customer", { p_customer_id: customerId, p_reason: reason })
    : supabase.rpc("unblock_customer", { p_customer_id: customerId, p_reason: reason })
}

export type CustomerBlockEvent = { id: string; action: "block" | "unblock"; reason: string; at: string; byName: string | null }

export async function listCustomerBlockEvents(customerId: string): Promise<CustomerBlockEvent[]> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from("customer_block_events")
    .select("id, action, reason, created_at, author:profiles!customer_block_events_created_by_fkey(full_name)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
  return (data ?? []).map((e) => ({ id: e.id, action: e.action, reason: e.reason, at: e.created_at, byName: e.author?.full_name ?? null }))
}
