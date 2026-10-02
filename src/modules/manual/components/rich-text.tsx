import type { RichText as RichTextValue } from "../lib/types/manual.types"
import { parseRichText } from "../lib/utils/manual.util"
import GlossaryTerm from "./glossary-term"

// Texto del manual con **negrita** y términos del glosario.
const RichText = ({ text }: { text: RichTextValue }) => (
  <>
    {parseRichText(text).map((segment, index) => {
      if (segment.type === "bold")
        return (
          <strong key={index} className="font-semibold text-foreground">
            {segment.value}
          </strong>
        )
      if (segment.type === "term")
        return (
          <GlossaryTerm key={index} termKey={segment.key}>
            {segment.value}
          </GlossaryTerm>
        )
      return segment.value
    })}
  </>
)

export default RichText
