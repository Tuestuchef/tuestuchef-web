// Claves de TanStack Query: siempre desde aquí, nunca escritas a mano en un componente.
export const QUERY_KEYS = {
  // Contadores del menú (API /api/nav-badges).
  NAV_BADGES: ["nav-badges"],
  // Ventas guardadas en este teléfono sin enviar (las publica OfflineSync).
  OFFLINE_QUEUE_COUNT: ["offline-queue-count"],
} as const
