"use client"

import { PackageCheckIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/common/components/ui/select"
import { Textarea } from "@/common/components/ui/textarea"

import { setSaleItemsStatusAction } from "../lib/actions/sale-operations.action"
import { ITEM_STATUS_LABELS, type SaleItemStatus } from "../lib/constants/sales.constants"

const useStatusAction = () => {
  const [pending, startTransition] = useTransition()
  const run = (items: { sale_item_id: string; status: SaleItemStatus; note?: string }, onDone?: () => void) =>
    startTransition(async () => {
      const result = await setSaleItemsStatusAction([items])
      if (result.ok) {
        toast.success(result.message)
        onDone?.()
      } else toast.error(result.error)
    })
  return { pending, run }
}

type ItemStatusSelectProps = {
  itemId: string
  status: SaleItemStatus | null
  // Estados posibles de la línea, en orden.
  options: readonly SaleItemStatus[]
  // Owner y admin pueden volver a uno anterior (con motivo).
  canGoBack: boolean
  // Estados que se ven pero no se eligen aquí (en un pedido, "entregado" es del pedido completo).
  locked?: readonly SaleItemStatus[]
}

// Elegir el estado de una línea: cualquiera posterior; uno anterior pide el motivo.
export const ItemStatusSelect = ({ itemId, status, options, canGoBack, locked = [] }: ItemStatusSelectProps) => {
  const { pending, run } = useStatusAction()
  const [goingBack, setGoingBack] = useState<SaleItemStatus | null>(null)
  const [reason, setReason] = useState("")
  const current = status ? options.indexOf(status) : -1
  const choices = options.filter((option, index) => !locked.includes(option) && (index > current || (canGoBack && index < current)))
  if (choices.length === 0) return null

  const choose = (value: string) => {
    const next = value as SaleItemStatus
    if (options.indexOf(next) < current) {
      setReason("")
      setGoingBack(next)
    } else run({ sale_item_id: itemId, status: next })
  }

  return (
    <>
      <Select value={status ?? undefined} onValueChange={choose} disabled={pending}>
        <SelectTrigger aria-label="Estado de la línea" size="sm" className="h-8 w-auto min-w-40">
          <SelectValue placeholder="Elegir estado" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option, index) => (
            <SelectItem key={option} value={option} disabled={index !== current && !choices.includes(option)}>
              {ITEM_STATUS_LABELS[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={goingBack !== null} onOpenChange={(open) => !open && setGoingBack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Volver a {goingBack ? ITEM_STATUS_LABELS[goingBack] : ""}</DialogTitle>
            <DialogDescription>Queda en el historial con tu nombre. Lo que ya se consumió de materia prima no vuelve.</DialogDescription>
          </DialogHeader>
          <FormField label="Motivo" htmlFor={`back-${itemId}`}>
            <Textarea id={`back-${itemId}`} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: se marcó entregado por error" />
          </FormField>
          {reason.trim().length > 0 && reason.trim().length < 3 && <StatusAlert tone="warning" title="Explica un poco más el motivo." />}
          <DialogFooter>
            <Button
              type="button"
              className="h-11 md:h-9"
              disabled={pending || reason.trim().length < 3}
              onClick={() => goingBack && run({ sale_item_id: itemId, status: goingBack, note: reason }, () => setGoingBack(null))}
            >
              Volver a ese estado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Marca como entregadas todas las líneas que ya están listas.
export const DeliverReadyButton = ({ itemIds }: { itemIds: string[] }) => {
  const [pending, startTransition] = useTransition()
  const runMany = (items: { sale_item_id: string; status: SaleItemStatus }[]) =>
    startTransition(async () => {
      const result = await setSaleItemsStatusAction(items)
      if (result.ok) toast.success(result.message)
      else toast.error(result.error)
    })
  if (!itemIds.length) return null
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 md:h-9"
      disabled={pending}
      onClick={() => runMany(itemIds.map((id) => ({ sale_item_id: id, status: "delivered" as const })))}
    >
      <PackageCheckIcon aria-hidden />
      Marcar entregado
    </Button>
  )
}
