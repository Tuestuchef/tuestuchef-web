"use client"

import { FileUpIcon, SearchCheckIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Label } from "@/common/components/ui/label"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import { confirmInitialStockAction, previewInitialStockAction } from "../lib/actions/initial-stock.action"
import type { InitialStockPreviewRow } from "../lib/types/products.types"
import type { StockCsvIssue } from "../lib/utils/parse-stock-csv.util"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const EXAMPLE = "sku;cantidad;costo_usdt\nFIL-D-BR-VIN-M;12;9,50\nFIL-D-BR-VIN-L;8;9,50"

type Preview = { rows: InitialStockPreviewRow[]; issues: StockCsvIssue[] }

// Paso 1: pegar o subir el CSV → vista previa. Paso 2: confirmar (todo o nada).
const InitialStockImport = () => {
  const router = useRouter()
  const [csv, setCsv] = useState("")
  const [preview, setPreview] = useState<Preview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, startChecking] = useTransition()
  const [loading, startLoading] = useTransition()

  const updateCsv = (value: string) => {
    setCsv(value)
    setPreview(null)
  }

  const check = () =>
    startChecking(async () => {
      setError(null)
      const result = await previewInitialStockAction(csv)
      if (!result.ok) setError(result.error)
      else setPreview({ rows: result.rows, issues: result.issues })
    })

  const confirm = () =>
    startLoading(async () => {
      const result = await confirmInitialStockAction(csv)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      router.push(ROUTES.STOCK)
    })

  const rowErrors = preview?.rows.filter((r) => r.error).length ?? 0
  const totalErrors = rowErrors + (preview?.issues.length ?? 0)
  const canConfirm = preview !== null && preview.rows.length > 0 && totalErrors === 0

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="initial-csv">CSV</Label>
        <Textarea
          id="initial-csv"
          value={csv}
          onChange={(e) => updateCsv(e.target.value)}
          placeholder={EXAMPLE}
          rows={8}
          spellCheck={false}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Columnas: SKU, cantidad y, opcional, costo unitario en USDT. Separador coma o punto y coma.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="h-11 md:h-9">
          <label>
            <FileUpIcon aria-hidden />
            Subir archivo .csv
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0]
                if (file) updateCsv(await file.text())
                event.target.value = ""
              }}
            />
          </label>
        </Button>
        <SubmitButton type="button" pending={checking} pendingLabel="Revisando…" disabled={!csv.trim()} onClick={check}>
          <SearchCheckIcon aria-hidden />
          Revisar
        </SubmitButton>
      </div>

      {error && <StatusAlert tone="error" title={error} />}

      {preview && (
        <div className="grid gap-3">
          {totalErrors > 0 ? (
            <StatusAlert tone="error" title={`${totalErrors} ${totalErrors === 1 ? "línea con error" : "líneas con error"}`}>
              Corrige el CSV y vuelve a revisar. No se carga nada mientras haya errores.
            </StatusAlert>
          ) : (
            <StatusAlert tone="success" title={`${preview.rows.length} variantes listas para cargar`} />
          )}

          {preview.issues.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {preview.issues.map((issue) => (
                <li key={`${issue.line}-${issue.message}`}>
                  <StatusBadge tone="error">Línea {issue.line}</StatusBadge> {issue.message}
                </li>
              ))}
            </ul>
          )}

          <ul className="divide-y rounded-lg border">
            {preview.rows.map((row) => (
              <li key={row.line} className="flex items-start gap-3 p-3">
                <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{row.line}</span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <code className="font-mono text-sm">{row.sku}</code>
                  {row.error ? (
                    <StatusBadge tone="error">{row.error}</StatusBadge>
                  ) : (
                    <span className="truncate text-xs text-muted-foreground">
                      {row.productName} · {row.variantLabel}
                    </span>
                  )}
                </div>
                <span className="text-sm tabular-nums">{quantityFormat.format(row.quantity)}</span>
              </li>
            ))}
          </ul>

          <SubmitButton type="button" pending={loading} pendingLabel="Cargando…" disabled={!canConfirm} onClick={confirm}>
            Confirmar carga inicial
          </SubmitButton>
        </div>
      )}
    </div>
  )
}

export default InitialStockImport
