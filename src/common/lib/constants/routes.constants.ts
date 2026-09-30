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

  SETTINGS_ACCOUNTS: "/configuracion/cuentas",
  SETTINGS_CATEGORIES: "/configuracion/categorias",
  SETTINGS_PAYMENT_METHODS: "/configuracion/metodos-de-pago",
  SETTINGS_USERS: "/configuracion/usuarios",

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
