// Datos de contacto del negocio que ven los clientes (recibos y, más adelante, correos y mensajes).
export type BusinessProfile = {
  email: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  address: string | null
  taxId: string | null
  updatedAt: string | null
  updatedByName: string | null
}

export type BusinessProfileField = "email" | "phone" | "whatsapp" | "instagram" | "address" | "tax_id"
