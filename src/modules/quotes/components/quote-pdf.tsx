import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer"

import { brandConfig } from "@/common/lib/config/brand.config"
import { documentTheme as t } from "@/common/lib/config/document-theme.config"
import { formatMoney } from "@/common/lib/utils/format-money.util"
import type { BusinessProfile } from "@/modules/business/lib/types/business.types"
import { formatPhone, formatTaxId } from "@/modules/customers/lib/utils/normalize-contact.util"

import type { QuoteDetail, QuoteItem, QuoteTotals } from "../lib/types/quotes.types"
import { groupQuoteItemsBySize, type QuoteDisplayRow } from "../lib/utils/group-by-size.util"

// PDF del presupuesto con @react-pdf/renderer. Misma distribución que QuoteDocument (pantalla) y
// que la referencia: logo y empresa arriba, cliente, tabla de artículos, totales y condiciones.
// Colores del tema (document-theme.config), nunca fijos. Fuente estándar Helvetica.

export type PdfImage = { data: Buffer; format: "png" | "jpg" } | null

const dmy = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-")
  return `${d}-${m}-${y}`
}
const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })
const variantText = (item: Pick<QuoteItem, "colorName" | "sizeName">) => [item.colorName, item.sizeName].filter(Boolean).join(" · ")

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9, color: t.foreground, backgroundColor: t.background },
  header: { flexDirection: "row", gap: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: t.border },
  logoBox: { width: 120, height: 80, alignItems: "center", justifyContent: "center" },
  logo: { maxWidth: 120, maxHeight: 80, objectFit: "contain" },
  placeholder: { width: 120, height: 80, backgroundColor: t.muted, alignItems: "center", justifyContent: "center" },
  monogram: { fontSize: 24, fontFamily: "Helvetica-Bold", color: t["muted-foreground"] },
  company: { flex: 1, gap: 3 },
  companyName: { fontSize: 15, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 2 },
  meta: { width: 120, alignItems: "flex-end", gap: 7 },
  label: { fontSize: 7.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  muted: { color: t["muted-foreground"] },
  bold: { fontFamily: "Helvetica-Bold" },
  section: { marginTop: 14, gap: 3 },
  customerName: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  table: { marginTop: 16 },
  thead: { flexDirection: "row", borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: t.foreground, paddingVertical: 6 },
  row: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: t.border, borderStyle: "dashed", paddingVertical: 6 },
  colItem: { flex: 1, paddingRight: 6 },
  colPrice: { width: 62, textAlign: "right" },
  colQty: { width: 40, textAlign: "right" },
  colTotal: { width: 68, textAlign: "right" },
  sub: { fontSize: 7.5, color: t["muted-foreground"], marginTop: 2 },
  totals: { marginTop: 14, marginLeft: "auto", width: 230, gap: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  grandTotal: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderTopWidth: 1, borderTopColor: t.border, paddingTop: 6 },
  grandValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },
  terms: { marginTop: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border, gap: 3, lineHeight: 1.35 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: t["muted-foreground"] },
  watermark: {
    position: "absolute",
    top: 330,
    left: 90,
    fontSize: 90,
    fontFamily: "Helvetica-Bold",
    color: t.border,
    transform: "rotate(-30deg)",
    opacity: 0.6,
  },
})

type QuotePdfProps = { quote: QuoteDetail; business: BusinessProfile; image: PdfImage; draft: boolean }

const QuotePdf = ({ quote, business, image, draft }: QuotePdfProps) => {
  const showUsd = quote.currencies !== "ves"
  const showVes = quote.currencies !== "usd"
  const rate = quote.vesRate ?? 0
  const usd = (v: number) => formatMoney(v, "USD")
  const bs = (v: number) => formatMoney(Math.round(v * rate * 100) / 100, "VES")
  const companyName = business.tradeName ?? brandConfig.name
  const rows: QuoteDisplayRow[] = quote.groupBySize
    ? groupQuoteItemsBySize(quote.items)
    : quote.items.filter((i) => !i.parentId).map((item) => ({ kind: "line", item }))
  const childrenOf = (id: string) => quote.items.filter((i) => i.parentId === id)

  const priceCells = (usdValue: number, vesValue: number, style: typeof s.colPrice) => (
    <>
      {showUsd && <Text style={style}>{usd(usdValue)}</Text>}
      {showVes && <Text style={style}>{bs(vesValue)}</Text>}
    </>
  )

  const totalsBlock = (label: string, totals: QuoteTotals, fmt: (v: number) => string) => (
    <View style={{ gap: 3 }}>
      {(totals.volumeDiscount > 0 || totals.discount > 0 || totals.vat > 0) && (
        <View style={[s.totalRow, s.muted]}>
          <Text>Subtotal</Text>
          <Text>{fmt(totals.subtotal)}</Text>
        </View>
      )}
      {totals.volumeDiscount > 0 && (
        <View style={[s.totalRow, s.muted]}>
          <Text>Precio al mayor ({quote.volumeDiscountPercent}%)</Text>
          <Text>-{fmt(totals.volumeDiscount)}</Text>
        </View>
      )}
      {totals.discount > 0 && (
        <View style={[s.totalRow, s.muted]}>
          <Text>Descuento</Text>
          <Text>-{fmt(totals.discount)}</Text>
        </View>
      )}
      {totals.vat > 0 && (
        <View style={[s.totalRow, s.muted]}>
          <Text>IVA ({quote.vatPercent}%)</Text>
          <Text>{fmt(totals.vat)}</Text>
        </View>
      )}
      <View style={s.grandTotal}>
        <Text style={s.label}>Total{label ? ` ${label}` : ""}</Text>
        <Text style={s.grandValue}>{fmt(totals.total)}</Text>
      </View>
    </View>
  )

  return (
    <Document title={`Presupuesto ${quote.code}`} author={companyName} subject={`Presupuesto para ${quote.customer.name}`} creator={companyName}>
      <Page size="LETTER" style={s.page}>
        {draft && (
          <Text style={s.watermark} fixed>
            BORRADOR
          </Text>
        )}

        {/* Encabezado */}
        <View style={s.header}>
          <View style={s.logoBox}>
            {image ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- Image de react-pdf no tiene alt
              <Image style={s.logo} src={image} />
            ) : (
              <View style={s.placeholder}>
                <Text style={s.monogram}>{brandConfig.monogram}</Text>
              </View>
            )}
          </View>
          <View style={s.company}>
            <Text style={s.companyName}>{companyName}</Text>
            {business.legalName && <Text>{business.legalName}</Text>}
            {business.taxId && (
              <Text>
                <Text style={s.bold}>RIF </Text>
                {formatTaxId(business.taxId)}
              </Text>
            )}
            {business.address && <Text>{business.address}</Text>}
            {business.phone && <Text>{formatPhone(business.phone)}</Text>}
            {business.email && <Text>{business.email}</Text>}
            {(business.instagram || business.website) && (
              <Text style={s.muted}>{[business.instagram && `@${business.instagram}`, business.website?.replace(/^https:\/\//, "")].filter(Boolean).join(" · ")}</Text>
            )}
          </View>
          <View style={s.meta}>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={s.label}>Presupuesto</Text>
              <Text>{quote.code}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={s.label}>Fecha</Text>
              <Text>{dmy(quote.issuedOn)}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={s.label}>Vence</Text>
              <Text>{dmy(quote.validUntil)}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={s.label}>Total</Text>
              <Text>{showUsd ? usd(quote.usd.total) : formatMoney(quote.ves.totalBs, "VES")}</Text>
            </View>
          </View>
        </View>

        {/* Cliente */}
        <View style={s.section}>
          <Text style={s.label}>Cliente</Text>
          <Text style={s.customerName}>{quote.customer.name || "-"}</Text>
          {quote.customer.legalName && quote.customer.legalName !== quote.customer.name && <Text>{quote.customer.legalName}</Text>}
          {quote.customer.taxId && <Text>RIF {formatTaxId(quote.customer.taxId)}</Text>}
          {quote.customer.contactPerson && <Text>Atención: {quote.customer.contactPerson}</Text>}
          {(quote.customer.phone || quote.customer.email) && (
            <Text style={s.muted}>{[quote.customer.phone && formatPhone(quote.customer.phone), quote.customer.email].filter(Boolean).join(" · ")}</Text>
          )}
          {quote.customer.address && <Text style={s.muted}>{quote.customer.address}</Text>}
        </View>

        {/* Artículos */}
        <View style={s.table}>
          <View style={s.thead} fixed>
            <Text style={[s.colItem, s.label]}>Artículo</Text>
            {showUsd && <Text style={[s.colPrice, s.label]}>Tarifa{showVes ? " USD" : ""}</Text>}
            {showVes && <Text style={[s.colPrice, s.label]}>Tarifa{showUsd ? " Bs" : ""}</Text>}
            <Text style={[s.colQty, s.label]}>Cant.</Text>
            {showUsd && <Text style={[s.colTotal, s.label]}>Total{showVes ? " USD" : ""}</Text>}
            {showVes && <Text style={[s.colTotal, s.label]}>Total{showUsd ? " Bs" : ""}</Text>}
          </View>
          {rows.map((row) => {
            if (row.kind === "group") {
              return (
                <View key={row.key} style={s.row} wrap={false}>
                  <View style={s.colItem}>
                    <Text>
                      {row.productName}
                      {row.colorName ? ` · ${row.colorName}` : ""}
                    </Text>
                    <Text style={s.sub}>Tallas: {row.sizes.map((size) => `${size.sizeName} ${quantityFormat.format(size.quantity)}`).join(" · ")}</Text>
                    {row.discountPercent > 0 && <Text style={s.sub}>Descuento {row.discountPercent}%</Text>}
                  </View>
                  {priceCells(row.usdUnitPrice, row.vesUnitPrice, s.colPrice)}
                  <Text style={s.colQty}>{quantityFormat.format(row.quantity)}</Text>
                  {priceCells(row.usdLineTotal, row.vesLineTotal, s.colTotal)}
                </View>
              )
            }
            const item = row.item
            const detail = item.kind === "combo" ? childrenOf(item.id) : []
            return (
              <View key={item.id}>
                <View style={s.row} wrap={false}>
                  <View style={s.colItem}>
                    <Text>
                      {item.productName}
                      {item.kind !== "combo" && variantText(item) ? ` · ${variantText(item)}` : ""}
                    </Text>
                    {detail.length > 0 && (
                      <Text style={s.sub}>
                        {detail.map((c) => `${quantityFormat.format(c.quantity)} × ${c.productName}${variantText(c) ? ` (${variantText(c)})` : ""}`).join(" · ")}
                      </Text>
                    )}
                    {item.discountPercent > 0 && <Text style={s.sub}>Descuento {item.discountPercent}%</Text>}
                  </View>
                  {priceCells(item.usdUnitPrice, item.vesUnitPrice, s.colPrice)}
                  <Text style={s.colQty}>{quantityFormat.format(item.quantity)}</Text>
                  {priceCells(item.usdLineTotal, item.vesLineTotal, s.colTotal)}
                </View>
                {item.customizations.map((c) => (
                  <View key={c.id} style={[s.row, s.muted]} wrap={false}>
                    <View style={[s.colItem, { paddingLeft: 10 }]}>
                      <Text>
                        {c.typeName}
                        {c.text ? ` · "${c.text}"` : ""}
                        {c.sizeCm ? ` · ${c.sizeCm} cm` : ""}
                        {c.position ? ` · ${c.position}` : ""}
                      </Text>
                      {c.discountPercent > 0 && <Text style={s.sub}>Precio al mayor {c.discountPercent}%</Text>}
                    </View>
                    {priceCells(c.unitPriceUsd, c.unitPriceUsd, s.colPrice)}
                    <Text style={s.colQty}>{quantityFormat.format(c.quantity)}</Text>
                    {priceCells(c.lineTotalUsd, c.lineTotalUsd, s.colTotal)}
                  </View>
                ))}
              </View>
            )
          })}
        </View>

        {/* Totales */}
        <View style={s.totals} wrap={false}>
          {showUsd && totalsBlock(showVes ? "USD" : "", quote.usd, usd)}
          {showVes && totalsBlock(showUsd ? "Bs" : "", quote.ves, bs)}
          {showVes && rate > 0 && (
            <Text style={[s.sub, { marginTop: 4 }]}>
              Montos en Bs referenciales a la tasa BCV del día ({rate.toLocaleString("es-VE", { maximumFractionDigits: 4 })} Bs) del {dmy(quote.issuedOn)}.
            </Text>
          )}
        </View>

        {/* Condiciones */}
        {(quote.terms || (quote.igtfNoteEnabled && quote.igtfNote)) && (
          <View style={s.terms} wrap={false}>
            <Text style={s.label}>Notas y condiciones</Text>
            {quote.terms
              ?.split("\n")
              .filter((line) => line.trim())
              .map((line, index) => (
                <Text key={index}>{line}</Text>
              ))}
            {quote.igtfNoteEnabled && quote.igtfNote && <Text style={s.muted}>{quote.igtfNote}</Text>}
          </View>
        )}

        <View style={[s.section, { marginTop: 18 }]} wrap={false}>
          <Text style={s.muted}>
            Elaborado por <Text style={[s.bold, { color: t.foreground }]}>{quote.createdBy.name}</Text>
            {quote.createdBy.phone || quote.createdBy.email
              ? ` · ${[quote.createdBy.phone && formatPhone(quote.createdBy.phone), quote.createdBy.email].filter(Boolean).join(" · ")}`
              : ""}
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            {quote.code} · Este presupuesto no es una factura.
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}

export default QuotePdf
