import StatusBadge from "@/common/components/status-badge"

import { QUOTE_STATUS_LABELS, QUOTE_STATUS_TONES } from "../lib/constants/quotes.constants"
import type { QuoteStatus } from "../lib/types/quotes.types"

const QuoteStatusBadge = ({ status }: { status: QuoteStatus }) => (
  <StatusBadge tone={QUOTE_STATUS_TONES[status]}>{QUOTE_STATUS_LABELS[status]}</StatusBadge>
)

export default QuoteStatusBadge
