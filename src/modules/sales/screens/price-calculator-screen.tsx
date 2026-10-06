import PageHeader from "@/common/components/page-header"

import PriceCalculator from "../components/price-calculator"
import { getPriceCalculatorData } from "../lib/services/price-calculator.service"

// Calculadora de precios: para contestar "¿cuánto cuesta…?" sin registrar nada.
const PriceCalculatorScreen = async () => {
  const data = await getPriceCalculatorData()

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4">
      <PageHeader
        help="priceCalculator"
        title="Calculadora de precios"
        description="Toca los productos que pregunta el cliente: abajo sale el total por método de pago. No se registra nada."
      />
      <PriceCalculator {...data} />
    </div>
  )
}

export default PriceCalculatorScreen
