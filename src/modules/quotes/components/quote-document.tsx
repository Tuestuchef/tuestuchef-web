import Logo from "@/common/components/logo/logo"
import { brandConfig } from "@/common/lib/config/brand.config"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import type { BusinessProfile } from "@/modules/business/lib/types/business.types"
import { formatPhone, formatTaxId } from "@/modules/customers/lib/utils/normalize-contact.util"

import type { QuoteDetail, QuoteItem } from "../lib/types/quotes.types"
import { groupQuoteItemsBySize, type QuoteDisplayRow } from "../lib/utils/group-by-size.util"

// DD-MM-AAAA, como en la referencia.
const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}-${m}-${y}`
}
const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

const variantText = (item: Pick<QuoteItem, "colorName" | "sizeName">) => [item.colorName, item.sizeName].filter(Boolean).join(" · ")

type QuoteDocumentProps = { quote: QuoteDetail; business: BusinessProfile; headerImageUrl: string | null; draft?: boolean }

// El presupuesto como lo ve el cliente (misma distribución que el PDF): empresa arriba, cliente,
// tabla de artículos, totales y condiciones. Sin colores fijos.
const QuoteDocument = ({ quote, business, headerImageUrl, draft }: QuoteDocumentProps) => {
  const showUsd = quote.currencies !== "ves"
  const showVes = quote.currencies !== "usd"
  const rate = quote.vesRate ?? 0
  const usd = (v: number) => formatMoney(v, "USD")
  const bs = (v: number) => formatMoney(Math.round(v * rate * 100) / 100, "VES")
  const rows: QuoteDisplayRow[] = quote.groupBySize
    ? groupQuoteItemsBySize(quote.items)
    : quote.items.filter((i) => !i.parentId).map((item) => ({ kind: "line", item }))
  const childrenOf = (id: string) => quote.items.filter((i) => i.parentId === id)
  const companyName = business.tradeName ?? brandConfig.name
  const mainTotal = showUsd ? usd(quote.usd.total) : formatMoney(quote.ves.totalBs, "VES")

  const totalsBlock = (label: string, t: QuoteDetail["usd"], fmt: (v: number) => string) => (
    <dl className="grid gap-1 text-sm tabular-nums">
      {(t.volumeDiscount > 0 || t.discount > 0 || t.vat > 0) && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Subtotal</dt>
          <dd>{fmt(t.subtotal)}</dd>
        </div>
      )}
      {t.volumeDiscount > 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Precio al mayor ({quote.volumeDiscountPercent}%)</dt>
          <dd>−{fmt(t.volumeDiscount)}</dd>
        </div>
      )}
      {t.discount > 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>Descuento</dt>
          <dd>−{fmt(t.discount)}</dd>
        </div>
      )}
      {t.vat > 0 && (
        <div className="flex justify-between gap-4 text-muted-foreground">
          <dt>IVA ({quote.vatPercent}%)</dt>
          <dd>{fmt(t.vat)}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t pt-2">
        <dt className="text-xs font-semibold tracking-wide uppercase">Total{label ? ` ${label}` : ""}</dt>
        <dd className="text-lg font-semibold">{fmt(t.total)}</dd>
      </div>
    </dl>
  )

  return (
    <article className="relative grid gap-6 rounded-lg border bg-card p-5 text-card-foreground sm:p-8">
      {draft && (
        <span className="absolute top-3 right-3 rounded border px-2 py-0.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">Borrador</span>
      )}

      {/* Encabezado */}
      <header className="grid gap-4 border-b pb-5 sm:grid-cols-[auto_1fr_auto]">
        <div className="flex h-24 w-40 items-center justify-center overflow-hidden">
          {headerImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen de R2
            <img src={headerImageUrl} alt={companyName} className="max-h-full max-w-full object-contain" />
          ) : (
            <Logo variant="gradient-full" className="h-20" />
          )}
        </div>
        <div className="grid content-start gap-1 text-sm">
          <span className="text-lg font-semibold uppercase">{companyName}</span>
          {business.legalName && <span>{business.legalName}</span>}
          {business.taxId && (
            <span>
              <span className="font-semibold">RIF</span> {formatTaxId(business.taxId)}
            </span>
          )}
          {business.address && <span>{business.address}</span>}
          {business.phone && <span>{formatPhone(business.phone)}</span>}
          {business.email && <span>{business.email}</span>}
          {(business.instagram || business.website) && (
            <span className="text-muted-foreground">{[business.instagram && `@${business.instagram}`, business.website?.replace(/^https:\/\//, "")].filter(Boolean).join(" · ")}</span>
          )}
        </div>
        <dl className="grid content-start gap-2 text-sm sm:text-right">
          <div>
            <dt className="text-xs font-semibold uppercase">Presupuesto</dt>
            <dd className="font-mono">{quote.code}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase">Fecha</dt>
            <dd>{dmy(quote.issuedOn)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase">Vence</dt>
            <dd>{dmy(quote.validUntil)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase">Total</dt>
            <dd>{mainTotal}</dd>
          </div>
        </dl>
      </header>

      {/* Cliente */}
      <section className="grid gap-1 text-sm">
        <span className="text-xs font-semibold uppercase">Cliente</span>
        <span className="text-lg font-semibold uppercase">{quote.customer.name || "—"}</span>
        {quote.customer.legalName && quote.customer.legalName !== quote.customer.name && <span>{quote.customer.legalName}</span>}
        {quote.customer.taxId && <span>RIF {formatTaxId(quote.customer.taxId)}</span>}
        {quote.customer.contactPerson && <span>Atención: {quote.customer.contactPerson}</span>}
        {(quote.customer.phone || quote.customer.email) && (
          <span className="text-muted-foreground">{[quote.customer.phone && formatPhone(quote.customer.phone), quote.customer.email].filter(Boolean).join(" · ")}</span>
        )}
        {quote.customer.address && <span className="text-muted-foreground">{quote.customer.address}</span>}
      </section>

      {/* Artículos */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-y-2 border-foreground text-xs font-semibold uppercase">
              <th className="py-2 text-left">Artículo</th>
              {showUsd && <th className="py-2 text-right">Tarifa{showVes ? " USD" : ""}</th>}
              {showVes && <th className="py-2 text-right">Tarifa{showUsd ? " Bs" : ""}</th>}
              <th className="py-2 text-right">Cant.</th>
              {showUsd && <th className="py-2 text-right">Total{showVes ? " USD" : ""}</th>}
              {showVes && <th className="py-2 text-right">Total{showUsd ? " Bs" : ""}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              if (row.kind === "group") {
                return (
                  <tr key={row.key} className="border-b border-dashed align-top">
                    <td className="py-2">
                      {row.productName}
                      {row.colorName ? ` · ${row.colorName}` : ""}
                      <div className="text-xs text-muted-foreground">Tallas: {row.sizes.map((s) => `${s.sizeName} ${quantityFormat.format(s.quantity)}`).join(" · ")}</div>
                      {row.discountPercent > 0 && <div className="text-xs text-muted-foreground">Descuento {row.discountPercent}%</div>}
                    </td>
                    {showUsd && <td className="py-2 text-right tabular-nums">{usd(row.usdUnitPrice)}</td>}
                    {showVes && <td className="py-2 text-right tabular-nums">{bs(row.vesUnitPrice)}</td>}
                    <td className="py-2 text-right tabular-nums">{quantityFormat.format(row.quantity)}</td>
                    {showUsd && <td className="py-2 text-right tabular-nums">{usd(row.usdLineTotal)}</td>}
                    {showVes && <td className="py-2 text-right tabular-nums">{bs(row.vesLineTotal)}</td>}
                  </tr>
                )
              }
              const item = row.item
              const detail = item.kind === "combo" ? childrenOf(item.id) : []
              return [
                <tr key={item.id} className="border-b border-dashed align-top">
                  <td className="py-2">
                    {item.productName}
                    {item.kind !== "combo" && variantText(item) ? ` · ${variantText(item)}` : ""}
                    {detail.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {detail.map((c) => `${quantityFormat.format(c.quantity)} × ${c.productName}${variantText(c) ? ` (${variantText(c)})` : ""}`).join(" · ")}
                      </div>
                    )}
                    {item.discountPercent > 0 && <div className="text-xs text-muted-foreground">Descuento {item.discountPercent}%</div>}
                  </td>
                  {showUsd && <td className="py-2 text-right tabular-nums">{usd(item.usdUnitPrice)}</td>}
                  {showVes && <td className="py-2 text-right tabular-nums">{bs(item.vesUnitPrice)}</td>}
                  <td className="py-2 text-right tabular-nums">{quantityFormat.format(item.quantity)}</td>
                  {showUsd && <td className="py-2 text-right tabular-nums">{usd(item.usdLineTotal)}</td>}
                  {showVes && <td className="py-2 text-right tabular-nums">{bs(item.vesLineTotal)}</td>}
                </tr>,
                ...item.customizations.map((c) => (
                  <tr key={c.id} className="border-b border-dashed align-top text-muted-foreground">
                    <td className="py-2 pl-4">
                      {c.typeName}
                      {c.text ? ` · "${c.text}"` : ""}
                      {c.sizeCm ? ` · ${c.sizeCm} cm` : ""}
                      {c.position ? ` · ${c.position}` : ""}
                      {c.discountPercent > 0 && <div className="text-xs">Precio al mayor {c.discountPercent}%</div>}
                    </td>
                    {showUsd && <td className="py-2 text-right tabular-nums">{usd(c.unitPriceUsd)}</td>}
                    {showVes && <td className="py-2 text-right tabular-nums">{bs(c.unitPriceUsd)}</td>}
                    <td className="py-2 text-right tabular-nums">{quantityFormat.format(c.quantity)}</td>
                    {showUsd && <td className="py-2 text-right tabular-nums">{usd(c.lineTotalUsd)}</td>}
                    {showVes && <td className="py-2 text-right tabular-nums">{bs(c.lineTotalUsd)}</td>}
                  </tr>
                )),
              ]
            })}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="grid gap-4 sm:ml-auto sm:w-80">
        {showUsd && totalsBlock(showVes ? "USD" : "", quote.usd, usd)}
        {showVes && totalsBlock(showUsd ? "Bs" : "", quote.ves, bs)}
        {showVes && rate > 0 && (
          <p className="text-xs text-muted-foreground">Montos en Bs referenciales a la tasa BCV del día ({rate.toLocaleString("es-VE", { maximumFractionDigits: 4 })} Bs) del {dmy(quote.issuedOn)}.</p>
        )}
      </div>

      {/* Condiciones */}
      {(quote.terms || (quote.igtfNoteEnabled && quote.igtfNote)) && (
        <section className="grid gap-2 border-t pt-4 text-sm">
          <span className="text-xs font-semibold uppercase">Notas y condiciones</span>
          {quote.terms && <p className="whitespace-pre-line">{quote.terms}</p>}
          {quote.igtfNoteEnabled && quote.igtfNote && <p className="text-muted-foreground">{quote.igtfNote}</p>}
        </section>
      )}

      <footer className="grid gap-0.5 border-t pt-4 text-xs text-muted-foreground">
        <span>
          Elaborado por <span className="font-medium text-foreground">{quote.createdBy.name}</span>
        </span>
        {(quote.createdBy.phone || quote.createdBy.email) && (
          <span>{[quote.createdBy.phone && formatPhone(quote.createdBy.phone), quote.createdBy.email].filter(Boolean).join(" · ")}</span>
        )}
        <span>Este presupuesto no es una factura.</span>
      </footer>
    </article>
  )
}

export default QuoteDocument
