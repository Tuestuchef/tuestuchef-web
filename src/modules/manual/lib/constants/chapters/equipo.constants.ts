import {
  BanknoteIcon,
  ChartColumnIcon,
  FileSignatureIcon,
  HandCoinsIcon,
  LinkIcon,
  ListIcon,
  UserPlusIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const TEAM_CHAPTER: ManualChapter = {
  slug: "equipo",
  area: "rrhh",
  title: "Equipo, sueldos y adelantos",
  summary:
    "Quién trabaja en el negocio, cuánto gana, qué se le ha pagado y qué adelantos le faltan por descontar. Aquí se separa el dinero del negocio del dinero de cada persona, incluido el dueño.",
  icon: UsersRoundIcon,
  roles: ROLE_GROUPS.MANAGEMENT,
  screens: [{ title: "Equipo", url: ROUTES.TEAM, roles: ROLE_GROUPS.MANAGEMENT }],
  related: ["tesoreria", "resultados", "configuracion"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "El área de **recursos humanos**. Cada persona que recibe dinero del negocio está aquí: la costurera, quien vende, quien despacha y **el dueño**. No hace falta que tenga usuario en el sistema.",
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Nadie “toma prestado” de la caja",
          body:
            "Todo dinero que sale del negocio hacia una persona del equipo es **sueldo**, **adelanto** o **retiro**, siempre con su nombre. Así se sabe cuánto cuesta de verdad el equipo y la utilidad no miente. Ver [[negocio]].",
        },
      ],
    },
    {
      id: "pasos",
      heading: "De la contratación al pago",
      blocks: [
        {
          kind: "flow",
          nodes: [
            { icon: UserPlusIcon, title: "Agregar a la persona", detail: "Nombre, cargo y contacto." },
            { icon: FileSignatureIcon, title: "Definir su sueldo", detail: "Monto, moneda y frecuencia (semanal, quincenal o mensual). Puede ser en Bs, dólares, USDT, o en dólares o euros a tasa BCV (se paga en Bs con la tasa del día)." },
            { icon: HandCoinsIcon, title: "Adelantos", detail: "Si pide dinero antes, queda pendiente." },
            { icon: BanknoteIcon, title: "Pagar el sueldo", detail: "Se descuentan los adelantos y sale el neto." },
          ],
        },
        {
          kind: "text",
          body:
            "Un sueldo nuevo **no edita** el anterior: se agrega otro con su fecha de inicio. Así queda la historia de cuánto ganaba cada quien en cada momento.",
        },
      ],
    },
    {
      id: "adelantos",
      heading: "Adelantos y pago neto",
      blocks: [
        {
          kind: "example",
          title: "La quincena de María (150 USD quincenales)",
          rows: [
            { label: "Día 10: pide un adelanto", value: "40,00 USD", note: "Sale de la caja y queda pendiente." },
            { label: "Día 15: sueldo de la quincena", value: "150,00 USD" },
            { label: "− Adelanto marcado para descontar", value: "−40,00 USD" },
            { label: "Neto que se le paga", value: "110,00 USD", total: true },
          ],
          conclusion:
            "Al pagar, el sistema muestra los adelantos pendientes y sugiere el neto. En total María recibió 150: el adelanto y el pago juntos.",
        },
        {
          kind: "timeline",
          title: "Vida de un adelanto",
          steps: [
            { title: "Se entrega", detail: "Sale dinero de una cuenta." },
            { title: "Pendiente", detail: "Aparece en la ficha de la persona." },
            { title: "Descontado", detail: "Se marca en el próximo pago de sueldo." },
          ],
        },
        {
          kind: "text",
          body:
            "Si el pago es en Bs, su equivalente en dólares usa la [[tasa-bcv]] de la fecha del pago; su [[valor-real]], como siempre, la paralela.",
        },
      ],
    },
    {
      id: "dinero",
      heading: "A dónde va el dinero",
      blocks: [
        {
          kind: "effects",
          items: [
            { icon: WalletIcon, title: "Cuentas", effect: "Cada pago o adelanto es una salida de la cuenta elegida.", chapter: "tesoreria" },
            { icon: ListIcon, title: "Movimientos", effect: "Quedan con categoría Sueldos y el nombre de la persona.", chapter: "tesoreria" },
            { icon: ChartColumnIcon, title: "Utilidad real", effect: "Sueldos, adelantos y retiros restan, incluido el del dueño.", chapter: "resultados" },
            { icon: UsersRoundIcon, title: "Personas", effect: "Resultados muestra cuánto recibió cada una en el período.", chapter: "resultados" },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "El sueldo del dueño también cuenta",
          body:
            "Si el dueño no se registra un sueldo, la utilidad parece más grande de lo que es. Lo que el dueño saca de más se registra como **retiro** con su nombre.",
        },
      ],
    },
    {
      id: "destajo",
      heading: "Pago por pieza (destajo)",
      blocks: [
        {
          kind: "text",
          body:
            "Cada persona cobra por **sueldo**, por **pieza** ([[destajo]]) o **ambos**. Las tarifas van por categoría de producto y etapa, en Configuración → Tarifas a destajo.",
        },
        {
          kind: "example",
          title: "María corta 20 filipinas (tarifa de corte: 0,50 USD)",
          rows: [
            { label: "Piezas contadas al terminar el corte", value: "20" },
            { label: "Tarifa", value: "0,50 USD" },
            { label: "Le corresponde", value: "10,00 USD", total: true },
          ],
          conclusion: "En su ficha: **Pagar destajo**. Se registra como sueldo y se pueden descontar adelantos.",
        },
      ],
    },
    {
      id: "usuario",
      heading: "Personas con usuario",
      blocks: [
        {
          kind: "text",
          body:
            "Si la persona entra al panel, vincula su ficha con su usuario: sus sueldos y retiros quedan unidos a su cuenta. Una costurera que no usa el sistema puede estar en el equipo sin usuario.",
        },
        {
          kind: "effects",
          items: [{ icon: LinkIcon, title: "Vincular", effect: "En la ficha de la persona, elige su usuario.", chapter: "configuracion" }],
        },
      ],
    },
    {
      id: "corregir",
      heading: "Corregir un error",
      blocks: [
        {
          kind: "text",
          body:
            "Un pago o adelanto mal registrado se [[revertir|revierte]] en **Tesorería → Movimientos** (owner o admin), con motivo. Un adelanto revertido deja de estar pendiente.",
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
            { role: "admin", can: "Agrega personas, define sueldos, paga sueldos y adelantos, y registra retiros." },
            { role: "owner", can: "Igual que admin." },
          ],
        },
        { kind: "text", body: "Staff no ve sueldos, adelantos ni retiros de nadie: la base de datos no se los entrega." },
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
              question: "Le subimos el sueldo a alguien, ¿lo edito?",
              answer: "No: agrega un sueldo nuevo con la fecha desde la que aplica. El anterior queda en la historia.",
            },
            {
              question: "El dueño sacó 100 USD de la caja para algo personal.",
              answer: "Regístralo como retiro con su nombre (Gasto o ingreso, categoría Retiro o adelanto). Nunca como préstamo.",
            },
            {
              question: "¿Le pago a alguien que no tiene usuario?",
              answer: "Sí. Agrégalo al equipo sin usuario; solo hace falta su nombre.",
            },
          ],
        },
      ],
    },
  ],
}
