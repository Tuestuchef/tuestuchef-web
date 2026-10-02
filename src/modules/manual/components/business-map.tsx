import {
  BanknoteIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  PiggyBankIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  TruckIcon,
  UsersRoundIcon,
} from "lucide-react"

import { MANUAL_AREAS } from "../lib/constants/manual-areas.constants"
import type { DiagramNode as DiagramNodeValue, ManualAreaKey } from "../lib/types/manual.types"
import DiagramNode, { type ChapterAccess } from "./diagrams/diagram-node"

type JourneyStep = DiagramNodeValue & { area: ManualAreaKey }

// El recorrido de una filipina por todo el negocio: cada paso es un área de la administración.
const JOURNEY: readonly JourneyStep[] = [
  {
    area: "compras",
    icon: TruckIcon,
    title: "Se compra la tela",
    detail: "Al proveedor, de contado o a crédito. Entra al inventario de materia prima.",
    chapter: "compras",
  },
  {
    area: "inventario",
    icon: ScissorsIcon,
    title: "Se produce la filipina",
    detail: "La receta descuenta 1,6 m de tela y 8 botones. Sube el stock de filipinas, con su costo.",
    chapter: "inventario",
  },
  {
    area: "comercial",
    icon: ShoppingBagIcon,
    title: "Se vende",
    detail: "28 USD por pago móvil. Baja el stock y, si el cliente debe, queda por cobrar.",
    chapter: "ventas",
  },
  {
    area: "tesoreria",
    icon: BanknoteIcon,
    title: "Se cobra",
    detail: "Entran 1.120 Bs al banco (BCV 40). El movimiento aparece solo.",
    chapter: "tesoreria",
  },
  {
    area: "tesoreria",
    icon: CircleDollarSignIcon,
    title: "Se mide en valor real",
    detail: "1.120 Bs ÷ paralelo 50 = [[valor-real|22,40 USDT reales]]. Esa es la cifra que cuenta.",
    chapter: "tesoreria",
  },
  {
    area: "rrhh",
    icon: UsersRoundIcon,
    title: "Se pagan los sueldos",
    detail: "Del equipo y del dueño. Salen de las cuentas y restan en la utilidad.",
    chapter: "equipo",
  },
  {
    area: "resultados",
    icon: ChartColumnIcon,
    title: "Se calcula la utilidad real",
    detail: "Ingresos reales − costos − gastos − comisiones − impuestos − sueldos.",
    chapter: "resultados",
  },
  {
    area: "resultados",
    icon: PiggyBankIcon,
    title: "Se reparte la utilidad",
    detail: "Una parte a la reserva (USDT) y otra a reinvertir para crecer.",
    chapter: "resultados",
  },
]

const BusinessMap = ({ readable }: ChapterAccess) => (
  <figure className="grid gap-3">
    <figcaption className="sr-only">El recorrido de una filipina por todas las áreas del negocio.</figcaption>
    <ol className="grid gap-0">
      {JOURNEY.map((step, index) => {
        const area = MANUAL_AREAS[step.area]
        const AreaIcon = area.icon
        return (
          <li key={step.title} className="relative grid grid-cols-[2rem_1fr] gap-3 pb-3 last:pb-0">
            {index < JOURNEY.length - 1 && (
              <span aria-hidden className="absolute top-8 bottom-0 left-3.5 w-0.5 bg-muted-foreground/40" />
            )}
            <span className="relative z-10 flex size-8 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-semibold tabular-nums">
              {index + 1}
            </span>
            <div className="grid gap-1.5">
              <span className="inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                <AreaIcon className="size-3" aria-hidden />
                {area.title}
              </span>
              <DiagramNode node={step} readable={readable} />
            </div>
          </li>
        )
      })}
    </ol>
  </figure>
)

export default BusinessMap
