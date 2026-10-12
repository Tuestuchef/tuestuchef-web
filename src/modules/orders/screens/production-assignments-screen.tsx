import { FactoryIcon, UserRoundIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatSaleNumber, ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import { formatPurchaseNumber } from "@/modules/purchases/lib/constants/purchases.constants"

import { listPendingReceipts, listProductionCards } from "../lib/services/production.service"
import type { PendingReceipt, ProductionCard } from "../lib/types/orders.types"

// Quién tiene qué: lo asignado por persona o taller, y lo que nadie tiene todavía.
const ProductionAssignmentsScreen = async () => {
  const [cards, receipts] = await Promise.all([listProductionCards(), listPendingReceipts()])
  const groups = new Map<string, { name: string; kind: "member" | "workshop"; cards: ProductionCard[]; receipts: PendingReceipt[] }>()
  const unassigned: ProductionCard[] = []
  for (const card of cards) {
    if (!card.assignee) {
      if (card.stage !== "to_produce") unassigned.push(card)
      continue
    }
    const key = `${card.assignee.kind}:${card.assignee.id}`
    const group = groups.get(key) ?? { name: card.assignee.name, kind: card.assignee.kind, cards: [], receipts: [] }
    group.cards.push(card)
    groups.set(key, group)
  }
  // Encargos para el stock (compras por recibir): bajo el mismo taller o proveedor.
  for (const receipt of receipts) {
    const key = `workshop:${receipt.supplierId}`
    const group = groups.get(key) ?? { name: receipt.supplierName, kind: "workshop" as const, cards: [], receipts: [] }
    group.receipts.push(receipt)
    groups.set(key, group)
  }

  const receiptRow = (receipt: PendingReceipt) => (
    <li key={receipt.purchaseItemId} className="flex items-start gap-3 py-2">
      <Link href={ROUTES.PURCHASE(receipt.purchaseId)} className="grid min-w-0 flex-1 gap-0.5 underline-offset-4 hover:underline">
        <span className="text-sm">
          {receipt.pending} × {receipt.productName} <span className="text-muted-foreground">· {receipt.variantLabel}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          Para el stock · {formatPurchaseNumber(receipt.number)}
          {receipt.pending < receipt.quantity && ` · faltan ${receipt.pending} de ${receipt.quantity}`}
        </span>
      </Link>
      <div className="flex flex-col items-end gap-1 text-xs">
        {receipt.expectedDate && <span>Entrega {formatDate(`${receipt.expectedDate}T12:00:00-04:00`)}</span>}
        {receipt.isLate && <StatusBadge tone="error">Entrega atrasada</StatusBadge>}
      </div>
    </li>
  )

  const row = (card: ProductionCard) => (
    <li key={card.saleItemId} className="flex items-start gap-3 py-2">
      <Link href={ROUTES.ORDER(card.saleId)} className="grid min-w-0 flex-1 gap-0.5 underline-offset-4 hover:underline">
        <span className="text-sm">
          {card.pieces} × {card.productName} <span className="text-muted-foreground">· {card.variantLabel}</span>
        </span>
        <span className="text-xs text-muted-foreground">
          {ITEM_STATUS_LABELS[card.stage]} · {formatSaleNumber(card.number)} · prometido {formatDate(card.promisedDate)}
        </span>
      </Link>
      <div className="flex flex-col items-end gap-1 text-xs">
        {card.assignee?.expectedDate && <span>Entrega {formatDate(card.assignee.expectedDate)}</span>}
        {card.assignee?.isLate && <StatusBadge tone="error">Taller atrasado</StatusBadge>}
        {card.orderLate && <StatusBadge tone="error">Pedido atrasado</StatusBadge>}
      </div>
    </li>
  )

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader help="production" title="Quién tiene qué" description="Etapas en curso y encargos para el stock, por persona del equipo o taller." />
      {groups.size === 0 && unassigned.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay etapas en curso ni encargos por recibir.</p>
      )}
      {[...groups.values()]
        .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "member" ? -1 : 1))
        .map((group) => (
          <Card key={`${group.kind}-${group.name}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {group.kind === "workshop" ? <FactoryIcon className="size-4" aria-hidden /> : <UserRoundIcon className="size-4" aria-hidden />}
                {group.name}
                <span className="text-sm font-normal text-muted-foreground">· {group.cards.length + group.receipts.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {group.cards.map(row)}
                {group.receipts.map(receiptRow)}
              </ul>
            </CardContent>
          </Card>
        ))}
      {unassigned.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sin asignar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">{unassigned.map(row)}</ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ProductionAssignmentsScreen
