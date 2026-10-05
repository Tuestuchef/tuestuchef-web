// Datos de la empresa que ven los clientes (presupuestos, recibos y, más adelante, correos).
export type BusinessProfile = {
  tradeName: string | null
  legalName: string | null
  taxId: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  website: string | null
  address: string | null
  headerImagePath: string | null
  // URL para mostrarla (dominio público o firmada temporal). null si no hay imagen o almacenamiento.
  headerImageUrl: string | null
  updatedAt: string | null
  updatedByName: string | null
}

export type BusinessProfileField =
  | "trade_name"
  | "legal_name"
  | "tax_id"
  | "email"
  | "phone"
  | "whatsapp"
  | "instagram"
  | "website"
  | "address"
