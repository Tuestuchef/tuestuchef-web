import {
  BanknoteIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  FactoryIcon,
  LandmarkIcon,
  PackageIcon,
  ScissorsIcon,
  TagsIcon,
  TruckIcon,
  WrenchIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const PURCHASES_CHAPTER: ManualChapter = {
  slug: "compras",
  area: "compras",
  title: "Compras y proveedores",
  summary:
    "Todo lo que el negocio compra (tela, insumos, servicios, una máquina), a quién se lo compra, cómo lo pagó y lo que todavía le debe.",
  icon: TruckIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Compras", url: ROUTES.PURCHASES, roles: ROLE_GROUPS.ALL },
    { title: "Nueva compra", url: ROUTES.NEW_PURCHASE, roles: ROLE_GROUPS.ALL },
    { title: "Proveedores", url: ROUTES.SUPPLIERS, roles: ROLE_GROUPS.ALL },
    { title: "Por pagar", url: ROUTES.PAYABLES, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["inventario", "tesoreria", "resultados"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "El área de **abastecimiento**: es el espejo de Ventas. En una venta entra dinero y sale mercancía; en una compra **sale dinero y entra mercancía** (o un servicio). Cada compra tiene un proveedor, unas líneas y unos pagos.",
        },
        {
          kind: "flow",
          title: "Qué pasa al registrar una compra",
          nodes: [
            { icon: FactoryIcon, title: "Proveedor", detail: "A quién se le compró." },
            { icon: PackageIcon, title: "Entra al inventario", detail: "Si es tela, insumos o mercancía, con su costo.", chapter: "inventario" },
            { icon: BanknoteIcon, title: "Sale el dinero", detail: "De la cuenta con que se pagó, o queda por pagar.", chapter: "tesoreria" },
            { icon: ChartColumnIcon, title: "Cuenta en la utilidad", detail: "Según la categoría de cada línea.", chapter: "resultados" },
          ],
        },
      ],
    },
    {
      id: "lineas",
      heading: "Dos tipos de línea",
      blocks: [
        {
          kind: "effects",
          items: [
            {
              icon: ScissorsIcon,
              title: "Materia prima o mercancía",
              effect: "Tela, botones, pantalones para revender. Entra al inventario y recalcula su costo promedio.",
              chapter: "inventario",
            },
            {
              icon: WrenchIcon,
              title: "Concepto sin stock",
              effect: "Alquiler, maquila, bordado, reparaciones, servicios, una máquina. No toca el inventario.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Cada línea lleva su categoría",
          body:
            "La tela es **costo**; la publicidad, **gasto operativo**; una máquina nueva, **reinversión**. La categoría decide cómo cuenta esa línea en la [[utilidad-real]], aunque estén en la misma compra.",
        },
      ],
    },
    {
      id: "registrar",
      heading: "Cómo registrar una compra",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Abre Registrar → Compra", body: "Desde la flecha junto a Registrar venta, o en Compras → Nueva compra." },
            { title: "Elige el proveedor", body: "O créalo con el botón +: solo el nombre es obligatorio." },
            { title: "Agrega las líneas", body: "Material o mercancía con cantidad y costo en dólares, o conceptos sin stock." },
            { title: "Indica cómo se pagó", body: "Pagada completa, a crédito, o un abono (crédito y abono: owner y admin)." },
            { title: "Adjunta la factura", body: "Foto o PDF, si la hay. Se guarda privada." },
          ],
        },
      ],
    },
    {
      id: "pagos-bs",
      heading: "Pagar en bolívares: ¿BCV o paralela?",
      blocks: [
        {
          kind: "text",
          body:
            "Los proveedores cobran en dólares de referencia. Si se les paga en Bs, se elige con qué tasa lo pidió el proveedor: [[tasa-bcv|BCV]] o [[tasa-paralela|paralela]], siempre la registrada para esa fecha. El valor real del pago **siempre** usa la paralela.",
        },
        {
          kind: "example",
          title: "Una deuda de 300 USD pagada en Bs (BCV 41, paralelo 52)",
          rows: [
            { label: "Si el proveedor acepta tasa BCV: 300 × 41", value: "12.300,00 Bs" },
            { label: "Valor real (12.300 ÷ 52)", value: "236,54 USDT", note: "Pagaste menos de lo que valía la deuda." },
            { label: "Ganancia por la tasa", value: "63,46 USDT", total: true },
            { label: "Si pide tasa paralela: 300 × 52", value: "15.600,00 Bs", note: "Valor real 300 USDT: sin ganancia ni pérdida." },
          ],
          conclusion: "Esa diferencia se ve en Resultados → Tasa. Es lo contrario de cobrar en Bs, donde se pierde.",
        },
      ],
    },
    {
      id: "credito",
      heading: "Compras a crédito y Por pagar",
      blocks: [
        {
          kind: "timeline",
          title: "Estados de una compra",
          steps: [
            { title: "Por pagar", detail: "A crédito, sin pagar nada." },
            { title: "Abono", detail: "Se pagó una parte." },
            { title: "Pagada", detail: "Total cubierto." },
          ],
          note: "Si pasa la fecha de vencimiento con saldo, se marca **Vencida**. También puede quedar **Anulada**.",
        },
        {
          kind: "text",
          body:
            "**Compras → Por pagar** (owner y admin) lista lo que se debe, con las vencidas primero y sus días de atraso. Para pagar, abre la compra → **Registrar pago**. El saldo vive en dólares: un pago en Bs se convierte con la tasa del día en que se paga.",
        },
      ],
    },
    {
      id: "proveedores",
      heading: "Proveedores",
      blocks: [
        {
          kind: "text",
          body:
            "La ficha de cada proveedor tiene sus datos (RIF, contacto, teléfono), todas sus compras y lo que se le debe. Se llama o se escribe por WhatsApp con un toque. Los proveedores no se borran: se desactivan.",
        },
      ],
    },
    {
      id: "talleres",
      heading: "Talleres",
      blocks: [
        {
          kind: "text",
          body:
            "Un proveedor de tipo **taller** (confección, bordado) puede recibir etapas de los pedidos, con una fecha estimada que se confirma con ellos; si se pasa, aparece atrasado. Lo que se le paga se registra como una compra de servicio, y si el pedido se cancela después del corte, ese gasto se descuenta del reembolso.",
        },
      ],
    },
    {
      id: "anular",
      heading: "Corregir un error: anular",
      blocks: [
        {
          kind: "text",
          body:
            "Una compra no se edita ni se borra. Owner o admin la anulan con motivo: el inventario que entró vuelve a salir y cada pago se revierte en su cuenta. Después se registra bien.",
        },
      ],
    },
    {
      id: "conexiones",
      heading: "Con qué se conecta",
      blocks: [
        {
          kind: "connections",
          center: { icon: TruckIcon, title: "Compras" },
          inputs: [
            { icon: FactoryIcon, title: "Proveedores", effect: "A quién se le compra" },
            { icon: LandmarkIcon, title: "Tasas", effect: "BCV y paralela de la fecha del pago", chapter: "tesoreria" },
            { icon: TagsIcon, title: "Categorías de dinero", effect: "Cómo cuenta cada línea", chapter: "configuracion" },
          ],
          outputs: [
            { icon: PackageIcon, title: "Inventario", effect: "Entra la mercancía y cambia su costo", chapter: "inventario" },
            { icon: BanknoteIcon, title: "Cuentas", effect: "Cada pago es una salida", chapter: "tesoreria" },
            { icon: CalendarClockIcon, title: "Por pagar", effect: "Lo que se debe y cuándo vence" },
            { icon: ChartColumnIcon, title: "Resultados", effect: "Costos, gastos y efecto de la tasa", chapter: "resultados" },
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
            {
              role: "staff",
              can: "Registra compras **pagadas completas en el momento** y crea proveedores. Ve solo las compras que registró.",
            },
            { role: "admin", can: "Todo: compras a crédito y abonos, pagos de deudas, Por pagar, anular compras y desactivar proveedores." },
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
              question: "Pagué el alquiler, ¿es una compra o un gasto?",
              answer:
                "Las dos sirven. Si quieres que quede a nombre del arrendador (y poder deberlo), regístralo como compra con un concepto. Si no, como gasto en Tesorería.",
            },
            {
              question: "Compré tela a crédito, ¿cuándo cuenta como costo?",
              answer: "Cuando se paga: la utilidad se mide con dinero que de verdad salió. Mientras tanto aparece en Por pagar.",
            },
            {
              question: "¿Dónde guardo la factura del proveedor?",
              answer: "Adjúntala en la compra o en el pago. Se guarda en un espacio privado y solo se abre con sesión.",
            },
          ],
        },
      ],
    },
  ],
}

