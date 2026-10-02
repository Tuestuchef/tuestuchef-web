import { ChartColumnIcon, PackageIcon, SettingsIcon, TruckIcon, UsersRoundIcon } from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"

import type { ManualChapter, ManualChapterStub } from "../types/manual.types"
import { COMERCIAL_STUBS, SALES_CHAPTER } from "./chapters/comercial.constants"
import { TREASURY_CHAPTER } from "./chapters/tesoreria.constants"

// Capítulos escritos.
export const MANUAL_CHAPTERS: readonly ManualChapter[] = [SALES_CHAPTER, TREASURY_CHAPTER]

// Capítulos planificados: aparecen en el índice como "Pronto" hasta que se escriban.
export const MANUAL_STUBS: readonly ManualChapterStub[] = [
  ...COMERCIAL_STUBS,
  {
    slug: "inventario",
    area: "inventario",
    title: "Catálogo, stock y producción",
    summary: "Productos y variantes, el stock calculado por movimientos, las recetas y cómo producir.",
    icon: PackageIcon,
    roles: ROLE_GROUPS.ALL,
  },
  {
    slug: "compras",
    area: "compras",
    title: "Compras y proveedores",
    summary: "Comprar tela e insumos, pagar al contado o a crédito, y lo que se le debe a cada proveedor.",
    icon: TruckIcon,
    roles: ROLE_GROUPS.ALL,
  },
  {
    slug: "resultados",
    area: "resultados",
    title: "Dashboard de resultados",
    summary: "La utilidad real, la reserva y la reinversión, el flujo de caja, el margen por producto y el efecto de la tasa.",
    icon: ChartColumnIcon,
    roles: ROLE_GROUPS.MANAGEMENT,
  },
  {
    slug: "equipo",
    area: "rrhh",
    title: "Equipo, sueldos y adelantos",
    summary: "Las personas del equipo, su acuerdo de sueldo, los pagos y los adelantos que se descuentan.",
    icon: UsersRoundIcon,
    roles: ROLE_GROUPS.MANAGEMENT,
  },
  {
    slug: "configuracion",
    area: "configuracion",
    title: "Configuración",
    summary: "Usuarios y roles, cuentas, métodos de pago, categorías y reglas de venta.",
    icon: SettingsIcon,
    roles: ROLE_GROUPS.MANAGEMENT,
  },
]
