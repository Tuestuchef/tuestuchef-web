import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/common/components/ui/card"

import CategoryFormDialog from "../components/category-form-dialog"
import {
  CATEGORY_TYPE_HINTS,
  CATEGORY_TYPE_LABELS,
  EXPENSE_CATEGORY_TYPES,
  INCOME_CATEGORY_TYPES,
} from "../lib/constants/money-movements.constants"
import { listCategories } from "../lib/services/movement-categories.service"

const CategoriesScreen = async () => {
  const categories = await listCategories()
  const types = [...INCOME_CATEGORY_TYPES, ...EXPENSE_CATEGORY_TYPES]

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        title="Categorías"
        description="Cada movimiento lleva una categoría. Su tipo define cómo cuenta en la utilidad real."
        actions={<CategoryFormDialog />}
      />
      {types.map((type) => {
        const items = categories.filter((category) => category.type === type)
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="text-base">{CATEGORY_TYPE_LABELS[type]}</CardTitle>
              <p className="text-sm text-muted-foreground">{CATEGORY_TYPE_HINTS[type]}</p>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin categorías de este tipo.</p>
              ) : (
                <ul className="divide-y">
                  {items.map((category) => (
                    <li key={category.id} className="flex items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      {category.scope === "personal" && <StatusBadge tone="info">Personal</StatusBadge>}
                      {category.is_system && <StatusBadge tone="info">Sistema</StatusBadge>}
                      {!category.is_active && <StatusBadge tone="warning">Inactiva</StatusBadge>}
                      {!category.is_system && <CategoryFormDialog category={category} />}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default CategoriesScreen
