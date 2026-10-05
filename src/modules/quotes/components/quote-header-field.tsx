"use client"

import { ImageUpIcon, Loader2Icon, Undo2Icon } from "lucide-react"
import { useRef, useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { HEADER_IMAGE_ACCEPT } from "@/modules/business/lib/constants/business.constants"
import { headerImageUploadSchema } from "@/modules/business/lib/schemas/business-profile.schema"

import { requestQuoteHeaderUploadAction, verifyQuoteHeaderImageAction } from "../lib/actions/quotes.action"

type QuoteHeaderFieldProps = {
  imageUrl: string | null
  hasCustomImage: boolean
  enabled: boolean
  onChange: (image: { path: string; url: string | null } | null) => void
}

// Imagen del encabezado solo para este presupuesto. Sin ella, se usa la de Datos de la empresa.
const QuoteHeaderField = ({ imageUrl, hasCustomImage, enabled, onChange }: QuoteHeaderFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setError(null)
    const parsed = headerImageUploadSchema.safeParse({ contentType: file.type, size: file.size })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setUploading(true)
    try {
      const signed = await requestQuoteHeaderUploadAction(parsed.data)
      if (!signed.ok) throw new Error(signed.error)
      const response = await fetch(signed.data.uploadUrl, { method: "PUT", headers: { "Content-Type": signed.data.contentType }, body: file })
      if (!response.ok) throw new Error("No se pudo subir la imagen.")
      const verified = await verifyQuoteHeaderImageAction(signed.data.path)
      if (!verified.ok) throw new Error(verified.error)
      onChange({ path: signed.data.path, url: verified.data.url })
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  if (!enabled) return null

  return (
    <div className="grid gap-2">
      {error && <StatusAlert tone="error" title={error} />}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border bg-muted text-xs text-muted-foreground">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen de R2
            <img src={imageUrl} alt="Imagen del encabezado" className="max-h-full max-w-full object-contain" />
          ) : (
            "Logo de la marca"
          )}
        </div>
        <input ref={inputRef} type="file" accept={HEADER_IMAGE_ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2Icon className="animate-spin" aria-hidden /> : <ImageUpIcon aria-hidden />}
          Otra imagen solo para este presupuesto
        </Button>
        {hasCustomImage && (
          <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => onChange(null)}>
            <Undo2Icon aria-hidden />
            Usar la de la empresa
          </Button>
        )}
      </div>
    </div>
  )
}

export default QuoteHeaderField
