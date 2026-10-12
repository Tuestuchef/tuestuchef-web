"use client"

import { PackageCheckIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import FormField from "@/common/components/form-field"
import StatusAlert from "@/common/components/status-alert"
import SubmitButton from "@/common/components/submit-button"
import { Button } from "@/common/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

import { receivePurchaseAction } from "../lib/actions/purchase-operations.action"

type PendingLine = { id: string; label: string; pending: number }

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

// Recibir lo que entregó el proveedor: todo lo pendiente, o una parte de cada línea.
const ReceivePurchaseDialog = ({ purchaseId, lines }: { purchaseId: string; lines: PendingLine[] }) => {
  const [open, setOpen] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const reset = () => {
    setQuantities(Object.fromEntries(lines.map((l) => [l.id, String(l.pending)])))
    setNote("")
    setError(null)
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const items = lines.map((l) => ({ item_id: l.id, quantity: parseAmount(quantities[l.id] ?? "0", 3) ?? -1 }))
    const invalid = items.find((i, index) => i.quantity < 0 || i.quantity > lines[index].pending)
    if (invalid) {
      setError("Revisa las cantidades: van de 0 a lo pendiente de cada línea.")
      return
    }
    if (items.every((i) => i.quantity === 0)) {
      setError("Indica cuánto se recibió.")
      return
    }
    startTransition(async () => {
      const result = await receivePurchaseAction({ purchase_id: purchaseId, items, note: note.trim() || null })
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      setOpen(false)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) reset()
        setOpen(next)
      }}
    >
      <DialogTrigger asChild>
        <Button className="h-11 md:h-9">
          <PackageCheckIcon aria-hidden />
          Recibir
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recibir mercancía</DialogTitle>
          <DialogDescription>Lo que entregó el proveedor entra al inventario ahora. Si entregó una parte, cambia la cantidad.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <ul className="grid gap-3">
            {lines.map((line) => (
              <li key={line.id} className="grid grid-cols-[minmax(0,1fr)_6rem] items-center gap-3">
                <span className="grid min-w-0 text-sm">
                  <span className="truncate font-medium">{line.label}</span>
                  <span className="text-xs text-muted-foreground">Pendiente: {quantityFormat.format(line.pending)}</span>
                </span>
                <Input
                  aria-label={`Cantidad recibida de ${line.label}`}
                  inputMode="decimal"
                  value={quantities[line.id] ?? ""}
                  onChange={(e) => setQuantities((q) => ({ ...q, [line.id]: e.target.value }))}
                  className="h-11 text-right tabular-nums md:h-9"
                />
              </li>
            ))}
          </ul>
          <FormField label="Nota" htmlFor="receive-note" optional>
            <Input id="receive-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Ej.: faltaron 2 tallas L" className="h-11 md:h-9" />
          </FormField>
          {error && <StatusAlert tone="error" title={error} />}
          <DialogFooter>
            <SubmitButton pending={pending}>Registrar recepción</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default ReceivePurchaseDialog
