import { CheckIcon, FilePenLineIcon, FileTextIcon, SendIcon } from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const QUOTES_CHAPTER: ManualChapter = {
  slug: "presupuestos",
  area: "comercial",
  title: "Presupuestos",
  summary:
    "Cotizaciones para empresas (restaurantes, escuelas, hoteles) y pedidos grandes: con la marca, en USD, Bs o ambos, con IVA si hace falta. Un presupuesto no es una factura.",
  icon: FileTextIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Presupuestos", url: ROUTES.QUOTES, roles: ROLE_GROUPS.ALL },
    { title: "Nuevo presupuesto", url: ROUTES.NEW_QUOTE, roles: ROLE_GROUPS.ALL },
    { title: "Configuración de presupuestos", url: ROUTES.SETTINGS_QUOTES, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["clientes", "pedidos", "ventas", "configuracion"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "Un presupuesto le dice al cliente **cuánto le costaría** un pedido antes de hacerlo. No mueve dinero ni inventario: solo cuando el cliente acepta se convierte en un pedido.",
        },
        {
          kind: "flow",
          title: "La vida de un presupuesto",
          nodes: [
            { icon: FilePenLineIcon, title: "Borrador", detail: "Se arma y se ajusta todo lo que haga falta." },
            { icon: SendIcon, title: "Enviado", detail: "Queda congelado: el cliente lo tiene." },
            { icon: CheckIcon, title: "Aceptado", detail: "Listo para convertirse en pedido." },
          ],
        },
      ],
    },
    {
      id: "crear",
      heading: "Cómo se hace",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Cliente", body: "Elige uno guardado o escribe solo el nombre (el resto es opcional). A un cliente bloqueado no se le hacen presupuestos." },
            { title: "Monedas y listas", body: "USD, Bs o ambas. Cada moneda sale de la **lista de precios** de un método de pago." },
            { title: "Productos", body: "Con su color y talla, combos y personalización (nombre bordado, logos). Los nombres y el logo se piden después, en el pedido." },
            { title: "Descuentos", body: "Por línea o del presupuesto, siempre con motivo. Staff tiene el mismo límite que en ventas." },
            { title: "IVA, IGTF y tallas", body: "IVA opcional sobre el total; la nota de IGTF es solo texto; **agrupar por talla** junta las tallas de un mismo producto en una fila." },
            { title: "Guarda el borrador", body: "La fecha, la tasa y los precios se actualizan cada vez que lo guardas." },
          ],
        },
      ],
    },
    {
      id: "precios",
      heading: "Precios y monedas",
      blocks: [
        {
          kind: "example",
          title: "10 filipinas: lista USD 25, lista en Bs 28, tramo al mayor 5%, IVA 16%, tasa BCV 40",
          rows: [
            { label: "USD: 10 × 25 − 5% al mayor", value: "237,50 USD" },
            { label: "USD + IVA 16%", value: "275,50 USD", total: true },
            { label: "Bs: 10 × 28 − 5% al mayor + IVA", value: "308,56 USD de referencia" },
            { label: "En bolívares (× 40)", value: "Bs 12.342,40", total: true },
          ],
          conclusion:
            "Cada moneda sale de **su propia lista**: el monto en Bs nunca es el de dólares convertido. Los Bs son referenciales a la tasa BCV del día del presupuesto, que queda guardada.",
        },
      ],
    },
    {
      id: "estados",
      heading: "Estados y versiones",
      blocks: [
        {
          kind: "timeline",
          title: "Estados",
          steps: [
            { title: "Borrador", detail: "Se edita. Si no se va a enviar, se **descarta** con motivo (no se borra: la numeración no deja huecos)." },
            { title: "Enviado", detail: "Congelado. Para enviarlo, el borrador debe ser de hoy (precios y tasa del día)." },
            { title: "Aceptado o rechazado", detail: "Se marca a mano cuando el cliente responde." },
            { title: "Vencido", detail: "Se marca solo al pasar la fecha de vencimiento." },
          ],
          note: "Cada cambio queda en el historial con quién y cuándo.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "¿Hay que cambiar uno ya enviado?",
          body:
            "Usa **Nueva versión**: crea un borrador con el mismo número (TLT00042-v2) y el anterior queda como **reemplazado**, sin cambios. **Duplicar** crea un presupuesto nuevo, con número propio y precios de hoy.",
        },
      ],
    },
    {
      id: "pdf",
      heading: "El PDF",
      blocks: [
        {
          kind: "text",
          body:
            "Arriba va la **imagen del encabezado** (la de Configuración → Datos de la empresa, u otra solo para ese presupuesto) con los datos de la empresa, el número, la fecha, el vencimiento y el total; luego el cliente, la tabla de artículos, los totales y las condiciones. Sin imagen, sale el monograma de la marca.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "El PDF enviado no cambia",
          body:
            "En borrador, el PDF lleva la marca **BORRADOR** y se genera al momento. Al enviarlo se guarda el **PDF oficial** en el archivo privado de la empresa: es exactamente lo que recibió el cliente, aunque después cambien precios, datos o la imagen.",
        },
      ],
    },
    {
      id: "enviar",
      heading: "Enviarlo al cliente",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Toca Enviar", body: "En un borrador lo congela y guarda su PDF oficial. En uno ya enviado, **Reenviar** manda el mismo PDF." },
            {
              title: "Por correo",
              body: "Sale del correo del sistema con el **PDF adjunto** y un enlace para verlo. Si el cliente responde, le llega a quien preparó el presupuesto.",
            },
            {
              title: "Por WhatsApp",
              body: "Se abre WhatsApp con el mensaje (su texto se cambia en Configuración → Mensajes de WhatsApp) y el enlace al PDF. Toca enviar allá.",
            },
            { title: "Solo marcar como enviado", body: "Si se lo entregaste de otra forma (impreso, por otro medio)." },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "El enlace del cliente",
          body:
            "Abre el PDF sin descargar nada y sin entrar al sistema. Funciona hasta **30 días después del vencimiento**, no aparece en buscadores y tiene un límite de aperturas. Si se envió a quien no era, **Revócalo**. En el detalle se ve cuántas veces se abrió, y cada envío queda en **Mensajes enviados**.",
        },
      ],
    },
    {
      id: "convertir",
      heading: "Convertirlo en pedido",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Márcalo aceptado", body: "Cuando el cliente confirma, toca **Aceptado** en el presupuesto." },
            {
              title: "Convertir en pedido",
              body: "Copia el cliente, las líneas, los combos, la personalización y **los precios del presupuesto**, aunque la lista haya cambiado después. Si el presupuesto lleva IVA, el pedido también.",
            },
            {
              title: "Completa lo que falta",
              body: "El cliente guardado (si solo tenía nombre), con qué lista paga si tenía USD y Bs, el inventario, la fecha prometida y los nombres o logos de la personalización.",
            },
            { title: "El pedido sigue su camino", body: "Con la regla de abono de siempre. El pedido muestra de qué presupuesto salió y el presupuesto enlaza a su pedido." },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Cobra exactamente lo aceptado",
          body: "Si por cualquier motivo el total del pedido no coincidiera con el del presupuesto, no se convierte. Y un presupuesto se convierte **una sola vez**.",
        },
      ],
    },
    {
      id: "quien",
      heading: "Quién puede qué",
      blocks: [
        {
          kind: "roles",
          items: [
            { role: "owner", can: "Todo, más la configuración: numeración, vigencia, listas de precios, IVA, condiciones y datos de la empresa." },
            { role: "admin", can: "Igual que owner." },
            { role: "staff", can: "Crea, envía y ve todos los presupuestos. Descuentos hasta su límite." },
          ],
        },
      ],
    },
  ],
}
