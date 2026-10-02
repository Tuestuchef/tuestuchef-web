import type { GlossaryTerm } from "../types/manual.types"

// Glosario "para tontos": cada término se explica sin jerga y con un ejemplo.
// En el texto del manual se marcan con [[clave]] o [[clave|texto]].
export const GLOSSARY = {
  "valor-real": {
    key: "valor-real",
    term: "Valor real (USDT)",
    definition:
      "Lo que de verdad vale un monto, medido en USDT con la tasa paralela (Binance) del día. Es la regla de oro del sistema: todo se compara en valor real, porque los bolívares pierden valor y la tasa BCV no refleja lo que cuesta reponer las cosas.",
    example: "Cobras 1.120 Bs con el paralelo en 50: valor real = 1.120 ÷ 50 = 22,40 USDT.",
  },
  "tasa-bcv": {
    key: "tasa-bcv",
    term: "Tasa BCV",
    definition:
      "La tasa oficial del Banco Central (dólar y euro). Por ley, los precios en dólares se cobran en bolívares a esta tasa.",
    example: "Una filipina de 28 USD con el BCV en 40 se cobra en 1.120 Bs.",
  },
  "tasa-paralela": {
    key: "tasa-paralela",
    term: "Tasa paralela (Binance)",
    definition:
      "Lo que cuesta un USDT en el mercado (Binance). Suele ser más alta que la BCV. Se usa para saber el valor real de los bolívares.",
    example: "Si el paralelo está en 50, con 1.120 Bs compras 22,40 USDT.",
  },
  usdt: {
    key: "usdt",
    term: "USDT",
    definition:
      "Un dólar digital (en Binance). El sistema lo usa como la unidad para medir todo, porque no pierde valor como el bolívar.",
  },
  "precio-por-metodo": {
    key: "precio-por-metodo",
    term: "Precio por método de pago",
    definition:
      "Cada producto puede costar distinto según cómo paga el cliente. Los precios se guardan en dólares; si el método cobra en Bs, se convierten a la tasa BCV del día.",
    example: "Filipina: 28 USD por pago móvil, 25 USD en efectivo.",
  },
  abono: {
    key: "abono",
    term: "Abono",
    definition: "Un pago parcial. La venta queda con saldo pendiente hasta que se pague completa.",
  },
  "por-cobrar": {
    key: "por-cobrar",
    term: "Por cobrar",
    definition: "Dinero que los clientes nos deben: ventas registradas que no se han pagado completas.",
  },
  "por-encargo": {
    key: "por-encargo",
    term: "Por encargo",
    definition:
      "Un producto que se fabrica después de venderlo. No descuenta stock al vender: pasa por producir → en producción → listo → entregado.",
  },
  anular: {
    key: "anular",
    term: "Anular",
    definition:
      "Deshacer una venta completa, con motivo. No la borra: queda registrada como anulada, sus pagos se revierten y el inventario vuelve.",
  },
  revertir: {
    key: "revertir",
    term: "Revertir",
    definition:
      "Corregir un movimiento de dinero creando otro igual pero al revés. El original no se borra: así siempre queda la historia completa.",
    example: "Un gasto de 50 USD mal registrado se revierte con un ingreso de 50 USD que dice 'Reverso de…'.",
  },
  retroactiva: {
    key: "retroactiva",
    term: "Retroactiva",
    definition:
      "Algo registrado con una fecha anterior al día en que se cargó. Usa las tasas de esa fecha, no las de hoy, y queda marcado.",
  },
  cuenta: {
    key: "cuenta",
    term: "Cuenta",
    definition:
      "Un lugar donde vive el dinero del negocio, en una sola moneda: el banco en Bs, el efectivo en dólares, Zelle o la billetera de USDT.",
  },
  movimiento: {
    key: "movimiento",
    term: "Movimiento",
    definition:
      "Cada entrada o salida de dinero de una cuenta. El saldo de una cuenta es la suma de sus movimientos; nadie escribe un saldo a mano.",
  },
  traspaso: {
    key: "traspaso",
    term: "Traspaso",
    definition:
      "Mover dinero de una cuenta del negocio a otra. Si cambia de moneda (Bs → USDT), es un cambio y puede tener comisión.",
  },
  "comision-cambio": {
    key: "comision-cambio",
    term: "Comisión de cambio",
    definition:
      "Lo que se pierde al cambiar de moneda: la diferencia entre el valor real que sale y el que llega. Queda registrada aparte y resta en la utilidad.",
    example: "Sale el equivalente a 800 USDT en Bs y llegan 784 USDT: la comisión es 16 USDT.",
  },
  categoria: {
    key: "categoria",
    term: "Categoría de dinero",
    definition:
      "La etiqueta que dice qué fue un ingreso o un gasto: costo, gasto operativo, sueldo, retiro, reinversión, impuesto… De ella depende cómo cuenta en la utilidad.",
  },
  "utilidad-real": {
    key: "utilidad-real",
    term: "Utilidad real",
    definition:
      "Lo que el negocio ganó de verdad: ingresos reales − costos − gastos − comisiones de cambio − impuestos − sueldos (incluido el del dueño). La reserva y la reinversión salen de aquí después.",
  },
  saldo: {
    key: "saldo",
    term: "Saldo",
    definition: "Cuánto hay en una cuenta, o cuánto falta por pagar de una venta.",
  },
  "nota-entrega": {
    key: "nota-entrega",
    term: "Nota de entrega",
    definition: "El comprobante que se le da al cliente. No es factura fiscal.",
  },
  negocio: {
    key: "negocio",
    term: "Negocio vs. personal",
    definition:
      "La regla más importante: el dinero del negocio no se mezcla con el personal. Si alguien del equipo (incluido el dueño) saca dinero, se registra como sueldo, adelanto o retiro con su nombre. Nunca como 'prestado'.",
  },
} as const satisfies Record<string, GlossaryTerm>

export type GlossaryKey = keyof typeof GLOSSARY
