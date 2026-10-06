import { Text } from "@react-email/components"

import EmailLayout, { EmailHeading, EmailHighlight, EmailText } from "@/common/components/email/email-layout"
import { documentTheme as t } from "@/common/lib/config/document-theme.config"

// Código de acceso. Es una plantilla de Supabase Auth ("Magic Link", la que usa signInWithOtp):
// {{ .Token }} y {{ .SiteURL }} los reemplaza Supabase al enviar. El HTML se genera con
// npm run email:auth (ver auth-email-templates.test.ts).
const AccessCodeEmail = () => (
  <EmailLayout
    preview="Tu código para entrar a Tuestuchef: {{ .Token }}"
    siteUrl="{{ .SiteURL }}"
    footer="Si no lo pediste tú, ignora este correo: nadie puede entrar sin el código."
  >
    <EmailHeading>Tu código para entrar</EmailHeading>
    <EmailText>Escribe este código en el panel:</EmailText>
    <EmailHighlight>
      <Text
        style={{
          color: t.foreground,
          fontFamily: "ui-monospace, Menlo, Consolas, monospace",
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: 8,
          lineHeight: "40px",
          margin: 0,
          textAlign: "center",
        }}
      >
        {"{{ .Token }}"}
      </Text>
    </EmailHighlight>
    <EmailText muted>Vence en 10 minutos.</EmailText>
  </EmailLayout>
)

export default AccessCodeEmail
