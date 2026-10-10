"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"
import { getRatesForDate } from "@/modules/treasury/lib/services/exchange-rates.service"

import { SALES_MESSAGES } from "../constants/sales.constants"
import {
  type AddPaymentField,
  addPaymentSchema,
  correctPaymentSchema,
  editSaleSchema,
  itemStatusSchema,
  salesSettingsSchema,
  type VoidSaleField,
  voidSaleSchema,
} from "../schemas/sales.schema"
import {
  addSalePayment,
  correctSalePayment,
  editSaleDetails,
  setSaleItemStatus,
  updateSalesSettings,
  voidSale,
} from "../services/sales.service"
import type { SaleRatesForDate } from "../types/sales.types"

const ok = (message: string) => ({ status: "success" as const, message, submissionId: crypto.randomUUID() })

// Abono o pago posterior (todos los roles). Se convierte con la tasa del día.
export async function addSalePaymentAction(
  _prev: ActionState<AddPaymentField>,
  formData: FormData
): Promise<ActionState<AddPaymentField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = addPaymentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await addSalePayment(parsed.data)
  if (error) return { status: "error", message: toUserError(error, "No se pudo registrar el pago.") }

  refresh()
  return ok(SALES_MESSAGES.PAYMENT_SAVED)
}

// Anular: owner y admin, con motivo (la base lo vuelve a exigir).
export async function voidSaleAction(
  _prev: ActionState<VoidSaleField>,
  formData: FormData
): Promise<ActionState<VoidSaleField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = voidSaleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }

  const { error } = await voidSale(parsed.data.sale_id, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error, "No se pudo anular la venta.") }

  refresh()
  return ok(SALES_MESSAGES.VOIDED)
}

type Result = { ok: true; message: string } | { ok: false; error: string }

// Editar cliente, canal, entrega y notas (owner y admin, con motivo; queda en el historial).
export async function editSaleAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = editSaleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." }

  const { error } = await editSaleDetails(parsed.data)
  if (error) return { ok: false, error: toUserError(error, "No se pudo editar la venta.") }

  refresh()
  return { ok: true, message: SALES_MESSAGES.EDITED }
}

// Corregir o quitar un pago (owner y admin): se revierte en su cuenta y entra el correcto.
export async function correctPaymentAction(input: unknown): Promise<Result> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = correctPaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa los datos." }

  const { error } = await correctSalePayment(parsed.data)
  if (error) return { ok: false, error: toUserError(error, "No se pudo corregir el pago.") }

  refresh()
  return { ok: true, message: parsed.data.payment_method_id ? SALES_MESSAGES.PAYMENT_CORRECTED : SALES_MESSAGES.PAYMENT_REMOVED }
}

// Avanza el estado de una o varias líneas (p. ej. "marcar todo entregado").
export async function setSaleItemsStatusAction(
  items: { sale_item_id: string; status: string }[]
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }

  const parsed = z.array(itemStatusSchema).min(1).max(100).safeParse(items)
  if (!parsed.success) return { ok: false, error: "Estado inválido." }

  for (const item of parsed.data) {
    const { error } = await setSaleItemStatus(item.sale_item_id, item.status)
    if (error) return { ok: false, error: toUserError(error, "No se pudo actualizar el estado.") }
  }

  refresh()
  return { ok: true, message: SALES_MESSAGES.STATUS_SAVED }
}

export async function saveSalesSettingsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }

  const parsed = salesSettingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message }

  const { data, error } = await updateSalesSettings({
    staffMaxDiscountPercent: parsed.data.staff_max_discount_percent,
    staffMaxBackdateDays: parsed.data.staff_max_backdate_days,
  })
  if (error || !data?.length) return { status: "error", message: toUserError(error) }

  refresh()
  return ok(SALES_MESSAGES.SETTINGS_SAVED)
}

// Tasas de una fecha pasada, para mostrar los montos en Bs antes de guardar. null si no hay.
export async function getRatesForDateAction(date: string): Promise<SaleRatesForDate> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return null
  if (!z.iso.date().safeParse(date).success) return null
  const rate = await getRatesForDate(date)
  return rate
    ? {
        bcvUsd: Number(rate.bcv_usd),
        bcvEur: Number(rate.bcv_eur),
        binance: Number(rate.binance_usdt),
        usdUsdt: Number(rate.usd_usdt),
      }
    : null
}
