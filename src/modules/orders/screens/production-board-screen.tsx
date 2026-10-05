import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatSaleNumber, ITEM_STATUS_LABELS } from "@/modules/sales/lib/constants/sales.constants"

import { AdvanceStageButton } from "../components/order-stage-controls"
import { BOARD_STAGES } from "../lib/constants/orders.constants"
import { listProductionCards } from "../lib/services/production.service"

// Tablero: una columna por etapa; en el celular se desliza de lado.
const ProductionBoardScreen = async () => {
  const cards = await listProductionCards()

  return (
    <div className="grid w-full gap-4">
      <PageHeader
        help="production"
        title="Tablero de producción"
        description="Cada línea de pedido en su etapa, ordenada por fecha prometida."
      />
      {cards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay nada en producción.</p>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6">
          {BOARD_STAGES.map((stage) => {
            const column = cards.filter((c) => c.stage === stage)
            return (
              <section key={stage} className="grid w-72 shrink-0 snap-start content-start gap-2" aria-label={ITEM_STATUS_LABELS[stage]}>
                <h2 className="flex items-center justify-between text-sm font-medium">
                  {ITEM_STATUS_LABELS[stage]}
                  <span className="text-xs text-muted-foreground tabular-nums">{column.length}</span>
                </h2>
                {column.length === 0 ? (
                  <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">Vacío</p>
                ) : (
                  column.map((card) => (
                    <article key={card.saleItemId} className="grid gap-2 rounded-xl border bg-card p-3">
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
                      <AdvanceStageButton itemId={card.saleItemId} nextStage={card.nextStage} />
                    </article>
                  ))
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ProductionBoardScreen
