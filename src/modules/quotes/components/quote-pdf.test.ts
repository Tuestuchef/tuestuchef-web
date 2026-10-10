import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import sharp from "sharp"
import { describe, expect, it } from "vitest"

import type { BusinessProfile } from "@/modules/business/lib/types/business.types"

import type { QuoteDetail, QuoteItem } from "../lib/types/quotes.types"
import QuotePdf, { type PdfGalleryImage } from "./quote-pdf"

const item = (over: Partial<QuoteItem>): QuoteItem => ({
  id: crypto.randomUUID(),
  parentId: null,
  kind: "product",
  variantId: "v",
  productName: "Filipina manga corta",
  sku: "FIL-B-M",
  genderName: null,
  colorName: "Blanco",
  sizeName: "M",
  sizeSort: 2,
  quantity: 12,
  discountPercent: 0,
  usdUnitPrice: 37,
  vesUnitPrice: 40,
  usdLineTotal: 444,
  vesLineTotal: 480,
  customizations: [],
  ...over,
})

const totals = { subtotal: 684, volumeDiscount: 34.2, lineDiscounts: 0, discount: 0, vat: 103.97, total: 753.77 }

const quote = (over: Partial<QuoteDetail> = {}): QuoteDetail => ({
  id: "q",
  code: "TLT00001",
  number: 1,
  version: 1,
  status: "sent",
  effectiveStatus: "sent",
  customerId: null,
  customer: { kind: "company", name: "Litoral", legalName: "Inversiones Litoral C.A.", taxId: "J123456789", phone: "+584141111111", email: null, address: "Caracas", contactPerson: "María" },
  issuedOn: "2026-10-05",
  validUntil: "2026-10-12",
  currencies: "both",
  usdPriceList: { id: "u", name: "Efectivo" },
  vesPriceList: { id: "v", name: "Pago móvil" },
  vesRate: 40,
  vatEnabled: true,
  vatPercent: 16,
  igtfNoteEnabled: true,
  igtfNote: "Los pagos en divisas pueden estar sujetos al IGTF.",
  discount: null,
  discountReason: null,
  groupBySize: true,
  terms: "Vigencia: 7 días.\nAbono: 60% para empezar.",
  headerImagePath: null,
  images: [],
  pieces: 24,
  volumeDiscountPercent: 5,
  customizationTotalUsd: 0,
  usd: totals,
  ves: { ...totals, totalBs: 32_000 },
  createdBy: { name: "Ana Pérez", email: "ana@tuestuchef.com", phone: null },
  createdAt: "2026-10-05T12:00:00Z",
  replacesId: null,
  supersededBy: null,
  duplicatedFrom: null,
  orderSaleId: null,
  orderNumber: null,
  pdfPath: null,
  items: [
    item({ sizeName: "S", sizeSort: 1 }),
    item({ sizeName: "L", sizeSort: 3 }),
    item({
      productName: "Mono de cocina",
      sizeName: null,
      colorName: null,
      usdUnitPrice: 20,
      customizations: [
        { id: "c", typeId: "t", typeName: "Nombre bordado", quantity: 12, sizeCm: null, position: "Pecho", text: null, note: null, unitPriceUsd: 4, discountPercent: 0, lineTotalUsd: 48 },
      ],
    }),
  ],
  events: [],
  ...over,
})

const business: BusinessProfile = {
  tradeName: "Tuestuchef",
  legalName: "Tuestuchef C.A.",
  taxId: "J412398434",
  email: "contacto@tuestuchef.com",
  phone: "+584241099765",
  whatsapp: null,
  instagram: "tuestuchef",
  website: "https://tuestuchef.com",
  address: "Caracas, Distrito Capital, Venezuela",
  headerImagePath: null,
  headerImageUrl: null,
  updatedAt: null,
  updatedByName: null,
}

const render = (q: QuoteDetail, draft: boolean, gallery: PdfGalleryImage[] = []) =>
  renderToBuffer(createElement(QuotePdf, { quote: q, business, image: null, gallery, draft }) as ReactElement<DocumentProps>)

describe("PDF del presupuesto", () => {
  it("se genera en ambas monedas, agrupado por talla, con IVA y como borrador", async () => {
    const pdf = await render(quote(), true)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it("lleva las imágenes (convertidas a JPG) con su nombre después de los artículos", async () => {
    // Una foto WEBP como las del catálogo: sharp la pasa a JPG, igual que al generar el PDF real.
    const webp = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 150, g: 13, b: 19 } } }).webp().toBuffer()
    const jpg = await sharp(webp).resize({ width: 900, height: 900, fit: "inside" }).jpeg({ quality: 80 }).toBuffer()
    const without = await render(quote(), false)
    const withImages = await render(quote(), false, [
      { label: "Filipina manga corta · Vinotinto", data: jpg },
      { label: null, data: jpg },
    ])
    expect(withImages.subarray(0, 5).toString()).toBe("%PDF-")
    expect(withImages.length).toBeGreaterThan(without.length)
  })

  it("se genera solo en USD y con muchas líneas (varias páginas)", async () => {
    const many = Array.from({ length: 60 }, (_, i) => item({ productName: `Producto ${i + 1}`, sizeName: null }))
    const pdf = await render(quote({ currencies: "usd", groupBySize: false, items: many }), false)
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })
})
