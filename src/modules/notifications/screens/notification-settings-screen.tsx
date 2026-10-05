import PageHeader from "@/common/components/page-header"

import NotificationSettingsPanel from "../components/notification-settings-panel"
import { isEmailConfigured, isPushConfigured } from "../lib/services/notification-dispatch.service"
import { getNotificationSettings } from "../lib/services/notification-settings.service"

// Configuración de avisos (owner y admin).
const NotificationSettingsScreen = async () => {
  const settings = await getNotificationSettings()
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="notificationSettings"
        title="Avisos"
        description="Qué avisos se envían, por qué canal y a quién. Salen cada mañana a las 7:00."
      />
      <NotificationSettingsPanel {...settings} emailConfigured={isEmailConfigured()} pushConfigured={isPushConfigured()} />
    </div>
  )
}

export default NotificationSettingsScreen
