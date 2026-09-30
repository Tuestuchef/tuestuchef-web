import PageHeader from "@/common/components/page-header"
import { Card, CardContent } from "@/common/components/ui/card"

import SalesSettingsForm from "../components/sales-settings-form"
import { getSalesSettings } from "../lib/services/sales.service"

const SalesSettingsScreen = async () => {
  const settings = await getSalesSettings()

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader title="Ventas" description="Reglas para registrar ventas." />
      <Card>
        <CardContent>
          <SalesSettingsForm {...settings} />
        </CardContent>
      </Card>
    </div>
  )
}

export default SalesSettingsScreen
