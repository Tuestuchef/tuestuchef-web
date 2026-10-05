import {
  ArrowRightLeftIcon,
  BellIcon,
  BookOpenIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  CloudOffIcon,
  ContactRoundIcon,
  FileTextIcon,
  FactoryIcon,
  FileSpreadsheetIcon,
  HandCoinsIcon,
  HouseIcon,
  KanbanIcon,
  LandmarkIcon,
  ListIcon,
  type LucideIcon,
  PackageIcon,
  PackageOpenIcon,
  ReceiptTextIcon,
  RulerIcon,
  ScaleIcon,
  ScissorsIcon,
  SettingsIcon,
  ShirtIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react"

import {
  type AppRole,
  ROLE_GROUPS,
} from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

export type NavLink = {
  title: string
  url: string
  roles: readonly AppRole[]
  // Módulo planificado pero aún no construido: se muestra deshabilitado.
  soon?: boolean
}

// Una entrada del menú: un enlace directo, o un submenú (children) para listas largas.
export type NavItem = NavLink & {
  icon: LucideIcon
  children?: readonly NavLink[]
}

// Un bloque del menú con su rótulo (el área de la administración). Sin rótulo: va arriba.
export type NavSection = {
  label?: string
  items: readonly NavItem[]
}

// Menú por área de la administración. Cada área muestra sus pantallas directamente;
// "nueva venta", "nueva compra", etc. están en el botón de registro rápido.
// Un ítem o un área sin nada visible para el rol no se muestra.
export const NAV_SECTIONS: readonly NavSection[] = [
  {
    items: [{ title: "Inicio", url: ROUTES.HOME, icon: HouseIcon, roles: ROLE_GROUPS.ALL }],
  },
  {
    label: "Comercial",
    items: [
      { title: "Ventas", url: ROUTES.SALES, icon: ShoppingBagIcon, roles: ROLE_GROUPS.ALL },
      { title: "Presupuestos", url: ROUTES.QUOTES, icon: FileTextIcon, roles: ROLE_GROUPS.ALL },
      { title: "Clientes", url: ROUTES.CUSTOMERS, icon: ContactRoundIcon, roles: ROLE_GROUPS.ALL },
      { title: "Por cobrar", url: ROUTES.RECEIVABLES, icon: HandCoinsIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Ventas pendientes", url: ROUTES.OFFLINE_SALES, icon: CloudOffIcon, roles: ROLE_GROUPS.ALL },
    ],
  },
  {
    label: "Inventario",
    items: [
      { title: "Catálogo", url: ROUTES.PRODUCTS, icon: ShirtIcon, roles: ROLE_GROUPS.ALL },
      { title: "Combos", url: ROUTES.COMBOS, icon: PackageOpenIcon, roles: ROLE_GROUPS.ALL },
      { title: "Stock", url: ROUTES.STOCK, icon: PackageIcon, roles: ROLE_GROUPS.ALL },
      { title: "Materia prima", url: ROUTES.RAW_MATERIALS, icon: ScissorsIcon, roles: ROLE_GROUPS.ALL },
    ],
  },
  {
    label: "Producción",
    items: [
      { title: "Pedidos", url: ROUTES.ORDERS, icon: ClipboardListIcon, roles: ROLE_GROUPS.ALL },
      { title: "Tablero", url: ROUTES.PRODUCTION, icon: KanbanIcon, roles: ROLE_GROUPS.ALL },
      { title: "Quién tiene qué", url: ROUTES.PRODUCTION_ASSIGNMENTS, icon: UsersIcon, roles: ROLE_GROUPS.ALL },
      { title: "Material necesario", url: ROUTES.PRODUCTION_MATERIALS, icon: RulerIcon, roles: ROLE_GROUPS.ALL },
    ],
  },
  {
    label: "Compras",
    items: [
      { title: "Compras", url: ROUTES.PURCHASES, icon: TruckIcon, roles: ROLE_GROUPS.ALL },
      { title: "Proveedores", url: ROUTES.SUPPLIERS, icon: FactoryIcon, roles: ROLE_GROUPS.ALL },
      { title: "Por pagar", url: ROUTES.PAYABLES, icon: ReceiptTextIcon, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  {
    label: "Tesorería",
    items: [
      { title: "Movimientos", url: ROUTES.MOVEMENTS, icon: ListIcon, roles: ROLE_GROUPS.ALL },
      { title: "Tasas y cuentas", url: ROUTES.TREASURY, icon: LandmarkIcon, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  {
    label: "Gestión",
    items: [
      { title: "Resultados", url: ROUTES.ANALYTICS, icon: ChartColumnIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Cierres y Excel", url: ROUTES.PERIODS, icon: FileSpreadsheetIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Equipo", url: ROUTES.TEAM, icon: UsersRoundIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Usuarios", url: ROUTES.SETTINGS_USERS, icon: UserCogIcon, roles: ROLE_GROUPS.MANAGEMENT },
      {
        title: "Configuración",
        url: ROUTES.SETTINGS_SALES,
        icon: SettingsIcon,
        roles: ROLE_GROUPS.MANAGEMENT,
        children: [
          { title: "Datos de la empresa", url: ROUTES.SETTINGS_BUSINESS, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Presupuestos", url: ROUTES.SETTINGS_QUOTES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Reglas de venta", url: ROUTES.SETTINGS_SALES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Pedidos y personalización", url: ROUTES.SETTINGS_ORDERS, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Tarifas a destajo", url: ROUTES.SETTINGS_PIECE_RATES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Avisos", url: ROUTES.SETTINGS_NOTIFICATIONS, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Mensajes de WhatsApp", url: ROUTES.SETTINGS_MESSAGES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Cuentas", url: ROUTES.SETTINGS_ACCOUNTS, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Métodos de pago", url: ROUTES.SETTINGS_PAYMENT_METHODS, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Categorías de dinero", url: ROUTES.SETTINGS_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Categorías de producto", url: ROUTES.SETTINGS_PRODUCT_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Tallas", url: ROUTES.SETTINGS_SIZES, roles: ROLE_GROUPS.MANAGEMENT },
          { title: "Colores", url: ROUTES.SETTINGS_COLORS, roles: ROLE_GROUPS.MANAGEMENT },
        ],
      },
    ],
  },
  {
    label: "Ayuda",
    items: [
      { title: "Mis avisos", url: ROUTES.MY_NOTIFICATIONS, icon: BellIcon, roles: ROLE_GROUPS.ALL },
      { title: "Manual", url: ROUTES.MANUAL, icon: BookOpenIcon, roles: ROLE_GROUPS.ALL },
      { title: "Reglas del negocio", url: ROUTES.BUSINESS_RULES, icon: ScaleIcon, roles: ROLE_GROUPS.ALL },
    ],
  },
]

// Botón de registro rápido (arriba del menú). El primero es el principal: un toque.
export type QuickAction = {
  title: string
  description: string
  url: string
  icon: LucideIcon
  roles: readonly AppRole[]
}

export const QUICK_ACTIONS: readonly QuickAction[] = [
  { title: "Venta", description: "Vender y cobrar", url: ROUTES.NEW_SALE, icon: ShoppingBagIcon, roles: ROLE_GROUPS.ALL },
  { title: "Pedido", description: "Por encargo, con personalización", url: ROUTES.NEW_ORDER, icon: ClipboardListIcon, roles: ROLE_GROUPS.ALL },
  { title: "Presupuesto", description: "Para empresas, en PDF", url: ROUTES.NEW_QUOTE, icon: FileTextIcon, roles: ROLE_GROUPS.ALL },
  {
    title: "Gasto o ingreso",
    description: "Alquiler, servicios, publicidad…",
    url: ROUTES.NEW_MOVEMENT,
    icon: WalletIcon,
    roles: ROLE_GROUPS.ALL,
  },
  { title: "Compra", description: "Tela, insumos o servicios", url: ROUTES.NEW_PURCHASE, icon: TruckIcon, roles: ROLE_GROUPS.ALL },
  {
    title: "Traspaso",
    description: "Mover o cambiar dinero entre cuentas",
    url: ROUTES.NEW_TRANSFER,
    icon: ArrowRightLeftIcon,
    roles: ROLE_GROUPS.MANAGEMENT,
  },
]

// Todos los enlaces, aplanados (p. ej. para listar los módulos "pronto").
export const NAV_LINKS: readonly (NavLink & { icon: LucideIcon })[] = NAV_SECTIONS.flatMap((section) =>
  section.items.flatMap((item) =>
    item.children ? item.children.map((child) => ({ ...child, icon: item.icon })) : [item]
  )
)
