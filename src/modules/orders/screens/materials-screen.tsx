import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { UNIT_LABELS, type ProductUnit } from "@/modules/products/lib/constants/products.constants"

import { listMaterialRequirements } from "../lib/services/production.service"

const number = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 })

// Material que piden los pedidos que aún no se cortan, contra lo que hay.
const MaterialsScreen = async () => {
  const rows = await listMaterialRequirements()

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="materials"
        title="Material necesario"
        description="Calculado desde las recetas de los pedidos que aún no se cortan. Nadie lo anota a mano."
      />
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay pedidos pendientes de corte con receta.</p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {rows.map((r) => {
            const unit = UNIT_LABELS[r.unit as ProductUnit]?.toLowerCase() ?? ""
            return (
              <li key={r.rawVariantId ?? r.materialName} className="flex items-start gap-3 p-3">
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="text-sm font-medium">
                    {r.materialName}
                    {r.colorName && <span className="font-normal text-muted-foreground"> · {r.colorName}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Necesitas {number.format(r.required)} {unit} y tienes {number.format(r.available)} · {r.lines}{" "}
                    {r.lines === 1 ? "línea" : "líneas"}
                  </span>
                </div>
                {r.rawVariantId === null ? (
                  <StatusBadge tone="error">Falta el color</StatusBadge>
                ) : r.shortage > 0 ? (
                  <StatusBadge tone="error">
                    Faltan {number.format(r.shortage)} {unit}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="success">Alcanza</StatusBadge>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default MaterialsScreen
