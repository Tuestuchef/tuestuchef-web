import { describe, expect, it } from "vitest"

import { buildSku, normalizeSku, uniqueSku } from "@/modules/products/lib/utils/build-sku.util"
import { parseStockCsv } from "@/modules/products/lib/utils/parse-stock-csv.util"

describe("SKU", () => {
  it("filipina dama broche vinotinta M", () => {
    expect(
      buildSku({ categoryCode: "FIL", gender: "women", closure: "snap", colorCode: "VIN", sizeCode: "M" })
    ).toBe("FIL-D-BR-VIN-M")
  })
  it("pantalón jogger caballero negro L", () => {
    expect(buildSku({ categoryCode: "PAN", gender: "men", fit: "jogger", colorCode: "NEG", sizeCode: "L" })).toBe(
      "PAN-C-JG-NEG-L"
    )
  })
  it("estuche sin talla ni género", () => {
    expect(buildSku({ categoryCode: "EST", colorCode: "NEG" })).toBe("EST-NEG")
  })
  it("normaliza lo escrito a mano", () => {
    expect(normalizeSku(" fil d  br-vinótinta-m ")).toBe("FIL-D-BR-VINOTINTA-M")
  })
  it("evita duplicados", () => {
    expect(uniqueSku("FIL-VIN", new Set(["FIL-VIN", "FIL-VIN-2"]))).toBe("FIL-VIN-3")
  })
})

describe("CSV de carga inicial", () => {
  it("encabezado, coma o punto y coma, decimales y costo opcional", () => {
    const { rows, issues } = parseStockCsv("sku,cantidad,costo_usdt\nfil-d-br-vin-m,10,12.5\nEST-NEG;3;\n")
    expect(issues).toEqual([])
    expect(rows).toEqual([
      { line: 2, sku: "FIL-D-BR-VIN-M", quantity: 10, unitCostUsdt: 12.5 },
      { line: 3, sku: "EST-NEG", quantity: 3, unitCostUsdt: null },
    ])
  })
  it("reporta cantidades inválidas, SKU vacío y repetidos", () => {
    const { rows, issues } = parseStockCsv("A,0\n,5\nB,abc\nC,2\nc,4")
    expect(rows.map((r) => r.sku)).toEqual(["C"])
    expect(issues.map((i) => i.line)).toEqual([1, 2, 3, 5])
  })
})
