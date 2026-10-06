import { Column, Row, Text } from "@react-email/components"

import EmailLayout, { EmailButton, EmailHeading, EmailHighlight, EmailText } from "@/common/components/email/email-layout"
import { documentTheme as t } from "@/common/lib/config/document-theme.config"

type QuoteEmailProps = {
  siteUrl: string
  companyName: string
  customerName: string
  code: string
  total: string
  validUntil: string
  note: string | null
  link: string | null
  sender: { name: string; phone: string | null; email: string | null }
}

const label = { color: t["muted-foreground"], fontSize: 12, lineHeight: "16px", margin: "0 0 2px" }
const value = { color: t.foreground, fontSize: 16, fontWeight: 700, lineHeight: "22px", margin: 0 }

// Correo con el presupuesto en PDF adjunto. Responde a quien lo preparó.
const QuoteEmail = ({ siteUrl, companyName, customerName, code, total, validUntil, note, link, sender }: QuoteEmailProps) => (
  <EmailLayout
    preview={`Presupuesto ${code} de ${companyName} por ${total}`}
    siteUrl={siteUrl}
    footer="Responde a este correo para hablar con quien preparó el presupuesto. Un presupuesto no es una factura."
  >
    <EmailHeading>Presupuesto {code}</EmailHeading>
    <EmailText>Hola{customerName ? ` ${customerName}` : ""},</EmailText>
    <EmailText>Te enviamos nuestro presupuesto. Va adjunto en PDF.</EmailText>

    <EmailHighlight>
      <Row>
        <Column>
          <Text style={label}>Total</Text>
          <Text style={value}>{total}</Text>
        </Column>
        <Column align="right">
          <Text style={{ ...label, textAlign: "right" }}>Válido hasta</Text>
          <Text style={{ ...value, textAlign: "right" }}>{validUntil}</Text>
        </Column>
      </Row>
    </EmailHighlight>

    {note && <EmailText style={{ whiteSpace: "pre-line" }}>{note}</EmailText>}
    {link && <EmailButton href={link}>Ver presupuesto</EmailButton>}

    <EmailText style={{ margin: "20px 0 0" }}>
      <strong>{sender.name}</strong>
      <br />
      {[sender.phone, sender.email].filter(Boolean).join(" · ")}
      {(sender.phone || sender.email) && <br />}
      {companyName}
    </EmailText>
  </EmailLayout>
)

export default QuoteEmail
