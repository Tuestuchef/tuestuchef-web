import { createHash } from "node:crypto"

import { NextResponse, type NextRequest } from "next/server"

import { brandConfig } from "@/common/lib/config/brand.config"
import { serverEnv } from "@/common/lib/config/server-env.config"
import { getStorage } from "@/common/lib/services/storage.service"
import { type PublicQuoteOutcome, resolvePublicQuote } from "@/modules/quotes/lib/services/quote-delivery.service"

// Enlace público de un presupuesto (lo recibe el cliente por WhatsApp o correo). Sin sesión.
// Si es válido, redirige al PDF oficial con una URL firmada de 10 minutos; cada apertura pide una
// nueva. Nunca se indexa, tiene límite de solicitudes y el equipo puede revocarlo.
const SIGNED_URL_TTL_SECONDS = 10 * 60
const NO_INDEX = { "X-Robots-Tag": "noindex, nofollow, noarchive", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }

const MESSAGES: Record<Exclude<PublicQuoteOutcome, "ok">, { status: number; title: string; body: string }> = {
  not_found: { status: 404, title: "Presupuesto no encontrado", body: "Revisa el enlace o pide uno nuevo." },
  revoked: { status: 410, title: "Este enlace ya no está activo", body: "Pide a quien te lo envió un enlace nuevo." },
  superseded: { status: 410, title: "Hay una versión más nueva", body: "Este presupuesto fue reemplazado. Pide el enlace de la versión vigente." },
  link_expired: { status: 410, title: "Este enlace venció", body: "El presupuesto ya no está vigente. Pide uno actualizado." },
  rate_limited: { status: 429, title: "Demasiadas solicitudes", body: "Espera unos minutos e intenta de nuevo." },
  unavailable: { status: 503, title: "No disponible en este momento", body: "Intenta de nuevo más tarde o escríbenos." },
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Página mínima sin estilos propios: el navegador usa los suyos (claro u oscuro), sin colores fijos.
function messagePage(outcome: Exclude<PublicQuoteOutcome, "ok">) {
  const { status, title, body } = MESSAGES[outcome]
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><meta name="color-scheme" content="light dark"><title>${escapeHtml(title)} · ${escapeHtml(brandConfig.name)}</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;min-height:100svh;display:grid;place-items:center;padding:16px;box-sizing:border-box}main{max-width:420px;display:grid;gap:8px;text-align:center}h1{font-size:1.25rem;margin:0}p{margin:0;line-height:1.5}</style></head><body><main><p>${escapeHtml(brandConfig.name)}</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p></main></body></html>`
  return new NextResponse(html, { status, headers: { ...NO_INDEX, "Content-Type": "text/html; charset=utf-8" } })
}

// Huella de la IP (con sal del servidor): basta para el límite de solicitudes y no guarda la IP.
function ipHash(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconocida"
  return createHash("sha256").update(`${serverEnv.CRON_SECRET ?? brandConfig.name}:${ip}`).digest("hex").slice(0, 32)
}

export async function GET(request: NextRequest, ctx: RouteContext<"/p/presupuesto/[token]">) {
  const { token } = await ctx.params
  if (!/^[0-9a-f]{64}$/.test(token)) return messagePage("not_found")

  const result = await resolvePublicQuote(token, ipHash(request))
  if (result.outcome !== "ok") return messagePage(result.outcome)

  const storage = getStorage()
  if (!storage || !result.pdfPath) return messagePage("unavailable")
  const url = await storage.createDownloadUrl({ bucket: "private", path: result.pdfPath, expiresInSeconds: SIGNED_URL_TTL_SECONDS })
  return NextResponse.redirect(url, { status: 302, headers: NO_INDEX })
}
