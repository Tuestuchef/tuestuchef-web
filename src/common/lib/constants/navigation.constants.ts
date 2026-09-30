import {
  HouseIcon,
  type LucideIcon,
  PackageIcon,
  ShoppingBagIcon,
  UserCogIcon,
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

// Menú agrupado por área. La configuración de cada área vive dentro de su grupo
// (solo owner y admin la ven). Un grupo sin hijos visibles para el rol no se muestra.
export const NAV_ITEMS: readonly NavItem[] = [
  { title: "Inicio", url: ROUTES.HOME, icon: HouseIcon, roles: ROLE_GROUPS.ALL },
  {
    title: "Ventas",
    url: ROUTES.SALES,
    icon: ShoppingBagIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Ventas", url: ROUTES.SALES, roles: ROLE_GROUPS.ALL },
      { title: "Nueva venta", url: ROUTES.NEW_SALE, roles: ROLE_GROUPS.ALL },
      { title: "Clientes", url: ROUTES.CUSTOMERS, roles: ROLE_GROUPS.ALL },
      { title: "Reglas de venta", url: ROUTES.SETTINGS_SALES, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  {
    title: "Productos",
    url: ROUTES.PRODUCTS,
    icon: PackageIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Catálogo", url: ROUTES.PRODUCTS, roles: ROLE_GROUPS.ALL },
      { title: "Stock", url: ROUTES.STOCK, roles: ROLE_GROUPS.ALL },
      { title: "Categorías", url: ROUTES.SETTINGS_PRODUCT_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Tallas", url: ROUTES.SETTINGS_SIZES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Colores", url: ROUTES.SETTINGS_COLORS, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  {
    title: "Finanzas",
    url: ROUTES.MOVEMENTS,
    icon: WalletIcon,
    roles: ROLE_GROUPS.ALL,
    children: [
      { title: "Movimientos", url: ROUTES.MOVEMENTS, roles: ROLE_GROUPS.ALL },
      { title: "Tasas y cuentas", url: ROUTES.TREASURY, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Analítica", url: ROUTES.ANALYTICS, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Cuentas", url: ROUTES.SETTINGS_ACCOUNTS, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Categorías de dinero", url: ROUTES.SETTINGS_CATEGORIES, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Métodos de pago", url: ROUTES.SETTINGS_PAYMENT_METHODS, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
  { title: "Usuarios", url: ROUTES.SETTINGS_USERS, icon: UserCogIcon, roles: ROLE_GROUPS.MANAGEMENT },
]

// Todos los enlaces, aplanados (p. ej. para listar los módulos "pronto").
export const NAV_LINKS: readonly (NavLink & { icon: LucideIcon })[] = NAV_ITEMS.flatMap((item) =>
  item.children ? item.children.map((child) => ({ ...child, icon: item.icon })) : [item]
)
