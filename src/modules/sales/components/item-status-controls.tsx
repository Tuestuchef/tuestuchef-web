"use client"

import { ArrowRightIcon, PackageCheckIcon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/common/components/ui/button"

import { setSaleItemsStatusAction } from "../lib/actions/sale-operations.action"
import { ITEM_STATUS_LABELS, ITEM_STATUS_ORDER, type SaleItemStatus } from "../lib/constants/sales.constants"

const nextStatus = (status: SaleItemStatus | null): SaleItemStatus | null => {
  const index = status ? ITEM_STATUS_ORDER.indexOf(status) : -1
  return ITEM_STATUS_ORDER[index + 1] ?? null
}

const useStatusAction = () => {
  const [pending, startTransition] = useTransition()
  const run = (items: { sale_item_id: string; status: SaleItemStatus }[]) =>
    startTransition(async () => {
      const result = await setSaleItemsStatusAction(items)
      if (result.ok) toast.success(result.message)
      else toast.error(result.error)
    })
  return { pending, run }
}

// Avanza una línea al siguiente estado (por producir → en producción → listo → entregado).
export const AdvanceItemButton = ({ itemId, status }: { itemId: string; status: SaleItemStatus | null }) => {
  const { pending, run } = useStatusAction()
  const next = nextStatus(status)
  if (!next) return null
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => run([{ sale_item_id: itemId, status: next }])}
    >
      <ArrowRightIcon aria-hidden />
      {ITEM_STATUS_LABELS[next]}
    </Button>
  )
}

// Marca como entregadas todas las líneas que ya están listas.
export const DeliverReadyButton = ({ itemIds }: { itemIds: string[] }) => {
  const { pending, run } = useStatusAction()
  if (!itemIds.length) return null
  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 md:h-9"
      disabled={pending}
      onClick={() => run(itemIds.map((id) => ({ sale_item_id: id, status: "delivered" })))}
    >
      <PackageCheckIcon aria-hidden />
      Marcar entregado
    </Button>
  )
}
