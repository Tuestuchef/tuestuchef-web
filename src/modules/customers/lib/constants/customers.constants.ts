import type { ContactField } from "../types/customers.types"

export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  phone: "teléfono",
  email: "correo",
  instagram: "Instagram",
  tax_id: "RIF",
}

export const CUSTOMER_LIST_LIMIT = 50

export const CUSTOMER_KIND_LABELS = { person: "Persona", company: "Empresa" } as const

export const CUSTOMER_MESSAGES = {
  SAVED: "Cliente guardado.",
  CONTACT_REQUIRED: "Indica al menos un teléfono, correo o Instagram.",
  LEGAL_NAME_REQUIRED: "Escribe la razón social.",
  DUPLICATE: (field: ContactField, name: string) =>
    `Ya existe un cliente con ese ${CONTACT_FIELD_LABELS[field]}: ${name}.`,
} as const
