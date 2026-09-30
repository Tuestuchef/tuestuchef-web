"use client"

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImagePlusIcon,
  Loader2Icon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"

import StatusAlert from "@/common/components/status-alert"
import StatusBadge from "@/common/components/status-badge"
import { Button } from "@/common/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/components/ui/select"

import {
  deleteProductImageAction,
  moveImageAction,
  registerProductImageAction,
  requestProductImageUploadAction,
  setPrimaryImageAction,
  updateImageColorAction,
} from "../lib/actions/product-images.action"
import { PRODUCT_IMAGE_ACCEPT } from "../lib/constants/products.constants"
import { productImageUploadSchema } from "../lib/schemas/products.schema"
import type { CatalogItem, ProductImage } from "../lib/types/products.types"

type ProductImageManagerProps = {
  productId: string
  images: ProductImage[]
  colors: CatalogItem[]
  canManage: boolean
  enabled: boolean
}

type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

const NONE = "none"

// Fotos del producto: suben directo a R2 (bucket público) con URL prefirmada.
const ProductImageManager = ({ productId, images, colors, canManage, enabled }: ProductImageManagerProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action()
      if (!result.ok) toast.error(result.error)
      else if (result.message) toast.success(result.message)
    })

  async function uploadOne(file: File) {
    const parsed = productImageUploadSchema.safeParse({ product_id: productId, contentType: file.type, size: file.size })
    if (!parsed.success) throw new Error(`${file.name}: ${parsed.error.issues[0].message}`)
    const signed = await requestProductImageUploadAction(parsed.data)
    if (!signed.ok) throw new Error(signed.error)
    const response = await fetch(signed.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": signed.data.contentType },
      body: file,
    })
    if (!response.ok) throw new Error(`${file.name}: no se pudo subir.`)
    const registered = await registerProductImageAction({ product_id: productId, path: signed.data.path })
    if (!registered.ok) throw new Error(registered.error)
  }

  async function handleFiles(files: FileList) {
    setError(null)
    const list = [...files]
    setUploading(list.length)
    // Una por una: así el orden de subida es el orden de las fotos.
    for (const file of list) {
      try {
        await uploadOne(file)
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo subir la foto.")
      } finally {
        setUploading((n) => n - 1)
      }
    }
    if (inputRef.current) inputRef.current.value = ""
  }

  if (!enabled) {
    return (
      <StatusAlert tone="info" title="Fotos no disponibles todavía">
        Falta configurar el almacenamiento (R2).
      </StatusAlert>
    )
  }

  const activeColors = colors.filter((c) => c.is_active)

  return (
    <div className="grid gap-3">
      {error && <StatusAlert tone="error" title={error} />}

      {images.length === 0 && !uploading ? (
        <p className="text-sm text-muted-foreground">Sin fotos.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((image, index) => (
            <li key={image.id} className="grid gap-2 rounded-lg border p-2">
              <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                {image.url && (
                  // eslint-disable-next-line @next/next/no-img-element -- bucket público con dominio configurable
                  <img src={image.url} alt="" className="size-full object-cover" loading="lazy" />
                )}
                {image.is_primary && (
                  <StatusBadge tone="success" className="absolute top-1.5 left-1.5 bg-background">
                    Principal
                  </StatusBadge>
                )}
              </div>
              {canManage && (
                <>
                  <Select
                    value={image.color_id ?? NONE}
                    onValueChange={(value) =>
                      run(() => updateImageColorAction({ id: image.id, color_id: value === NONE ? "" : value }))
                    }
                    disabled={pending}
                  >
                    <SelectTrigger aria-label="Color de la foto" className="h-9 w-full text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Todos los colores</SelectItem>
                      {activeColors.map((color) => (
                        <SelectItem key={color.id} value={color.id}>
                          {color.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex justify-between gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      disabled={pending || index === 0}
                      onClick={() => run(() => moveImageAction(image.id, "up"))}
                    >
                      <ArrowLeftIcon aria-hidden />
                      <span className="sr-only">Mover antes</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      disabled={pending || image.is_primary}
                      onClick={() => run(() => setPrimaryImageAction(image.id))}
                    >
                      <StarIcon aria-hidden />
                      <span className="sr-only">Hacer principal</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      disabled={pending || index === images.length - 1}
                      onClick={() => run(() => moveImageAction(image.id, "down"))}
                    >
                      <ArrowRightIcon aria-hidden />
                      <span className="sr-only">Mover después</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      disabled={pending}
                      onClick={() => {
                        if (confirm("¿Eliminar esta foto?")) run(() => deleteProductImageAction(image.id))
                      }}
                    >
                      <Trash2Icon aria-hidden />
                      <span className="sr-only">Eliminar foto</span>
                    </Button>
                  </div>
                </>
              )}
            </li>
          ))}
          {uploading > 0 && (
            <li className="flex aspect-square items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
              Subiendo {uploading}…
            </li>
          )}
        </ul>
      )}

      {canManage && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept={PRODUCT_IMAGE_ACCEPT}
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              if (event.target.files?.length) void handleFiles(event.target.files)
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-11 justify-start md:h-9"
            disabled={uploading > 0}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlusIcon aria-hidden />
            Agregar fotos (JPG, PNG o WEBP, hasta 8 MB)
          </Button>
        </>
      )}
    </div>
  )
}

export default ProductImageManager
