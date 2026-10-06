import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent } from "@/common/components/ui/card"
import type { HelpTopicKey } from "@/common/lib/constants/help.constants"

import CatalogItemDialog from "../components/catalog-item-dialog"
import SizeSurchargesDialog from "../components/size-surcharges-dialog"
import { listCatalog } from "../lib/services/catalog.service"
import { listSizeSurcharges, listSurchargeableProducts } from "../lib/services/size-surcharges.service"
import type { CatalogKind } from "../lib/types/products.types"

const COPY: Record<
  CatalogKind,
  { title: string; description: string; noun: string; codeHint: string; help: HelpTopicKey }
> = {
  product_categories: {
    title: "Categorías de producto",
    description: "Filipinas, delantales, pantalones, estuches, gorros…",
    noun: "categoría",
    codeHint: "Ej.: FIL",
    help: "productCategories",
  },
  sizes: {
    title: "Tallas",
    description: "En el orden en que se muestran. La talla es opcional en cada variante. Recargo: lo que cuesta de más esa talla en ciertos productos (p. ej. 3XL).",
    noun: "talla",
    codeHint: "Ej.: XL",
    help: "sizes",
  },
  colors: {
    title: "Colores",
    description: "Nombre y código para el SKU (ej.: Vinotinta → VIN).",
    noun: "color",
    codeHint: "Ej.: VIN",
    help: "colors",
  },
}

// Pantalla común para las tres listas editables.
const CatalogScreen = async ({ kind }: { kind: CatalogKind }) => {
  const isSizes = kind === "sizes"
  const [items, surcharges, products] = await Promise.all([
    listCatalog(kind),
    isSizes ? listSizeSurcharges() : Promise.resolve({} as Record<string, Record<string, number>>),
    isSizes ? listSurchargeableProducts() : Promise.resolve([]),
  ])
  const copy = COPY[kind]

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        title={copy.title}
        help={copy.help}
        description={copy.description}
        actions={<CatalogItemDialog kind={kind} noun={copy.noun} codeHint={copy.codeHint} />}
      />
      <Card>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay elementos.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{item.code}</code>
                  {!item.is_active && <StatusBadge tone="warning">Inactivo</StatusBadge>}
                  {/* Solo tallas: productos que cobran más en esta talla. */}
                  {isSizes && <SizeSurchargesDialog size={item} products={products} current={surcharges[item.id] ?? {}} />}
                  <CatalogItemDialog kind={kind} noun={copy.noun} codeHint={copy.codeHint} item={item} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CatalogScreen
