import { render } from "@react-email/render"
import { createElement } from "react"
import { describe, expect, it } from "vitest"

import AccessCodeEmail from "./access-code-email"
import InviteEmail from "./invite-email"

// Las plantillas de Supabase Auth (src/common/lib/supabase/templates) salen de estos componentes.
// Si cambian, esta prueba falla hasta regenerarlas con: npm run email:auth
const TEMPLATES = "../../../../common/lib/supabase/templates"

const header = (supabaseName: string) =>
  `<!--
  Generado desde src/modules/auth/components/emails con npm run email:auth. No editar a mano.
  Copiar este mismo contenido en Supabase → Authentication → Emails → ${supabaseName}.
-->
`

describe("plantillas de correo de Supabase Auth", () => {
  it("código de acceso (Magic Link): muestra {{ .Token }} y el logo desde {{ .SiteURL }}", async () => {
    const html = await render(createElement(AccessCodeEmail))
    expect(html).toContain("{{ .Token }}")
    expect(html).toContain("{{ .SiteURL }}/email/header.png")
    await expect(header("Magic Link") + html).toMatchFileSnapshot(`${TEMPLATES}/magic-link.html`)
  })

  it("invitación: enlace a /auth/confirm con el token_hash", async () => {
    const html = await render(createElement(InviteEmail))
    expect(html).toContain("{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite")
    expect(html).toContain("{{ if .Data.full_name }}")
    await expect(header("Invite user") + html).toMatchFileSnapshot(`${TEMPLATES}/invite.html`)
  })
})
