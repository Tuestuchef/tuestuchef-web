import StatusBadge from "@/common/components/status-badge"
import type { StatusTone } from "@/common/lib/constants/status.constants"

import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "../lib/constants/sales.constants"

const TONES: Record<PaymentStatus, StatusTone> = {
  paid: "success",
  partial: "warning",
  pending: "warning",
  voided: "error",
}

// Estado de pago con icono y texto (no depende del color).
const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => (
  <StatusBadge tone={TONES[status]}>{PAYMENT_STATUS_LABELS[status]}</StatusBadge>
)

export default PaymentStatusBadge
