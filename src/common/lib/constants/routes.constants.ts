export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGN_OUT: "/auth/sign-out",
  SIGN_OUT_INACTIVE: "/auth/sign-out?reason=inactive",
  AUTH_CONFIRM: "/auth/confirm",
  MFA_SETUP: "/auth/2fa/activar",
  MFA_VERIFY: "/auth/2fa",

  MOVEMENTS: "/movimientos",
  NEW_MOVEMENT: "/movimientos/nuevo",
  TREASURY: "/cuentas",
  NEW_TRANSFER: "/cuentas/traspaso",
  ANALYTICS: "/analitica",
  PRODUCTS: "/productos",
  PRODUCT: (id: string) => `/productos/${id}`,
  STOCK: "/productos/stock",
  INITIAL_STOCK: "/productos/stock/carga-inicial",
  SALES: "/ventas",
  NEW_SALE: "/ventas/nueva",
  SALE: (id: string) => `/ventas/${id}`,
  SALE_NOTE: (id: string) => `/ventas/${id}/nota`,
  RECEIVABLES: "/ventas/por-cobrar",
  PURCHASES: "/compras",
  NEW_PURCHASE: "/compras/nueva",
  PURCHASE: (id: string) => `/compras/${id}`,
  SUPPLIERS: "/compras/proveedores",
  SUPPLIER: (id: string) => `/compras/proveedores/${id}`,
  PAYABLES: "/compras/por-pagar",
  RAW_MATERIALS: "/compras/materia-prima",
  CUSTOMERS: "/clientes",
  CUSTOMER: (id: string) => `/clientes/${id}`,

  SETTINGS_ACCOUNTS: "/configuracion/cuentas",
  SETTINGS_CATEGORIES: "/configuracion/categorias",
  SETTINGS_PAYMENT_METHODS: "/configuracion/metodos-de-pago",
  SETTINGS_USERS: "/configuracion/usuarios",
  SETTINGS_PRODUCT_CATEGORIES: "/configuracion/categorias-de-producto",
  SETTINGS_SIZES: "/configuracion/tallas",
  SETTINGS_COLORS: "/configuracion/colores",
  SETTINGS_SALES: "/configuracion/ventas",

  RECEIPT: (entryId: string) => `/api/receipts/${entryId}`,
} as const

// Rutas accesibles sin sesión.
// /api/cron/* no usa sesión: se protege con CRON_SECRET.
export const PUBLIC_ROUTES: readonly string[] = [
  ROUTES.LOGIN,
  ROUTES.SIGN_OUT,
  ROUTES.AUTH_CONFIRM,
  "/api/cron/exchange-rates",
]

// Parámetro con la ruta a la que volver tras iniciar sesión.
export const REDIRECT_PARAM = "next"

// Motivo por el que se cerró la sesión (se muestra en el login).
export const SIGN_OUT_REASON_PARAM = "reason"
