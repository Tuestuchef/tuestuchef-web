import { Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text } from "@react-email/components"

import { brandConfig } from "@/common/lib/config/brand.config"
import { documentTheme as t } from "@/common/lib/config/document-theme.config"

// Marco de todos los correos (avisos, presupuestos y los de acceso de Supabase).
// Un correo no lee variables CSS: los colores salen de document-theme.config.ts (los mismos del tema
// claro). Las fuentes web no cargan en la mayoría de los clientes: va Helvetica, como los títulos.
const FONT = '"Helvetica Neue", Helvetica, Arial, sans-serif'

type EmailLayoutProps = {
  // Texto que el cliente de correo muestra junto al asunto.
  preview: string
  // Para el logo: la URL pública de la app (en las plantillas de Supabase, "{{ .SiteURL }}").
  siteUrl: string
  children: React.ReactNode
  // Debajo de la tarjeta, en letra chica.
  footer?: React.ReactNode
}

const EmailLayout = ({ preview, siteUrl, children, footer }: EmailLayoutProps) => (
  <Html lang="es">
    <Head>
      {/* El encabezado ya es negro: que el modo oscuro del cliente no invierta los colores. */}
      <meta name="color-scheme" content="light only" />
      <meta name="supported-color-schemes" content="light" />
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: t.background, color: t.foreground, fontFamily: FONT, margin: 0, padding: "24px 12px" }}>
      <Container style={{ maxWidth: 560, width: "100%" }}>
        <Section style={{ backgroundColor: t.primary, borderRadius: "12px 12px 0 0", padding: "20px 28px" }}>
          <Img src={`${siteUrl}/email/header.png`} width={255} height={48} alt={brandConfig.name} style={{ display: "block", border: 0 }} />
        </Section>
        {/* Línea del rojo de marca, como en los documentos. */}
        <Section style={{ backgroundColor: t.brand, height: 4, lineHeight: "4px", fontSize: 0 }}>&nbsp;</Section>
        <Section
          style={{
            backgroundColor: t.card,
            border: `1px solid ${t.border}`,
            borderTop: 0,
            borderRadius: "0 0 12px 12px",
            padding: "28px 28px 32px",
          }}
        >
          {children}
        </Section>
        <Section style={{ padding: "16px 8px 0" }}>
          {footer && <Text style={{ color: t["muted-foreground"], fontSize: 12, lineHeight: "18px", margin: "0 0 8px" }}>{footer}</Text>}
          <Text style={{ color: t["muted-foreground"], fontSize: 12, lineHeight: "18px", margin: 0 }}>
            {brandConfig.name} · {brandConfig.slogan}
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const EmailHeading = ({ children }: { children: React.ReactNode }) => (
  <Heading as="h1" style={{ color: t.foreground, fontFamily: FONT, fontSize: 22, fontWeight: 700, lineHeight: "28px", margin: "0 0 16px" }}>
    {children}
  </Heading>
)

export const EmailSubheading = ({ children }: { children: React.ReactNode }) => (
  <Heading as="h2" style={{ color: t.foreground, fontFamily: FONT, fontSize: 16, fontWeight: 700, lineHeight: "22px", margin: "24px 0 8px" }}>
    {children}
  </Heading>
)

export const EmailText = ({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: React.CSSProperties }) => (
  <Text style={{ color: muted ? t["muted-foreground"] : t.foreground, fontSize: muted ? 13 : 15, lineHeight: muted ? "20px" : "23px", margin: "0 0 12px", ...style }}>
    {children}
  </Text>
)

// Botón principal: negro, como en el panel.
export const EmailButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Section style={{ margin: "20px 0" }}>
    <Button
      href={href}
      style={{
        backgroundColor: t.primary,
        borderRadius: 8,
        color: t["primary-foreground"],
        display: "inline-block",
        fontFamily: FONT,
        fontSize: 15,
        fontWeight: 700,
        padding: "12px 22px",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  </Section>
)

// Recuadro gris claro para datos clave (un código, el total de un presupuesto).
export const EmailHighlight = ({ children }: { children: React.ReactNode }) => (
  <Section style={{ backgroundColor: t.background, border: `1px solid ${t.border}`, borderRadius: 8, margin: "16px 0", padding: "16px 20px" }}>
    {children}
  </Section>
)

export default EmailLayout
