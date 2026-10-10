"use client"

import { FileTextIcon, Loader2Icon, PackagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import ChoiceChips from "@/common/components/choice-chips"
import DateField from "@/common/components/date-field"
import FormField from "@/common/components/form-field"
import ReceiptField from "@/common/components/receipt-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/common/components/ui/command"
import { Input } from "@/common/components/ui/input"
import { Label } from "@/common/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/common/components/ui/popover"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"
import BackdateField from "@/modules/sales/components/backdate-field"
import type { SaleRatesForDate } from "@/modules/sales/lib/types/sales.types"

import { createPurchaseAction } from "../lib/actions/purchase-operations.action"
import { PURCHASE_MESSAGES, SUPPLIER_RATE_LABELS, type SupplierRateKind } from "../lib/constants/purchases.constants"
import type { PurchaseFormData, PurchaseRates } from "../lib/types/purchases.types"
import { accountAmountToUsd, purchaseLineTotal, usdToAccountAmount } from "../lib/utils/purchase-math.util"
import SupplierFormDialog from "./supplier-form-dialog"

type Line =
  | { key: number; type: "inventory"; variantId: string; quantity: string; cost: string; categoryId: string }
  | { key: number; type: "concept"; description: string; quantity: string; cost: string; categoryId: string }
type PaymentRow = { key: number; accountId: string; rateKind: SupplierRateKind; amount: string }
type PaymentMode = "full" | "custom" | "credit"

type PurchaseFormProps = PurchaseFormData & { canManage: boolean; receiptsEnabled: boolean }

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const usd = (value: number) => formatMoney(value, "USD")
const BS_RATES = [
  { value: "bcv_usd", label: SUPPLIER_RATE_LABELS.bcv_usd },
  { value: "parallel", label: SUPPLIER_RATE_LABELS.parallel },
] as const

// Registrar una compra a un proveedor: inventario (materia prima o mercancía) y conceptos sin stock.
const PurchaseForm = ({
  suppliers: initialSuppliers,
  variants,
  accounts,
  categories,
  rates,
  staffMaxBackdateDays,
  today,
  canManage,
  receiptsEnabled,
}: PurchaseFormProps) => {
  const router = useRouter()
  const receiptRef = useRef<HTMLDivElement>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const [suppliers, setSuppliers] = useState(initialSuppliers)
  const [supplierId, setSupplierId] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [mode, setMode] = useState<PaymentMode>("full")
  const [fullAccountId, setFullAccountId] = useState(accounts[0]?.id ?? "")
  const [fullRateKind, setFullRateKind] = useState<SupplierRateKind>("bcv_usd")
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([])
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState(today)
  const [dateRates, setDateRates] = useState<SaleRatesForDate | "today">("today")
  const isBackdated = date !== today

  const variantById = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants])
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const costCategory = categories.find((c) => c.type === "cost")?.id ?? categories[0]?.id ?? ""
  const expenseCategory = categories.find((c) => c.type === "operating_expense")?.id ?? costCategory

  const effectiveRates: PurchaseRates | null =
    dateRates === "today"
      ? rates
      : dateRates
        ? { bcvUsd: dateRates.bcvUsd, binance: dateRates.binance, usdUsdt: dateRates.usdUsdt }
        : null
  const ratesForMath = effectiveRates ?? { bcvUsd: 1, binance: 1, usdUsdt: 1 }

  // ---- Totales ----
  const lineTotals = lines.map((l) => {
    const quantity = parseAmount(l.quantity, 3) ?? 0
    const cost = parseAmount(l.cost, 4) ?? 0
    return quantity > 0 && cost > 0 ? purchaseLineTotal(cost, quantity) : 0
  })
  const total = Math.round(lineTotals.reduce((a, b) => a + b, 0) * 100) / 100

  const payments =
    mode === "full"
      ? fullAccountId && total > 0
        ? [
            {
              accountId: fullAccountId,
              rateKind: accountById.get(fullAccountId)?.currency === "VES" ? fullRateKind : ("none" as const),
              amount: usdToAccountAmount(
                total,
                accountById.get(fullAccountId)?.currency ?? "USD",
                accountById.get(fullAccountId)?.currency === "VES" ? fullRateKind : "none",
                ratesForMath
              ),
            },
          ]
        : []
      : mode === "credit"
        ? []
        : paymentRows.flatMap((row) => {
          const amount = parseAmount(row.amount)
          const account = accountById.get(row.accountId)
          return amount && amount > 0 && account
            ? [{ accountId: row.accountId, rateKind: account.currency === "VES" ? row.rateKind : ("none" as const), amount }]
            : []
        })
  const paidUsd = payments.reduce(
    (sum, p) => sum + accountAmountToUsd(p.amount, accountById.get(p.accountId)!.currency, p.rateKind, ratesForMath),
    0
  )
  const balance = Math.max(Math.round((total - paidUsd) * 100) / 100, 0)

  const invalidLine = lines.some((l, i) => lineTotals[i] === 0 || (l.type === "concept" && !l.description.trim()))
  const paysInBs = payments.some((p) => accountById.get(p.accountId)?.currency === "VES")
  const blockers = [
    !supplierId && "Elige el proveedor.",
    lines.length === 0 && PURCHASE_MESSAGES.EMPTY,
    invalidLine && "Revisa las líneas: cantidad, costo y descripción.",
    paidUsd > total + 0.01 && "Los pagos superan el total.",
    !canManage && balance > 0.01 && PURCHASE_MESSAGES.STAFF_MUST_PAY,
    isBackdated && dateRates === null && "No hay tasas registradas para esa fecha. Owner o admin debe cargarlas.",
    !isBackdated && paysInBs && !rates?.isCurrent && "Falta la tasa de hoy para pagar en Bs.",
    uploading && "Esperando que termine de subir el comprobante.",
  ].filter(Boolean) as string[]

  const addVariant = (variantId: string) => {
    setPickerOpen(false)
    const variant = variantById.get(variantId)
    setLines((prev) => [
      ...prev,
      {
        key: Date.now(),
        type: "inventory",
        variantId,
        quantity: "1",
        // Último costo conocido como sugerencia (USDT ≈ USD).
        cost: variant?.lastCostUsdt ? String(variant.lastCostUsdt) : "",
        categoryId: costCategory,
      },
    ])
  }
  const addConcept = () =>
    setLines((prev) => [
      ...prev,
      { key: Date.now(), type: "concept", description: "", quantity: "1", cost: "", categoryId: expenseCategory },
    ])
  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? ({ ...l, ...patch } as Line) : l)))

  const addPaymentRow = () => {
    const account = accounts[0]
    if (!account) return
    setPaymentRows((rows) => [
      ...rows,
      {
        key: Date.now(),
        accountId: account.id,
        rateKind: "bcv_usd",
        amount: balance > 0 ? String(usdToAccountAmount(balance, account.currency, "bcv_usd", ratesForMath)) : "",
      },
    ])
  }

  const submit = () => {
    setError(null)
    const receiptPath =
      receiptRef.current?.querySelector<HTMLInputElement>('input[name="receipt_path"]')?.value || null
    startTransition(async () => {
      const result = await createPurchaseAction({
        supplier_id: supplierId,
        items: lines.map((l) =>
          l.type === "inventory"
            ? { line_type: "inventory", variant_id: l.variantId, quantity: l.quantity, unit_cost_usd: l.cost, category_id: l.categoryId }
            : { line_type: "concept", description: l.description, quantity: l.quantity, unit_cost_usd: l.cost, category_id: l.categoryId }
        ),
        payments: payments.map((p) => ({ account_id: p.accountId, amount: p.amount, rate_kind: p.rateKind })),
        due_date: mode !== "full" && dueDate ? dueDate : null,
        notes: notes.trim() || null,
        receipt_path: receiptPath,
        date: isBackdated ? date : undefined,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(PURCHASE_MESSAGES.CREATED)
      router.push(ROUTES.PURCHASE(result.purchaseId))
    })
  }

  if (accounts.length === 0 || categories.length === 0) {
    return (
      <StatusAlert tone="warning" title="Faltan cuentas o categorías de costo">
        Owner o admin debe crear al menos una cuenta y una categoría de tipo costo o gasto.
      </StatusAlert>
    )
  }

  const fullAccount = accountById.get(fullAccountId)

  return (
    <div className="grid gap-5">
      {/* 1. Proveedor */}
      <div className="grid gap-2">
        <Label htmlFor="purchase-supplier">Proveedor</Label>
        <div className="flex gap-2">
          <select
            id="purchase-supplier"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm md:h-9"
          >
            <option value="">Elige el proveedor</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <SupplierFormDialog
            canManage={canManage}
            onSaved={(supplier) => {
              setSuppliers((prev) =>
                prev.some((s) => s.id === supplier.id) ? prev : [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name, "es"))
              )
              setSupplierId(supplier.id)
            }}
            trigger={
              <Button type="button" variant="outline" size="icon" className="size-11 md:size-9">
                <PlusIcon aria-hidden />
                <span className="sr-only">Nuevo proveedor</span>
              </Button>
            }
          />
        </div>
      </div>

      {/* 2. Líneas */}
      <section className="grid gap-2">
        <Label>Qué se compró</Label>
        <div className="flex flex-wrap gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="h-11 md:h-9">
                <PackagePlusIcon aria-hidden />
                Materia prima o mercancía
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command>
                <CommandInput placeholder="Tela, botones, SKU…" />
                <CommandList>
                  <CommandEmpty>No hay coincidencias.</CommandEmpty>
                  <CommandGroup>
                    {variants.map((v) => (
                      <CommandItem key={v.id} value={`${v.productName} ${v.variantLabel} ${v.sku}`} onSelect={() => addVariant(v.id)}>
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate">
                            {v.productName} <span className="text-muted-foreground">· {v.variantLabel}</span>
                          </span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {v.sku}
                            {v.isRawMaterial && " · materia prima"}
                          </span>
                        </span>
                        <span className="text-xs tabular-nums text-muted-foreground">Hay {quantityFormat.format(v.stock)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button type="button" variant="outline" className="h-11 md:h-9" onClick={addConcept}>
            <FileTextIcon aria-hidden />
            Concepto (servicio, alquiler…)
          </Button>
        </div>

        {lines.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lines.map((line, index) => {
              const variant = line.type === "inventory" ? variantById.get(line.variantId) : undefined
              return (
                <li key={line.key} className="grid gap-2 p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {line.type === "inventory" ? (
                        <span className="text-sm font-medium">
                          {variant?.productName} <span className="font-normal text-muted-foreground">· {variant?.variantLabel}</span>
                        </span>
                      ) : (
                        <Input
                          aria-label="Descripción del concepto"
                          value={line.description}
                          onChange={(e) => updateLine(line.key, { description: e.target.value })}
                          placeholder="Ej.: Alquiler del taller, maquila de 20 filipinas"
                          className="h-11 md:h-9"
                        />
                      )}
                    </div>
                    <span className="pt-2 text-sm font-medium tabular-nums">{usd(lineTotals[index])}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      <Trash2Icon aria-hidden />
                      <span className="sr-only">Quitar línea</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[6rem_8rem_1fr]">
                    <Input
                      aria-label={`Cantidad${variant ? ` (${variant.unit})` : ""}`}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(e) => updateLine(line.key, { quantity: e.target.value })}
                      placeholder="Cant."
                      className="h-11 tabular-nums md:h-9"
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        aria-label="Costo unitario en USD"
                        inputMode="decimal"
                        value={line.cost}
                        onChange={(e) => updateLine(line.key, { cost: e.target.value })}
                        placeholder="c/u"
                        className="h-11 pl-7 tabular-nums md:h-9"
                      />
                    </div>
                    <select
                      aria-label="Categoría"
                      value={line.categoryId}
                      onChange={(e) => updateLine(line.key, { categoryId: e.target.value })}
                      className="col-span-2 h-11 rounded-md border bg-background px-2 text-sm sm:col-span-1 md:h-9"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* 3. Pago */}
      <FormField
        label="Pago"
        htmlFor="purchase-payment"
        hint={canManage ? undefined : "Staff registra solo compras pagadas completas en el momento."}
      >
        <ChoiceChips
          id="purchase-payment"
          label="Pago"
          value={mode}
          onChange={(v) => {
            setMode(v as PaymentMode)
            if (v === "custom" && paymentRows.length === 0) addPaymentRow()
          }}
          options={
            canManage
              ? [
                  { value: "full", label: "Pagada completa" },
                  { value: "custom", label: "Abono o mixto" },
                  { value: "credit", label: "A crédito" },
                ]
              : [{ value: "full", label: "Pagada completa" }]
          }
        />
      </FormField>

      {mode === "full" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Sale de la cuenta" htmlFor="purchase-account">
            <select
              id="purchase-account"
              value={fullAccountId}
              onChange={(e) => setFullAccountId(e.target.value)}
              className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </FormField>
          {fullAccount?.currency === "VES" && (
            <FormField label="Tasa del pago en Bs" htmlFor="purchase-rate">
              <ChoiceChips
                id="purchase-rate"
                label="Tasa del pago en Bs"
                value={fullRateKind}
                onChange={(v) => setFullRateKind(v as SupplierRateKind)}
                options={BS_RATES}
              />
            </FormField>
          )}
        </div>
      )}

      {mode === "custom" && (
        <div className="grid gap-2">
          {paymentRows.map((row) => {
            const account = accountById.get(row.accountId)
            return (
              <div key={row.key} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_auto_8rem_auto] sm:items-center">
                <select
                  aria-label="Cuenta"
                  value={row.accountId}
                  onChange={(e) => setPaymentRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, accountId: e.target.value } : r)))}
                  className="h-11 rounded-md border bg-background px-2 text-sm md:h-9"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </select>
                {account?.currency === "VES" ? (
                  <ChoiceChips
                    label="Tasa del pago"
                    value={row.rateKind}
                    onChange={(v) =>
                      setPaymentRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, rateKind: v as SupplierRateKind } : r)))
                    }
                    options={BS_RATES}
                  />
                ) : (
                  <span />
                )}
                <Input
                  aria-label={`Monto en ${account?.currency ?? ""}`}
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) => setPaymentRows((rows) => rows.map((r) => (r.key === row.key ? { ...r, amount: e.target.value } : r)))}
                  placeholder={account?.currency}
                  className="h-11 text-right tabular-nums md:h-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9"
                  onClick={() => setPaymentRows((rows) => rows.filter((r) => r.key !== row.key))}
                >
                  <Trash2Icon aria-hidden />
                  <span className="sr-only">Quitar pago</span>
                </Button>
              </div>
            )
          })}
          {paymentRows.length < 5 && (
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addPaymentRow}>
              <PlusIcon aria-hidden />
              Otro pago{balance > 0 ? ` (resta ${usd(balance)})` : ""}
            </Button>
          )}
        </div>
      )}

      {mode !== "full" && (
        <FormField label="Vence" htmlFor="purchase-due" optional hint="Fecha límite para pagar el saldo.">
          <DateField id="purchase-due" min={date} value={dueDate} onChange={setDueDate} clearable className="max-w-80" />
        </FormField>
      )}

      {/* Fecha, comprobante y notas */}
      <BackdateField
        id="purchase-date"
        today={today}
        maxDaysBack={canManage ? null : staffMaxBackdateDays}
        value={date}
        onChange={(next, nextRates) => {
          setDate(next)
          setDateRates(nextRates)
        }}
      />
      <div ref={receiptRef}>
        <ReceiptField enabled={receiptsEnabled} onUploadingChange={setUploading} />
      </div>
      <Input
        aria-label="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas (opcional): n.º de factura, condiciones…"
        className="h-11 md:h-9"
      />

      {/* Resumen */}
      <div className="sticky bottom-0 -mx-4 grid gap-3 border-t bg-background p-4 md:static md:mx-0 md:rounded-lg md:border">
        <dl className="grid gap-1 text-sm tabular-nums">
          <div className="flex items-baseline justify-between text-base font-semibold">
            <dt>Total</dt>
            <dd>{usd(total)}</dd>
          </div>
          {payments.map((p, i) => {
            const account = accountById.get(p.accountId)!
            return (
              <div key={i} className="flex justify-between text-muted-foreground">
                <dt>
                  {account.name}
                  {account.currency === "VES" && ` (${SUPPLIER_RATE_LABELS[p.rateKind].toLowerCase()})`}
                </dt>
                <dd>{formatMoney(p.amount, account.currency)}</dd>
              </div>
            )
          })}
          {total > 0 && balance > 0.01 && (
            <div className="flex justify-between">
              <dt>Queda por pagar</dt>
              <dd>{usd(balance)}</dd>
            </div>
          )}
        </dl>

        {error ? (
          <StatusAlert tone="error" title={error} />
        ) : (
          (lines.length > 0 || supplierId) && blockers[0] && <StatusAlert tone="warning" title={blockers[0]} />
        )}

        <Button type="button" className="h-12 text-base" disabled={pending || blockers.length > 0} onClick={submit}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {pending ? "Registrando…" : `Registrar compra · ${usd(total)}`}
        </Button>
      </div>
    </div>
  )
}

export default PurchaseForm
