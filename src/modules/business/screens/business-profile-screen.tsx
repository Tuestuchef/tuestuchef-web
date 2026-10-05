import PageHeader from "@/common/components/page-header"
import { Card, CardContent } from "@/common/components/ui/card"
import { formatDate } from "@/common/lib/utils/format-date.util"

import BusinessProfileForm from "../components/business-profile-form"
import { getBusinessProfile } from "../lib/services/business-profile.service"

// Datos de contacto del negocio (owner y admin). Salen en la nota de entrega.
const BusinessProfileScreen = async () => {
  const profile = await getBusinessProfile()
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="businessProfile"
        title="Datos del negocio"
        description="El contacto que ven los clientes en la nota de entrega. Todo es opcional: lo que quede vacío no se muestra."
      />
      <Card>
        <CardContent>
          <BusinessProfileForm key={profile.updatedAt ?? "new"} profile={profile} />
        </CardContent>
      </Card>
      {profile.updatedAt && (
        <p className="text-center text-xs text-muted-foreground">
          Último cambio: {formatDate(profile.updatedAt)}
          {profile.updatedByName ? ` · ${profile.updatedByName}` : ""}
        </p>
      )}
    </div>
  )
}

export default BusinessProfileScreen
