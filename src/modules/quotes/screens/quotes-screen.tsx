import { PlusIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import QuoteFilters from "../components/quote-filters"
import QuoteList from "../components/quote-list"
import type { QuoteFilters as Filters } from "../lib/schemas/quote.schema"
import { listQuotes } from "../lib/services/quotes.service"

const QuotesScreen = async ({ filters }: { filters: Filters }) => {
  const quotes = await listQuotes(filters)
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        help="quotes"
        title="Presupuestos"
        description="Para empresas y pedidos grandes. Un presupuesto no es una factura."
        actions={
          <Button asChild className="h-11 md:h-9">
            <Link href={ROUTES.NEW_QUOTE}>
              <PlusIcon aria-hidden />
              Nuevo presupuesto
            </Link>
          </Button>
        }
      />
      <QuoteFilters filters={filters} />
      <QuoteList quotes={quotes} />
    </div>
  )
}

export default QuotesScreen
