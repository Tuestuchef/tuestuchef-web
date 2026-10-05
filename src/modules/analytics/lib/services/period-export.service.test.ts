import ExcelJS from "exceljs"
import { describe, expect, it, vi } from "vitest"

// Respuestas por tabla: lo justo para armar el libro.
const DATA: Record<string, unknown[]> = {
  sales: [],
  sale_payments: [],
  purchases: [],
  payroll_entries: [],
  ledger_entries: [
    { occurred_at: "2026-09-10T16:00:00Z", entry_type: "sale_payment", description: null, currency: "USD", amount: 500, bcv_usd_rate: 40, binance_rate: 50, usdt_value: 500, reverses_entry_id: null, account: { name: "Caja" }, category: { name: "Ventas", type: "sales" }, member: null },
    { occurred_at: "2026-09-11T16:00:00Z", entry_type: "expense", description: "Alquiler", currency: "USD", amount: -200, bcv_usd_rate: 40, binance_rate: 50, usdt_value: -200, reverses_entry_id: null, account: { name: "Caja" }, category: { name: "Alquiler", type: "operating_expense" }, member: null },
  ],
}

const query = (table: string) => {
  const result = { data: DATA[table] ?? null, error: null }
  const chain: Record<string, unknown> = {}
  for (const method of ["select", "gte", "lt", "order", "eq", "in"]) chain[method] = () => chain
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain
}

vi.mock("server-only", () => ({}))
// Resumen por tipo (analytics_ledger_summary): el cobro de 580 trae 80 de IVA, que va aparte.
const SUMMARY = [
  { month: "2026-09", category_type: "sales", category_name: "Ventas", person_name: null, usdt_value: 500 },
  { month: "2026-09", category_type: "vat_collected", category_name: "IVA cobrado", person_name: null, usdt_value: 80 },
  { month: "2026-09", category_type: "operating_expense", category_name: "Alquiler", person_name: null, usdt_value: -200 },
]

vi.mock("@/common/lib/db/supabase-server.client", () => ({
  createSupabaseServerClient: async () => ({ from: query, rpc: async () => ({ data: SUMMARY, error: null }) }),
}))

describe("Excel del mes", () => {
  it("arma las hojas y el resumen de utilidad real", async () => {
    const { buildPeriodWorkbook } = await import("./period-export.service")
    const buffer = await buildPeriodWorkbook("2026-09")
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(buffer as unknown as ArrayBuffer)

    expect(book.worksheets.map((s) => s.name)).toEqual(["Resumen", "Ventas", "Pagos recibidos", "Compras", "Movimientos", "Sueldos"])
    const summary = book.getWorksheet("Resumen")!
    const values = new Map<string, number>()
    summary.eachRow((row) => values.set(String(row.getCell(1).value), Number(row.getCell(2).value)))
    expect(values.get("Ingresos reales")).toBe(500)
    expect(values.get("Utilidad real")).toBe(300)
    expect(values.get("IVA cobrado (no es ingreso)")).toBe(80)
    expect(book.getWorksheet("Movimientos")!.rowCount).toBe(3)
  })
})
