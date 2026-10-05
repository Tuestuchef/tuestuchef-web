import PageHeader from "@/common/components/page-header"
import { Card, CardContent } from "@/common/components/ui/card"
import { formatDate } from "@/common/lib/utils/format-date.util"

import QuoteSettingsForm from "../components/quote-settings-form"
import { getQuoteSettings, listPriceLists } from "../lib/services/quote-settings.service"

// Configuración de presupuestos (owner y admin).
const QuoteSettingsScreen = async () => {
  const [settings, priceLists] = await Promise.all([getQuoteSettings(), listPriceLists()])
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="quoteSettings"
        title="Presupuestos"
        description="Numeración, vigencia, listas de precios, IVA y condiciones por defecto."
      />
      <Card>
        <CardContent>
          <QuoteSettingsForm key={settings.updatedAt} settings={settings} priceLists={priceLists} />
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        Último cambio: {formatDate(settings.updatedAt)}
        {settings.updatedByName ? ` · ${settings.updatedByName}` : ""}
      </p>
    </div>
  )
}

export default QuoteSettingsScreen
