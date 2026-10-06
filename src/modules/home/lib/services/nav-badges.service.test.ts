import { beforeEach, describe, expect, it, vi } from "vitest"

const counts = vi.hoisted(() => ({
  receivables: vi.fn(async () => 9),
  payables: vi.fn(async () => 3),
  rejections: vi.fn(async () => 2),
  orders: vi.fn(async () => 4),
  shortages: vi.fn(async () => 1),
  rate: vi.fn(async () => ({ hasTodayRate: false })),
}))

vi.mock("@/modules/sales/lib/services/sales.service", () => ({ countReceivables: counts.receivables }))
vi.mock("@/modules/purchases/lib/services/purchases.service", () => ({ countPayables: counts.payables }))
vi.mock("@/modules/sales/lib/services/offline-sales.service", () => ({ countOpenOfflineRejections: counts.rejections }))
vi.mock("@/modules/orders/lib/services/orders.service", () => ({ countOpenOrders: counts.orders }))
vi.mock("@/modules/orders/lib/services/production.service", () => ({ countMaterialShortages: counts.shortages }))
vi.mock("@/modules/treasury/lib/services/exchange-rates.service", () => ({ getRateStatus: counts.rate }))

const { getNavBadges } = await import("./nav-badges.service")

describe("contadores del menú", () => {
  beforeEach(() => vi.clearAllMocks())

  it("owner ve todo, incluido el aviso de la tasa de hoy", async () => {
    expect(await getNavBadges("owner")).toEqual({
      receivables: 9,
      offlineRejections: 2,
      openOrders: 4,
      materialShortages: 1,
      payables: 3,
      missingTodayRate: true,
    })
  })

  it("staff no consulta lo que no ve en el menú (cobros, pagos, tasas)", async () => {
    const badges = await getNavBadges("staff")
    expect(badges).toMatchObject({ receivables: 0, payables: 0, missingTodayRate: false, openOrders: 4, offlineRejections: 2 })
    expect(counts.receivables).not.toHaveBeenCalled()
    expect(counts.payables).not.toHaveBeenCalled()
    expect(counts.rate).not.toHaveBeenCalled()
  })

  it("si un contador falla, queda en cero y el resto sigue", async () => {
    counts.orders.mockRejectedValueOnce(new Error("sin conexión"))
    counts.rate.mockRejectedValueOnce(new Error("sin conexión"))
    const badges = await getNavBadges("admin")
    expect(badges.openOrders).toBe(0)
    expect(badges.missingTodayRate).toBe(false)
    expect(badges.receivables).toBe(9)
  })
})
