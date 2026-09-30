import PageHeader from "@/common/components/page-header"
import { isRoleIn, ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import type { SessionUser } from "@/common/lib/types/session.types"

import CustomerFormDialog from "../components/customer-form-dialog"
import CustomerList from "../components/customer-list"
import CustomerSearchInput from "../components/customer-search-input"
import { CUSTOMER_LIST_LIMIT } from "../lib/constants/customers.constants"
import { listCustomers } from "../lib/services/customers.service"

const CustomersScreen = async ({ user, search }: { user: SessionUser; search?: string }) => {
  const customers = await listCustomers({ search })

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="customers"
        title="Clientes"
        description="Datos de contacto e historial de compras."
        actions={<CustomerFormDialog canManage={isRoleIn(user.role, ROLE_GROUPS.MANAGEMENT)} />}
      />
      <CustomerSearchInput />
      <CustomerList customers={customers} searching={Boolean(search)} />
      {customers.length === CUSTOMER_LIST_LIMIT && (
        <p className="text-center text-xs text-muted-foreground">
          Se muestran los primeros {CUSTOMER_LIST_LIMIT}. Busca para encontrar a alguien en particular.
        </p>
      )}
    </div>
  )
}

export default CustomersScreen
