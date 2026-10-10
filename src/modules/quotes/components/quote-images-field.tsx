"use client"

import { ArrowDownIcon, ArrowUpIcon, CheckIcon, ImagePlusIcon, ImagesIcon, Loader2Icon, SearchIcon, Trash2Icon } from "lucide-react"
import { useRef, useState } from "react"

import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/common/components/ui/dialog"
import { Input } from "@/common/components/ui/input"
import { cn } from "@/common/lib/utils"

import { requestQuoteImageUploadAction, verifyQuoteImageAction } from "../lib/actions/quotes.action"
import { QUOTE_IMAGE_ACCEPT, QUOTE_IMAGES_MAX } from "../lib/constants/quotes.constants"
import { quoteImageUploadSchema } from "../lib/schemas/quote.schema"
import type { CatalogImageOption } from "../lib/types/quotes.types"

// Una imagen en el formulario: del catálogo (por su id) o subida (por su ruta), con su nombre.
export type QuoteImageDraft = {
  key: string
  source: "product" | "upload"
  productImageId: string | null
  path: string | null
  url: string | null
  label: string
}

type QuoteImagesFieldProps = {
  images: QuoteImageDraft[]
  onChange: (images: QuoteImageDraft[]) => void
  catalog: CatalogImageOption[]
  // Productos que ya están en el presupuesto: sus fotos salen primero.
  productIds: string[]
  storageEnabled: boolean
}

const labelFor = (photo: CatalogImageOption) => [photo.productName, photo.colorName].filter(Boolean).join(" · ")

// Fotos para el presupuesto (después de los artículos): del catálogo o subidas, cada una con su nombre.
const QuoteImagesField = ({ images, onChange, catalog, productIds, storageEnabled }: QuoteImagesFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [picking, setPicking] = useState(false)
  const [search, setSearch] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = images.length >= QUOTE_IMAGES_MAX

  const add = (image: Omit<QuoteImageDraft, "key">) => onChange([...images, { ...image, key: crypto.randomUUID() }])
  const update = (key: string, patch: Partial<QuoteImageDraft>) => onChange(images.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const move = (index: number, delta: number) => {
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  async function upload(file: File) {
    setError(null)
    const parsed = quoteImageUploadSchema.safeParse({ contentType: file.type, size: file.size })
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setUploading(true)
    try {
      const signed = await requestQuoteImageUploadAction(parsed.data)
      if (!signed.ok) throw new Error(signed.error)
      const response = await fetch(signed.data.uploadUrl, { method: "PUT", headers: { "Content-Type": signed.data.contentType }, body: file })
      if (!response.ok) throw new Error("No se pudo subir la imagen.")
      const verified = await verifyQuoteImageAction(signed.data.path)
      if (!verified.ok) throw new Error(verified.error)
      add({ source: "upload", productImageId: null, path: signed.data.path, url: verified.data.url, label: "" })
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen.")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const query = search.trim().toLowerCase()
  const visible = catalog
    .filter((p) => !query || labelFor(p).toLowerCase().includes(query))
    .sort((a, b) => Number(productIds.includes(b.productId)) - Number(productIds.includes(a.productId)))
  const picked = new Set(images.flatMap((i) => (i.productImageId ? [i.productImageId] : [])))

  return (
    <div className="grid gap-3">
      {error && <StatusAlert tone="error" title={error} />}

      {images.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {images.map((image, index) => (
            <li key={image.key} className="flex gap-3 rounded-lg border p-2">
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                {image.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen de R2
                  <img src={image.url} alt={image.label || "Imagen del presupuesto"} className="size-full object-cover" />
                ) : (
                  <ImagesIcon className="size-5 text-muted-foreground" aria-hidden />
                )}
              </div>
              <div className="grid min-w-0 flex-1 content-between gap-1.5">
                <Input
                  value={image.label}
                  onChange={(e) => update(image.key, { label: e.target.value })}
                  maxLength={120}
                  placeholder="Nombre (ej.: Filipina manga corta vinotinto)"
                  aria-label={`Nombre de la imagen ${index + 1}`}
                  className="h-10 md:h-8"
                />
                <div className="flex items-center gap-1">
                  <span className="mr-auto text-xs text-muted-foreground">{image.source === "product" ? "Del catálogo" : "Subida"}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUpIcon aria-hidden />
                    <span className="sr-only">Subir de lugar</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" disabled={index === images.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDownIcon aria-hidden />
                    <span className="sr-only">Bajar de lugar</span>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onChange(images.filter((i) => i.key !== image.key))}>
                    <Trash2Icon aria-hidden />
                    <span className="sr-only">Quitar imagen</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" className="h-11 md:h-9" disabled={full || catalog.length === 0} onClick={() => setPicking(true)}>
          <ImagesIcon aria-hidden />
          Del catálogo
        </Button>
        {storageEnabled && (
          <>
            <input ref={inputRef} type="file" accept={QUOTE_IMAGE_ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            <Button type="button" variant="outline" className="h-11 md:h-9" disabled={full || uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? <Loader2Icon className="animate-spin" aria-hidden /> : <ImagePlusIcon aria-hidden />}
              Subir foto
            </Button>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          {images.length} de {QUOTE_IMAGES_MAX}
          {catalog.length === 0 && " · el catálogo aún no tiene fotos"}
        </span>
      </div>

      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Fotos del catálogo</DialogTitle>
            <DialogDescription>Toca las que quieras agregar. Primero salen las de los productos del presupuesto.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar: filipina vinotinto…" aria-label="Buscar fotos" className="h-11 pl-8 md:h-9" />
          </div>
          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay fotos con ese nombre.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {visible.map((photo) => {
                const already = picked.has(photo.id)
                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      disabled={already || images.length >= QUOTE_IMAGES_MAX}
                      onClick={() => add({ source: "product", productImageId: photo.id, path: null, url: photo.url, label: labelFor(photo) })}
                      className={cn(
                        "grid w-full gap-1 rounded-lg border p-1.5 text-left text-xs transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        already ? "border-primary" : "hover:bg-accent disabled:opacity-50"
                      )}
                    >
                      <span className="relative block aspect-square overflow-hidden rounded-md bg-muted">
                        {photo.url && (
                          // eslint-disable-next-line @next/next/no-img-element -- imagen de R2
                          <img src={photo.url} alt={labelFor(photo)} className="size-full object-cover" />
                        )}
                        {already && (
                          <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <CheckIcon className="size-4" aria-hidden />
                          </span>
                        )}
                      </span>
                      <span className="line-clamp-2">{labelFor(photo)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          <Button type="button" className="h-11 w-fit md:h-9" onClick={() => setPicking(false)}>
            Listo
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default QuoteImagesField
