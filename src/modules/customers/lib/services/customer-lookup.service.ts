import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/common/lib/db/database.types"

import type { ContactField, ContactInput, DuplicateCustomer } from "../types/customers.types"

type Client = SupabaseClient<Database>

// Datos que identifican a un cliente: no se repiten entre clientes.
const CONTACT_FIELDS: readonly ContactField[] = ["phone", "email", "instagram", "tax_id"]

// Los valores llegan normalizados (sin comas ni paréntesis); las comillas los protegen en el filtro.
const contactFilter = (contact: ContactInput) =>
  CONTACT_FIELDS.filter((field) => contact[field])
    .map((field) => `${field}.eq."${contact[field]}"`)
    .join(",")

// Clientes que ya usan alguno de estos datos de contacto (normalizados).
export async function findCustomersByContact(
  client: Client,
  contact: ContactInput,
  { excludeId }: { excludeId?: string } = {}
): Promise<DuplicateCustomer[]> {
  const filter = contactFilter(contact)
  if (!filter) return []

  let query = client.from("customers").select("id, first_name, last_name, phone, email, instagram, tax_id").or(filter)
  if (excludeId) query = query.neq("id", excludeId)
  const { data, error } = await query
  if (error) throw error

  return data.map((customer) => ({
    id: customer.id,
    name: [customer.first_name, customer.last_name].filter(Boolean).join(" "),
    field: CONTACT_FIELDS.find((field) => contact[field] && customer[field] === contact[field]) ?? "phone",
  }))
}

type FindOrCreateInput = ContactInput & { first_name: string; last_name?: string | null }

// Para la tienda online (Fase 3): busca por email o teléfono normalizados y, si no hay
// coincidencia, crea el cliente. Devuelve solo el id: nunca expone datos de un cliente
// existente (verlos exige OTP). Se llama desde el servidor, con el cliente de Supabase
// que corresponda (en el checkout, el de la clave secreta tras validar los datos con Zod).
export async function findOrCreateCustomer(
  client: Client,
  input: FindOrCreateInput
): Promise<{ id: string; created: boolean }> {
  const lookup = async () => {
    // El email manda: es el dato que se verifica con OTP.
    for (const field of ["email", "phone"] as const) {
      if (!input[field]) continue
      const matches = await findCustomersByContact(client, { [field]: input[field] })
      if (matches[0]) return matches[0].id
    }
    return null
  }

  const existing = await lookup()
  if (existing) return { id: existing, created: false }

  const { data, error } = await client
    .from("customers")
    .insert({
      first_name: input.first_name,
      last_name: input.last_name ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      instagram: input.instagram ?? null,
    })
    .select("id")
    .single()

  if (error?.code === "23505") {
    // Otra compra lo creó al mismo tiempo, o el teléfono/email pertenece a otro cliente.
    const raced = await lookup()
    if (raced) return { id: raced, created: false }
  }
  if (error) throw error
  return { id: data.id, created: true }
}
