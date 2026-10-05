import { permanentRedirect } from "next/navigation"

import { ROUTES } from "@/common/lib/constants/routes.constants"

// Dirección anterior de Datos de la empresa.
export default function OldBusinessProfilePage() {
  permanentRedirect(ROUTES.SETTINGS_BUSINESS)
}
