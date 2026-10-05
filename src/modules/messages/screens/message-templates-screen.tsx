import PageHeader from "@/common/components/page-header"

import TemplateEditor from "../components/template-editor"
import { listMessageTemplates } from "../lib/services/message-templates.service"

// Mensajes de WhatsApp listos para enviar (owner y admin).
const MessageTemplatesScreen = async () => {
  const templates = await listMessageTemplates()
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <PageHeader
        help="messageTemplates"
        title="Mensajes de WhatsApp"
        description="El texto de cada mensaje que el equipo envía desde ventas, pedidos y Por cobrar. Los datos entre llaves se completan solos."
      />
      {templates.map((template) => (
        <TemplateEditor key={`${template.kind}-${template.updatedAt}`} template={template} />
      ))}
    </div>
  )
}

export default MessageTemplatesScreen
