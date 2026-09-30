import StatusBadge from "@/common/components/status-badge"

const quantityFormat = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 3 })

type StockBadgeProps = {
  quantity: number
  isLow: boolean
  madeToOrder?: boolean
}

// Existencia con alerta: "Sin stock" y "Stock bajo" llevan icono y texto, no solo color.
const StockBadge = ({ quantity, isLow, madeToOrder }: StockBadgeProps) => {
  if (madeToOrder) return <StatusBadge tone="info">Por encargo</StatusBadge>
  if (quantity <= 0) return <StatusBadge tone="error">Sin stock</StatusBadge>
  if (isLow) return <StatusBadge tone="warning">Bajo: {quantityFormat.format(quantity)}</StatusBadge>
  return <span className="text-sm tabular-nums">{quantityFormat.format(quantity)}</span>
}

export default StockBadge
