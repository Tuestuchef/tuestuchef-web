import PageHeader from "@/common/components/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/common/components/ui/card"
import { isStorageEnabled } from "@/common/lib/services/storage.service"
import { formatDate } from "@/common/lib/utils/format-date.util"

import BusinessProfileForm from "../components/business-profile-form"
import HeaderImageField from "../components/header-image-field"
import { getBusinessProfile } from "../lib/services/business-profile.service"

// Datos de la empresa (owner y admin). Salen en presupuestos y en la nota de entrega.
const BusinessProfileScreen = async () => {
  const profile = await getBusinessProfile()
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="businessProfile"
        title="Datos de la empresa"
        description="Lo que ven los clientes en presupuestos y notas de entrega. Todo es opcional: lo que quede vacío no se muestra."
      />
      <Card>
        <CardHeader>
          <CardTitle>Imagen del encabezado</CardTitle>
          <CardDescription>El logo de los presupuestos. Un presupuesto puede usar otra imagen si hace falta.</CardDescription>
        </CardHeader>
        <CardContent>
          <HeaderImageField imageUrl={profile.headerImageUrl} enabled={isStorageEnabled()} />
        </CardContent>
      </Card>
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
