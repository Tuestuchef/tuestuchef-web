import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Text } from "@react-email/components"

type QuoteEmailProps = {
  companyName: string
  customerName: string
  code: string
  total: string
  validUntil: string
  note: string | null
  link: string | null
  sender: { name: string; phone: string | null; email: string | null }
}

// Correo con el presupuesto en PDF adjunto. Sin colores fijos: el cliente de correo usa los suyos.
const QuoteEmail = ({ companyName, customerName, code, total, validUntil, note, link, sender }: QuoteEmailProps) => (
  <Html lang="es">
    <Head />
    <Preview>{`Presupuesto ${code} de ${companyName} por ${total}`}</Preview>
    <Body style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", margin: 0, padding: "24px 12px" }}>
      <Container style={{ maxWidth: 560 }}>
        <Text style={{ fontSize: 12, margin: 0 }}>{companyName}</Text>
        <Heading as="h1" style={{ fontSize: 20, margin: "8px 0 12px" }}>
          Presupuesto {code}
        </Heading>
        <Text style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 12px" }}>Hola{customerName ? ` ${customerName}` : ""},</Text>
        <Text style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 12px" }}>
          Te enviamos el presupuesto <strong>{code}</strong> por <strong>{total}</strong>, válido hasta el {validUntil}. Va adjunto en PDF.
        </Text>
        {note && <Text style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 12px", whiteSpace: "pre-line" }}>{note}</Text>}
        {link && (
          <Text style={{ fontSize: 15, lineHeight: "22px", margin: "0 0 12px" }}>
            También puedes verlo aquí: <Link href={link}>Ver presupuesto</Link>
          </Text>
        )}
        <Text style={{ fontSize: 15, lineHeight: "22px", margin: "16px 0 0" }}>
          {sender.name}
          <br />
          {[sender.phone, sender.email].filter(Boolean).join(" · ")}
          {(sender.phone || sender.email) && <br />}
          {companyName}
        </Text>
        <Hr style={{ margin: "24px 0 12px" }} />
        <Text style={{ fontSize: 12, margin: 0 }}>Responde a este correo para hablar con quien preparó el presupuesto. Este presupuesto no es una factura.</Text>
      </Container>
    </Body>
  </Html>
)

export default QuoteEmail
