import EmailLayout, { EmailButton, EmailHeading, EmailText } from "@/common/components/email/email-layout"

// Invitación al panel. Es una plantilla de Supabase Auth ("Invite user"): las variables {{ ... }}
// las reemplaza Supabase al enviar. El enlace va a /auth/confirm (flujo con token_hash, compatible
// con SSR). El HTML se genera con npm run email:auth (ver auth-email-templates.test.ts).
const InviteEmail = () => (
  <EmailLayout
    preview="Te dieron acceso al panel de Tuestuchef"
    siteUrl="{{ .SiteURL }}"
    footer="El enlace vence pronto; si ya no funciona, pide que te inviten de nuevo. Si no esperabas este correo, ignóralo."
  >
    <EmailHeading>Te invitaron al panel de Tuestuchef</EmailHeading>
    <EmailText>{"Hola{{ if .Data.full_name }}, {{ .Data.full_name }}{{ end }}."}</EmailText>
    <EmailText>Te dieron acceso al panel administrativo de Tuestuchef.</EmailText>
    <EmailButton href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Aceptar invitación</EmailButton>
    <EmailText muted>
      No necesitas contraseña: las próximas veces entras con tu correo y un código que te enviamos. Si tu rol es dueño o
      administrador, el panel te pedirá activar una app autenticadora.
    </EmailText>
  </EmailLayout>
)

export default InviteEmail
