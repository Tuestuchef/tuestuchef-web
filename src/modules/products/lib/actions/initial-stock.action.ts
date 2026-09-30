"use server"

import { refresh } from "next/cache"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { PRODUCT_MESSAGES } from "../constants/products.constants"
import { initialStockSchema } from "../schemas/products.schema"
import { loadInitialStock, previewInitialStock } from "../services/stock.service"
import type { InitialStockPreviewRow } from "../types/products.types"
import { parseStockCsv, type StockCsvIssue } from "../utils/parse-stock-csv.util"

type PreviewResult =
  | { ok: true; rows: InitialStockPreviewRow[]; issues: StockCsvIssue[] }
  | { ok: false; error: string }

// Paso 1: leer el CSV y mostrar qué se cargaría y qué no (nada se guarda).
export async function previewInitialStockAction(csv: string): Promise<PreviewResult> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = initialStockSchema.safeParse({ csv })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { rows, issues } = parseStockCsv(parsed.data.csv)
  return { ok: true, rows: await previewInitialStock(rows), issues }
}

// Paso 2: confirmar. Se vuelve a leer y validar; si algo falla no se carga nada.
export async function confirmInitialStockAction(
  csv: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = initialStockSchema.safeParse({ csv })
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

  const { rows, issues } = parseStockCsv(parsed.data.csv)
  const preview = await previewInitialStock(rows)
  if (issues.length || preview.some((row) => row.error) || !rows.length) {
    return { ok: false, error: "El CSV tiene errores. Corrígelos y vuelve a revisar." }
  }

  const { data, error } = await loadInitialStock(rows)
  if (error) return { ok: false, error: toUserError(error) }

  refresh()
  return { ok: true, message: PRODUCT_MESSAGES.INITIAL_STOCK_LOADED(data ?? rows.length) }
}
