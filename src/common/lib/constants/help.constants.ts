// Ayuda de cada pantalla (botón "?" junto al título). Un solo lugar para editar los textos.
// Lo marcado "(owner y admin)" no está disponible para staff.

export type HelpSection = {
  heading: string
  items: readonly string[]
}

export type HelpTopic = {
  title: string
  summary: string
  sections: readonly HelpSection[]
}

export const HELP_TOPICS = {
  home: {
    title: "Inicio",
    summary: "Accesos rápidos para lo que más se hace en el día y la tasa vigente.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Registrar una venta o un gasto/ingreso con un toque.",
          "Ver la tasa del día (BCV dólar, BCV euro y paralelo/USDT).",
          "Si falta la tasa de hoy, registrarla desde el aviso.",
        ],
      },
    ],
  },

  sales: {
    title: "Ventas",
    summary: "Todas las ventas del mes, con su estado de pago y los encargos pendientes.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Filtrar por mes, canal (tienda, WhatsApp, Instagram) y estado de pago.",
          "Abrir una venta para cobrar un saldo, marcar entregas o compartir la nota.",
          "Ver los totales del mes: vendido, cobrado en valor real y por cobrar (owner y admin).",
        ],
      },
      {
        heading: "Estados",
        items: [
          "Pagada: el total está cubierto.",
          "Abono: pagó una parte; queda saldo.",
          "Por cobrar: no ha pagado nada.",
          "Anulada: se revirtieron los pagos y volvió el inventario.",
          "Retroactiva: se registró con una fecha anterior al día en que se cargó.",
          "Por encargo: tiene productos que aún no están listos.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Los montos de la venta están en dólares de referencia. En Bs se cobra a la tasa BCV del día del pago.",
          "El valor real (USDT) usa la tasa paralela: por eso puede ser menor al total en dólares.",
        ],
      },
    ],
  },

  newSale: {
    title: "Nueva venta",
    summary: "Registra una venta en una sola pantalla, con o sin cliente.",
    sections: [
      {
        heading: "Pasos",
        items: [
          "Busca y agrega los productos. Ajusta la cantidad con + y −.",
          "Elige el método de pago: define el precio de cada producto.",
          "Cliente opcional: búscalo o créalo sin salir. Sin cliente = venta rápida.",
          "Elige canal y entrega. Si es delivery, agrega el cobro del delivery.",
          "Indica el pago: pagó todo, abono o mixto (varios métodos), o por cobrar.",
          "Toca Registrar venta.",
        ],
      },
      {
        heading: "Descuentos",
        items: [
          "En porcentaje o monto, siempre con motivo. Queda registrado quién lo aplicó.",
          "Staff tiene un máximo (10% por defecto); por encima, solo owner o admin.",
        ],
      },
      {
        heading: "Por encargo e inventario",
        items: [
          "Los productos de inventario descuentan stock; si no alcanza, no se puede vender.",
          "Los productos por encargo no descuentan stock y quedan como 'Por producir'.",
          "Si un producto admite ambos, toca el botón de la línea para cambiarlo.",
        ],
      },
      {
        heading: "Fecha pasada",
        items: [
          "En 'Más opciones' puedes cambiar la fecha. Se usan las tasas de ese día.",
          "Staff puede ir hasta 7 días atrás (configurable). Si no hay tasas de esa fecha, owner o admin debe cargarlas.",
        ],
      },
      {
        heading: "Si el botón está desactivado",
        items: [
          "Falta stock, un producto no tiene precio para ese método, el descuento supera el máximo o falta la tasa de hoy. El aviso encima del botón dice cuál.",
        ],
      },
    ],
  },

  sale: {
    title: "Detalle de venta",
    summary: "Todo sobre una venta: productos, pagos, estados y nota de entrega.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Registrar pago: para abonos o saldos. En Bs se usa la tasa del día del pago.",
          "Avanzar cada producto: por producir → en producción → listo → entregado.",
          "Marcar entregado: pasa a entregado todo lo que está listo.",
          "WhatsApp: envía el resumen de la venta al cliente.",
          "Nota de entrega: para imprimir o guardar como PDF. No es factura fiscal.",
          "Anular, con motivo: revierte los pagos y devuelve el inventario (owner y admin).",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Una venta no se edita ni se borra. Si hubo un error, se anula y se registra de nuevo.",
          "Los estados solo avanzan; no se pueden devolver.",
        ],
      },
    ],
  },

  salesSettings: {
    title: "Configuración de ventas",
    summary: "Reglas que limitan lo que staff puede hacer al registrar. Solo owner y admin la ven.",
    sections: [
      {
        heading: "Opciones",
        items: [
          "Descuento máximo para staff: por encima de este porcentaje, solo owner o admin pueden aplicar el descuento.",
          "Días hacia atrás para staff: hasta cuántos días atrás staff puede registrar ventas, pagos y movimientos. Owner y admin no tienen límite.",
        ],
      },
    ],
  },

  products: {
    title: "Productos",
    summary: "El catálogo: cada producto es un modelo, y sus variantes son las combinaciones de color y talla.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Buscar por nombre y filtrar por categoría.",
          "Ver existencias y avisos de stock bajo por producto.",
          "Crear un producto y luego agregarle variantes, precios y fotos (owner y admin).",
          "Ir a Stock para registrar compras, producción o ajustes.",
        ],
      },
      {
        heading: "Avisos",
        items: [
          "Sin stock: la variante está en 0.",
          "Bajo: la existencia llegó al mínimo definido para esa variante.",
          "Por encargo: el producto se fabrica cuando se vende; no lleva stock.",
        ],
      },
    ],
  },

  product: {
    title: "Detalle de producto",
    summary: "Variantes, precios, fotos y movimientos de stock de un producto.",
    sections: [
      {
        heading: "Variantes",
        items: [
          "'Colores × tallas' crea todas las combinaciones de una vez, con su SKU.",
          "El SKU se genera con los códigos (categoría, género, cierre o corte, color y talla). Puedes editarlo mientras la variante no tenga movimientos.",
          "Stock mínimo: al llegar a ese número se marca como stock bajo.",
        ],
      },
      {
        heading: "Precios",
        items: [
          "Un precio en dólares por método de pago. Vacío = no se vende con ese método.",
          "Cobrado en Bs, se convierte con la tasa BCV del día de la venta. Nunca se guarda un precio fijo en Bs.",
        ],
      },
      {
        heading: "Fotos",
        items: [
          "Sube varias, ordénalas y elige la principal (la que se ve en la lista).",
          "Cada foto puede asociarse a un color.",
        ],
      },
    ],
  },

  stock: {
    title: "Stock",
    summary: "Registra lo que entra y sale del inventario. El saldo se calcula siempre desde estos movimientos.",
    sections: [
      {
        heading: "Tipos de movimiento",
        items: [
          "Compra: mercancía comprada, con su costo unitario en USDT.",
          "Producción: prendas fabricadas, con su costo unitario en USDT.",
          "Ajuste: suma o resta con motivo, p. ej. conteo físico o prenda dañada (owner y admin).",
          "Las ventas descuentan stock solas; no se registran aquí.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Los movimientos no se editan ni se borran. Un error se corrige con un ajuste.",
          "El stock nunca puede quedar negativo.",
        ],
      },
    ],
  },

  initialStock: {
    title: "Carga inicial de stock",
    summary: "Carga las existencias de arranque de muchas variantes a la vez desde un CSV (owner y admin).",
    sections: [
      {
        heading: "Cómo se usa",
        items: [
          "Columnas: SKU, cantidad y, opcional, costo unitario en USDT. Separador coma o punto y coma.",
          "Pega el texto o sube el archivo, y toca Revisar para ver qué se cargaría.",
          "Si no hay errores, confirma. Se carga todo o nada.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Solo sirve para variantes sin movimientos. Después, usa compras, producción o ajustes.",
        ],
      },
    ],
  },

  productCategories: {
    title: "Categorías de producto",
    summary: "Grupos del catálogo: filipinas, delantales, pantalones, estuches, gorros…",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "El código (p. ej. FIL) forma la primera parte del SKU.",
          "Cambiar un código no modifica los SKU que ya existen.",
          "Una categoría inactiva no aparece al crear productos.",
        ],
      },
    ],
  },

  sizes: {
    title: "Tallas",
    summary: "Lista de tallas disponibles, en el orden en que se muestran.",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "El código (p. ej. XL) forma la última parte del SKU.",
          "La talla es opcional en cada variante (p. ej. estuches o gorros).",
          "Orden: menor aparece primero.",
        ],
      },
    ],
  },

  colors: {
    title: "Colores",
    summary: "Lista de colores para las variantes y las fotos.",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "El código (p. ej. Vinotinta → VIN) forma parte del SKU.",
          "Cambiar un código no modifica los SKU que ya existen.",
        ],
      },
    ],
  },

  customers: {
    title: "Clientes",
    summary: "Datos de contacto de los clientes y su historial de compras.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Buscar por nombre, teléfono, correo o Instagram.",
          "Crear un cliente: nombre y al menos un teléfono, correo o Instagram.",
          "Si el contacto ya existe, se te ofrece abrir ese cliente en vez de duplicarlo.",
        ],
      },
      {
        heading: "Cédula",
        items: [
          "Es opcional. Cualquiera la registra, pero solo owner y admin pueden verla.",
          "Pídela solo cuando sea necesaria: es un dato personal.",
        ],
      },
    ],
  },

  customer: {
    title: "Detalle de cliente",
    summary: "Contacto del cliente y todas sus compras.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Llamar, escribir por WhatsApp o abrir su Instagram.",
          "Editar sus datos.",
          "Desactivarlo (owner y admin). Los clientes no se borran porque tienen ventas.",
        ],
      },
    ],
  },

  movements: {
    title: "Movimientos",
    summary: "El libro del dinero: cada ingreso, gasto y traspaso que cambia el saldo de una cuenta.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Filtrar por mes, cuenta y tipo.",
          "Ver los ingresos y egresos del período en valor real (USDT).",
          "Revertir un movimiento con motivo si hubo un error (owner y admin).",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Staff ve solo lo que registró.",
          "Los movimientos no se editan ni se borran: se revierten y se registran de nuevo.",
          "Los cobros de ventas aparecen aquí solos; no se registran a mano.",
        ],
      },
    ],
  },

  newMovement: {
    title: "Nuevo movimiento",
    summary: "Registra un gasto o un ingreso que no viene de una venta.",
    sections: [
      {
        heading: "Pasos",
        items: [
          "Elige gasto o ingreso, escribe el monto y la cuenta.",
          "Elige la categoría: define si es costo, gasto operativo, sueldo, retiro, etc.",
          "Adjunta el comprobante si lo tienes (foto o PDF).",
        ],
      },
      {
        heading: "Negocio vs. personal",
        items: [
          "Todo dinero que una persona del equipo saca del negocio (incluido el dueño) se registra como sueldo o retiro, con su nombre. Nunca como 'prestado'.",
          "Costo: lo necesario para producir y vender este mes. Reinversión: lo que es para crecer.",
        ],
      },
      {
        heading: "Fecha pasada",
        items: ["Puedes cambiar la fecha. Se usan las tasas de ese día; staff hasta 7 días atrás (configurable)."],
      },
    ],
  },

  treasury: {
    title: "Tasas y cuentas",
    summary: "Las tasas del día y el saldo real de cada cuenta del negocio.",
    sections: [
      {
        heading: "Tasas",
        items: [
          "Se actualizan solas cada mañana (6:00) desde el BCV y el paralelo.",
          "Corregir tasa: registra una manual que queda como vigente. Lo ya registrado conserva su tasa.",
          "Tasa de otra fecha: carga las tasas de un día pasado para ventas o movimientos retroactivos.",
          "Las tasas no se editan una vez cargadas; una corrección es otra tasa del mismo día.",
        ],
      },
      {
        heading: "Cuentas",
        items: [
          "Cada cuenta tiene una moneda: Bs, USD efectivo, Zelle o USDT.",
          "El saldo es la suma de sus movimientos.",
          "Traspaso: mover o cambiar dinero entre cuentas. La comisión de cambio queda registrada aparte.",
        ],
      },
    ],
  },

  transfer: {
    title: "Traspaso",
    summary: "Mueve dinero entre cuentas o cambia de moneda (p. ej. Bs → USDT).",
    sections: [
      {
        heading: "Cómo se usa",
        items: [
          "Indica cuánto sale de la cuenta de origen y cuánto llega a la de destino.",
          "Si cambió de moneda, la diferencia de valor queda como comisión de cambio.",
          "Un traspaso se anula completo; sus partes no se revierten sueltas.",
        ],
      },
    ],
  },

  accounts: {
    title: "Cuentas",
    summary: "Las cuentas donde vive el dinero del negocio.",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "Cada cuenta es de una moneda: Bs (banco o efectivo), USD (efectivo o Zelle) o USDT.",
          "Una cuenta inactiva no recibe movimientos nuevos, pero conserva su historial.",
        ],
      },
    ],
  },

  paymentMethods: {
    title: "Métodos de pago",
    summary: "Cómo pagan los clientes y a qué cuenta llega el dinero.",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "Cada método tiene su propia lista de precios en dólares (se cargan en cada producto).",
          "Si cobra en Bs, elige la tasa que lo convierte: BCV dólar o BCV euro.",
          "USD, Zelle y USDT no llevan tasa.",
        ],
      },
    ],
  },

  categories: {
    title: "Categorías de dinero",
    summary: "Clasifican cada ingreso y gasto para calcular la utilidad real.",
    sections: [
      {
        heading: "Tipos",
        items: [
          "Costo: lo necesario para producir y vender (tela, botones, alquiler, publicidad habitual).",
          "Gasto operativo: lo que mantiene el negocio funcionando.",
          "Reinversión: para crecer (máquina nueva, línea nueva, stock adelantado). Sale de la utilidad.",
          "Sueldo y retiro: dinero que sale para una persona del equipo, con su nombre.",
        ],
      },
      {
        heading: "Recuerda",
        items: ["'Ventas' y 'Comisión de cambio' son del sistema y no se editan."],
      },
    ],
  },

  users: {
    title: "Usuarios",
    summary: "Quién entra al sistema y con qué rol.",
    sections: [
      {
        heading: "Roles",
        items: [
          "Owner: ve y hace todo.",
          "Admin: gestión completa; solo puede invitar o cambiar staff.",
          "Staff: registra ventas, gastos y stock; sin acceso a sueldos, retiros ni totales.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Se entra con un código enviado al correo, sin contraseña. Owner y admin usan además una app autenticadora.",
          "Los usuarios no se borran: se desactivan y ya no pueden entrar.",
        ],
      },
    ],
  },

  analytics: {
    title: "Analítica",
    summary: "Cómo va el negocio en valor real: utilidad, ingresos, egresos y retiros.",
    sections: [
      {
        heading: "Qué ves",
        items: [
          "Utilidad real = ingresos − costos − gastos − comisiones − impuestos − sueldos (incluido el del dueño).",
          "Ingresos vs. egresos de los últimos 12 meses.",
          "En qué se va el dinero, por categoría.",
          "Cuánto recibió cada persona del equipo (sueldos y retiros).",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Todo está en USDT (valor real), no en Bs ni en dólares BCV.",
          "La reinversión y la reserva de caja salen de la utilidad; no se restan antes.",
        ],
      },
    ],
  },
} as const satisfies Record<string, HelpTopic>

export type HelpTopicKey = keyof typeof HELP_TOPICS
