import StatusBadge from "@/common/components/status-badge"
import type { StatusTone } from "@/common/lib/constants/status.constants"

import { PURCHASE_STATUS_LABELS, type PurchaseStatus } from "../lib/constants/purchases.constants"

const TONES: Record<PurchaseStatus, StatusTone> = {
  paid: "success",
  partial: "warning",
  pending: "warning",
  voided: "error",
}

// Estado de pago con icono y texto (no depende del color).
const PurchaseStatusBadge = ({ status, overdue }: { status: PurchaseStatus; overdue?: boolean }) =>
  overdue ? (
    <StatusBadge tone="error">Vencida</StatusBadge>
  ) : (
    <StatusBadge tone={TONES[status]}>{PURCHASE_STATUS_LABELS[status]}</StatusBadge>
  )

export default PurchaseStatusBadge
