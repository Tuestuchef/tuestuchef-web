"use client"

import { HandCoinsIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import { payPieceworkAction } from "../lib/actions/orders.action"
import type { PendingPiecework } from "../lib/services/production.service"

type PieceworkPaymentDialogProps = {
  memberId: string
  pieces: PendingPiecework[]
  advances: { id: string; usdAmount: number; occurredAt: string }[]
  accounts: { id: string; name: string; currency: string }[]
}

const usd = (v: number) => formatMoney(v, "USD")

// Pagar las piezas a destajo pendientes: piezas × tarifa, menos los adelantos que se descuenten.
const PieceworkPaymentDialog = ({ memberId, pieces, advances, accounts }: PieceworkPaymentDialogProps) => {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState<Set<string>>(new Set(pieces.map((p) => p.id)))
  const [settle, setSettle] = useState<Set<string>>(new Set(advances.map((a) => a.id)))
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "")
  const [error, setError] = useState<string | null>(null)

  const gross = pieces.filter((p) => selected.has(p.id)).reduce((s, p) => s + p.amountUsd, 0)
  const deducted = advances.filter((a) => settle.has(a.id)).reduce((s, a) => s + a.usdAmount, 0)
  const net = Math.max(Math.round((gross - deducted) * 100) / 100, 0)
  const [amount, setAmount] = useState("")
  const account = accounts.find((a) => a.id === accountId)
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  const submit = () =>
    startTransition(async () => {
      setError(null)
      const result = await payPieceworkAction({
        team_member_id: memberId,
        account_id: accountId,
        amount: amount || String(net),
        piecework_ids: [...selected],
        advance_ids: [...settle],
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      setOpen(false)
    })

  if (pieces.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 md:h-9">
          <HandCoinsIcon aria-hidden />
          Pagar destajo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pagar destajo</DialogTitle>
          <DialogDescription>Se registra como pago de sueldo. Las piezas pagadas quedan liquidadas.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <ul className="divide-y rounded-lg border">
            {pieces.map((p) => (
              <li key={p.id}>
                <label className="flex items-center gap-3 p-2.5 text-sm">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => setSelected((s) => toggle(s, p.id))} className="size-4" />
                  <span className="grid flex-1">
                    <span>{p.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {ITEM_STATUS_LABELS[p.stage]} · {p.pieces} piezas
                    </span>
                  </span>
                  <span className="tabular-nums">{usd(p.amountUsd)}</span>
                </label>
              </li>
            ))}
          </ul>
          {advances.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {advances.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-3 p-2.5 text-sm">
                    <input type="checkbox" checked={settle.has(a.id)} onChange={() => setSettle((s) => toggle(s, a.id))} className="size-4" />
                    <span className="flex-1">Descontar adelanto</span>
                    <span className="tabular-nums">−{usd(a.usdAmount)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <FormField label="Cuenta" htmlFor="pw-account">
            <select id="pw-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="h-11 rounded-md border bg-background px-2 text-sm md:h-9">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={`Monto en ${account?.currency ?? ""}`} htmlFor="pw-amount" hint={`Neto sugerido: ${usd(net)} (en Bs, a la tasa BCV del día).`}>
            <Input id="pw-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(net)} className="h-11 md:h-9" />
          </FormField>
          {error && <StatusAlert tone="error" title={error} />}
        </div>
        <DialogFooter>
          <Button type="button" className="h-11 md:h-9" disabled={pending || selected.size === 0} onClick={submit}>
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default PieceworkPaymentDialog
