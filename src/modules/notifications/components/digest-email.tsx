import { Link, Section, Text } from "@react-email/components"

import EmailLayout, { EmailButton, EmailHeading, EmailSubheading, EmailText } from "@/common/components/email/email-layout"
import { brandConfig } from "@/common/lib/config/brand.config"
import { documentTheme as t } from "@/common/lib/config/document-theme.config"

import type { DigestSection } from "../lib/utils/digest.util"

type DigestEmailProps = {
  name: string
  dateLabel: string
  sections: DigestSection[]
  siteUrl: string
}

// Resumen diario de avisos: una sección por aviso, cada pendiente con su enlace.
const DigestEmail = ({ name, dateLabel, sections, siteUrl }: DigestEmailProps) => {
  const total = sections.reduce((sum, s) => sum + s.items.length, 0)
  return (
    <EmailLayout
      preview={`${total} ${total === 1 ? "aviso" : "avisos"} de ${brandConfig.name} · ${sections.map((s) => s.title).join(", ")}`}
      siteUrl={siteUrl}
      footer="Recibes este correo por tu rol en el panel. Owner y admin cambian qué avisos se envían en Configuración → Avisos."
    >
      <EmailText muted style={{ margin: "0 0 4px" }}>
        {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
      </EmailText>
      <EmailHeading>Hola{name ? `, ${name.split(" ")[0]}` : ""}. Esto necesita atención hoy</EmailHeading>

      {sections.map((section) => (
        <Section key={section.kind}>
          <EmailSubheading>
            {section.title} ({section.items.length})
          </EmailSubheading>
          {section.items.map((item) => (
            <Text
              key={item.key}
              style={{ borderBottom: `1px solid ${t.border}`, fontSize: 14, lineHeight: "20px", margin: 0, padding: "10px 0" }}
            >
              <Link href={`${siteUrl}${item.url}`} style={{ color: t.foreground, fontWeight: 700, textDecoration: "underline" }}>
                {item.title}
              </Link>
              <br />
              <span style={{ color: t["muted-foreground"] }}>{item.detail}</span>
            </Text>
          ))}
          <Text style={{ fontSize: 13, margin: "10px 0 0" }}>
            <Link href={`${siteUrl}${section.listUrl}`} style={{ color: t.foreground, textDecoration: "underline" }}>
              Ver todo
            </Link>
          </Text>
        </Section>
      ))}

      <EmailButton href={siteUrl}>Abrir el panel</EmailButton>
    </EmailLayout>
  )
}

export default DigestEmail
