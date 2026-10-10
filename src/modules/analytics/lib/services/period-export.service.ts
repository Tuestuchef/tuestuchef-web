import "server-only"

import ExcelJS from "exceljs"

import type { Enums } from "@/common/lib/db/database.types"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { caracasMonthRange } from "@/common/lib/utils/format-date.util"
import { CATEGORY_TYPE_LABELS, ENTRY_TYPE_LABELS } from "@/modules/money-movements/lib/constants/money-movements.constants"
import { formatPurchaseNumber, PURCHASE_STATUS_LABELS } from "@/modules/purchases/lib/constants/purchases.constants"
import { CHANNEL_LABELS, formatSaleNumber, PAYMENT_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import { CONTRIBUTION_TYPES, DEDUCTION_TYPES, INCOME_TYPES, PROFIT_USE_TYPES } from "../constants/analytics.constants"

type CategoryType = Enums<"category_type">
type Column = { header: string; key: string; width?: number; money?: boolean; date?: boolean }

const caracasDate = (iso: string) => new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Caracas" }))
const fullName = (c: { first_name: string; last_name: string | null } | null) => (c ? [c.first_name, c.last_name].filter(Boolean).join(" ") : "")

function addSheet(book: ExcelJS.Workbook, name: string, columns: Column[], rows: Record<string, unknown>[]) {
  const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] })
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }))
  sheet.getRow(1).font = { bold: true }
  for (const row of rows) sheet.addRow(row)
  columns.forEach((c, index) => {
    const column = sheet.getColumn(index + 1)
    if (c.money) column.numFmt = "#,##0.00"
    if (c.date) column.numFmt = "dd/mm/yyyy"
  })
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  return sheet
}

// Libro del mes para el contador: resumen de utilidad, ventas, pagos, compras, libro de dinero y sueldos.
// Se lee con la sesión de la persona: RLS decide qué datos entran (solo owner y admin ven todo).
export async function buildPeriodWorkbook(month: string): Promise<Buffer> {
  const supabase = await createSupabaseServerClient()
  const { from, to } = caracasMonthRange(month)

  // Último día del mes (AAAA-MM-DD) para el resumen por tipo.
  const [year, monthNumber] = month.split("-").map(Number)
  const lastDay = `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`

  const [sales, payments, purchases, ledger, payroll, status, totalsByType] = await Promise.all([
    supabase
      .from("sales")
      .select(
        "id, number, occurred_at, channel, subtotal_usd, volume_discount_usd, discount_usd, delivery_fee_usd, vat_usd, total_usd, customer:customers(first_name, last_name), method:payment_methods(name)"
      )
      .gte("occurred_at", from)
      .lt("occurred_at", to)
      .order("occurred_at"),
    supabase
      .from("sale_payments_all")
      .select(
        "occurred_at, currency, amount, applied_rate, usd_amount, usdt_value, sale:sales(number), method:payment_methods(name), correction:sale_payment_corrections!sale_payment_corrections_payment_id_fkey(payment_id)"
      )
      .gte("occurred_at", from)
      .lt("occurred_at", to)
      .order("occurred_at"),
    supabase
      .from("purchases")
      .select("id, number, occurred_at, total_usd, due_date, supplier:suppliers(name)")
      .gte("occurred_at", from)
      .lt("occurred_at", to)
      .order("occurred_at"),
    supabase
      .from("ledger_entries")
      .select(
        "occurred_at, entry_type, description, currency, amount, bcv_usd_rate, binance_rate, usdt_value, reverses_entry_id, account:accounts(name), category:movement_categories(name, type), member:team_members(full_name)"
      )
      .gte("occurred_at", from)
      .lt("occurred_at", to)
      .order("occurred_at"),
    supabase
      .from("payroll_entries")
      .select("occurred_at, kind, currency, amount, usd_amount, period_label, member:team_members(full_name)")
      .gte("occurred_at", from)
      .lt("occurred_at", to)
      .order("occurred_at"),
    supabase.from("period_status").select("is_closed, changed_at").eq("period", `${month}-01`).maybeSingle(),
    // Mismo resumen que el dashboard: el IVA de los cobros ya viene separado de las ventas.
    supabase.rpc("analytics_ledger_summary", { p_from: `${month}-01`, p_to: lastDay }),
  ])
  for (const result of [sales, payments, purchases, ledger, payroll, totalsByType]) if (result.error) throw result.error

  const saleIds = (sales.data ?? []).map((s) => s.id)
  const purchaseIds = (purchases.data ?? []).map((p) => p.id)
  const [saleSummary, purchaseSummary] = await Promise.all([
    saleIds.length ? supabase.from("sales_summary").select("sale_id, paid_usd, balance_usd, payment_status").in("sale_id", saleIds) : Promise.resolve({ data: [] }),
    purchaseIds.length
      ? supabase.from("purchases_summary").select("purchase_id, paid_usd, balance_usd, payment_status").in("purchase_id", purchaseIds)
      : Promise.resolve({ data: [] }),
  ])
  const saleStatus = new Map((saleSummary.data ?? []).map((s) => [s.sale_id, s]))
  const purchaseStatus = new Map((purchaseSummary.data ?? []).map((p) => [p.purchase_id, p]))

  const book = new ExcelJS.Workbook()
  book.creator = "Tuestuchef"
  book.created = new Date()

  // ---- Resumen: utilidad real del mes ----
  const byType = new Map<CategoryType, number>()
  for (const row of totalsByType.data ?? []) {
    byType.set(row.category_type, (byType.get(row.category_type) ?? 0) + Number(row.usdt_value))
  }
  const sum = (types: readonly CategoryType[]) => types.reduce((s, t) => s + (byType.get(t) ?? 0), 0)
  const income = sum(INCOME_TYPES)
  const deductions = sum(DEDUCTION_TYPES)
  const summary = addSheet(
    book,
    "Resumen",
    [
      { header: "Concepto", key: "label", width: 36 },
      { header: "USDT (valor real)", key: "value", width: 20, money: true },
    ],
    [
      { label: `Mes ${month}${status.data?.is_closed ? " (cerrado)" : " (abierto)"}`, value: null },
      ...INCOME_TYPES.map((t) => ({ label: CATEGORY_TYPE_LABELS[t], value: byType.get(t) ?? 0 })),
      { label: "Ingresos reales", value: income },
      ...DEDUCTION_TYPES.map((t) => ({ label: CATEGORY_TYPE_LABELS[t], value: byType.get(t) ?? 0 })),
      { label: "Utilidad real", value: income + deductions },
      ...PROFIT_USE_TYPES.map((t) => ({ label: `${CATEGORY_TYPE_LABELS[t]} (sale de la utilidad)`, value: byType.get(t) ?? 0 })),
      ...CONTRIBUTION_TYPES.map((t) => ({ label: `${CATEGORY_TYPE_LABELS[t]} (no es ingreso)`, value: byType.get(t) ?? 0 })),
      { label: `${CATEGORY_TYPE_LABELS.vat_collected} (no es ingreso)`, value: byType.get("vat_collected") ?? 0 },
    ]
  )
  summary.getRow(2).font = { bold: true }

  addSheet(
    book,
    "Ventas",
    [
      { header: "Nota", key: "number", width: 12 },
      { header: "Fecha", key: "date", width: 12, date: true },
      { header: "Cliente", key: "customer", width: 28 },
      { header: "Canal", key: "channel" },
      { header: "Lista de precios", key: "method" },
      { header: "Subtotal USD", key: "subtotal", money: true },
      { header: "Al mayor USD", key: "volume", money: true },
      { header: "Descuento USD", key: "discount", money: true },
      { header: "Delivery USD", key: "fee", money: true },
      { header: "IVA USD", key: "vat", money: true },
      { header: "Total USD", key: "total", money: true },
      { header: "Pagado USD", key: "paid", money: true },
      { header: "Saldo USD", key: "balance", money: true },
      { header: "Estado", key: "status" },
    ],
    (sales.data ?? []).map((s) => {
      const st = saleStatus.get(s.id)
      return {
        number: formatSaleNumber(s.number),
        date: caracasDate(s.occurred_at),
        customer: fullName(s.customer) || "Venta rápida",
        channel: CHANNEL_LABELS[s.channel],
        method: s.method?.name ?? "",
        subtotal: Number(s.subtotal_usd),
        volume: Number(s.volume_discount_usd),
        discount: Number(s.discount_usd),
        fee: Number(s.delivery_fee_usd),
        vat: Number(s.vat_usd),
        total: Number(s.total_usd),
        paid: Number(st?.paid_usd ?? 0),
        balance: Number(st?.balance_usd ?? 0),
        status: st?.payment_status ? PAYMENT_STATUS_LABELS[st.payment_status as keyof typeof PAYMENT_STATUS_LABELS] : "",
      }
    })
  )

  addSheet(
    book,
    "Pagos recibidos",
    [
      { header: "Fecha", key: "date", width: 12, date: true },
      { header: "Nota", key: "number", width: 12 },
      { header: "Método", key: "method" },
      { header: "Moneda", key: "currency", width: 10 },
      { header: "Monto", key: "amount", money: true },
      { header: "Tasa aplicada", key: "rate", money: true },
      { header: "Equivale USD", key: "usd", money: true },
      { header: "Valor real USDT", key: "usdt", money: true },
    ],
    // Los pagos corregidos no cuentan (su reverso y el pago correcto están en el libro).
    (payments.data ?? []).filter((p) => !p.correction).map((p) => ({
      date: caracasDate(p.occurred_at),
      number: p.sale ? formatSaleNumber(p.sale.number) : "",
      method: p.method?.name ?? "",
      currency: p.currency,
      amount: Number(p.amount),
      rate: p.applied_rate === null ? null : Number(p.applied_rate),
      usd: Number(p.usd_amount),
      usdt: Number(p.usdt_value),
    }))
  )

  addSheet(
    book,
    "Compras",
    [
      { header: "Compra", key: "number", width: 12 },
      { header: "Fecha", key: "date", width: 12, date: true },
      { header: "Proveedor", key: "supplier", width: 28 },
      { header: "Total USD", key: "total", money: true },
      { header: "Pagado USD", key: "paid", money: true },
      { header: "Saldo USD", key: "balance", money: true },
      { header: "Vence", key: "due", width: 12, date: true },
      { header: "Estado", key: "status" },
    ],
    (purchases.data ?? []).map((p) => {
      const st = purchaseStatus.get(p.id)
      return {
        number: formatPurchaseNumber(p.number),
        date: caracasDate(p.occurred_at),
        supplier: p.supplier?.name ?? "",
        total: Number(p.total_usd),
        paid: Number(st?.paid_usd ?? 0),
        balance: Number(st?.balance_usd ?? 0),
        due: p.due_date ? new Date(`${p.due_date}T12:00:00`) : null,
        status: st?.payment_status ? PURCHASE_STATUS_LABELS[st.payment_status as keyof typeof PURCHASE_STATUS_LABELS] : "",
      }
    })
  )

  addSheet(
    book,
    "Movimientos",
    [
      { header: "Fecha", key: "date", width: 12, date: true },
      { header: "Cuenta", key: "account", width: 20 },
      { header: "Tipo", key: "type", width: 18 },
      { header: "Categoría", key: "category", width: 22 },
      { header: "Clase", key: "kind", width: 18 },
      { header: "Persona", key: "person", width: 20 },
      { header: "Descripción", key: "description", width: 40 },
      { header: "Moneda", key: "currency", width: 10 },
      { header: "Monto", key: "amount", money: true },
      { header: "Tasa BCV", key: "bcv", money: true },
      { header: "Tasa paralela", key: "binance", money: true },
      { header: "Valor real USDT", key: "usdt", money: true },
      { header: "Reverso", key: "reversal", width: 10 },
    ],
    (ledger.data ?? []).map((l) => ({
      date: caracasDate(l.occurred_at),
      account: l.account?.name ?? "",
      type: ENTRY_TYPE_LABELS[l.entry_type],
      category: l.category?.name ?? "",
      kind: l.category ? CATEGORY_TYPE_LABELS[l.category.type] : "",
      person: l.member?.full_name ?? "",
      description: l.description ?? "",
      currency: l.currency,
      amount: Number(l.amount),
      bcv: Number(l.bcv_usd_rate),
      binance: Number(l.binance_rate),
      usdt: Number(l.usdt_value),
      reversal: l.reverses_entry_id ? "Sí" : "",
    }))
  )

  addSheet(
    book,
    "Sueldos",
    [
      { header: "Fecha", key: "date", width: 12, date: true },
      { header: "Persona", key: "person", width: 24 },
      { header: "Tipo", key: "kind" },
      { header: "Período", key: "period" },
      { header: "Moneda", key: "currency", width: 10 },
      { header: "Monto", key: "amount", money: true },
      { header: "Equivale USD", key: "usd", money: true },
    ],
    (payroll.data ?? []).map((p) => ({
      date: caracasDate(p.occurred_at),
      person: p.member?.full_name ?? "",
      kind: p.kind === "advance" ? "Adelanto" : "Pago",
      period: p.period_label ?? "",
      currency: p.currency,
      amount: Number(p.amount),
      usd: Number(p.usd_amount),
    }))
  )

  return Buffer.from(await book.xlsx.writeBuffer())
}
