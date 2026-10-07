"use client"

import { useQueryClient } from "@tanstack/react-query"
import { CloudOffIcon, Loader2Icon, RefreshCwIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/common/components/ui/button"
import { QUERY_KEYS } from "@/common/lib/constants/query-keys.constants"
import { SERVICE_WORKER_URL } from "@/common/lib/constants/service-worker.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import { syncOfflineSaleAction } from "../lib/actions/offline-sale.action"
import { isNetworkError, listQueuedSales, QUEUE_CHANGED_EVENT, removeQueuedSale } from "../lib/utils/offline-queue.util"

// Va en todo el panel: registra el service worker (que guarda Nueva venta para usarla sin señal),
// envía las ventas guardadas en el teléfono cuando vuelve la conexión y avisa lo que falta.
const OfflineSync = () => {
  const [online, setOnline] = useState(true)
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const running = useRef(false)
  const queryClient = useQueryClient()

  // El menú lateral cuenta estas ventas en "Ventas pendientes".
  useEffect(() => {
    queryClient.setQueryData(QUERY_KEYS.OFFLINE_QUEUE_COUNT, queued)
  }, [queued, queryClient])

  const refreshCount = useCallback(async () => {
    try {
      setQueued((await listQueuedSales()).length)
    } catch {
      setQueued(0)
    }
  }, [])

  const sync = useCallback(async () => {
    if (running.current || !navigator.onLine) return
    running.current = true
    setSyncing(true)
    try {
      for (const sale of await listQueuedSales()) {
        let result
        try {
          result = await syncOfflineSaleAction({ clientRef: sale.clientRef, ...sale.payload })
        } catch (error) {
          if (isNetworkError(error)) break
          continue
        }
        if (!result.ok) {
          // Sesión vencida u otro error antes de llegar a la base: se reintenta más tarde.
          toast.error(`No se pudo enviar una venta guardada: ${result.error}`)
          break
        }
        await removeQueuedSale(sale.clientRef)
        if (result.status === "rejected") {
          toast.warning("Una venta hecha sin conexión no pasó. Quedó en Ventas pendientes para revisarla.", {
            action: { label: "Ver", onClick: () => window.location.assign(ROUTES.OFFLINE_SALES) },
          })
        } else if (result.status === "created") {
          toast.success(`Venta sin conexión enviada: ${sale.label}`)
        }
      }
    } finally {
      running.current = false
      setSyncing(false)
      void refreshCount()
      // Una venta rechazada pasa a contarse en la base.
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NAV_BADGES })
    }
  }, [refreshCount, queryClient])

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine)
      if (navigator.onLine) void sync()
    }
    // Lectura inicial y primer envío al montar.
    update()
    listQueuedSales()
      .then((list) => setQueued(list.length))
      .catch(() => setQueued(0))
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register(SERVICE_WORKER_URL).then((registration) => {
        // Deja Nueva venta lista para abrirla sin señal.
        if (navigator.onLine) registration.active?.postMessage({ type: "warm" })
      })
    }
    const onQueue = () => void refreshCount()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    window.addEventListener(QUEUE_CHANGED_EVENT, onQueue)
    const timer = window.setInterval(() => void sync(), 60_000)
    return () => {
      window.removeEventListener("online", update)
      window.removeEventListener("offline", update)
      window.removeEventListener(QUEUE_CHANGED_EVENT, onQueue)
      window.clearInterval(timer)
    }
  }, [refreshCount, sync])

  if (online && queued === 0) return null

  return (
    <div role="status" className="sticky top-(--header-height) z-10 -mx-4 -mt-4 flex flex-wrap items-center gap-2 border-b bg-muted px-4 py-2 text-sm md:-mx-6 md:-mt-6 md:px-6">
      {online ? <RefreshCwIcon className="size-4" aria-hidden /> : <CloudOffIcon className="size-4" aria-hidden />}
      <span className="flex-1">
        {online ? "Conexión de vuelta." : "Sin conexión."}
        {queued > 0
          ? ` ${queued} ${queued === 1 ? "venta guardada" : "ventas guardadas"} en este teléfono${online ? "" : ": se enviarán solas al volver la señal"}.`
          : " Puedes seguir registrando ventas en Nueva venta."}
      </span>
      {!online && (
        <Button asChild size="sm" variant="outline">
          <Link href={ROUTES.NEW_SALE}>Nueva venta</Link>
        </Button>
      )}
      {online && queued > 0 && (
        <Button size="sm" variant="outline" disabled={syncing} onClick={() => void sync()}>
          {syncing && <Loader2Icon className="animate-spin" aria-hidden />}
          {syncing ? "Enviando…" : "Enviar ahora"}
        </Button>
      )}
    </div>
  )
}

export default OfflineSync
