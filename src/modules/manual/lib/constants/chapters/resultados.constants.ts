import {
  ArrowRightLeftIcon,
  BanknoteIcon,
  ChartColumnIcon,
  CoinsIcon,
  LandmarkIcon,
  PackageIcon,
  PercentIcon,
  PiggyBankIcon,
  ShoppingBagIcon,
  SproutIcon,
  TruckIcon,
  UsersRoundIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const RESULTS_CHAPTER: ManualChapter = {
  slug: "resultados",
  area: "resultados",
  title: "Dashboard de resultados",
  summary:
    "La respuesta a “¿estamos ganando?”: la utilidad real del período, qué se hace con ella, cómo se movió el dinero en cada cuenta, cuánto deja cada producto y cuánto cuesta la tasa.",
  icon: ChartColumnIcon,
  roles: ROLE_GROUPS.MANAGEMENT,
  screens: [
    { title: "Resultados", url: ROUTES.ANALYTICS, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Cierres y Excel", url: ROUTES.PERIODS, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["tesoreria", "ventas", "inventario", "equipo", "configuracion"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "Es la **contabilidad de gestión** del negocio. No se registra nada aquí: todo se calcula con lo que ya se registró en ventas, compras, tesorería y equipo, siempre en [[valor-real]] (USDT). Arriba se elige el período (este mes, últimos 3, 6 o 12 meses, o este año) y abajo hay cuatro vistas.",
        },
        {
          kind: "effects",
          items: [
            { icon: PiggyBankIcon, title: "Utilidad real", effect: "Cuánto se ganó y qué se hace con lo ganado." },
            { icon: LandmarkIcon, title: "Flujo de caja", effect: "Por cuenta: con cuánto empezó, qué entró, qué salió y con cuánto terminó." },
            { icon: PercentIcon, title: "Margen", effect: "Cuánto deja cada producto vendido después de sus materiales y mano de obra." },
            { icon: CoinsIcon, title: "Tasa", effect: "Cuánto se pierde cobrando en Bs y cuánto se gana pagando en Bs." },
          ],
        },
      ],
    },
    {
      id: "utilidad",
      heading: "La utilidad real",
      blocks: [
        {
          kind: "text",
          body:
            "La [[utilidad-real]] es lo que queda después de pagar **todo**, incluido el sueldo del dueño. Si el dueño no se paga sueldo, la utilidad parece más grande de lo que es.",
        },
        {
          kind: "example",
          title: "Un mes del negocio",
          rows: [
            { label: "Ingresos reales (ventas y otros ingresos)", value: "3.000,00 USDT" },
            { label: "− Costos (tela, botones, alquiler)", value: "−900,00 USDT" },
            { label: "− Gastos operativos (publicidad, servicios)", value: "−250,00 USDT" },
            { label: "− Comisiones de cambio", value: "−16,00 USDT" },
            { label: "− Impuestos", value: "−60,00 USDT" },
            { label: "− Sueldos y retiros (equipo y dueño)", value: "−940,00 USDT" },
            { label: "Utilidad real", value: "834,00 USDT", total: true },
          ],
          conclusion:
            "Si es positiva aparece **En verde**; si es negativa, **En rojo**. Los **aportes de capital** (dinero que el dueño mete) no son ingreso: se muestran aparte. El **IVA cobrado** en ventas o pedidos con IVA tampoco es ingreso: el sistema lo separa de cada cobro y lo muestra aparte, en el dashboard y en el Excel del mes.",
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Lo que NO se resta antes",
          body:
            "La **reserva** y la **reinversión** no son gastos: salen **de** la utilidad, después de calcularla. Tampoco se resta la mano de obra de los productos (ya está en los sueldos).",
        },
      ],
    },
    {
      id: "asignaciones",
      heading: "Qué se hace con la utilidad",
      blocks: [
        {
          kind: "text",
          body:
            "Owner y admin definen una **política**: qué porcentaje de la utilidad va a la **reserva** (una cuenta en USDT para emergencias) y cuál a **reinversión** (crecer). El dashboard compara lo que dice la política con lo que de verdad se hizo.",
        },
        {
          kind: "money-split",
          title: "Los 834 USDT del ejemplo, con política 10% reserva y 20% reinversión",
          unit: "USDT",
          total: { label: "Utilidad real", amount: 834 },
          parts: [
            { label: "Libre", amount: 583.8, note: "Puede quedarse en el negocio o repartirse." },
            { label: "Reinversión", amount: 166.8, note: "Plan: gastar en crecer (categoría Reinversión)." },
            { label: "Reserva", amount: 83.4, note: "Plan: traspasar a la cuenta de reserva." },
          ],
        },
        {
          kind: "example",
          title: "Plan vs. lo que se hizo",
          rows: [
            { label: "Reserva: la política pide", value: "83,40 USDT" },
            { label: "Reserva: se traspasó", value: "150,00 USDT", note: "Un traspaso real a la cuenta Reserva." },
            { label: "Reinversión: la política permite", value: "166,80 USDT" },
            { label: "Reinversión: se gastó", value: "600,00 USDT", note: "Más de lo planificado: conviene revisar si era reinversión de verdad." },
          ],
          conclusion:
            "La reserva solo cuenta cuando el dinero **de verdad** se traspasa a su cuenta. Cada fila dice **Al día** o cuánto **falta**. Para cambiar los porcentajes o la cuenta de reserva: botón **Política** en la vista de utilidad.",
        },
      ],
    },
    {
      id: "caja",
      heading: "Flujo de caja",
      blocks: [
        {
          kind: "text",
          body:
            "Utilidad y caja no son lo mismo: se puede ganar y tener poco efectivo (por ejemplo, si los clientes deben). El flujo de caja muestra, **por cuenta y en su moneda**, el recorrido del período, traspasos incluidos.",
        },
        {
          kind: "timeline",
          title: "Cuenta del banco en el mes",
          steps: [
            { title: "Saldo inicial", detail: "50.000 Bs" },
            { title: "Entró", detail: "+120.000 Bs (cobros y otros)" },
            { title: "Salió", detail: "−95.000 Bs (pagos, gastos, cambios a USDT)" },
            { title: "Saldo final", detail: "75.000 Bs" },
          ],
        },
      ],
    },
    {
      id: "margen",
      heading: "Margen por producto",
      blocks: [
        {
          kind: "text",
          body:
            "Para cada producto vendido en el período: cuánto entró de verdad (con descuentos y la tasa de cada venta), menos sus materiales (costo promedio) y su mano de obra. Sirve para saber **qué conviene vender** y a qué precio.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "“Sin costo” es un aviso, no un cero",
          body:
            "Si un producto vendido no tiene receta o un material no tiene costo, su margen sale marcado como incompleto. Así nunca se ve un margen inflado.",
        },
      ],
    },
    {
      id: "tasa",
      heading: "El efecto de la tasa",
      blocks: [
        {
          kind: "effects",
          items: [
            {
              icon: ShoppingBagIcon,
              title: "Ventas cobradas en Bs",
              effect: "Se cobran a BCV y valen a paralela: la diferencia es pérdida.",
              chapter: "ventas",
            },
            {
              icon: TruckIcon,
              title: "Pagos a proveedores en Bs",
              effect: "Pagar a BCV una deuda en dólares cuesta menos: la diferencia es ganancia.",
              chapter: "compras",
            },
          ],
        },
        {
          kind: "text",
          body:
            "El neto dice si la tasa está jugando a favor o en contra. Si la pérdida crece, conviene revisar el [[precio-por-metodo|precio por método de pago]] o cambiar los Bs a USDT más rápido.",
        },
      ],
    },
    {
      id: "cierres",
      heading: "Cierres de mes y Excel para el contador",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Descargar el Excel",
              body: "En **Gestión → Cierres y Excel**, el botón Excel de cada mes: resumen de utilidad real, ventas, pagos recibidos, compras, movimientos de dinero y sueldos, cada monto en su moneda y en valor real.",
            },
            {
              title: "Cerrar el mes",
              body: "Cuando el mes terminó y todo está registrado. Desde ese momento **nadie** registra nada con fecha de ese mes, ni owner ni admin, y se guarda la utilidad tal como quedó.",
            },
            {
              title: "Reabrir",
              body: "Solo el owner, con motivo (p. ej. faltó un gasto). Queda registrado. Después se vuelve a cerrar.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "¿Por qué cerrar?",
          body: "Para que los números que ya viste (o que le diste al contador) no cambien por un registro con fecha vieja.",
        },
      ],
    },
    {
      id: "conexiones",
      heading: "De dónde salen los números",
      blocks: [
        {
          kind: "connections",
          center: { icon: ChartColumnIcon, title: "Resultados" },
          inputs: [
            { icon: ShoppingBagIcon, title: "Ventas", effect: "Ingresos reales y unidades vendidas", chapter: "ventas" },
            { icon: TruckIcon, title: "Compras", effect: "Costos, gastos y reinversión", chapter: "compras" },
            { icon: BanknoteIcon, title: "Movimientos", effect: "Todo lo que entra y sale, por categoría", chapter: "tesoreria" },
            { icon: UsersRoundIcon, title: "Equipo", effect: "Sueldos, adelantos y retiros", chapter: "equipo" },
            { icon: PackageIcon, title: "Inventario", effect: "Costo de cada prenda", chapter: "inventario" },
          ],
          outputs: [
            { icon: PiggyBankIcon, title: "Decisión: reserva", effect: "Cuánto traspasar a la cuenta de reserva" },
            { icon: SproutIcon, title: "Decisión: reinversión", effect: "Cuánto se puede gastar en crecer" },
            { icon: ArrowRightLeftIcon, title: "Decisión: tasa", effect: "Cambiar precios o cambiar Bs antes" },
          ],
        },
      ],
    },
    {
      id: "quien",
      heading: "Quién lo ve",
      blocks: [
        {
          kind: "roles",
          items: [
            { role: "admin", can: "Ve todo el dashboard y ajusta la política de reserva y reinversión." },
            { role: "owner", can: "Igual que admin." },
          ],
        },
        { kind: "text", body: "Staff no ve resultados, totales ni sueldos: la base de datos no se los entrega." },
      ],
    },
    {
      id: "preguntas",
      heading: "Preguntas frecuentes",
      blocks: [
        {
          kind: "faq",
          items: [
            {
              question: "Vendimos mucho y la utilidad es baja, ¿por qué?",
              answer: "Revisa Margen (productos que dejan poco) y Tasa (cuánto se perdió cobrando en Bs). Los sueldos también restan.",
            },
            {
              question: "¿Por qué la utilidad cambió si no registré nada hoy?",
              answer: "No debería: los valores se congelan al registrarse. Revisa si alguien registró algo con fecha pasada en el período.",
            },
            {
              question: "¿Dónde elijo el período?",
              answer: "Arriba a la derecha: este mes, últimos 3, 6 o 12 meses, o este año.",
            },
          ],
        },
      ],
    },
  ],
}
