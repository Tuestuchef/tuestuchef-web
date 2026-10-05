"use client"

import { RotateCwIcon, XIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Textarea } from "@/common/components/ui/textarea"

import { discardOfflineSaleAction, retryOfflineSaleAction } from "../lib/actions/offline-sale.action"

// Reintentar (p. ej. cuando ya hay stock o se cargó la tasa) o descartar con motivo. Owner y admin.
const OfflineRejectionActions = ({ id }: { id: string }) => {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-wrap gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await retryOfflineSaleAction(id)
            if (result.ok) toast.success(result.message)
            else toast.error(result.error)
          })
        }
      >
        <RotateCwIcon aria-hidden />
        Reintentar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost">
            <XIcon aria-hidden />
            Descartar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar venta pendiente</DialogTitle>
            <DialogDescription>No se registra. Queda guardada con el motivo (p. ej. ya se registró a mano).</DialogDescription>
          </DialogHeader>
          <Textarea aria-label="Motivo" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" />
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <Button
              className="h-11 md:h-9"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await discardOfflineSaleAction({ id, reason })
                  if (result.ok) {
                    toast.success(result.message)
                    setOpen(false)
                  } else setError(result.error)
                })
              }
            >
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default OfflineRejectionActions
