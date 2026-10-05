"use client"

import { ImageUpIcon, Loader2Icon, Trash2Icon } from "lucide-react"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import BrandLogo from "@/common/components/brand-logo"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"

import { registerHeaderImageAction, removeHeaderImageAction, requestHeaderImageUploadAction } from "../lib/actions/business-profile.action"
import { HEADER_IMAGE_ACCEPT } from "../lib/constants/business.constants"
import { headerImageUploadSchema } from "../lib/schemas/business-profile.schema"

type HeaderImageFieldProps = { imageUrl: string | null; enabled: boolean }

// Imagen del encabezado de presupuestos y recibos: sube directo a R2 (bucket público) con URL prefirmada.
// Sin imagen, los documentos usan el logo de la marca (o su placeholder).
const HeaderImageField = ({ imageUrl, enabled }: HeaderImageFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function upload(file: File) {
    setError(null)
    const parsed = headerImageUploadSchema.safeParse({ contentType: file.type, size: file.size })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setUploading(true)
    try {
      const signed = await requestHeaderImageUploadAction(parsed.data)
      if (!signed.ok) throw new Error(signed.error)
      const response = await fetch(signed.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": signed.data.contentType },
        body: file,
      })
      if (!response.ok) throw new Error("No se pudo subir la imagen.")
      const registered = await registerHeaderImageAction(signed.data.path)
      if (!registered.ok) throw new Error(registered.error)
      toast.success(registered.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  if (!enabled) {
    return (
      <StatusAlert tone="info" title="Imagen no disponible todavía">
        Falta configurar el almacenamiento (R2). Mientras tanto se usa el logo de la marca.
      </StatusAlert>
    )
  }

  return (
    <div className="grid gap-3">
      {error && <StatusAlert tone="error" title={error} />}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen subida por el usuario, de R2
            <img src={imageUrl} alt="Imagen del encabezado" className="max-h-full max-w-full object-contain" />
          ) : (
            <BrandLogo variant="full" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={HEADER_IMAGE_ACCEPT}
            className="sr-only"
            id="header-image-input"
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
          <Button type="button" variant="outline" className="h-11 md:h-9" disabled={uploading || pending} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2Icon className="animate-spin" aria-hidden /> : <ImageUpIcon aria-hidden />}
            {imageUrl ? "Reemplazar imagen" : "Subir imagen"}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              className="h-11 md:h-9"
              disabled={uploading || pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeHeaderImageAction()
                  if (result.ok) toast.success(result.message)
                  else toast.error(result.error)
                })
              }
            >
              <Trash2Icon aria-hidden />
              Quitar
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">PNG o JPG de hasta 2 MB. Sale arriba a la izquierda en los presupuestos.</p>
    </div>
  )
}

export default HeaderImageField
