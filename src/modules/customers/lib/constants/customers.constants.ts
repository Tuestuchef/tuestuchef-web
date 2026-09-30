import type { ContactField } from "../types/customers.types"

export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  phone: "teléfono",
  email: "correo",
  instagram: "Instagram",
}

export const CUSTOMER_LIST_LIMIT = 50

export const CUSTOMER_MESSAGES = {
  SAVED: "Cliente guardado.",
  CONTACT_REQUIRED: "Indica al menos un teléfono, correo o Instagram.",
  DUPLICATE: (field: ContactField, name: string) =>
    `Ya existe un cliente con ese ${CONTACT_FIELD_LABELS[field]}: ${name}.`,
} as const
