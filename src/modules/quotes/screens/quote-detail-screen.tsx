import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import StatusAlert from "@/common/components/status-alert"
import { Button } from "@/common/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate, formatTime } from "@/common/lib/utils/format-date.util"
import { getBusinessProfile, resolvePublicImageUrl } from "@/modules/business/lib/services/business-profile.service"
import MessageHistory from "@/modules/messages/components/message-history"

import QuoteActions from "../components/quote-actions"
import QuoteDocument from "../components/quote-document"
import QuoteLinkPanel from "../components/quote-link-panel"
import QuotePdfButtons from "../components/quote-pdf-buttons"
import QuoteStatusBadge from "../components/quote-status-badge"
import { QUOTE_STATUS_LABELS } from "../lib/constants/quotes.constants"
import { getQuoteLink, getQuoteLinkViews, isQuoteEmailConfigured, quotePublicUrl } from "../lib/services/quote-delivery.service"
import { getQuoteDetail } from "../lib/services/quotes.service"

const QuoteDetailScreen = async ({ id }: { id: string }) => {
  const [quote, business] = await Promise.all([getQuoteDetail(id), getBusinessProfile()])
  if (!quote) notFound()
  const headerImageUrl = quote.headerImagePath ? await resolvePublicImageUrl(quote.headerImagePath) : business.headerImageUrl
  const shared = quote.status !== "draft" && quote.status !== "discarded"
  const [link, views] = shared ? await Promise.all([getQuoteLink(quote.id), getQuoteLinkViews(quote.id)]) : [null, null]

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
        <Link href={ROUTES.QUOTES}>
          <ChevronLeftIcon aria-hidden />
          Presupuestos
        </Link>
      </Button>
      <PageHeader
        help="quote"
        className="pt-0"
        title={quote.code}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            <QuoteStatusBadge status={quote.effectiveStatus} />
            {quote.customer.name || "Sin cliente"}
          </span>
        }
      />

      {quote.supersededBy && (
        <StatusAlert tone="info" title="Hay una versión más nueva">
          <Link href={ROUTES.QUOTE(quote.supersededBy)} className="underline underline-offset-4">
            Ver la versión vigente
          </Link>
        </StatusAlert>
      )}
      {quote.status === "draft" && !quote.customerId && (
        <StatusAlert tone="info" title="Sin cliente guardado">
          Basta para enviarlo; para convertirlo en pedido se pedirá elegir o crear el cliente.
        </StatusAlert>
      )}

      <QuoteActions
        id={quote.id}
        code={quote.code}
        status={quote.effectiveStatus}
        isLatest={!quote.supersededBy}
        delivery={{ defaultEmail: quote.customer.email, defaultPhone: quote.customer.phone, emailConfigured: isQuoteEmailConfigured() }}
      />

      {link && views && (
        <QuoteLinkPanel
          id={quote.id}
          link={quotePublicUrl({ ...link, pdfPath: quote.pdfPath })}
          revoked={link.tokenRevoked}
          views={{ count: views.count, lastAtLabel: views.lastAt ? `${formatDate(views.lastAt)} · ${formatTime(views.lastAt)}` : null }}
        />
      )}

      <QuotePdfButtons id={quote.id} code={quote.code} />

      <QuoteDocument quote={quote} business={business} headerImageUrl={headerImageUrl} draft={quote.status === "draft"} />

      <MessageHistory filter={{ quoteId: quote.id }} />

      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-2 text-sm">
            {quote.events.map((e) => (
              <li key={e.id} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{QUOTE_STATUS_LABELS[e.status]}</span>
                <span className="text-muted-foreground">
                  {formatDate(e.at)} · {formatTime(e.at)} · {e.byName ?? "Sistema"}
                </span>
                {e.note && <span className="w-full text-muted-foreground">{e.note}</span>}
              </li>
            ))}
          </ol>
          {(quote.replacesId || quote.duplicatedFrom) && (
            <p className="mt-3 text-xs text-muted-foreground">
              {quote.replacesId && (
                <Link href={ROUTES.QUOTE(quote.replacesId)} className="underline underline-offset-4">
                  Ver la versión anterior
                </Link>
              )}
              {quote.duplicatedFrom && (
                <Link href={ROUTES.QUOTE(quote.duplicatedFrom)} className="underline underline-offset-4">
                  Ver el presupuesto original
                </Link>
              )}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default QuoteDetailScreen
