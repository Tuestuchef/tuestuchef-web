import {
  BanknoteIcon,
  BookOpenIcon,
  ChartColumnIcon,
  CircleDollarSignIcon,
  ContactRoundIcon,
  HandCoinsIcon,
  LandmarkIcon,
  PackageIcon,
  PhoneIcon,
  ReceiptTextIcon,
  ScissorsIcon,
  ShoppingBagIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  TagIcon,
  UserRoundIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

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
    { title: "Ventas pendientes", url: ROUTES.OFFLINE_SALES, roles: ROLE_GROUPS.ALL },
    { title: "Calculadora de precios", url: ROUTES.PRICE_CALCULATOR, roles: ROLE_GROUPS.ALL },
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
          body: "Está pensado para hacerse desde el celular en menos de 20 segundos. Toca **Registrar venta**, el botón principal arriba del menú (también está en Inicio):",
        },
        {
          kind: "steps",
          items: [
            {
              title: "Agrega los productos",
              body: "Busca el producto (también por color, talla o código: \"filipina 3/4 dama negra\") y tócalo: eliges el **género**, el **color** y la **talla** con botones, ves el precio y el stock, y la cantidad. **Agregar y elegir otra** suma otra combinación sin cerrar. En el carrito ajustas la cantidad con + y −.",
            },
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
      id: "sin-conexion",
      heading: "Vender sin señal",
      blocks: [
        {
          kind: "text",
          body:
            "Si se va el internet, **Nueva venta** sigue abriendo (con los precios y la tasa de la última vez que hubo señal). La venta se guarda en el teléfono y arriba aparece cuántas faltan por enviar. Las demás pantallas muestran un aviso de sin conexión.",
        },
        {
          kind: "timeline",
          title: "Lo que pasa con una venta sin señal",
          steps: [
            { title: "Se guarda en el teléfono", detail: "Con la hora real en que se hizo. El formulario queda listo para la siguiente." },
            { title: "Vuelve la señal", detail: "Se envía sola (o con Enviar ahora). Si ya se había enviado, no se duplica." },
            { title: "Se revisa de nuevo", detail: "Stock, cliente bloqueado, tasa de esa fecha y días hacia atrás, como cualquier venta." },
            { title: "Queda registrada o pendiente", detail: "Si algo no pasa, va a Ventas pendientes con su motivo. Nunca se pierde." },
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "No cierres sesión con ventas por enviar",
          body:
            "Las ventas guardadas viven en ese teléfono hasta que se envían. En Ventas pendientes, owner o admin reintentan (por ejemplo, cuando ya hay stock) o descartan con motivo; staff ve solo las suyas. El número junto a **Ventas pendientes** en el menú suma las guardadas en ese teléfono y las que no pasaron.",
        },
      ],
    },
    {
      id: "whatsapp",
      heading: "Mandar la nota por WhatsApp",
      blocks: [
        {
          kind: "text",
          body:
            "En la venta, **WhatsApp** prepara la nota de entrega con los productos, el total y lo pendiente. Revísala, toca **Abrir WhatsApp** y envíala allá (si el cliente no tiene teléfono, WhatsApp te deja elegir el contacto). Queda en **Mensajes enviados**, al final de la venta.",
        },
      ],
    },
    {
      id: "calculadora",
      heading: "¿Cuánto cuesta? La calculadora",
      blocks: [
        {
          kind: "text",
          body:
            "Para contestar rápido \"¿cuánto cuesta la filipina vinotinto y el gorro de sushi?\": abre **Comercial → Calculadora** (o la flecha junto a **Registrar venta** → **Calcular un precio**), busca o toca los productos y abajo sale el total **por método de pago**, cada uno en su moneda. No registra nada: no es una venta ni un presupuesto.",
        },
        {
          kind: "steps",
          items: [
            { title: "Toca los productos", body: "Cada toque suma uno. La búsqueda encuentra también colores (\"vinotinto\"). En la lista cambias la cantidad con − y +." },
            {
              title: "Lee el total de cada método",
              body: "Cada método usa su propia lista de precios: los Bs salen del precio de ese método × la tasa BCV de hoy, igual que al vender. Los métodos que dan lo mismo van juntos (\"Efectivo / Zelle\"). El descuento al mayor se aplica solo.",
            },
            {
              title: "Elige talla o color, si cobran extra",
              body: "Si un producto cobra extra en alguna talla (p. ej. 3XL) o color (p. ej. pata de gallo), debajo de él aparecen esas opciones. Tócala si el cliente ya la pidió: el total la incluye. **Otra talla o color** agrega otra línea del mismo producto (p. ej. 2 en M y 1 en 4XL). En un combo, la opción suma lo de todas sus piezas (3XL: filipina +$3 y pantalón +$2 = +$5). Si el producto se hace en dama y caballero, toca primero el **género**: las tallas con recargo dependen de él (y si no lo eliges, el mensaje avisa los extras de cada uno).",
            },
            {
              title: "Copia para WhatsApp",
              body: "**Copiar para WhatsApp** arma la respuesta, lista para pegar: el título \"Tuestuchef - Lista de Precios\", los productos (con la talla o el color elegido) y el total en Bs (pago móvil) y en **USD** (el precio en efectivo). Lo que cobra extra y no se eligió va al final como **Opcional**, en USD y en Bs (p. ej. \"Pantalón jogger en pata de gallo: +$ 2,00\"). Zelle y USDT no van en el mensaje: si el cliente los pide, están en pantalla.",
            },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "¿Y si el cliente se decide?",
          body: "Registra la venta como siempre en **Nueva venta**, o un **presupuesto** si necesita algo formal. La lista de la calculadora queda en ese navegador hasta que la vacíes.",
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
            { label: "Diferencia por cobrar en Bs", value: "−5,60 USDT", note: "Se ve en Gestión → Resultados → Tasa." },
          ],
          conclusion:
            "La misma filipina **en efectivo a 25 USD vale 25 USDT**: más que por pago móvil, aunque el precio sea menor. Para eso existe el precio por método.",
        },
        {
          kind: "money-split",
          title: "Qué parte de los 28 USD llega de verdad",
          unit: "USDT",
          total: { label: "Precio", amount: 28, unit: "USD" },
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
            { title: "Confección", detail: "Se está haciendo." },
            { title: "Listo para entregar", detail: "Al llegar aquí se descuenta la materia prima de su receta (tela, botones…)." },
            { title: "Entregado", detail: "El cliente lo tiene." },
          ],
          note: "Los estados solo avanzan. Si falta materia prima del color, el sistema avisa y no deja marcarlo listo.",
        },
      ],
    },
    {
      id: "descuentos",
      heading: "Combos, descuentos y fechas pasadas",
      blocks: [
        {
          kind: "example",
          title: "4 Combos Escuela de 50 USD, con tramo de 5% desde 10 piezas",
          rows: [
            { label: "Subtotal: 4 × 50", value: "200,00 USD" },
            { label: "Piezas: 4 combos × 3 componentes", value: "12 piezas" },
            { label: "Al mayor 5%", value: "−10,00 USD" },
            { label: "Descuento manual 10% (sobre 190)", value: "−19,00 USD" },
            { label: "Total", value: "171,00 USD", total: true },
          ],
        },
        {
          kind: "steps",
          items: [
            {
              title: "Combo",
              body:
                "Al agregar un combo se elige el modelo (si acepta varios), la talla y el color de **cada pieza**; con varios combos se pueden mezclar modelos y tallas. El combo lleva el precio, la pieza con recargo (talla o color) lo suma encima y el stock se descuenta de cada pieza.",
            },
            {
              title: "Descuento al mayor",
              body:
                "Se aplica **solo** según las piezas de la venta (un combo cuenta por sus componentes). Debajo del total se ve cuántas piezas faltan para el siguiente tramo.",
            },
            {
              title: "Descuento manual",
              body:
                "En porcentaje o monto, siempre con motivo, sobre lo que queda después del descuento al mayor. Queda guardado quién lo hizo. Staff tiene un máximo (10% por defecto); por encima, solo owner o admin. El de al mayor no cuenta para ese límite.",
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

export const CUSTOMERS_CHAPTER: ManualChapter = {
  slug: "clientes",
  area: "comercial",
  title: "Clientes",
  summary:
    "La libreta de clientes del negocio: cómo contactarlos, todo lo que han comprado y lo que deben. Reemplaza los contactos sueltos del teléfono.",
  icon: ContactRoundIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Clientes", url: ROUTES.CUSTOMERS, roles: ROLE_GROUPS.ALL },
    { title: "Por cobrar", url: ROUTES.RECEIVABLES, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["ventas", "configuracion"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "Parte del área **comercial**. Cada cliente tiene su ficha: nombre, teléfono, correo, Instagram y el historial de sus compras. Es opcional en una venta: sin cliente, la venta es **rápida** (alguien que pasó por la tienda y pagó).",
        },
        {
          kind: "callout",
          tone: "info",
          title: "¿Cuándo vale la pena guardar al cliente?",
          body:
            "Cuando va a volver, cuando queda debiendo, cuando es un encargo o cuando hay que entregarle algo. Un cliente con ficha permite saber **cuánto compra**, **cuánto debe** y escribirle con un toque.",
        },
      ],
    },
    {
      id: "crear",
      heading: "Cómo se crea un cliente",
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Desde la venta o desde Clientes", body: "En Nueva venta, busca el cliente; si no existe, créalo sin salir de la venta." },
            { title: "Persona: nombre y un contacto", body: "Nombre y al menos uno: teléfono, correo o Instagram." },
            {
              title: "Empresa: la razón social",
              body: "Para restaurantes, escuelas u hoteles elige **Empresa**: basta con la razón social. RIF, persona de contacto, teléfono, correo y dirección son opcionales.",
            },
            {
              title: "Sin duplicados",
              body: "Si ese teléfono, correo, Instagram o RIF ya existe, el sistema te ofrece abrir ese cliente en vez de crear otro.",
            },
            { title: "Cédula, solo si hace falta", body: "Es un dato personal: pídela solo cuando sea necesaria (ver abajo)." },
          ],
        },
      ],
    },
    {
      id: "ficha",
      heading: "Qué tiene la ficha",
      blocks: [
        {
          kind: "effects",
          items: [
            { icon: PhoneIcon, title: "Contacto directo", effect: "Llamar, escribir por WhatsApp o abrir su Instagram con un toque." },
            { icon: ShoppingBagIcon, title: "Historial", effect: "Todas sus compras, con su estado de pago.", chapter: "ventas" },
            { icon: HandCoinsIcon, title: "Lo que debe", effect: "Sus ventas con saldo aparecen en Por cobrar, agrupadas por cliente." },
            { icon: ShieldCheckIcon, title: "Cédula protegida", effect: "Cualquiera la puede registrar, pero solo owner y admin la ven." },
          ],
        },
      ],
    },
    {
      id: "por-cobrar",
      heading: "Por cobrar: quién nos debe",
      roles: ROLE_GROUPS.MANAGEMENT,
      blocks: [
        {
          kind: "text",
          body:
            "**Comercial → Por cobrar** junta todas las ventas con saldo, **por cliente**: cuánto debe en total y desde cuándo (su deuda más antigua). Las ventas rápidas sin cliente que quedaron debiendo aparecen aparte. No se registra nada aquí: se calcula solo desde las ventas. El número junto a **Por cobrar** en el menú dice cuántas ventas tienen saldo.",
        },
        {
          kind: "example",
          title: "Lo que se ve en Por cobrar",
          rows: [
            { label: "Restaurante La Sazón · 3 ventas", value: "84,00 USD", note: "La más antigua, hace 18 días." },
            { label: "Valentina Rojas · 1 venta", value: "14,00 USD", note: "Abonó la mitad hace 6 días." },
            { label: "Ventas rápidas sin cliente", value: "22,00 USD" },
            { label: "Total por cobrar", value: "120,00 USD", total: true },
          ],
          conclusion:
            "El saldo vive en dólares de referencia. Cuando el cliente paga en Bs, se usa la tasa BCV **del día en que paga**: cuanto más se tarda, más valor real se puede perder.",
        },
        {
          kind: "text",
          body:
            "Junto a cada cliente, **WhatsApp** prepara un **recordatorio de pago** con su saldo y cada venta pendiente. Lo que se le envió queda en su ficha, en **Mensajes enviados**.",
        },
      ],
    },
    {
      id: "bloqueo",
      heading: "Clientes bloqueados",
      blocks: [
        {
          kind: "text",
          body:
            "Regla del negocio: un cliente que **cancela un pedido y recibe reembolso** queda [[cliente-bloqueado|bloqueado]] solo y no se le vende más. Al elegirlo en una venta o un pedido aparece un aviso y el botón no deja registrar.",
        },
        {
          kind: "steps",
          items: [
            { title: "No se puede esquivar", body: "Si alguien intenta registrarlo de nuevo con el mismo teléfono, correo o cédula, el sistema lo reconoce." },
            { title: "Desbloquear", body: "Solo owner o admin, con motivo, desde la ficha del cliente. Queda en el historial." },
          ],
        },
      ],
    },
    {
      id: "privacidad",
      heading: "Datos personales",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          title: "La cédula es un dato sensible",
          body:
            "Pídela solo cuando haga falta (por ejemplo, para un envío o una nota formal). Staff puede registrarla pero no verla después. Nunca la compartas por mensaje.",
        },
        {
          kind: "text",
          body: "Los clientes **no se borran**, porque tienen ventas. Owner o admin los desactivan si ya no se usan.",
        },
      ],
    },
    {
      id: "conexiones",
      heading: "Con qué se conecta",
      blocks: [
        {
          kind: "connections",
          center: { icon: ContactRoundIcon, title: "Clientes" },
          inputs: [{ icon: ShoppingBagIcon, title: "Ventas", effect: "Cada venta con cliente suma a su historial", chapter: "ventas" }],
          outputs: [
            { icon: HandCoinsIcon, title: "Por cobrar", effect: "Lo que debe cada cliente" },
            { icon: ReceiptTextIcon, title: "Nota de entrega", effect: "Sus datos salen en la nota y en el WhatsApp" },
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
            { role: "staff", can: "Busca, crea y edita clientes. Registra la cédula pero no la ve." },
            { role: "admin", can: "Todo lo anterior, ve la cédula, ve Por cobrar y desactiva clientes." },
            { role: "owner", can: "Igual que admin." },
          ],
        },
      ],
    },
  ],
}
