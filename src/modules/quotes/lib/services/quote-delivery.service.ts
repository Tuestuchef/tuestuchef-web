import "server-only"

import { createElement } from "react"
import { Resend } from "resend"

import { brandConfig } from "@/common/lib/config/brand.config"
import { publicEnv } from "@/common/lib/config/env.config"
import { serverEnv } from "@/common/lib/config/server-env.config"
import { createSupabaseAdminClient } from "@/common/lib/db/supabase-admin.client"
import { createSupabaseServerClient } from "@/common/lib/db/supabase-server.client"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { getBusinessProfile } from "@/modules/business/lib/services/business-profile.service"
import { formatPhone } from "@/modules/customers/lib/utils/normalize-contact.util"
import { getMessageTemplate } from "@/modules/messages/lib/services/message-templates.service"
import { renderTemplate } from "@/modules/messages/lib/utils/render-template.util"

import QuoteEmail from "../../components/quote-email"
import type { QuoteDetail } from "../types/quotes.types"
import { getQuotePdf } from "./quote-pdf.service"

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string }

const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}-${m}-${y}`
}

export const isQuoteEmailConfigured = () => Boolean(serverEnv.RESEND_API_KEY && serverEnv.NOTIFICATIONS_EMAIL_FROM)

// El enlace público solo funciona con el PDF guardado en R2.
export const quotePublicUrl = (quote: Pick<QuoteDetail, "pdfPath"> & { publicToken: string | null; tokenRevoked: boolean }) =>
  quote.publicToken && !quote.tokenRevoked && isStorageEnabled() ? `${publicEnv.NEXT_PUBLIC_SITE_URL}/p/presupuesto/${quote.publicToken}` : null

// Total para mensajes: en la moneda que muestra el presupuesto (o ambas).
export function quoteTotalText(quote: QuoteDetail): string {
  const usd = formatMoney(quote.usd.total, "USD")
  const bs = formatMoney(quote.ves.totalBs, "VES")
  return quote.currencies === "usd" ? usd : quote.currencies === "ves" ? bs : `${usd} (${bs})`
}

// Token y estado del enlace (no están en QuoteDetail: solo los usa el envío).
export async function getQuoteLink(quoteId: string): Promise<{ publicToken: string | null; tokenRevoked: boolean }> {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase.from("quotes").select("public_token, token_revoked_at").eq("id", quoteId).maybeSingle()
  return { publicToken: data?.public_token ?? null, tokenRevoked: Boolean(data?.token_revoked_at) }
}

// Texto de WhatsApp desde su plantilla (Configuración → Mensajes).
export async function buildQuoteWhatsappText(quote: QuoteDetail, link: string | null): Promise<Result<string>> {
  const [template, business] = await Promise.all([getMessageTemplate("quote"), getBusinessProfile()])
  if (!template?.enabled) return { ok: false, error: "El mensaje de presupuesto está apagado en Configuración → Mensajes de WhatsApp." }
  return {
    ok: true,
    data: renderTemplate(template.body, {
      cliente: quote.customer.name,
      negocio: business.tradeName ?? brandConfig.name,
      numero: quote.code,
      total: quoteTotalText(quote),
      vence: dmy(quote.validUntil),
      enlace: link ?? "",
    }),
  }
}

export async function logQuoteMessage(input: { quoteId: string; channel: "email" | "wa_link"; body: string; phone?: string | null; email?: string | null }) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("log_quote_message", {
    p_quote_id: input.quoteId,
    p_channel: input.channel,
    p_body: input.body,
    p_phone: input.phone ?? undefined,
    p_email: input.email ?? undefined,
  })
}

// Correo con el PDF adjunto. Responde a quien lo preparó.
export async function sendQuoteEmail(input: { quote: QuoteDetail; to: string; note: string | null; link: string | null }): Promise<Result> {
  if (!isQuoteEmailConfigured()) return { ok: false, error: "El correo no está configurado (RESEND_API_KEY y remitente)." }
  const { quote, to, note, link } = input
  const business = await getBusinessProfile()
  const companyName = business.tradeName ?? brandConfig.name
  const pdf = await getQuotePdf(quote)
  const total = quoteTotalText(quote)

  const { error } = await new Resend(serverEnv.RESEND_API_KEY).emails.send({
    from: serverEnv.NOTIFICATIONS_EMAIL_FROM!,
    to,
    replyTo: quote.createdBy.email ?? business.email ?? undefined,
    subject: `Presupuesto ${quote.code} · ${companyName}`,
    react: createElement(QuoteEmail, {
      companyName,
      customerName: quote.customer.name,
      code: quote.code,
      total,
      validUntil: dmy(quote.validUntil),
      note,
      link,
      sender: {
        name: quote.createdBy.name,
        phone: quote.createdBy.phone ? formatPhone(quote.createdBy.phone) : null,
        email: quote.createdBy.email,
      },
    }),
    attachments: [{ filename: `${quote.code}.pdf`, content: pdf }],
  })
  if (error) return { ok: false, error: `No se pudo enviar el correo: ${error.message}` }

  const summary = `Correo a ${to}: presupuesto ${quote.code} por ${total} (PDF adjunto).${note ? `\n\n${note}` : ""}`
  const logged = await logQuoteMessage({ quoteId: quote.id, channel: "email", body: summary, email: to })
  if (logged.error) console.error(`[quotes] correo de ${quote.code} enviado pero no registrado: ${logged.error.message}`)
  return { ok: true, data: undefined }
}

export async function revokeQuoteLink(quoteId: string) {
  const supabase = await createSupabaseServerClient()
  return supabase.rpc("revoke_quote_link", { p_quote_id: quoteId })
}

// Cuántas veces el cliente abrió el enlace y cuándo fue la última.
export async function getQuoteLinkViews(quoteId: string): Promise<{ count: number; lastAt: string | null }> {
  const supabase = await createSupabaseServerClient()
  const { data, count } = await supabase
    .from("quote_link_views")
    .select("created_at", { count: "exact" })
    .eq("quote_id", quoteId)
    .eq("allowed", true)
    .order("created_at", { ascending: false })
    .limit(1)
  return { count: count ?? 0, lastAt: data?.[0]?.created_at ?? null }
}

export type PublicQuoteOutcome = "ok" | "not_found" | "revoked" | "superseded" | "link_expired" | "rate_limited" | "unavailable"

// Resuelve un enlace público (sin sesión: con la clave de servicio, por la función de la base).
export async function resolvePublicQuote(token: string, ipHash: string): Promise<{ outcome: PublicQuoteOutcome; code?: string; pdfPath?: string | null }> {
  const admin = createSupabaseAdminClient()
  if (!admin) return { outcome: "unavailable" }
  const { data, error } = await admin.rpc("quote_public_lookup", { p_token: token, p_ip_hash: ipHash })
  const row = data?.[0]
  if (error || !row) return { outcome: "unavailable" }
  return { outcome: row.outcome as PublicQuoteOutcome, code: row.code ?? undefined, pdfPath: row.pdf_path }
}
