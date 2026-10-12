import { describe, expect, it } from "vitest"

import type { SellableVariant } from "../types/sales.types"
import { variantsForCustomer } from "./agreement-pricing.util"

const variant = (id: string, productId: string, extra = 0, exclusive: string | null = null): SellableVariant => ({
  id,
  productId,
  sku: id,
  productName: productId,
  variantLabel: "",
  gender: null,
  color: null,
  size: null,
  fulfillmentType: "stock",
  stock: 10,
  pricesUsd: { cash: 20 + extra, zelle: 22 + extra },
  extraUsd: extra,
  exclusiveCustomerId: exclusive,
})

const variants = [variant("a", "fixed", 3), variant("b", "percent"), variant("c", "plain"), variant("d", "school-only", 0, "school")]
const agreement = {
  customerId: "school",
  customerName: "Escuela",
  generalDiscountPercent: 5,
  notes: null,
  rules: [
    { productId: "fixed", discountPercent: null, fixedPriceUsd: 12 },
    { productId: "percent", discountPercent: 25, fixedPriceUsd: null },
  ],
}

describe("precios del acuerdo en pantalla (igual que la base)", () => {
  it("fijo en cualquier método más el recargo; % sobre el precio del método; % general", () => {
    const priced = variantsForCustomer(variants, "school", agreement, ["cash", "zelle", "usdt"])
    const byId = new Map(priced.map((v) => [v.id, v]))
    expect(byId.get("a")!.pricesUsd).toEqual({ cash: 15, zelle: 15, usdt: 15 })
    expect(byId.get("b")!.pricesUsd).toEqual({ cash: 15, zelle: 16.5 })
    expect(byId.get("c")!.pricesUsd).toEqual({ cash: 19, zelle: 20.9 })
    expect(byId.has("d")).toBe(true)
  })

  it("los exclusivos solo se ven con su cliente; sin acuerdo, precios normales", () => {
    expect(variantsForCustomer(variants, null, null, []).map((v) => v.id)).toEqual(["a", "b", "c"])
    expect(variantsForCustomer(variants, "other", null, [])[1].pricesUsd).toEqual({ cash: 20, zelle: 22 })
  })
})
