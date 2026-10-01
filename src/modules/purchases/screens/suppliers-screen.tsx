import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

import SupplierFormDialog from "../components/supplier-form-dialog"
import SupplierList from "../components/supplier-list"
import { listSuppliers } from "../lib/services/suppliers.service"

const SuppliersScreen = async ({ user }: { user: SessionUser }) => {
  const canManage = isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)
  // Saldos con proveedores: solo owner y admin.
  const suppliers = await listSuppliers({ withBalances: canManage })

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="suppliers"
        title="Proveedores"
        description="A quién le compramos."
        actions={<SupplierFormDialog canManage={canManage} />}
      />
      <SupplierList suppliers={suppliers} />
    </div>
  )
}

export default SuppliersScreen
