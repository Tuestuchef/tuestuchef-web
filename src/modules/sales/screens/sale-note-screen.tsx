import { ChevronLeftIcon } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

import Logo from "@/common/components/logo/logo"
import { Button } from "@/common/components/ui/button"
import { brandConfig } from "@/common/lib/config/brand.config"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import { formatDate } from "@/common/lib/utils/format-date.util"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import { getBusinessProfile } from "@/modules/business/lib/services/business-profile.service"
import { formatPhone, formatTaxId } from "@/modules/customers/lib/utils/normalize-contact.util"

import PrintButton from "../components/print-button"
import { formatSaleNumber, ITEM_STATUS_LABELS } from "../lib/constants/sales.constants"
import { getSaleDetail } from "../lib/services/sales.service"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const usd = (value: number) => formatMoney(value, "USD")

// Nota de entrega imprimible (no es factura fiscal). Marca de brand.config; contacto de Datos del negocio.
const SaleNoteScreen = async ({ id }: { id: string }) => {
  const [sale, business] = await Promise.all([getSaleDetail(id), getBusinessProfile()])
  if (!sale) notFound()
  const contactLine = [
    business.phone && formatPhone(business.phone),
    business.whatsapp && business.whatsapp !== business.phone && `WhatsApp ${formatPhone(business.whatsapp)}`,
    business.email,
    business.instagram && `@${business.instagram}`,
  ].filter(Boolean)

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button asChild variant="ghost" className="h-auto px-0 text-muted-foreground">
          <Link href={ROUTES.SALE(sale.id)}>
            <ChevronLeftIcon aria-hidden />
            Volver a la venta
          </Link>
        </Button>
        <PrintButton />
      </div>

      <article className="grid gap-6 rounded-lg border bg-card p-6 text-card-foreground print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="grid gap-1">
            <Logo variant="gradient-full" layout="inline" className="h-10" />
            <p className="text-xs text-muted-foreground">{brandConfig.slogan}</p>
            {contactLine.length > 0 && <p className="text-xs text-muted-foreground">{contactLine.join(" · ")}</p>}
            {business.address && <p className="text-xs text-muted-foreground">{business.address}</p>}
            {(business.legalName || business.taxId) && (
              <p className="text-xs text-muted-foreground">
                {[business.legalName, business.taxId && `RIF ${formatTaxId(business.taxId)}`].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="grid justify-items-end gap-0.5 text-right">
            <span className="text-sm font-semibold">Nota de entrega</span>
            <span className="font-mono text-sm">{formatSaleNumber(sale.number)}</span>
            <span className="text-xs text-muted-foreground">{formatDate(sale.occurredAt)}</span>
          </div>
        </header>

        <section className="text-sm">
          <span className="text-xs text-muted-foreground">Cliente</span>
          <p className="font-medium">{sale.customer?.name ?? "Cliente de mostrador"}</p>
        </section>

        {sale.void && (
          <p className="rounded-md border border-destructive p-2 text-center text-sm font-semibold text-destructive">
            ANULADA — {sale.void.reason}
          </p>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Cant.</th>
              <th className="py-2 font-medium">Descripción</th>
              <th className="py-2 text-right font-medium">Precio</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {sale.items.map((item) => (
              <tr key={item.id} className={item.parentId ? "align-top text-muted-foreground" : "border-b align-top"}>
                <td className={item.parentId ? "py-1 pl-3" : "py-2"}>{quantityFormat.format(item.quantity)}</td>
                <td className={item.parentId ? "py-1 pl-3" : "py-2"}>
                  {item.source === "combo" ? item.productName : `${item.productName} · ${item.variantLabel}`}
                  {item.source === "made_to_order" && (
                    <span className="block text-xs text-muted-foreground">
                      Por encargo{item.status ? ` · ${ITEM_STATUS_LABELS[item.status]}` : ""}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">{item.parentId ? "" : usd(item.unitPriceUsd)}</td>
                <td className="py-2 text-right">{item.parentId ? "" : usd(item.lineTotalUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="ml-auto grid w-full max-w-64 gap-1 text-sm tabular-nums">
          {(sale.volumeDiscount || sale.discount || sale.deliveryFeeUsd > 0 || sale.vat) && (
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{usd(sale.subtotalUsd)}</dd>
            </div>
          )}
          {sale.volumeDiscount && (
            <div className="flex justify-between">
              <dt>Al mayor {sale.volumeDiscount.percent}%</dt>
              <dd>−{usd(sale.volumeDiscount.usd)}</dd>
            </div>
          )}
          {sale.discount && (
            <div className="flex justify-between">
              <dt>Descuento</dt>
              <dd>−{usd(sale.discount.usd)}</dd>
            </div>
          )}
          {sale.deliveryFeeUsd > 0 && (
            <div className="flex justify-between">
              <dt>Delivery</dt>
              <dd>{usd(sale.deliveryFeeUsd)}</dd>
            </div>
          )}
          {sale.vat && (
            <div className="flex justify-between">
              <dt>IVA {sale.vat.percent}%</dt>
              <dd>{usd(sale.vat.usd)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <dt>Total</dt>
            <dd>{usd(sale.totalUsd)}</dd>
          </div>
          {sale.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-xs text-muted-foreground">
              <dt>
                {p.methodName} ({formatDate(p.occurredAt)})
              </dt>
              <dd>{formatMoney(p.amount, p.currency)}</dd>
            </div>
          ))}
          {!sale.void && sale.balanceUsd > 0.01 && (
            <div className="flex justify-between font-medium">
              <dt>Pendiente</dt>
              <dd>{usd(sale.balanceUsd)}</dd>
            </div>
          )}
        </dl>

        <footer className="text-center text-xs text-muted-foreground">
          Montos en dólares de referencia. Pagos en Bs a la tasa BCV del día del pago. Este documento no es una factura
          fiscal.
        </footer>
      </article>
    </div>
  )
}

export default SaleNoteScreen
