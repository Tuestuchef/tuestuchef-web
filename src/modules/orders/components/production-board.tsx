"use client"

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import Link from "next/link"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { cn } from "@/common/lib/utils"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { setSaleItemsStatusAction } from "@/modules/sales/lib/actions/sale-operations.action"
import { formatSaleNumber, ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import type { ProductionStage } from "../lib/constants/orders.constants"
import type { ProductionCard } from "../lib/types/orders.types"
import { AdvanceStageButton } from "./order-stage-controls"

type ProductionBoardProps = {
  cards: ProductionCard[]
  // Columnas, en orden. La última ("listo") saca la línea del tablero.
  stages: readonly ProductionStage[]
  // Owner y admin pueden devolver una línea a una etapa anterior (con motivo).
  canGoBack: boolean
}

type PendingMove = { card: ProductionCard; to: ProductionStage }

// ¿Se puede soltar la tarjeta en esa columna? Solo etapas que aplican a la línea; hacia atrás, owner o admin.
const isBack = (card: ProductionCard, to: ProductionStage) => card.stages.indexOf(to) < card.stages.indexOf(card.stage)
const canDrop = (card: ProductionCard, to: ProductionStage, canGoBack: boolean) =>
  to !== card.stage && card.stages.includes(to) && (!isBack(card, to) || canGoBack)

// Tablero de producción tipo Trello: se arrastra cada tarjeta a la columna de su nueva etapa.
const ProductionBoard = ({ cards: initialCards, stages, canGoBack }: ProductionBoardProps) => {
  const [cards, setCards] = useState(initialCards)
  const [dragging, setDragging] = useState<ProductionCard | null>(null)
  const [goingBack, setGoingBack] = useState<PendingMove | null>(null)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  // Al refrescarse desde el servidor, manda lo que dice la base.
  const [synced, setSynced] = useState(initialCards)
  if (synced !== initialCards) {
    setSynced(initialCards)
    setCards(initialCards)
  }

  // En el celular, la tarjeta se toma manteniéndola presionada (así el tablero se sigue deslizando de lado).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } })
  )

  const move = ({ card, to }: PendingMove, note?: string) => {
    const previous = cards
    setCards((all) => all.map((c) => (c.saleItemId === card.saleItemId ? { ...c, stage: to } : c)))
    startTransition(async () => {
      const result = await setSaleItemsStatusAction([{ sale_item_id: card.saleItemId, status: to, note }])
      if (result.ok) toast.success(`${card.productName}: ${ITEM_STATUS_LABELS[to]}`)
      else {
        setCards(previous)
        toast.error(result.error)
      }
    })
  }

  const onDragStart = ({ active }: DragStartEvent) => setDragging(cards.find((c) => c.saleItemId === active.id) ?? null)

  const onDragEnd = ({ over }: DragEndEvent) => {
    const card = dragging
    setDragging(null)
    if (!card || !over) return
    const to = over.id as ProductionStage
    if (to === card.stage) return
    if (!canDrop(card, to, canGoBack)) {
      toast.error(
        !card.stages.includes(to)
          ? `"${ITEM_STATUS_LABELS[to]}" no aplica a esta línea.`
          : "Solo owner o admin pueden devolver una línea a una etapa anterior."
      )
      return
    }
    if (isBack(card, to)) {
      setReason("")
      setGoingBack({ card, to })
    } else move({ card, to })
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          {stages.map((stage) => (
            <BoardColumn
              key={stage}
              stage={stage}
              cards={cards.filter((c) => c.stage === stage)}
              dragging={dragging}
              allowed={dragging ? canDrop(dragging, stage, canGoBack) : false}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragging && <CardBody card={dragging} overlay />}</DragOverlay>
      </DndContext>

      <Dialog open={goingBack !== null} onOpenChange={(open) => !open && setGoingBack(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Volver a {goingBack ? ITEM_STATUS_LABELS[goingBack.to] : ""}</DialogTitle>
            <DialogDescription>
              {goingBack?.card.productName}. Queda en el historial con tu nombre; lo consumido de materia prima no vuelve.
            </DialogDescription>
          </DialogHeader>
          <FormField label="Motivo" htmlFor="board-back-reason">
            <Textarea id="board-back-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej.: hay que repetir la costura" />
          </FormField>
          <DialogFooter>
            <Button
              type="button"
              className="h-11 md:h-9"
              disabled={pending || reason.trim().length < 3}
              onClick={() => {
                if (goingBack) move(goingBack, reason)
                setGoingBack(null)
              }}
            >
              Volver a esa etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type BoardColumnProps = { stage: ProductionStage; cards: ProductionCard[]; dragging: ProductionCard | null; allowed: boolean }

// Una columna. Mientras se arrastra, la que está debajo se marca si se puede soltar ahí; las que no, se apagan.
const BoardColumn = ({ stage, cards, dragging, allowed }: BoardColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const isReady = stage === "ready"
  return (
    <section
      ref={setNodeRef}
      aria-label={ITEM_STATUS_LABELS[stage]}
      className={cn(
        "grid min-h-[60svh] w-72 shrink-0 snap-start content-start gap-2 rounded-xl border-2 border-transparent bg-muted/30 p-1.5 transition-colors",
        dragging && !allowed && dragging.stage !== stage && "opacity-50",
        isOver && allowed && "border-ring bg-muted/50"
      )}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-medium">
        {ITEM_STATUS_LABELS[stage]}
        {!isReady && <span className="text-xs text-muted-foreground tabular-nums">{cards.length}</span>}
      </h2>
      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
          {isReady ? "Suelta aquí lo que ya está listo para entregar." : "Vacío"}
        </p>
      ) : (
        cards.map((card) => <DraggableCard key={card.saleItemId} card={card} />)
      )}
    </section>
  )
}

const DraggableCard = ({ card }: { card: ProductionCard }) => {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: card.saleItemId })
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <CardBody card={card} />
    </div>
  )
}

const CardBody = ({ card, overlay = false }: { card: ProductionCard; overlay?: boolean }) => (
  <article className={cn("grid cursor-grab gap-2 rounded-xl border bg-card p-3", overlay && "cursor-grabbing shadow-lg")}>
    <Link href={ROUTES.ORDER(card.saleId)} className="grid gap-0.5 underline-offset-4 hover:underline">
      <span className="text-sm font-medium">
        {card.pieces} × {card.productName}
      </span>
      <span className="text-xs text-muted-foreground">
        {card.variantLabel} · {formatSaleNumber(card.number)} · {card.customerName ?? "—"}
      </span>
    </Link>
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className={card.orderLate ? "font-medium" : "text-muted-foreground"}>{formatDate(card.promisedDate)}</span>
      {card.orderLate && <StatusBadge tone="error">Atrasado</StatusBadge>}
      {card.hasCustomization && <StatusBadge tone="info">Personalizado</StatusBadge>}
    </div>
    {card.assignee && (
      <span className="text-xs text-muted-foreground">
        {card.assignee.kind === "workshop" ? "Taller: " : ""}
        {card.assignee.name}
        {card.assignee.expectedDate && ` · ${formatDate(card.assignee.expectedDate)}`}
        {card.assignee.isLate && " · atrasado"}
      </span>
    )}
    {!overlay && <AdvanceStageButton itemId={card.saleItemId} nextStage={card.nextStage} />}
  </article>
)

export default ProductionBoard
