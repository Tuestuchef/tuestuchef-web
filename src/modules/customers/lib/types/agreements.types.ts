// Acuerdo de un cliente fijo: % general y, por producto o combo, un % o un precio fijo en USD.
export type AgreementRule = { productId: string; discountPercent: number | null; fixedPriceUsd: number | null }

// Tasa de sus pagos en Bs: la de cada método (dólar) o siempre la BCV euro.
export type AgreementVesRateKind = "bcv_usd" | "bcv_eur"

export type CustomerAgreement = {
  customerId: string
  customerName: string
  generalDiscountPercent: number | null
  vesRateKind: AgreementVesRateKind
  // Inicial habitual de sus pedidos desde el umbral (null = la de la regla).
  depositPercent: number | null
  notes: string | null
  rules: AgreementRule[]
}
