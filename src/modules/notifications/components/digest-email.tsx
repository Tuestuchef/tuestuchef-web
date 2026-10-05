import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components"

import { brandConfig } from "@/common/lib/config/brand.config"

import type { DigestSection } from "../lib/utils/digest.util"

type DigestEmailProps = {
  name: string
  dateLabel: string
  sections: DigestSection[]
  siteUrl: string
}

// Resumen diario de avisos. Sin colores fijos: el cliente de correo usa los suyos (como las plantillas de acceso).
const DigestEmail = ({ name, dateLabel, sections, siteUrl }: DigestEmailProps) => {
  const total = sections.reduce((sum, s) => sum + s.items.length, 0)
  return (
    <Html lang="es">
      <Head />
      <Preview>
        {`${total} ${total === 1 ? "aviso" : "avisos"} de ${brandConfig.name} · ${sections.map((s) => s.title).join(", ")}`}
      </Preview>
      <Body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", margin: 0, padding: "24px 12px" }}>
        <Container style={{ maxWidth: 560 }}>
          <Text style={{ fontSize: 12, margin: 0 }}>
            {brandConfig.name} · {dateLabel}
          </Text>
          <Heading as="h1" style={{ fontSize: 20, margin: "8px 0 4px" }}>
            Hola{name ? `, ${name.split(" ")[0]}` : ""}. Esto necesita atención hoy
          </Heading>
          {sections.map((section) => (
            <Section key={section.kind} style={{ marginTop: 20 }}>
              <Heading as="h2" style={{ fontSize: 16, margin: "0 0 8px" }}>
                {section.title} ({section.items.length})
              </Heading>
              {section.items.map((item) => (
                <Text key={item.key} style={{ fontSize: 14, margin: "0 0 6px", lineHeight: "20px" }}>
                  <Link href={`${siteUrl}${item.url}`}>{item.title}</Link>
                  <br />
                  {item.detail}
                </Text>
              ))}
              <Text style={{ fontSize: 13, margin: "8px 0 0" }}>
                <Link href={`${siteUrl}${section.listUrl}`}>Ver todo</Link>
              </Text>
            </Section>
          ))}
          <Hr style={{ margin: "24px 0 12px" }} />
          <Text style={{ fontSize: 12, margin: 0 }}>
            Recibes este correo por tu rol en el panel. Owner y admin pueden cambiar qué avisos se envían en Configuración →
            Avisos.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default DigestEmail
