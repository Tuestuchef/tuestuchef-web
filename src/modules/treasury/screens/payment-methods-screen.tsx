import PageHeader from "@/common/components/page-header"
import StatusBadge from "@/common/components/status-badge"
import { Card, CardContent } from "@/common/components/ui/card"
import { CURRENCY_LABELS } from "@/common/lib/constants/currency.constants"

import PaymentMethodFormDialog from "../components/payment-method-form-dialog"
import { listAccounts } from "../lib/services/accounts.service"
import { listPaymentMethods } from "../lib/services/payment-methods.service"

const PaymentMethodsScreen = async () => {
  const [methods, accounts] = await Promise.all([listPaymentMethods(), listAccounts()])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <PageHeader
        title="Métodos de pago"
        description="Cómo te pagan los clientes y a qué cuenta llega el dinero."
        actions={<PaymentMethodFormDialog accounts={accounts} />}
      />
      <Card>
        <CardContent>
          {methods.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay métodos de pago.</p>
          ) : (
            <ul className="divide-y">
              {methods.map((method) => (
                <li key={method.id} className="flex items-center gap-3 py-3">
                  <div className="grid min-w-0 flex-1">
                    <span className="truncate font-medium">{method.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Llega a {method.account?.name ?? "—"} · Precios en {CURRENCY_LABELS[method.price_currency]}
                    </span>
                  </div>
                  {!method.is_active && <StatusBadge tone="info">Inactivo</StatusBadge>}
                  <PaymentMethodFormDialog accounts={accounts} paymentMethod={method} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentMethodsScreen
