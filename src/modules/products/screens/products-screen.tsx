import { ArrowDownUpIcon } from "lucide-react"
import Link from "next/link"

import PageHeader from "@/common/components/page-header"
import { Button } from "@/common/components/ui/button"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

import ProductFilters from "../components/product-filters"
import ProductFormDialog from "../components/product-form-dialog"
import ProductList from "../components/product-list"
import { listCatalog } from "../lib/services/catalog.service"
import { listProducts } from "../lib/services/products.service"

type ProductsScreenProps = {
  user: SessionUser
  filters: { search?: string; categoryId?: string }
}

const ProductsScreen = async ({ user, filters }: ProductsScreenProps) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  const [products, categories] = await Promise.all([listProducts(filters), listCatalog("product_categories")])

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4">
      <PageHeader
        help="products"
        title="Productos"
        description="Modelos, variantes, precios y existencias."
        actions={
          <>
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href={ROUTES.STOCK}>
                <ArrowDownUpIcon aria-hidden />
                Stock
              </Link>
            </Button>
            {canManage && <ProductFormDialog categories={categories} />}
          </>
        }
      />
      <ProductFilters categories={categories} />
      <ProductList products={products} />
    </div>
  )
}

export default ProductsScreen
