"use server"

import { refresh } from "next/cache"
import { z } from "zod"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { authorizeAction } from "@/common/lib/services/session.service"
import type { ActionState } from "@/common/lib/types/action-state.types"
import { toUserError } from "@/common/lib/utils/to-user-error.util"

import { ORDER_MESSAGES } from "../constants/orders.constants"
import {
  type AssignStageField,
  assignStageSchema,
  type BusinessRuleField,
  businessRuleSchema,
  type CancelOrderField,
  cancelOrderSchema,
  createOrderSchema,
  type DeliverOrderField,
  deliverOrderSchema,
  type OrderSettingsField,
  orderSettingsSchema,
  piecePaymentSchema,
  type PieceRateField,
  pieceRateSchema,
  type PromisedDateField,
  promisedDateSchema,
  type ReasonField,
  reasonSchema,
} from "../schemas/orders.schema"
import { saveBusinessRule } from "../services/business-rules.service"
import {
  advanceLine,
  allowWithoutDeposit,
  assignStage,
  cancelOrder,
  changePromisedDate,
  createOrder,
  deliverOrder,
  updateOrderSettings,
} from "../services/orders.service"
import { addPieceRate, registerPieceworkPayment } from "../services/production.service"

type JsonResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }
const ok = (message: string) => ({ status: "success" as const, message, submissionId: crypto.randomUUID() })

// El pedido llega como objeto; Zod valida y la base vuelve a validar todo.
export async function createOrderAction(input: unknown): Promise<JsonResult<{ saleId: string }>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa el pedido." }
  const { data, error } = await createOrder(parsed.data)
  if (error || !data) return { ok: false, error: toUserError(error, "No se pudo registrar el pedido.") }
  refresh()
  return { ok: true, saleId: data }
}

export async function advanceLineAction(itemId: string): Promise<JsonResult<{ message: string }>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { ok: false, error: auth.error }
  if (!z.uuid().safeParse(itemId).success) return { ok: false, error: "Línea inválida." }
  const { error } = await advanceLine(itemId)
  if (error) return { ok: false, error: toUserError(error, "No se pudo avanzar.") }
  refresh()
  return { ok: true, message: ORDER_MESSAGES.STAGE_ADVANCED }
}

export async function assignStageAction(_prev: ActionState<AssignStageField>, formData: FormData): Promise<ActionState<AssignStageField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = assignStageSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const [kind, id] = parsed.data.assignee.split(":") as ["member" | "workshop", string]
  const { error } = await assignStage({
    itemId: parsed.data.sale_item_id,
    stage: parsed.data.stage,
    assignee: kind,
    assigneeId: id,
    expectedDate: parsed.data.expected_date,
    note: parsed.data.note,
  })
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.ASSIGNED)
}

export async function deliverOrderAction(_prev: ActionState<DeliverOrderField>, formData: FormData): Promise<ActionState<DeliverOrderField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = deliverOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await deliverOrder(parsed.data.sale_id, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.DELIVERED)
}

export async function cancelOrderAction(_prev: ActionState<CancelOrderField>, formData: FormData): Promise<ActionState<CancelOrderField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = cancelOrderSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await cancelOrder(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.CANCELLED)
}

export async function changePromisedDateAction(
  _prev: ActionState<PromisedDateField>,
  formData: FormData
): Promise<ActionState<PromisedDateField>> {
  const auth = await authorizeAction(ROLE_GROUPS.ALL)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = promisedDateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await changePromisedDate(parsed.data.sale_id, parsed.data.promised_date, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.DATE_CHANGED)
}

export async function allowWithoutDepositAction(_prev: ActionState<ReasonField>, formData: FormData): Promise<ActionState<ReasonField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = reasonSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await allowWithoutDeposit(parsed.data.sale_id, parsed.data.reason)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.OVERRIDE_SAVED)
}

export async function saveOrderSettingsAction(
  _prev: ActionState<OrderSettingsField>,
  formData: FormData
): Promise<ActionState<OrderSettingsField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = orderSettingsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await updateOrderSettings(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.SETTINGS_SAVED)
}

export async function addPieceRateAction(_prev: ActionState<PieceRateField>, formData: FormData): Promise<ActionState<PieceRateField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = pieceRateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await addPieceRate(parsed.data)
  if (error) {
    return {
      status: "error",
      message: error.code === "23505" ? "Ya cambiaste esa tarifa hoy: el cambio rige desde mañana." : toUserError(error),
    }
  }
  refresh()
  return ok(ORDER_MESSAGES.RATE_SAVED)
}

export async function saveBusinessRuleAction(
  _prev: ActionState<BusinessRuleField>,
  formData: FormData
): Promise<ActionState<BusinessRuleField>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { status: "error", message: auth.error }
  const parsed = businessRuleSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { status: "error", fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const { error } = await saveBusinessRule(parsed.data)
  if (error) return { status: "error", message: toUserError(error) }
  refresh()
  return ok(ORDER_MESSAGES.RULE_SAVED)
}

export async function payPieceworkAction(input: unknown): Promise<JsonResult<{ message: string }>> {
  const auth = await authorizeAction(ROLE_GROUPS.MANAGEMENT)
  if (!auth.ok) return { ok: false, error: auth.error }
  const parsed = piecePaymentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa el pago." }
  const { error } = await registerPieceworkPayment({
    teamMemberId: parsed.data.team_member_id,
    accountId: parsed.data.account_id,
    amount: parsed.data.amount,
    pieceworkIds: parsed.data.piecework_ids,
    advanceIds: parsed.data.advance_ids,
  })
  if (error) return { ok: false, error: toUserError(error) }
  refresh()
  return { ok: true, message: ORDER_MESSAGES.PIECEWORK_PAID }
}
