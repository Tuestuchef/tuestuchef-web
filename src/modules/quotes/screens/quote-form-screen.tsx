import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import type { SessionUser } from "@/common/lib/types/session.types"
import { getBusinessProfile, resolvePublicImageUrl } from "@/modules/business/lib/services/business-profile.service"

import QuoteForm from "../components/quote-form"
import { getQuoteDetail, getQuoteFormData } from "../lib/services/quotes.service"

// Nuevo presupuesto (sin id) o edición de un borrador.
const QuoteFormScreen = async ({ user, id }: { user: SessionUser; id?: string }) => {
  const [formData, quote, business] = await Promise.all([getQuoteFormData(), id ? getQuoteDetail(id) : Promise.resolve(null), getBusinessProfile()])
  if (id && !quote) notFound()
  // Solo un borrador se edita: lo demás se cambia con una versión nueva.
  if (quote && quote.status !== "draft") redirect(ROUTES.QUOTE(quote.id))

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      {quote && (
        <Button asChild variant="ghost" className="h-auto w-fit px-0 text-muted-foreground">
          <Link href={ROUTES.QUOTE(quote.id)}>
            <ChevronLeftIcon aria-hidden />
            {quote.code}
          </Link>
        </Button>
      )}
      <PageHeader
        help="quoteForm"
        className={quote ? "pt-0" : undefined}
        title={quote ? `Editar ${quote.code}` : "Nuevo presupuesto"}
        description="Los precios, la tasa y la fecha se actualizan cada vez que guardas el borrador."
      />
      <QuoteForm
        {...formData}
        canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)}
        quote={quote ?? undefined}
        storageEnabled={isStorageEnabled()}
        companyHeaderUrl={business.headerImageUrl}
        quoteHeaderUrl={quote?.headerImagePath ? await resolvePublicImageUrl(quote.headerImagePath) : null}
      />
    </div>
  )
}

export default QuoteFormScreen
