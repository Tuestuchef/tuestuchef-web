import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

import ProductionBoard from "../components/production-board"
import { BOARD_STAGES } from "../lib/constants/orders.constants"
import { listProductionCards } from "../lib/services/production.service"

// Tablero: una columna por etapa (y "listo" para sacarla); en el celular se desliza de lado.
const ProductionBoardScreen = async ({ user }: { user: SessionUser }) => {
  const cards = await listProductionCards()

  return (
    <div className="grid w-full gap-4">
      <PageHeader
        help="production"
        title="Tablero de producción"
        description="Arrastra cada línea a la columna de su etapa. Ordenadas por fecha prometida."
      />
      {cards.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No hay nada en producción.</p>
      ) : (
        <ProductionBoard cards={cards} stages={[...BOARD_STAGES, "ready"]} canGoBack={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} />
      )}
    </div>
  )
}

export default ProductionBoardScreen
