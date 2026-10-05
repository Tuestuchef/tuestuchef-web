import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  CoinsIcon,
  CreditCardIcon,
  KeyRoundIcon,
  LandmarkIcon,
  MailIcon,
  PaletteIcon,
  PercentIcon,
  RulerIcon,
  SettingsIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  SproutIcon,
  TagsIcon,
  UserCogIcon,
  UserXIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const SETTINGS_CHAPTER: ManualChapter = {
  slug: "configuracion",
  area: "configuracion",
  title: "Configuración",
  summary:
    "Las reglas que usan todos los módulos: quién entra y con qué rol, las cuentas, los métodos de pago, las categorías del dinero y del catálogo, y los límites de staff.",
  icon: SettingsIcon,
  roles: ROLE_GROUPS.MANAGEMENT,
  screens: [
    { title: "Usuarios", url: ROUTES.SETTINGS_USERS, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Reglas de venta", url: ROUTES.SETTINGS_SALES, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Pedidos y personalización", url: ROUTES.SETTINGS_ORDERS, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Cuentas", url: ROUTES.SETTINGS_ACCOUNTS, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Métodos de pago", url: ROUTES.SETTINGS_PAYMENT_METHODS, roles: ROLE_GROUPS.MANAGEMENT },
    { title: "Categorías de dinero", url: ROUTES.SETTINGS_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["tesoreria", "ventas", "inventario", "resultados"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "Las **reglas del sistema**. Casi nunca se tocan, pero de ellas depende todo lo demás: a qué cuenta llega un pago, cómo cuenta un gasto en la utilidad o qué código lleva una prenda. Solo owner y admin la ven.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "Cambiar una regla no cambia el pasado",
          body:
            "Lo ya registrado guarda lo que valía en su momento (tasa, cuenta, categoría, SKU). Una regla nueva aplica desde ahora.",
        },
      ],
    },
    {
      id: "usuarios",
      heading: "Usuarios y roles",
      blocks: [
        {
          kind: "text",
          body:
            "Nadie tiene trato especial: todos son usuarios y lo que cambia es el **rol**. Los permisos los aplica la base de datos, no solo la pantalla: lo que un rol no puede ver, no le llega.",
        },
        {
          kind: "roles",
          items: [
            { role: "owner", can: "Ve y hace todo, incluido invitar o cambiar admins." },
            { role: "admin", can: "Gestión completa del negocio. Solo puede invitar o cambiar usuarios staff." },
            {
              role: "staff",
              can: "Registra ventas, gastos permitidos, compras de contado y producción. Sin sueldos, retiros, totales ni configuración.",
            },
          ],
        },
        {
          kind: "effects",
          items: [
            { icon: MailIcon, title: "Sin contraseñas", effect: "Se entra con un código que llega al correo." },
            { icon: KeyRoundIcon, title: "2FA para owner y admin", effect: "Además del código, una app autenticadora en el teléfono." },
            { icon: CalendarClockIcon, title: "Sesión de 30 días", effect: "En cada dispositivo; después se pide el código otra vez." },
            { icon: UserXIcon, title: "Desactivar, no borrar", effect: "Un usuario desactivado no puede pedir ni usar códigos." },
          ],
        },
      ],
    },
    {
      id: "cuentas",
      heading: "Cuentas y métodos de pago",
      blocks: [
        {
          kind: "text",
          body:
            "Una [[cuenta]] es donde vive el dinero, en una sola moneda (Bs, USD efectivo, Zelle o USDT). Un **método de pago** es cómo paga el cliente, y dice **a qué cuenta llega** y **con qué tasa** se convierte.",
        },
        {
          kind: "flow",
          title: "El camino de un pago",
          nodes: [
            { icon: ShoppingBagIcon, title: "El cliente paga por pago móvil", detail: "Precio de ese método: 28 USD." },
            { icon: CreditCardIcon, title: "Método Pago móvil", detail: "Cobra en Bs con tasa BCV dólar." },
            { icon: LandmarkIcon, title: "Cuenta Banco (Bs)", detail: "Ahí entran los 1.120 Bs.", chapter: "tesoreria" },
          ],
        },
        {
          kind: "text",
          body:
            "USD efectivo, Zelle y USDT no llevan tasa. Una cuenta o método inactivo deja de aparecer para registrar, pero conserva su historia.",
        },
      ],
    },
    {
      id: "categorias",
      heading: "Categorías de dinero: cómo cuenta cada cosa",
      blocks: [
        {
          kind: "text",
          body:
            "Cada ingreso o gasto lleva una [[categoria]], y cada categoría es de un **tipo**. El tipo decide qué le pasa en la [[utilidad-real]]. Se pueden crear categorías nuevas (p. ej. “Publicidad”), pero siempre de uno de estos tipos:",
        },
        {
          kind: "effects",
          items: [
            { icon: ArrowDownLeftIcon, title: "Ventas · Otros ingresos", effect: "Suman: son los ingresos reales." },
            { icon: ArrowUpRightIcon, title: "Costo", effect: "Resta: lo necesario para producir y vender (tela, botones, alquiler)." },
            { icon: ArrowUpRightIcon, title: "Gasto operativo", effect: "Resta: lo que mantiene el negocio funcionando." },
            { icon: ArrowUpRightIcon, title: "Comisión de cambio · Impuesto", effect: "Restan. La comisión la registra el sistema solo." },
            { icon: ArrowUpRightIcon, title: "Sueldo · Retiro o adelanto", effect: "Restan: dinero hacia una persona, con su nombre." },
            { icon: SproutIcon, title: "Reinversión · Reparto de utilidades", effect: "No restan antes: salen de la utilidad, después." },
            { icon: CoinsIcon, title: "Aporte de capital", effect: "No es ingreso: es dinero que el dueño mete al negocio." },
          ],
        },
        {
          kind: "text",
          body: "“Ventas” y “Comisión de cambio” son del sistema y no se editan. Staff solo puede usar categorías de ventas, otros ingresos, costo y gasto operativo.",
        },
      ],
    },
    {
      id: "catalogo",
      heading: "Categorías de producto, tallas y colores",
      blocks: [
        {
          kind: "text",
          body:
            "Son las listas del catálogo. Su **código** forma el SKU de cada variante (ver el capítulo de Inventario). Cambiar un código no modifica los SKU que ya existen.",
        },
        {
          kind: "effects",
          items: [
            { icon: TagsIcon, title: "Categorías de producto", effect: "Filipinas (FIL), Delantales (DEL)… Primera parte del SKU.", chapter: "inventario" },
            { icon: RulerIcon, title: "Tallas", effect: "S, M, L, XL… en el orden en que se muestran. Opcionales por variante." },
            { icon: PaletteIcon, title: "Colores", effect: "Negro (NEG), Vinotinta (VIN)… También se usan en fotos y recetas." },
          ],
        },
      ],
    },
    {
      id: "reglas",
      heading: "Reglas de venta",
      blocks: [
        {
          kind: "effects",
          items: [
            {
              icon: PercentIcon,
              title: "Descuento máximo de staff",
              effect: "Por encima de este %, solo owner o admin pueden aplicarlo (10% por defecto).",
              chapter: "ventas",
            },
            {
              icon: CalendarClockIcon,
              title: "Días hacia atrás de staff",
              effect: "Hasta cuántos días atrás staff registra ventas, pagos y movimientos (7 por defecto).",
              chapter: "ventas",
            },
          ],
        },
      ],
    },
    {
      id: "pedidos",
      heading: "Pedidos y personalización",
      blocks: [
        {
          kind: "effects",
          items: [
            {
              icon: TagsIcon,
              title: "Precios de personalización",
              effect: "Nombre bordado, logos de bolsillo, estampado y de pecho: precio por unidad en USD y mínimo de piezas. Sin precio no se pueden usar.",
            },
            {
              icon: PercentIcon,
              title: "Descuento al mayor",
              effect: "Tramos 'desde N piezas, X%' para productos y para personalización. Se aplica solo el más alto alcanzado.",
              chapter: "ventas",
            },
            {
              icon: CalendarClockIcon,
              title: "Abono y fecha prometida",
              effect: "Desde qué total se cobra abono, qué porcentaje y en cuántos días se promete por defecto.",
              chapter: "pedidos",
            },
            {
              icon: CoinsIcon,
              title: "Tarifas a destajo",
              effect: "Cuánto se paga por pieza según la categoría y la etapa.",
              chapter: "equipo",
            },
            {
              icon: ShieldCheckIcon,
              title: "Reglas del negocio",
              effect: "Todos las leen en Ayuda; owner y admin las escriben. Unas las aplica el sistema solo.",
            },
          ],
        },
      ],
    },
    {
      id: "conexiones",
      heading: "A quién afecta",
      blocks: [
        {
          kind: "connections",
          center: { icon: SettingsIcon, title: "Configuración" },
          inputs: [
            { icon: UserCogIcon, title: "Owner y admin", effect: "Son los únicos que la cambian" },
            { icon: ShieldCheckIcon, title: "Seguridad", effect: "Códigos por correo y 2FA" },
          ],
          outputs: [
            { icon: ShoppingBagIcon, title: "Ventas", effect: "Métodos, precios por método y límites de staff", chapter: "ventas" },
            { icon: LandmarkIcon, title: "Tesorería", effect: "Cuentas y categorías del dinero", chapter: "tesoreria" },
            { icon: TagsIcon, title: "Inventario", effect: "Códigos del SKU", chapter: "inventario" },
            { icon: SproutIcon, title: "Resultados", effect: "Cómo cuenta cada categoría", chapter: "resultados" },
          ],
        },
      ],
    },
  ],
}
