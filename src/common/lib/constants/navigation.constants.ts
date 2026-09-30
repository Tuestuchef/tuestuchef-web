import {
  ArrowLeftRightIcon,
  ChartColumnIcon,
  HouseIcon,
  LandmarkIcon,
  type LucideIcon,
  PackageIcon,
  ShoppingBagIcon,
  TagsIcon,
  UserCogIcon,
  UsersIcon,
  WalletCardsIcon,
  WalletIcon,
} from "lucide-react"

import {
  type AppRole,
  ROLE_GROUPS,
} from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

export type NavItem = {
  title: string
  url: string
  icon: LucideIcon
  roles: readonly AppRole[]
  // Módulo planificado pero aún no construido: se muestra deshabilitado.
  soon?: boolean
}

export type NavGroup = {
  label: string
  items: readonly NavItem[]
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Negocio",
    items: [
      { title: "Inicio", url: ROUTES.HOME, icon: HouseIcon, roles: ROLE_GROUPS.ALL },
      { title: "Movimientos", url: ROUTES.MOVEMENTS, icon: ArrowLeftRightIcon, roles: ROLE_GROUPS.ALL },
      { title: "Tasas y cuentas", url: ROUTES.TREASURY, icon: LandmarkIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Analítica", url: ROUTES.ANALYTICS, icon: ChartColumnIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Ventas", url: "/ventas", icon: ShoppingBagIcon, roles: ROLE_GROUPS.ALL, soon: true },
      { title: "Productos y stock", url: "/productos", icon: PackageIcon, roles: ROLE_GROUPS.ALL, soon: true },
      { title: "Clientes", url: "/clientes", icon: UsersIcon, roles: ROLE_GROUPS.ALL, soon: true },
    ],
  },
  {
    label: "Configuración",
    items: [
      { title: "Cuentas", url: ROUTES.SETTINGS_ACCOUNTS, icon: WalletIcon, roles: ROLE_GROUPS.MANAGEMENT },
      { title: "Categorías", url: ROUTES.SETTINGS_CATEGORIES, icon: TagsIcon, roles: ROLE_GROUPS.MANAGEMENT },
      {
        title: "Métodos de pago",
        url: ROUTES.SETTINGS_PAYMENT_METHODS,
        icon: WalletCardsIcon,
        roles: ROLE_GROUPS.MANAGEMENT,
      },
      { title: "Usuarios", url: ROUTES.SETTINGS_USERS, icon: UserCogIcon, roles: ROLE_GROUPS.MANAGEMENT },
    ],
  },
]

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items)
