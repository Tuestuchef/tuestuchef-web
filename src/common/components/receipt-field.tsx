"use client"

import { FileIcon, Loader2Icon, PaperclipIcon, XIcon } from "lucide-react"
import { useId, useRef, useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import { Label } from "@/common/components/ui/label"
import { requestReceiptUploadAction } from "@/common/lib/actions/request-receipt-upload.action"
import {
  RECEIPT_ACCEPT,
  RECEIPT_MESSAGES,
} from "@/common/lib/constants/receipts.constants"
import { receiptUploadSchema } from "@/common/lib/schemas/receipt-upload.schema"

type ReceiptFieldProps = {
  enabled: boolean
  name?: string
  label?: string
  onUploadingChange?: (uploading: boolean) => void
  // Avisa la ruta subida (o null al quitarla), para formularios que no usan FormData.
  onPathChange?: (path: string | null) => void
}

type ReceiptState =
  | { status: "idle" }
  | { status: "uploading"; fileName: string }
  | { status: "uploaded"; fileName: string; path: string }
  | { status: "error"; message: string }

// Sube el archivo directo a R2 con una URL prefirmada y deja solo la ruta en el formulario.
const ReceiptField = ({ enabled, name = "receipt_path", label = "Comprobante", onUploadingChange, onPathChange }: ReceiptFieldProps) => {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ReceiptState>({ status: "idle" })

  const setUploading = (uploading: boolean) => onUploadingChange?.(uploading)

  async function handleFile(file: File) {
    const parsed = receiptUploadSchema.safeParse({ contentType: file.type, size: file.size })
    if (!parsed.success) {
      setState({ status: "error", message: parsed.error.issues[0].message })
      return
    }

    setState({ status: "uploading", fileName: file.name })
    setUploading(true)
    try {
      const signed = await requestReceiptUploadAction(parsed.data)
      if (!signed.ok) {
        setState({ status: "error", message: signed.error })
        return
      }
      const response = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": signed.data.contentType },
        body: file,
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setState({ status: "uploaded", fileName: file.name, path: signed.data.path })
      onPathChange?.(signed.data.path)
    } catch {
      setState({ status: "error", message: RECEIPT_MESSAGES.UPLOAD_FAILED })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const clear = () => {
    setState({ status: "idle" })
    onPathChange?.(null)
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>
        {label} <span className="font-normal text-muted-foreground">(opcional)</span>
      </Label>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="sr-only"
        disabled={!enabled || state.status === "uploading"}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
        }}
      />
      {state.status === "uploaded" && <input type="hidden" name={name} value={state.path} />}

      {!enabled ? (
        <div className="grid gap-2">
          <Button type="button" variant="outline" className="h-11 justify-start md:h-9" disabled>
            <PaperclipIcon aria-hidden />
            Adjuntar foto o PDF
          </Button>
          <StatusAlert tone="info" title="Comprobantes no disponibles todavía">
            Falta configurar el almacenamiento. Puedes registrar sin comprobante.
          </StatusAlert>
        </div>
      ) : state.status === "uploaded" || state.status === "uploading" ? (
        <div className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm md:h-9">
          {state.status === "uploading" ? (
            <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <FileIcon className="size-4 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 flex-1 truncate">{state.fileName}</span>
          {state.status === "uploading" ? (
            <span className="text-xs text-muted-foreground">Subiendo…</span>
          ) : (
            <>
              <StatusBadge tone="success">Listo</StatusBadge>
              <Button type="button" variant="ghost" size="icon" className="size-8" onClick={clear}>
                <XIcon aria-hidden />
                <span className="sr-only">Quitar comprobante</span>
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 justify-start md:h-9"
          onClick={() => inputRef.current?.click()}
        >
          <PaperclipIcon aria-hidden />
          Adjuntar foto o PDF
        </Button>
      )}

      {state.status === "error" && <StatusAlert tone="error" title={state.message} />}
    </div>
  )
}

export default ReceiptField
