"use client"

import { StickyNoteIcon } from "lucide-react"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/common/components/ui/dialog"

type NoteButtonProps = {
  note: string | null
  // De qué es la nota ("NE-000027 · Ana Pérez").
  title: string
}

// Ícono que avisa que algo lleva nota; al tocarlo la muestra sin entrar al detalle.
// Puede ir dentro de una fila que es enlace: no la abre (ni al tocar el ícono ni dentro del diálogo).
const NoteButton = ({ note, title }: NoteButtonProps) => {
  const [open, setOpen] = useState(false)
  if (!note?.trim()) return null

  const stop = (event: React.SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    // Los clics (también los del diálogo, que está en un portal) no llegan a la fila-enlace.
    <span className="contents" onClick={stop}>
      <button
        type="button"
        aria-label="Ver nota"
        title="Ver nota"
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <StickyNoteIcon className="size-4" aria-hidden />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nota</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          <p className="text-sm whitespace-pre-line">{note}</p>
        </DialogContent>
      </Dialog>
    </span>
  )
}

export default NoteButton
