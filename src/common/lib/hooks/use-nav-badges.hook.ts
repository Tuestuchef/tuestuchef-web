"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import type { NavBadgeKey, NavBadges } from "@/common/lib/constants/navigation.constants"
import { QUERY_KEYS } from "@/common/lib/constants/query-keys.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

const REFRESH_MS = 60_000

async function fetchNavBadges(): Promise<NavBadges> {
  const response = await fetch(ROUTES.NAV_BADGES_API, { cache: "no-store" })
  if (!response.ok) throw new Error("No se pudieron leer los contadores del menú.")
  return response.json()
}

export type NavBadgeValues = Partial<Record<NavBadgeKey, number | boolean>>

// Contadores del menú: se actualizan al cambiar de pantalla, al volver a la pestaña y cada minuto.
// Sin conexión se quedan los últimos que se leyeron. Solo el menú pasa watchNavigation (una
// sola recarga por cambio de pantalla aunque otros componentes lean los mismos contadores).
export function useNavBadges({ watchNavigation = false }: { watchNavigation?: boolean } = {}): NavBadgeValues {
  const queryClient = useQueryClient()
  const pathname = usePathname()

  const { data } = useQuery({
    queryKey: QUERY_KEYS.NAV_BADGES,
    queryFn: fetchNavBadges,
    staleTime: 15_000,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: false,
  })

  // Lo publica OfflineSync (ventas guardadas en este teléfono); aquí solo se lee.
  const { data: queued = 0 } = useQuery<number>({
    queryKey: QUERY_KEYS.OFFLINE_QUEUE_COUNT,
    queryFn: () => queryClient.getQueryData<number>(QUERY_KEYS.OFFLINE_QUEUE_COUNT) ?? 0,
    staleTime: Infinity,
  })

  // Después de registrar algo casi siempre se cambia de pantalla: es cuando más importa estar al día.
  useEffect(() => {
    if (watchNavigation) void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NAV_BADGES })
  }, [pathname, queryClient, watchNavigation])

  return {
    receivables: data?.receivables ?? 0,
    offlineSales: (data?.offlineRejections ?? 0) + queued,
    openOrders: data?.openOrders ?? 0,
    materialShortages: data?.materialShortages ?? 0,
    payables: data?.payables ?? 0,
    missingTodayRate: data?.missingTodayRate ?? false,
  }
}
