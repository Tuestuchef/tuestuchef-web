import "server-only"

import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"

import { documentTheme } from "@/common/lib/config/document-theme.config"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { getStorage } from "@/common/lib/services/storage.service"
import { getBusinessProfile } from "@/modules/business/lib/services/business-profile.service"

import QuotePdf, { type PdfGalleryImage, type PdfImage } from "../../components/quote-pdf"
import type { QuoteDetail } from "../types/quotes.types"

const DOWNLOAD_TTL_SECONDS = 5 * 60
// Lado mayor de cada foto en el PDF (suficiente para imprimir a 3 por fila).
const GALLERY_MAX_PX = 900

// Bytes de una imagen de R2 (encabezado). null si no hay, no se puede leer o no es PNG/JPG.
async function loadImage(path: string | null, bucket: "public" | "private" = "public"): Promise<PdfImage> {
  const storage = getStorage()
  if (!path || !storage) return null
  const format = path.endsWith(".png") ? "png" : path.endsWith(".jpg") ? "jpg" : null
  if (!format) return null
  try {
    const url = await storage.createDownloadUrl({ bucket, path, expiresInSeconds: DOWNLOAD_TTL_SECONDS })
    const response = await fetch(url)
    if (!response.ok) return null
    return { data: Buffer.from(await response.arrayBuffer()), format }
  } catch {
    return null
  }
}

// Sin imagen de encabezado, va el ícono a color de la marca (archivo incluido en el build: next.config.ts).
async function loadBrandLogo(): Promise<PdfImage> {
  try {
    return { data: await readFile(join(process.cwd(), "src/common/assets/logo/logo-gradient.png")), format: "png" }
  } catch {
    return null
  }
}

// Fotos del presupuesto para el PDF: el PDF solo acepta JPG o PNG y una foto del celular pesa varios MB,
// así que cada una se convierte a JPG y se achica (sharp). Las que no se pueden leer se omiten.
async function loadGallery(images: QuoteDetail["images"]): Promise<PdfGalleryImage[]> {
  const storage = getStorage()
  if (!storage || images.length === 0) return []
  const { default: sharp } = await import("sharp")
  const loaded = await Promise.all(
    images.map(async (image) => {
      try {
        const url = await storage.createDownloadUrl({ bucket: image.bucket, path: image.path, expiresInSeconds: DOWNLOAD_TTL_SECONDS })
        const response = await fetch(url)
        if (!response.ok) return null
        const data = await sharp(Buffer.from(await response.arrayBuffer()))
          .rotate()
          .resize({ width: GALLERY_MAX_PX, height: GALLERY_MAX_PX, fit: "inside", withoutEnlargement: true })
          // Las transparencias (PNG) quedan sobre el fondo del documento.
          .flatten({ background: documentTheme.card })
          .jpeg({ quality: 80 })
          .toBuffer()
        return { label: image.label, data }
      } catch {
        return null
      }
    })
  )
  return loaded.filter((image) => image !== null)
}

// Genera el PDF de un presupuesto (con los datos guardados: no recalcula nada).
export async function renderQuotePdf(quote: QuoteDetail): Promise<Buffer> {
  const business = await getBusinessProfile()
  const [image, gallery] = await Promise.all([
    loadImage(quote.headerImagePath ?? business.headerImagePath).then(async (header) => header ?? (await loadBrandLogo())),
    loadGallery(quote.images),
  ])
  // QuotePdf devuelve un <Document>: es lo que espera renderToBuffer.
  const element = createElement(QuotePdf, { quote, business, image, gallery, draft: quote.status === "draft" }) as ReactElement<DocumentProps>
  return renderToBuffer(element)
}

// quotes/AAAA/MM/<código>.pdf, con el mes de la fecha del presupuesto.
export const quotePdfPath = (quote: Pick<QuoteDetail, "code" | "issuedOn">) =>
  `quotes/${quote.issuedOn.slice(0, 4)}/${quote.issuedOn.slice(5, 7)}/${quote.code}.pdf`

// Al enviarlo: genera el PDF una sola vez, lo guarda en el bucket privado y anota la ruta.
// Sin almacenamiento configurado no pasa nada: el PDF se genera al pedirlo con los datos congelados.
export async function storeQuotePdf(quote: QuoteDetail): Promise<{ ok: true; stored: boolean } | { ok: false; error: string }> {
  const storage = getStorage()
  if (!storage || quote.pdfPath) return { ok: true, stored: false }
  try {
    const pdf = await renderQuotePdf(quote)
    const path = quotePdfPath(quote)
    const uploadUrl = await storage.createUploadUrl({ bucket: "private", path, contentType: "application/pdf", expiresInSeconds: DOWNLOAD_TTL_SECONDS })
    const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "application/pdf" }, body: new Uint8Array(pdf) })
    if (!response.ok) return { ok: false, error: `No se pudo guardar el PDF (R2 respondió ${response.status}).` }
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.rpc("set_quote_pdf_path", { p_quote_id: quote.id, p_path: path })
    if (error) return { ok: false, error: error.message }
    return { ok: true, stored: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo generar el PDF." }
  }
}

// El PDF para ver o descargar: el congelado si existe; si no, se genera con los datos guardados.
export async function getQuotePdf(quote: QuoteDetail): Promise<Buffer> {
  const storage = getStorage()
  if (quote.pdfPath && storage) {
    try {
      const url = await storage.createDownloadUrl({ bucket: "private", path: quote.pdfPath, expiresInSeconds: DOWNLOAD_TTL_SECONDS })
      const response = await fetch(url)
      if (response.ok) return Buffer.from(await response.arrayBuffer())
    } catch {
      // Si R2 falla, se genera de nuevo con los mismos datos (el presupuesto enviado no cambia).
    }
  }
  return renderQuotePdf(quote)
}
