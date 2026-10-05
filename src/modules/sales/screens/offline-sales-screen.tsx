import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"

import OfflineRejectionActions from "../components/offline-rejection-actions"
import { listOfflineRejections } from "../lib/services/offline-sales.service"

// Ventas hechas sin conexión que la base no aceptó al sincronizar. Nunca se pierden.
const OfflineSalesScreen = async ({ canManage }: { canManage: boolean }) => {
  const rows = await listOfflineRejections()

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="offlineSales"
        title="Ventas pendientes"
        description="Ventas hechas sin conexión que no pasaron al enviarse (sin stock, cliente bloqueado, falta la tasa…)."
      />
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay ventas pendientes.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => (
            <li key={r.id} className="grid gap-2 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">
                  Venta del {formatDate(r.occurredAt)} · {formatTime(r.occurredAt)}
                </span>
                {r.resolved ? (
                  <StatusBadge tone={r.resolved.saleId ? "success" : "info"}>{r.resolved.saleId ? "Registrada" : "Descartada"}</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">Pendiente</StatusBadge>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {r.itemsCount} {r.itemsCount === 1 ? "producto" : "productos"} · {r.authorName ?? "—"} · {r.attempts}{" "}
                {r.attempts === 1 ? "intento" : "intentos"}
              </span>
              <p className="text-sm">Motivo: {r.error}</p>
              {r.resolved?.saleId && (
                <Link href={ROUTES.SALE(r.resolved.saleId)} className="w-fit text-sm underline-offset-4 hover:underline">
                  Ver la venta
                </Link>
              )}
              {r.resolved?.note && <p className="text-xs text-muted-foreground">Descartada: {r.resolved.note}</p>}
              {!r.resolved && canManage && <OfflineRejectionActions id={r.id} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default OfflineSalesScreen
