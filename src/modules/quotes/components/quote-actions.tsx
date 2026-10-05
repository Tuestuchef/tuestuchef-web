"use client"

import { CheckIcon, CopyIcon, FilePlus2Icon, PencilIcon, Trash2Icon, XIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/common/components/ui/dialog"
import { Textarea } from "@/common/components/ui/textarea"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import { discardQuoteAction, duplicateQuoteAction, markQuoteAction, newQuoteVersionAction } from "../lib/actions/quotes.action"
import type { QuoteStatus } from "../lib/types/quotes.types"
import QuoteSendDialog from "./quote-send-dialog"

type Result = { ok: true; message: string; id?: string } | { ok: false; error: string }

// Diálogo con un texto (motivo o nota) antes de confirmar.
const NoteDialog = ({
  trigger,
  title,
  description,
  label,
  required,
  confirm,
  onConfirm,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  label: string
  required: boolean
  confirm: string
  onConfirm: (note: string) => Promise<Result>
}) => {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Textarea aria-label={label} placeholder={label} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        {error && <StatusAlert tone="error" title={error} />}
        <DialogFooter>
          <Button
            className="h-11 md:h-9"
            disabled={pending || (required && note.trim().length < 3)}
            onClick={() =>
              startTransition(async () => {
                const result = await onConfirm(note)
                if (result.ok) {
                  toast.success(result.message)
                  setOpen(false)
                } else setError(result.error)
              })
            }
          >
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type QuoteActionsProps = {
  id: string
  code: string
  status: QuoteStatus
  isLatest: boolean
  delivery: { defaultEmail: string | null; defaultPhone: string | null; emailConfigured: boolean }
}

// Acciones según el estado: un borrador se edita, envía o descarta; un enviado se acepta,
// rechaza o se cambia con una versión nueva; cualquiera se duplica.
const QuoteActions = ({ id, code, status, isLatest, delivery }: QuoteActionsProps) => {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<Result>, goTo?: (id: string) => string) =>
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      if (goTo && result.id) router.push(goTo(result.id))
    })

  const button = "h-11 md:h-9"

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <>
          <QuoteSendDialog id={id} code={code} mode="send" {...delivery} />
          <Button asChild variant="outline" className={button}>
            <Link href={ROUTES.EDIT_QUOTE(id)}>
              <PencilIcon aria-hidden />
              Editar
            </Link>
          </Button>
          <NoteDialog
            trigger={
              <Button variant="ghost" className={button}>
                <Trash2Icon aria-hidden />
                Descartar
              </Button>
            }
            title="Descartar borrador"
            description="No se borra (la numeración no deja huecos): queda como descartado, con el motivo."
            label="Motivo"
            required
            confirm="Descartar"
            onConfirm={(reason) => discardQuoteAction({ id, reason })}
          />
        </>
      )}

      {status === "sent" && (
        <>
          <NoteDialog
            trigger={
              <Button className={button}>
                <CheckIcon aria-hidden />
                Aceptado
              </Button>
            }
            title="Presupuesto aceptado"
            description="El cliente lo aceptó. Después se podrá convertir en pedido."
            label="Nota (opcional): cómo lo confirmó"
            required={false}
            confirm="Marcar aceptado"
            onConfirm={(note) => markQuoteAction({ id, status: "accepted", note })}
          />
          <NoteDialog
            trigger={
              <Button variant="outline" className={button}>
                <XIcon aria-hidden />
                Rechazado
              </Button>
            }
            title="Presupuesto rechazado"
            description="Queda registrado con quién y cuándo. Si hace falta cambiarlo, crea una versión nueva."
            label="Motivo (opcional)"
            required={false}
            confirm="Marcar rechazado"
            onConfirm={(note) => markQuoteAction({ id, status: "rejected", note })}
          />
        </>
      )}

      {isLatest && ["sent", "accepted", "rejected"].includes(status) && <QuoteSendDialog id={id} code={code} mode="resend" {...delivery} />}

      {isLatest && ["sent", "rejected", "expired"].includes(status) && (
        <Button variant="outline" className={button} disabled={pending} onClick={() => run(() => newQuoteVersionAction(id), ROUTES.EDIT_QUOTE)}>
          <FilePlus2Icon aria-hidden />
          Nueva versión
        </Button>
      )}

      <Button variant="ghost" className={button} disabled={pending} onClick={() => run(() => duplicateQuoteAction(id), ROUTES.EDIT_QUOTE)}>
        <CopyIcon aria-hidden />
        Duplicar
      </Button>
    </div>
  )
}

export default QuoteActions
