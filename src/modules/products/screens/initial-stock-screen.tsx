import PageHeader from "@/common/components/page-header"
import { Card, CardContent } from "@/common/components/ui/card"

import InitialStockImport from "../components/initial-stock-import"

const InitialStockScreen = () => (
  <div className="mx-auto grid w-full max-w-2xl gap-4">
    <PageHeader
      help="initialStock"
      title="Carga inicial de stock"
      description="Una sola vez por variante, antes de cualquier otro movimiento. Se carga todo o nada."
    />
    <Card>
      <CardContent>
        <InitialStockImport />
      </CardContent>
    </Card>
  </div>
)

export default InitialStockScreen
