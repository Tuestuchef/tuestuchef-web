"use client"

import { CalendarIcon, CircleSlashIcon, PackageCheckIcon, ShieldCheckIcon } from "lucide-react"
import { useState } from "react"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { Textarea } from "@/common/components/ui/textarea"
import { useActionFeedback } from "@/common/lib/hooks/use-action-feedback.hook"
import { useFormAction } from "@/common/lib/hooks/use-form-action.hook"
import { formatMoney, formatUsdt } from "@/common/lib/utils/format-money.util"

import { allowWithoutDepositAction, cancelOrderAction, changePromisedDateAction, deliverOrderAction } from "../lib/actions/orders.action"

const usd = (v: number) => formatMoney(v, "USD")

export const DeliverOrderDialog = ({ saleId, balanceUsd, canManage }: { saleId: string; balanceUsd: number; canManage: boolean }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(deliverOrderAction)
  useActionFeedback(state, () => setOpen(false))
  const hasBalance = balanceUsd > 0.01

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <PackageCheckIcon aria-hidden />
          Entregar pedido
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entregar pedido</DialogTitle>
          <DialogDescription>Se entrega completo: todas las líneas pasan a entregado.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_id" value={saleId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          {hasBalance &&
            (canManage ? (
              <>
                <StatusAlert tone="warning" title={`Queda un saldo de ${usd(balanceUsd)}`}>
                  Registra el pago antes de entregar. Si se entrega igual, indica el motivo: queda registrado.
                </StatusAlert>
                <FormField label="Motivo para entregar con saldo" htmlFor="dl-reason">
                  <Textarea id="dl-reason" name="reason" rows={2} />
                </FormField>
              </>
            ) : (
              <StatusAlert tone="warning" title={`Queda un saldo de ${usd(balanceUsd)}`}>
                Registra el pago antes de entregar. Con saldo, solo owner o admin confirman la entrega.
              </StatusAlert>
            ))}
          <SubmitButton pending={pending} disabled={hasBalance && !canManage}>
            Confirmar entrega
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

type Quote = { paidUsdt: number; materialsUsdt: number; workshopsUsdt: number; suggestedUsdt: number; productionStarted: boolean }

export const CancelOrderDialog = ({ saleId, quote, canManage }: { saleId: string; quote: Quote | null; canManage: boolean }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(cancelOrderAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}
  const started = Boolean(quote?.productionStarted)
  const blocked = started && !canManage

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <CircleSlashIcon aria-hidden />
          Cancelar pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cancelar pedido</DialogTitle>
          <DialogDescription>
            Cada pago se devuelve en su moneda y a su cuenta, el inventario apartado vuelve y el cliente queda bloqueado.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_id" value={saleId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          {quote && (
            <dl className="grid gap-1 rounded-lg border p-3 text-sm tabular-nums">
              <div className="flex justify-between">
                <dt>Pagado (valor real)</dt>
                <dd>{formatUsdt(quote.paidUsdt)}</dd>
              </div>
              {started && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Materiales consumidos</dt>
                    <dd>{formatUsdt(quote.materialsUsdt)}</dd>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <dt>Talleres del pedido</dt>
                    <dd>{formatUsdt(quote.workshopsUsdt)}</dd>
                  </div>
                </>
              )}
            </dl>
          )}
          {blocked ? (
            <StatusAlert tone="warning" title="La producción ya empezó">
              Solo owner o admin pueden cancelar, descontando lo gastado en materiales.
            </StatusAlert>
          ) : (
            started && (
              <FormField
                label="No se devuelve (USDT)"
                htmlFor="cn-deduction"
                error={errors.deduction_usdt}
                hint="Sugerido: materiales + talleres. Ajústalo si hace falta."
              >
                <Input
                  id="cn-deduction"
                  name="deduction_usdt"
                  inputMode="decimal"
                  defaultValue={quote ? String(quote.suggestedUsdt) : ""}
                  className="h-11 md:h-9"
                />
              </FormField>
            )
          )}
          <FormField label="Motivo" htmlFor="cn-reason" error={errors.reason}>
            <Textarea id="cn-reason" name="reason" rows={2} />
          </FormField>
          <SubmitButton pending={pending} disabled={blocked}>
            Cancelar y reembolsar
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const PromisedDateDialog = ({ saleId, current, today }: { saleId: string; current: string; today: string }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(changePromisedDateAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <CalendarIcon aria-hidden />
          Cambiar fecha
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fecha prometida</DialogTitle>
          <DialogDescription>El cambio queda registrado con la fecha anterior.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_id" value={saleId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Nueva fecha" htmlFor="pd-date" error={errors.promised_date}>
            <Input id="pd-date" name="promised_date" type="date" min={today} defaultValue={current} className="h-11 md:h-9" />
          </FormField>
          <FormField label="Motivo" htmlFor="pd-reason" error={errors.reason} optional>
            <Input id="pd-reason" name="reason" className="h-11 md:h-9" />
          </FormField>
          <SubmitButton pending={pending}>Guardar fecha</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export const AllowWithoutDepositDialog = ({ saleId }: { saleId: string }) => {
  const [open, setOpen] = useState(false)
  const { state, onSubmit, pending } = useFormAction(allowWithoutDepositAction)
  useActionFeedback(state, () => setOpen(false))
  const errors = state.fieldErrors ?? {}

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheckIcon aria-hidden />
          Producir sin el abono
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Producir sin el abono completo</DialogTitle>
          <DialogDescription>Queda registrado quién lo autorizó y por qué.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="sale_id" value={saleId} />
          {state.status === "error" && state.message && <StatusAlert tone="error" title={state.message} />}
          <FormField label="Motivo" htmlFor="ov-reason" error={errors.reason}>
            <Textarea id="ov-reason" name="reason" rows={2} />
          </FormField>
          <SubmitButton pending={pending}>Autorizar</SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}
