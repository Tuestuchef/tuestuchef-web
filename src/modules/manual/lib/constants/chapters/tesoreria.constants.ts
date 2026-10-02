import {
  ArrowRightLeftIcon,
  BanknoteIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  CoinsIcon,
  CreditCardIcon,
  LandmarkIcon,
  ListIcon,
  RefreshCwIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagsIcon,
  TruckIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const TREASURY_CHAPTER: ManualChapter = {
  slug: "tesoreria",
  area: "tesoreria",
  title: "Tesorería",
  summary:
    "Dónde está el dinero del negocio, cuánto hay y cuánto vale de verdad. Aquí viven las tasas del día, las cuentas y cada entrada o salida de dinero.",
  icon: WalletIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Movimientos", url: ROUTES.MOVEMENTS, roles: ROLE_GROUPS.ALL },
    { title: "Nuevo movimiento", url: ROUTES.NEW_MOVEMENT, roles: ROLE_GROUPS.ALL },
    { title: "Tasas y cuentas", url: ROUTES.TREASURY, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Traspaso", url: ROUTES.NEW_TRANSFER, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["ventas", "compras", "equipo", "resultados", "configuracion"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "La **tesorería** es la caja del negocio. Responde tres preguntas: ¿a cuánto está la tasa hoy?, ¿cuánto dinero hay y dónde? y ¿en qué entró o salió cada bolívar o dólar? Tiene tres piezas que trabajan juntas:",
        },
        {
          kind: "flow",
          nodes: [
            { icon: RefreshCwIcon, title: "Tasas", detail: "Convierten todo a [[valor-real]]. Una por día." },
            { icon: LandmarkIcon, title: "Cuentas", detail: "Dónde vive el dinero, cada una en su moneda." },
            { icon: ListIcon, title: "Movimientos", detail: "Cada entrada y salida. El saldo es su suma." },
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "La regla más importante: negocio vs. personal",
          body:
            "El dinero del negocio no se mezcla con el personal. Si alguien del equipo, **incluido el dueño**, saca dinero, se registra como sueldo, adelanto o retiro **con su nombre**. Nunca como 'prestado'. Ver [[negocio]].",
        },
      ],
    },
    {
      id: "tasas",
      heading: "Las tasas del día",
      blocks: [
        {
          kind: "text",
          body:
            "En Venezuela hay tres tasas y el sistema guarda las tres cada día. Las ventas en Bs se cobran con la oficial; el valor real se mide con la paralela.",
        },
        {
          kind: "effects",
          items: [
            { icon: LandmarkIcon, title: "BCV dólar", effect: "Convierte los precios en USD a Bs al cobrar (por ley)." },
            { icon: LandmarkIcon, title: "BCV euro", effect: "Para métodos de pago que cobran a tasa euro." },
            { icon: CoinsIcon, title: "Paralelo (Binance)", effect: "Mide el valor real en USDT de todo." },
          ],
        },
        {
          kind: "steps",
          items: [
            { title: "Se cargan solas", body: "Cada mañana a las 6:00 se traen del BCV y del paralelo." },
            {
              title: "Si falta la de hoy",
              body: "Inicio muestra un aviso. Cualquiera del equipo puede registrarla; owner y admin también la corrigen.",
            },
            {
              title: "Corregir una tasa",
              body: "No se edita: se registra otra del mismo día, que queda como vigente. Lo ya registrado conserva su tasa.",
            },
            {
              title: "Tasa de otro día",
              body: "Para registrar algo [[retroactiva|retroactivo]], owner o admin cargan la tasa de esa fecha en Tasas y cuentas.",
            },
          ],
        },
      ],
    },
    {
      id: "cuentas",
      heading: "Las cuentas",
      blocks: [
        {
          kind: "text",
          body:
            "Una [[cuenta]] es un lugar donde vive el dinero, siempre en **una sola moneda**. Cada método de pago deposita en una cuenta: el pago móvil cae al banco, el efectivo a la caja, etc.",
        },
        {
          kind: "effects",
          items: [
            { icon: LandmarkIcon, title: "Bs", effect: "Banco (pago móvil, transferencias) o efectivo en bolívares." },
            { icon: BanknoteIcon, title: "USD efectivo", effect: "Los dólares en billete." },
            { icon: CreditCardIcon, title: "Zelle", effect: "Dólares en la cuenta de Zelle." },
            { icon: CoinsIcon, title: "USDT", effect: "La billetera de Binance, y la reserva del negocio." },
          ],
        },
        {
          kind: "example",
          title: "Un día en la cuenta del banco (Bs)",
          rows: [
            { label: "Saldo al empezar el día", value: "50.000,00 Bs" },
            { label: "+ Cobro de una venta por pago móvil", value: "+1.120,00 Bs", note: "Entra solo al registrar el pago." },
            { label: "− Publicidad en Instagram", value: "−1.800,00 Bs", note: "Gasto registrado a mano." },
            { label: "− Cambio a USDT", value: "−40.000,00 Bs", note: "Un traspaso a Binance." },
            { label: "Saldo al cerrar", value: "9.320,00 Bs", total: true },
          ],
          conclusion: "Nadie escribe el saldo: es la suma de los movimientos. Si el saldo no cuadra con el banco, falta registrar algo.",
        },
      ],
    },
    {
      id: "movimientos",
      heading: "Los movimientos",
      blocks: [
        {
          kind: "text",
          body:
            "Un [[movimiento]] es cada entrada o salida de dinero de una cuenta. Muchos llegan **solos** desde otros módulos; solo los gastos e ingresos sueltos se registran a mano.",
        },
        {
          kind: "connections",
          center: { icon: ListIcon, title: "Movimientos" },
          inputs: [
            { icon: ShoppingBagIcon, title: "Ventas", effect: "Cada pago de un cliente", chapter: "ventas" },
            { icon: TruckIcon, title: "Compras", effect: "Cada pago a un proveedor", chapter: "compras" },
            { icon: UsersRoundIcon, title: "Recursos humanos", effect: "Sueldos y adelantos", chapter: "equipo" },
            { icon: ArrowRightLeftIcon, title: "Traspasos", effect: "Dinero que pasa de una cuenta a otra" },
            { icon: WalletIcon, title: "A mano", effect: "Gastos e ingresos sueltos (alquiler, luz…)" },
          ],
          outputs: [
            { icon: LandmarkIcon, title: "Saldos", effect: "Cuánto hay en cada cuenta" },
            { icon: ChartColumnIcon, title: "Utilidad real", effect: "Según la categoría de cada uno", chapter: "resultados" },
            { icon: CircleDollarSignIcon, title: "Flujo de caja", effect: "Lo que entró y salió por cuenta", chapter: "resultados" },
          ],
        },
        {
          kind: "steps",
          items: [
            { title: "Registrar un gasto o ingreso", body: "En el menú, la flecha junto a **Registrar venta** → **Gasto o ingreso** (también está en Inicio): tipo, monto, cuenta y categoría." },
            {
              title: "Elegir bien la categoría",
              body:
                "La [[categoria]] decide cómo cuenta en la utilidad: costo (tela, botones, alquiler), gasto operativo, impuesto, sueldo, retiro o reinversión.",
            },
            { title: "Adjuntar el comprobante", body: "Foto o PDF. Se guarda privado; solo se ve con sesión." },
            { title: "Fecha pasada", body: "Usa las tasas de ese día. Staff hasta 7 días atrás." },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Costo o reinversión",
          body:
            "**Costo**: lo necesario para producir y vender este mes (tela, botones, alquiler, publicidad habitual). **Reinversión**: lo que es para crecer (una máquina nueva, una línea nueva). La reinversión no resta antes de la utilidad: sale de ella.",
        },
      ],
    },
    {
      id: "traspasos",
      heading: "Traspasos y cambios de moneda",
      blocks: [
        {
          kind: "text",
          body:
            "Un [[traspaso]] mueve dinero entre dos cuentas del negocio. No es ganancia ni gasto: el dinero sigue siendo del negocio. Si cambia de moneda, lo que se pierde en el cambio queda como [[comision-cambio|comisión de cambio]].",
        },
        {
          kind: "example",
          title: "Cambiar 40.000 Bs a USDT (paralelo 50)",
          rows: [
            { label: "Sale del banco", value: "40.000,00 Bs" },
            { label: "Valor real que sale (40.000 ÷ 50)", value: "800,00 USDT" },
            { label: "Llega a Binance", value: "784,00 USDT" },
            { label: "Comisión de cambio", value: "16,00 USDT", total: true, note: "Se registra sola y resta en la utilidad." },
          ],
        },
        {
          kind: "money-split",
          title: "Qué pasa con los 800 USDT que salen",
          unit: "USDT",
          total: { label: "Valor que sale", amount: 800 },
          parts: [
            { label: "Llega a Binance", amount: 784 },
            { label: "Comisión de cambio", amount: 16 },
          ],
        },
        {
          kind: "text",
          body: "Un traspaso se anula completo (owner o admin): no se revierten sus partes por separado.",
        },
      ],
    },
    {
      id: "corregir",
      heading: "Corregir un error: revertir",
      blocks: [
        {
          kind: "text",
          body:
            "Los movimientos **no se editan ni se borran**. Owner o admin los [[revertir|revierten]] con un motivo: se crea un movimiento igual pero al revés, y el saldo vuelve a como estaba. Después se registra el correcto.",
        },
        {
          kind: "timeline",
          steps: [
            { title: "Gasto mal registrado", detail: "−50 USD en Efectivo, categoría equivocada." },
            { title: "Se revierte", detail: "+50 USD 'Reverso de…', con motivo." },
            { title: "Se registra bien", detail: "−50 USD con la categoría correcta." },
          ],
          note: "Los cobros de ventas y los pagos de compras no se revierten aquí: se anula la venta o la compra.",
        },
      ],
    },
    {
      id: "quien",
      heading: "Quién puede hacer qué",
      blocks: [
        {
          kind: "roles",
          items: [
            {
              role: "staff",
              can: "Registra gastos e ingresos de costos, gastos operativos y otros ingresos. Ve solo lo que registró. Puede cargar la tasa de hoy si falta.",
            },
            {
              role: "admin",
              can: "Ve todo: saldos, tasas y movimientos de todos. Registra sueldos, retiros e impuestos, hace traspasos, revierte y carga tasas de otras fechas.",
            },
            { role: "owner", can: "Igual que admin." },
          ],
        },
      ],
    },
    {
      id: "conexiones",
      heading: "Lo que configura este módulo",
      blocks: [
        {
          kind: "effects",
          items: [
            { icon: LandmarkIcon, title: "Cuentas", effect: "Cuáles existen y su moneda.", chapter: "configuracion" },
            { icon: CreditCardIcon, title: "Métodos de pago", effect: "A qué cuenta llega cada uno y con qué tasa.", chapter: "configuracion" },
            { icon: TagsIcon, title: "Categorías de dinero", effect: "Cómo cuenta cada gasto o ingreso en la utilidad.", chapter: "configuracion" },
            { icon: SettingsIcon, title: "Reglas de venta", effect: "Cuántos días atrás puede registrar staff.", chapter: "configuracion" },
          ],
        },
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
              question: "¿Registro a mano lo que cobré de una venta?",
              answer: "No. Al registrar el pago en la venta, el movimiento aparece solo en la cuenta del método.",
            },
            {
              question: "Saqué dinero de la caja para mí, ¿cómo lo registro?",
              answer: "Como retiro o adelanto de sueldo con tu nombre (owner o admin lo registran). Nunca como préstamo.",
            },
            {
              question: "¿Por qué no puedo cambiar la tasa de ayer?",
              answer: "Las tasas no se editan: se registra una corrección. Lo ya registrado con la tasa vieja se queda así a propósito.",
            },
            {
              question: "¿Cambiar Bs a USDT es un gasto?",
              answer: "No: es un traspaso. Solo la comisión de cambio cuenta como gasto.",
            },
          ],
        },
      ],
    },
  ],
}
