import { parseAmount } from "@/common/lib/utils/parse-amount.util"

import { normalizeSku } from "./build-sku.util"

export type StockCsvRow = {
  line: number
  sku: string
  quantity: number
  unitCostUsdt: number | null
}

export type StockCsvIssue = { line: number; message: string }

// CSV de carga inicial: sku,cantidad[,costo_usdt]. Acepta coma o punto y coma
// como separador, encabezado opcional y decimales con coma o punto.
export function parseStockCsv(text: string): { rows: StockCsvRow[]; issues: StockCsvIssue[] } {
  const rows: StockCsvRow[] = []
  const issues: StockCsvIssue[] = []
  const seen = new Map<string, number>()

  const lines = text.replace(/^﻿/, "").split(/\r?\n/)
  lines.forEach((raw, index) => {
    const line = index + 1
    const content = raw.trim()
    if (!content) return

    const separator = content.includes(";") ? ";" : ","
    const [skuRaw = "", qtyRaw = "", costRaw = ""] = content.split(separator).map((cell) => cell.trim().replace(/^"|"$/g, ""))

    if (line === 1 && /^sku$/i.test(skuRaw)) return

    const sku = normalizeSku(skuRaw)
    if (!sku) {
      issues.push({ line, message: "Falta el SKU." })
      return
    }

    const quantity = parseAmount(qtyRaw, 3)
    if (quantity === null || quantity <= 0) {
      issues.push({ line, message: `Cantidad inválida para ${sku}: "${qtyRaw}".` })
      return
    }

    let unitCostUsdt: number | null = null
    if (costRaw) {
      unitCostUsdt = parseAmount(costRaw, 6)
      if (unitCostUsdt === null) {
        issues.push({ line, message: `Costo inválido para ${sku}: "${costRaw}".` })
        return
      }
    }

    if (seen.has(sku)) {
      issues.push({ line, message: `${sku} está repetido (también en la línea ${seen.get(sku)}).` })
      return
    }
    seen.set(sku, line)
    rows.push({ line, sku, quantity, unitCostUsdt })
  })

  return { rows, issues }
}
