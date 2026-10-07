import {
  BanknoteIcon,
  BoxesIcon,
  CircleSlashIcon,
  ClipboardListIcon,
  FactoryIcon,
  HandCoinsIcon,
  KanbanIcon,
  LockIcon,
  PackageCheckIcon,
  PaletteIcon,
  RulerIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  UsersRoundIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const ORDERS_CHAPTER: ManualChapter = {
  slug: "pedidos",
  area: "inventario",
  title: "Pedidos y producción",
  summary:
    "Lo que se fabrica por encargo: el pedido con su personalización y su abono, las etapas por las que pasa cada pieza, quién la tiene y la entrega.",
  icon: ClipboardListIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Pedidos", url: ROUTES.ORDERS, roles: ROLE_GROUPS.ALL },
    { title: "Nuevo pedido", url: ROUTES.NEW_ORDER, roles: ROLE_GROUPS.ALL },
    { title: "Tablero", url: ROUTES.PRODUCTION, roles: ROLE_GROUPS.ALL },
    { title: "Quién tiene qué", url: ROUTES.PRODUCTION_ASSIGNMENTS, roles: ROLE_GROUPS.ALL },
    { title: "Material necesario", url: ROUTES.PRODUCTION_MATERIALS, roles: ROLE_GROUPS.ALL },
  ],
  related: ["ventas", "inventario", "equipo", "compras", "clientes", "presupuestos"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "Un **pedido es una venta** que se fabrica: tiene su cliente, sus productos y su dinero igual que cualquier venta (aparece en Tesorería y en Resultados), y además una **fecha prometida**, un **abono** para empezar y unas **etapas** de producción. El número junto a **Pedidos** en el menú dice cuántos están abiertos (por empezar, en producción o listos para entregar).",
        },
        {
          kind: "flow",
          title: "La vida de un pedido",
          nodes: [
            { icon: ClipboardListIcon, title: "Se registra", detail: "Cliente, productos, personalización y fecha." },
            { icon: BanknoteIcon, title: "Se paga el abono", detail: "Sin él no se empieza a producir." },
            { icon: ScissorsIcon, title: "Se produce", detail: "Pasa por las etapas; la tela sale al cortar." },
            { icon: PackageCheckIcon, title: "Se entrega completo", detail: "Con el saldo pagado." },
          ],
        },
      ],
    },
    {
      id: "registrar",
      heading: "Cómo registrar un pedido",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Abre Registrar → Pedido", body: "Desde la flecha junto a Registrar venta, o en Producción → Pedidos." },
            { title: "Elige el cliente", body: "Es obligatorio. A un cliente [[cliente-bloqueado|bloqueado]] no se le puede vender." },
            { title: "Agrega productos y combos", body: "Con su cantidad. En un combo eliges el modelo, la talla y el color de cada pieza; si una cobra recargo, se suma al combo." },
            {
              title: "Personaliza",
              body: "**Personalizar** en cada línea: nombre bordado (uno para todas o uno por pieza), logo de bolsillo, estampado o de pecho.",
            },
            { title: "Elige el inventario", body: "Reservar lo que hay y producir lo que falta, o producir todo desde cero." },
            { title: "Revisa la fecha y el abono", body: "La fecha viene a 5 días (configurable). Registra el pago inicial." },
            {
              title: "IVA, si lo pide el cliente",
              body: "**Agregar IVA** lo suma al total, después de descuentos y sin el delivery. El detalle del pedido muestra cuánto IVA incluye. No es ingreso: los resultados lo muestran aparte.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "¿Reservar o producir todo?",
          body:
            "**Reservar y producir lo que falta** aparta lo que ya hay en inventario (deja de estar disponible) y fabrica solo el resto. **Producir todo desde cero** no toca el inventario: sirve para que todas las piezas salgan de la misma tela.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "¿El cliente aceptó un presupuesto?",
          body:
            "No lo registres a mano: en el presupuesto aceptado toca **Convertir en pedido** y se copian las líneas, la personalización, los precios y el IVA. El pedido muestra de qué presupuesto salió.",
        },
      ],
    },
    {
      id: "abono",
      heading: "El abono",
      blocks: [
        {
          kind: "example",
          title: "Dos pedidos (umbral 500 USD, abono 60%)",
          rows: [
            { label: "Pedido de 300 USD", value: "Paga 300 para empezar", note: "Por debajo del umbral: pago completo." },
            { label: "Pedido de 800 USD", value: "Paga 480 para empezar", note: "El 60%. Los 320 restantes al entregar." },
          ],
          conclusion:
            "Sin el abono, el pedido queda registrado pero **no pasa a producción**. Owner o admin pueden autorizar producir sin el abono completo, con motivo.",
        },
      ],
    },
    {
      id: "personalizacion",
      heading: "Personalización",
      blocks: [
        {
          kind: "effects",
          items: [
            { icon: PaletteIcon, title: "Nombre bordado", effect: "Un texto para todas las piezas o un nombre por pieza (pega la lista)." },
            { icon: PaletteIcon, title: "Logo de bolsillo", effect: "Bordado de hasta 8 cm. Más grande se considera logo de pecho." },
            { icon: PaletteIcon, title: "Logo estampado y de pecho", effect: "Con el archivo del logo, su posición y medida." },
          ],
        },
        {
          kind: "text",
          body:
            "Cada tipo tiene un **precio por pieza** en USD (igual para todos los métodos de pago), un **mínimo de piezas** por pedido y su propio **descuento al mayor**. Se configuran en Configuración → Pedidos y personalización.",
        },
      ],
    },
    {
      id: "etapas",
      heading: "Las etapas",
      blocks: [
        {
          kind: "timeline",
          title: "Por dónde pasa cada línea",
          steps: [
            { title: "Por producir", detail: "Esperando el abono o el turno." },
            { title: "Corte", detail: "Al terminar se descuenta la tela." },
            { title: "Confección" },
            { title: "Personalización", detail: "Solo si la lleva." },
            { title: "Revisión" },
            { title: "Empaque" },
            { title: "Listo para entregar" },
          ],
          note: "Lo que sale del inventario no se corta ni se cose: salta directo a revisión. Cada cambio queda registrado con quién y cuándo.",
        },
        {
          kind: "steps",
          items: [
            { title: "Avanzar", body: "En el pedido o en el **Tablero**, el botón con el nombre de la siguiente etapa." },
            { title: "Asignar", body: "Cada etapa se pone a nombre de una persona del equipo o de un **taller** (con su fecha estimada)." },
            { title: "A destajo", body: "Si quien la tiene cobra por pieza, al terminar la etapa se le cuentan las piezas." },
          ],
        },
      ],
    },
    {
      id: "produccion",
      heading: "Ver la producción",
      blocks: [
        {
          kind: "effects",
          items: [
            { icon: KanbanIcon, title: "Tablero", effect: "Una columna por etapa; los atrasados resaltados. En el celular se desliza de lado." },
            { icon: UsersRoundIcon, title: "Quién tiene qué", effect: "Lo asignado a cada persona o taller, y lo que nadie tiene todavía." },
            { icon: FactoryIcon, title: "Talleres atrasados", effect: "Si pasó su fecha estimada, aparecen marcados." },
            { icon: RulerIcon, title: "Material necesario", effect: "'Necesitas 32 m de tela negra y tienes 20': calculado solo con las recetas. El número en el menú dice cuántos materiales faltan." },
          ],
        },
      ],
    },
    {
      id: "entregar",
      heading: "Entregar",
      blocks: [
        {
          kind: "text",
          body:
            "Se entrega **el pedido completo**, cuando todas las líneas están listas. Si queda saldo, el sistema pide registrar el pago; si no se paga, solo owner o admin pueden confirmar la entrega, con motivo.",
        },
      ],
    },
    {
      id: "cancelar",
      heading: "Cancelar",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Antes del corte", body: "Cualquiera cancela. Se devuelve todo lo pagado." },
            {
              title: "Después del corte",
              body: "Solo owner o admin. El sistema sugiere no devolver lo gastado en **materiales y talleres**; ellos confirman el monto.",
            },
          ],
        },
        {
          kind: "effects",
          items: [
            { icon: HandCoinsIcon, title: "Reembolso", effect: "Cada pago vuelve en su moneda y a su cuenta: Bs como Bs, USD como USD, USDT como USDT." },
            { icon: BoxesIcon, title: "Inventario", effect: "Lo que estaba apartado vuelve a estar disponible." },
            { icon: LockIcon, title: "Cliente bloqueado", effect: "Regla de negocio: quien cancela con reembolso no puede volver a comprar.", chapter: "clientes" },
            { icon: CircleSlashIcon, title: "Resultados", effect: "La venta deja de contar; lo retenido queda como ingreso." },
          ],
        },
      ],
    },
    {
      id: "avisar",
      heading: "Avisar al cliente por WhatsApp",
      blocks: [
        {
          kind: "timeline",
          title: "Mensajes según el estado del pedido",
          steps: [
            { title: "Pedido confirmado", detail: "Total, abono para empezar, lo pagado y la fecha de entrega." },
            { title: "Pedido listo", detail: "Aparece cuando el pedido está listo: el saldo para entregarlo." },
            { title: "Pedido cancelado", detail: "Aparece al cancelarlo: el reembolso en la moneda en que pagó (Bs, USD o USDT)." },
          ],
          note: "La nota de entrega se puede mandar en cualquier momento. El texto de cada mensaje se cambia en Configuración.",
        },
      ],
    },
    {
      id: "conexiones",
      heading: "Con qué se conecta",
      blocks: [
        {
          kind: "connections",
          center: { icon: ClipboardListIcon, title: "Pedidos" },
          inputs: [
            { icon: ShoppingBagIcon, title: "Ventas", effect: "Un pedido es una venta", chapter: "ventas" },
            { icon: PaletteIcon, title: "Configuración", effect: "Abono, fecha y precios de personalización", chapter: "configuracion" },
            { icon: ScissorsIcon, title: "Recetas", effect: "Cuánta tela lleva cada pieza", chapter: "inventario" },
          ],
          outputs: [
            { icon: BoxesIcon, title: "Inventario", effect: "Aparta piezas y consume tela", chapter: "inventario" },
            { icon: UsersRoundIcon, title: "Equipo", effect: "Piezas a destajo", chapter: "equipo" },
            { icon: FactoryIcon, title: "Compras", effect: "Servicios de taller del pedido", chapter: "compras" },
            { icon: BanknoteIcon, title: "Tesorería", effect: "Abonos, pagos y reembolsos", chapter: "tesoreria" },
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
            { role: "staff", can: "Registra pedidos, cobra, avanza y asigna etapas, entrega pedidos pagados y cancela antes del corte." },
            { role: "admin", can: "Todo lo anterior, más autorizar producir sin abono, entregar con saldo y cancelar después del corte." },
            { role: "owner", can: "Igual que admin." },
          ],
        },
      ],
    },
  ],
}
