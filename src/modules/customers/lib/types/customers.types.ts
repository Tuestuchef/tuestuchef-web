import type { Tables } from "@/common/lib/db/database.types"

export type Customer = Tables<"customers">

export type CustomerListItem = Pick<
  Customer,
  | "id"
  | "kind"
  | "first_name"
  | "last_name"
  | "legal_name"
  | "phone"
  | "email"
  | "instagram"
  | "is_active"
  | "has_id_document"
  | "blocked_at"
  | "blocked_reason"
>

// Detalle: la cédula solo llega para owner y admin (RLS); para staff es null aunque exista.
export type CustomerDetail = Customer & { idDocument: string | null }

export type ContactField = "phone" | "email" | "instagram" | "tax_id"

// Cliente que ya usa ese teléfono, email o Instagram.
export type DuplicateCustomer = {
  id: string
  name: string
  field: ContactField
}

export type ContactInput = {
  phone?: string | null
  email?: string | null
  instagram?: string | null
  tax_id?: string | null
}
