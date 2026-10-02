import {
  BookOpenIcon,
  ChartColumnIcon,
  HouseIcon,
  type LucideIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TruckIcon,
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

// Una entrada del menú: un enlace directo, o un grupo con submenú (children).
export type NavItem = NavLink & {
  icon: LucideIcon
  children?: readonly NavLink[]
}

// Menú agrupado por área de la administración (comercial, inventario, compras, tesorería,
// resultados, recursos humanos). La configuración de todas las áreas vive en su propio grupo
// (solo owner y admin). Un grupo sin hijos visibles para el rol no se muestra.
export const NAV_ITEMS: readonly NavItem[] = [
  { title: "Inicio", url: ROUTES.HOME, icon: HouseIcon, roles: ROLE_GROUPS.ALL },
  {
    title: "Comercial",
    url: ROUTES.SALES,
    icon: ShoppingBagIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Ventas", url: ROUTES.SALES, roles: ROLE_GROUPS.ALL },
      { title: "Nueva venta", url: ROUTES.NEW_SALE, roles: ROLE_GROUPS.ALL },
      { title: "Clientes", url: ROUTES.CUSTOMERS, roles: ROLE_GROUPS.ALL },
      { title: "Por cobrar", url: ROUTES.RECEIVABLES, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  {
    title: "Inventario",
    url: ROUTES.PRODUCTS,
    icon: PackageIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Catálogo", url: ROUTES.PRODUCTS, roles: ROLE_GROUPS.ALL },
      { title: "Stock", url: ROUTES.STOCK, roles: ROLE_GROUPS.ALL },
      { title: "Materia prima", url: ROUTES.RAW_MATERIALS, roles: ROLE_GROUPS.ALL },
    ],
  },
  {
    title: "Compras",
    url: ROUTES.PURCHASES,
    icon: TruckIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Compras", url: ROUTES.PURCHASES, roles: ROLE_GROUPS.ALL },
      { title: "Nueva compra", url: ROUTES.NEW_PURCHASE, roles: ROLE_GROUPS.ALL },
      { title: "Proveedores", url: ROUTES.SUPPLIERS, roles: ROLE_GROUPS.ALL },
      { title: "Por pagar", url: ROUTES.PAYABLES, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  {
    title: "Tesorería",
    url: ROUTES.MOVEMENTS,
    icon: WalletIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Movimientos", url: ROUTES.MOVEMENTS, roles: ROLE_GROUPS.ALL },
      { title: "Tasas y cuentas", url: ROUTES.TREASURY, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  { title: "Resultados", url: ROUTES.ANALYTICS, icon: ChartColumnIcon, roles: ROLE_GROUPS.MANAGEMENT },
  { title: "Recursos humanos", url: ROUTES.TEAM, icon: UsersRoundIcon, roles: ROLE_GROUPS.MANAGEMENT },
  {
    title: "Configuración",
    url: ROUTES.SETTINGS_USERS,
    icon: SettingsIcon,
    roles: ROLE_GROUPS.MANAGEMENT,
    children: [
      { title: "Usuarios", url: ROUTES.SETTINGS_USERS, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Reglas de venta", url: ROUTES.SETTINGS_SALES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Cuentas", url: ROUTES.SETTINGS_ACCOUNTS, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Métodos de pago", url: ROUTES.SETTINGS_PAYMENT_METHODS, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Categorías de dinero", url: ROUTES.SETTINGS_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Categorías de producto", url: ROUTES.SETTINGS_PRODUCT_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Tallas", url: ROUTES.SETTINGS_SIZES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Colores", url: ROUTES.SETTINGS_COLORS, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  { title: "Manual", url: ROUTES.MANUAL, icon: BookOpenIcon, roles: ROLE_GROUPS.ALL },
]

// Todos los enlaces, aplanados (p. ej. para listar los módulos "pronto").
export const NAV_LINKS: readonly (NavLink & { icon: LucideIcon })[] = NAV_ITEMS.flatMap((item) =>
  item.children ? item.children.map((child) => ({ ...child, icon: item.icon })) : [item]
)
