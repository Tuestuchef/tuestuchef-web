"use client"

import { RefreshCwIcon } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/common/components/ui/button"
import { cn } from "@/common/lib/utils"

import { syncExchangeRatesAction } from "../lib/actions/sync-exchange-rates.action"

// Trae ahora las tasas de DolarAPI (lo mismo que hace el cron cada mañana).
const SyncRatesButton = () => {
  const [pending, startTransition] = useTransition()

  const sync = () =>
    startTransition(async () => {
      const result = await syncExchangeRatesAction()
      if (result.status === "success") toast.success(result.message)
      else toast.error(result.message)
    })

  return (
    <Button type="button" variant="outline" className="h-11 md:h-9" onClick={sync} disabled={pending}>
      <RefreshCwIcon className={cn(pending && "animate-spin")} aria-hidden />
      {pending ? "Actualizando…" : "Actualizar desde BCV"}
    </Button>
  )
}

export default SyncRatesButton
