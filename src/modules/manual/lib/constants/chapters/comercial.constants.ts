import {
  BanknoteIcon,
  BookOpenIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  HandCoinsIcon,
  LandmarkIcon,
  PackageIcon,
  ReceiptTextIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TagIcon,
  UserRoundIcon,
  UsersRoundIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter, ManualChapterStub } from "../../types/manual.types"

export const SALES_CHAPTER: ManualChapter = {
  slug: "ventas",
  area: "comercial",
  title: "Ventas",
  summary:
    "Registrar lo que se vende, cobrarlo (todo, por partes o después) y entregarlo. Una venta mueve el inventario, el dinero de las cuentas y la utilidad del negocio.",
  icon: ShoppingBagIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Ventas", url: ROUTES.SALES, roles: ROLE_GROUPS.ALL },
    { title: "Nueva venta", url: ROUTES.NEW_SALE, roles: ROLE_GROUPS.ALL },
    { title: "Por cobrar", url: ROUTES.RECEIVABLES, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Reglas de venta", url: ROUTES.SETTINGS_SALES, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["tesoreria", "clientes", "inventario", "resultados"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "Es el área **comercial**: el registro de cada venta, sea en la tienda, por WhatsApp o por Instagram. Todas caen en el mismo lugar; solo cambia el **canal**. Antes esto vivía en mensajes y cuadernos; ahora cada venta queda con sus productos, su cliente, cómo pagó y a qué [[tasa-bcv|tasa]].",
        },
        {
          kind: "callout",
          tone: "info",
          title: "La idea en una línea",
          body:
            "Una venta dice **qué** se vendió y **cuánto vale en dólares**. Los pagos dicen **cuánto entró de verdad** a las cuentas, y su [[valor-real]] en USDT.",
        },
      ],
    },
    {
      id: "recorrido",
      heading: "El recorrido de una venta",
      blocks: [
        {
          kind: "flow",
          title: "De la vitrina a la utilidad",
          nodes: [
            { icon: ShoppingCartIcon, title: "Se registra la venta", detail: "Productos, cliente (opcional), canal y método de pago." },
            { icon: PackageIcon, title: "Sale del inventario", detail: "Lo que es de stock se descuenta al instante.", chapter: "inventario" },
            { icon: BanknoteIcon, title: "Se cobra", detail: "Todo, un [[abono]] o después. Cada pago entra a una [[cuenta]].", chapter: "tesoreria" },
            { icon: CircleDollarSignIcon, title: "Se mide en valor real", detail: "Cada pago guarda la tasa del día y su valor en USDT." },
            { icon: ChartColumnIcon, title: "Suma a la utilidad", detail: "Los ingresos reales alimentan el dashboard.", chapter: "resultados" },
          ],
        },
      ],
    },
    {
      id: "registrar",
      heading: "Cómo registrar una venta",
      blocks: [
        {
          kind: "text",
          body: "Está pensado para hacerse desde el celular en menos de 20 segundos. Desde **Inicio → Registrar venta** o **Comercial → Nueva venta**:",
        },
        {
          kind: "steps",
          items: [
            { title: "Agrega los productos", body: "Búscalos por nombre o código y ajusta la cantidad con + y −." },
            {
              title: "Elige el método de pago",
              body:
                "Define el precio: cada producto tiene un [[precio-por-metodo|precio por método]]. Por eso la filipina puede salir en 28 por pago móvil y en 25 en efectivo.",
            },
            { title: "Cliente (opcional)", body: "Búscalo o créalo sin salir. Sin cliente es una venta rápida." },
            { title: "Canal y entrega", body: "Tienda, WhatsApp o Instagram; retiro o delivery (con su cobro aparte)." },
            {
              title: "Indica el pago",
              body: "Pagó todo, abonó una parte, pagó con varios métodos (mixto) o queda [[por-cobrar]].",
            },
            { title: "Toca Registrar venta", body: "Listo: el inventario, la cuenta y los reportes se actualizan solos." },
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Si el botón está apagado",
          body:
            "Encima del botón aparece por qué: falta stock, un producto no tiene precio para ese método, el descuento pasa el máximo o falta la tasa de hoy.",
        },
      ],
    },
    {
      id: "dinero",
      heading: "Cómo se calcula el dinero",
      blocks: [
        {
          kind: "text",
          body:
            "Los precios están en dólares. Si el cliente paga en bolívares, por ley se cobra a la [[tasa-bcv]] del día. Pero esos bolívares valen menos en la calle: su [[valor-real]] se mide con la [[tasa-paralela]]. Por eso el sistema guarda las dos tasas en cada pago.",
        },
        {
          kind: "example",
          title: "Una filipina de 28 USD por pago móvil (BCV 40, paralelo 50)",
          rows: [
            { label: "Precio por pago móvil", value: "28,00 USD" },
            { label: "Se cobra en Bs (28 × BCV 40)", value: "1.120,00 Bs" },
            { label: "Valor real (1.120 ÷ paralelo 50)", value: "22,40 USDT", total: true },
            { label: "Diferencia por cobrar en Bs", value: "−5,60 USDT", note: "Se ve en Resultados → Tasa." },
          ],
          conclusion:
            "La misma filipina **en efectivo a 25 USD vale 25 USDT**: más que por pago móvil, aunque el precio sea menor. Para eso existe el precio por método.",
        },
        {
          kind: "money-split",
          title: "Qué parte de los 28 USD llega de verdad",
          unit: "USDT",
          total: { label: "Precio", amount: 28 },
          parts: [
            { label: "Valor real que entra", amount: 22.4, note: "Lo que puedes comprar con esos Bs." },
            { label: "Se pierde por la tasa", amount: 5.6, note: "Diferencia entre BCV y paralelo." },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "La tasa se congela",
          body:
            "Cada pago guarda la tasa **del día en que se pagó**. Si mañana cambia la tasa, lo ya registrado no se recalcula nunca.",
        },
      ],
    },
    {
      id: "pagos",
      heading: "Pagos: todo, por partes o después",
      blocks: [
        {
          kind: "timeline",
          title: "Estados de pago de una venta",
          steps: [
            { title: "Por cobrar", detail: "No ha pagado nada." },
            { title: "Abono", detail: "Pagó una parte; queda saldo." },
            { title: "Pagada", detail: "El total está cubierto." },
          ],
          note: "Una venta también puede quedar **Anulada** (ver más abajo).",
        },
        {
          kind: "example",
          title: "Abono hoy y el resto en 4 días (pago móvil)",
          rows: [
            { label: "Total de la venta", value: "28,00 USD" },
            { label: "Hoy abona la mitad (14 × BCV 40)", value: "560,00 Bs", note: "Valor real: 560 ÷ 50 = 11,20 USDT" },
            { label: "En 4 días paga el resto (14 × BCV 41)", value: "574,00 Bs", note: "Con la tasa de ese día. Valor real: 574 ÷ 52 = 11,04 USDT" },
            { label: "Valor real total cobrado", value: "22,24 USDT", total: true },
          ],
          conclusion: "Cada pago usa la tasa de su propio día. Mientras más se tarda en cobrar en Bs, más valor se puede perder.",
        },
        {
          kind: "text",
          body:
            "Para cobrar un saldo: abre la venta → **Registrar pago**. Owner y admin ven a todos los que deben en **Comercial → Por cobrar**, agrupados por cliente y con su deuda más antigua.",
        },
      ],
    },
    {
      id: "encargos",
      heading: "Productos de inventario y por encargo",
      blocks: [
        {
          kind: "text",
          body:
            "Un producto de **inventario** ya está hecho: al venderlo se descuenta del stock y, si no alcanza, no se puede vender. Un producto [[por-encargo]] se fabrica después de venderlo.",
        },
        {
          kind: "timeline",
          title: "Lo que pasa con un encargo",
          steps: [
            { title: "Por producir", detail: "Se vendió; aún no se empieza." },
            { title: "En producción", detail: "Se está haciendo." },
            { title: "Listo", detail: "Al llegar aquí se descuenta la materia prima de su receta (tela, botones…)." },
            { title: "Entregado", detail: "El cliente lo tiene." },
          ],
          note: "Los estados solo avanzan. Si falta materia prima del color, el sistema avisa y no deja marcarlo listo.",
        },
      ],
    },
    {
      id: "descuentos",
      heading: "Descuentos y fechas pasadas",
      blocks: [
        {
          kind: "steps",
          items: [
            {
              title: "Descuento",
              body:
                "En porcentaje o monto, siempre con motivo. Queda guardado quién lo hizo. Staff tiene un máximo (10% por defecto); por encima, solo owner o admin.",
            },
            {
              title: "Venta de otro día",
              body:
                "En **Más opciones** se cambia la fecha. Usa las tasas de ese día y queda marcada como [[retroactiva]]. Staff puede ir hasta 7 días atrás (se cambia en Configuración → Reglas de venta).",
            },
          ],
        },
      ],
    },
    {
      id: "corregir",
      heading: "Corregir un error: anular",
      blocks: [
        {
          kind: "text",
          body:
            "Una venta **no se edita ni se borra**. Si algo quedó mal, owner o admin la [[anular|anulan]] con un motivo y se registra de nuevo bien. Así siempre se puede ver qué pasó y quién lo hizo.",
        },
        {
          kind: "effects",
          items: [
            { icon: PackageIcon, title: "Inventario", effect: "Vuelve lo que se había descontado.", chapter: "inventario" },
            { icon: LandmarkIcon, title: "Cuentas", effect: "Cada pago se revierte con un movimiento al revés.", chapter: "tesoreria" },
            { icon: ChartColumnIcon, title: "Resultados", effect: "La venta deja de contar como ingreso.", chapter: "resultados" },
            { icon: ReceiptTextIcon, title: "La venta", effect: "Queda visible como Anulada, con su motivo." },
          ],
        },
      ],
    },
    {
      id: "conexiones",
      heading: "Con qué se conecta",
      blocks: [
        {
          kind: "connections",
          center: { icon: ShoppingBagIcon, title: "Ventas" },
          inputs: [
            { icon: TagIcon, title: "Catálogo", effect: "Productos y precio por método", chapter: "inventario" },
            { icon: LandmarkIcon, title: "Tasas", effect: "Tasa BCV y paralela del día", chapter: "tesoreria" },
            { icon: UserRoundIcon, title: "Clientes", effect: "Quién compra", chapter: "clientes" },
            { icon: BookOpenIcon, title: "Reglas de venta", effect: "Descuento máximo y días atrás", chapter: "configuracion" },
          ],
          outputs: [
            { icon: PackageIcon, title: "Stock", effect: "Descuenta lo vendido", chapter: "inventario" },
            { icon: ScissorsIcon, title: "Materia prima", effect: "Los encargos consumen su receta", chapter: "inventario" },
            { icon: BanknoteIcon, title: "Cuentas", effect: "Cada pago es un ingreso", chapter: "tesoreria" },
            { icon: HandCoinsIcon, title: "Por cobrar", effect: "Lo que falta por pagar" },
            { icon: ChartColumnIcon, title: "Resultados", effect: "Ingresos reales y margen por producto", chapter: "resultados" },
          ],
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
            { role: "staff", can: "Registra ventas y pagos, avanza encargos, comparte la nota. Descuento y días atrás con límite." },
            { role: "admin", can: "Todo lo anterior sin límites, más anular ventas, ver Por cobrar y los totales en valor real." },
            { role: "owner", can: "Igual que admin." },
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
              question: "¿Por qué el valor real es menor que el total?",
              answer: "Porque se cobró en Bs a tasa BCV y el valor real usa la paralela. Es la diferencia de la tasa, no un error.",
            },
            {
              question: "Me equivoqué en una venta, ¿la edito?",
              answer: "No se puede: pide a owner o admin que la anule con el motivo y regístrala de nuevo.",
            },
            {
              question: "¿Dónde aparece el dinero que cobré?",
              answer: "En Tesorería → Movimientos, en la cuenta del método de pago. No hay que registrarlo a mano.",
            },
            {
              question: "¿La nota de entrega es una factura?",
              answer: "No. Es un comprobante para el cliente; la factura fiscal se definirá con el contador.",
            },
          ],
        },
      ],
    },
  ],
}

// Capítulos del área aún por escribir.
export const COMERCIAL_STUBS: readonly ManualChapterStub[] = [
  {
    slug: "clientes",
    area: "comercial",
    title: "Clientes",
    summary: "La libreta de clientes: contacto, historial de compras y su cédula protegida.",
    icon: UsersRoundIcon,
    roles: ROLE_GROUPS.ALL,
  },
]
