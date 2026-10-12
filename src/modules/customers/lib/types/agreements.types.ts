// Acuerdo de un cliente fijo: % general y, por producto o combo, un % o un precio fijo en USD.
export type AgreementRule = { productId: string; discountPercent: number | null; fixedPriceUsd: number | null }

export type CustomerAgreement = {
  customerId: string
  customerName: string
  generalDiscountPercent: number | null
  notes: string | null
  rules: AgreementRule[]
}
