"use client"

import { useMemo } from "react"

import type { CustomerAgreement } from "@/modules/customers/lib/types/agreements.types"

import type { SellableVariant, VolumeTier } from "../types/sales.types"
import { isAllowedFor, priceForAgreement, visibleForCustomer } from "../utils/agreement-pricing.util"

// Productos y precios según el cliente elegido en una venta, pedido o presupuesto:
// · priced: todas las variantes con los precios de su acuerdo (para calcular las líneas ya agregadas).
// · visible: sin los exclusivos de otros clientes (para el buscador).
// · tiers: sin descuento al mayor si el cliente tiene acuerdo.
// · notAllowed: si una variante ya agregada es exclusiva de otro cliente.
export function useCustomerPricing(
  variants: SellableVariant[],
  volumeTiers: VolumeTier[],
  agreements: CustomerAgreement[],
  methodIds: string[],
  customerId: string | null
) {
  const agreement = useMemo(() => agreements.find((a) => a.customerId === customerId) ?? null, [agreements, customerId])
  const methodKey = methodIds.join(",")
  const priced = useMemo(
    () => priceForAgreement(variants, agreement, methodKey ? methodKey.split(",") : []),
    [variants, agreement, methodKey]
  )
  const visible = useMemo(() => visibleForCustomer(priced, customerId), [priced, customerId])
  return {
    agreement,
    priced,
    visible,
    tiers: agreement ? [] : volumeTiers,
    notAllowed: (variant: SellableVariant | undefined) => Boolean(variant && !isAllowedFor(variant, customerId)),
  }
}
