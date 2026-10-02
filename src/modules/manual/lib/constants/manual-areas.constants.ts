import {
  ChartColumnIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TruckIcon,
  UsersRoundIcon,
  WalletIcon,
} from "lucide-react"

import type { ManualArea, ManualAreaKey } from "../types/manual.types"

// Las áreas de la administración, en el mismo orden que el menú.
export const MANUAL_AREAS: Record<ManualAreaKey, ManualArea> = {
  comercial: {
    key: "comercial",
    title: "Comercial",
    discipline: "Ventas y clientes",
    description: "Todo lo que entra por vender: cada venta, quién compró, cómo pagó y quién todavía debe.",
    icon: ShoppingBagIcon,
  },
  inventario: {
    key: "inventario",
    title: "Inventario y producción",
    discipline: "Stock y producto",
    description: "Qué vendemos, cuánto hay de cada cosa, de qué está hecho y cuánto cuesta hacerlo.",
    icon: PackageIcon,
  },
  compras: {
    key: "compras",
    title: "Compras",
    discipline: "Abastecimiento y proveedores",
    description: "Lo que compramos para producir y funcionar, a quién, y lo que todavía les debemos.",
    icon: TruckIcon,
  },
  tesoreria: {
    key: "tesoreria",
    title: "Tesorería",
    discipline: "El dinero: dónde está y cuánto vale",
    description:
      "Las cuentas donde vive el dinero, las [[tasa-bcv|tasas]] del día y cada entrada o salida. Es la caja del negocio.",
    icon: WalletIcon,
  },
  resultados: {
    key: "resultados",
    title: "Resultados",
    discipline: "Contabilidad de gestión",
    description: "Si el negocio gana o pierde de verdad: la [[utilidad-real]], el flujo de caja y el margen de cada producto.",
    icon: ChartColumnIcon,
  },
  rrhh: {
    key: "rrhh",
    title: "Recursos humanos",
    discipline: "Las personas del equipo",
    description: "Quién trabaja en el negocio, cuánto gana y qué se le ha pagado o adelantado.",
    icon: UsersRoundIcon,
  },
  configuracion: {
    key: "configuracion",
    title: "Configuración",
    discipline: "Las reglas del sistema",
    description: "Usuarios y permisos, cuentas, métodos de pago, categorías y las reglas que todos los módulos usan.",
    icon: SettingsIcon,
  },
}

export const MANUAL_AREA_ORDER: readonly ManualAreaKey[] = [
  "comercial",
  "inventario",
  "compras",
  "tesoreria",
  "resultados",
  "rrhh",
  "configuracion",
]
