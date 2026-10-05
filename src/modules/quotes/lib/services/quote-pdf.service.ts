import "server-only"

import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"

import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { getStorage } from "@/common/lib/services/storage.service"
import { getBusinessProfile } from "@/modules/business/lib/services/business-profile.service"

import QuotePdf, { type PdfImage } from "../../components/quote-pdf"
import type { QuoteDetail } from "../types/quotes.types"

const DOWNLOAD_TTL_SECONDS = 5 * 60

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

// Genera el PDF de un presupuesto (con los datos guardados: no recalcula nada).
export async function renderQuotePdf(quote: QuoteDetail): Promise<Buffer> {
  const business = await getBusinessProfile()
  const image = await loadImage(quote.headerImagePath ?? business.headerImagePath)
  // QuotePdf devuelve un <Document>: es lo que espera renderToBuffer.
  const element = createElement(QuotePdf, { quote, business, image, draft: quote.status === "draft" }) as ReactElement<DocumentProps>
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
