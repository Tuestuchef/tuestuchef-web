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
  // Capítulo del manual con la explicación completa (slug).
  chapter?: string
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
      {
        heading: "Los números del menú",
        items: [
          "Por cobrar y Por pagar: ventas y compras con saldo (owner y admin).",
          "Ventas pendientes: las guardadas en este teléfono sin enviar y las que no pasaron.",
          "Pedidos: los abiertos. Material necesario: los materiales que faltan.",
          "Un ícono de advertencia en Tasas y cuentas: falta la tasa de hoy (owner y admin).",
          "Se actualizan al cambiar de pantalla y cada minuto. Con el menú encogido, un punto marca dónde hay algo.",
        ],
      },
    ],
  },

  sales: {
    title: "Ventas",
    chapter: "ventas",
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
    chapter: "ventas",
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
          "Al mayor: se aplica solo según las piezas (un combo cuenta por sus componentes). Abajo se ve cuántas faltan para el siguiente tramo.",
          "Manual: en porcentaje o monto, siempre con motivo, sobre lo que queda después del descuento al mayor. Queda registrado quién lo aplicó.",
          "Staff tiene un máximo para el manual (10% por defecto); por encima, solo owner o admin. El de al mayor no cuenta.",
        ],
      },
      {
        heading: "Combos",
        items: [
          "Al elegir un combo se abre una ventana para escoger la talla y el color de cada pieza.",
          "Con varios combos se pueden mezclar tallas (p. ej. 3 combos: 2 filipinas M y 1 L).",
          "El combo lleva el precio; el stock se descuenta de cada pieza. Para cambiarlo, quítalo y agrégalo de nuevo.",
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
    chapter: "ventas",
    summary: "Todo sobre una venta: productos, pagos, estados y nota de entrega.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Registrar pago: para abonos o saldos. En Bs se usa la tasa del día del pago.",
          "Avanzar cada producto por encargo: por producir → confección → listo para entregar → entregado.",
          "Marcar entregado: pasa a entregado todo lo que está listo.",
          "WhatsApp: elige el mensaje (nota de entrega), revísalo y se abre WhatsApp con el texto listo. Queda en Mensajes enviados.",
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
    chapter: "ventas",
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
    chapter: "inventario",
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
    chapter: "inventario",
    summary: "Variantes, precios, fotos y movimientos de stock de un producto.",
    sections: [
      {
        heading: "Variantes",
        items: [
          "'Colores × tallas' crea todas las combinaciones de una vez, con su SKU.",
          "El SKU se genera con los códigos (categoría, código del modelo, género, cierre o corte, color y talla). Puedes editarlo mientras la variante no tenga movimientos.",
          "El código del modelo (en Editar) distingue modelos de la misma categoría, p. ej. MC → FIL-MC-BR-NEG-S. Ponlo antes de crear las variantes.",
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
        heading: "Receta",
        items: [
          "Qué materia prima lleva cada prenda: un material específico o \"del mismo color que la prenda\".",
          "La cantidad puede variar por talla; sin talla, aplica a todas.",
          "Al producir se descuenta del inventario y el costo de la prenda sale del costo promedio de los materiales.",
        ],
      },
      {
        heading: "Margen (owner y admin)",
        items: [
          "Precio de cada método convertido a valor real (USDT) con las tasas de hoy: en Bs se pierde la diferencia BCV–paralelo.",
          "Costo = materiales (costo promedio, o estimado con la receta) + mano de obra por unidad.",
          "La mano de obra solo se usa aquí: nunca se resta de la utilidad real, porque los sueldos ya se restan.",
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
    chapter: "inventario",
    summary: "Registra lo que entra y sale del inventario. El saldo se calcula siempre desde estos movimientos.",
    sections: [
      {
        heading: "Tipos de movimiento",
        items: [
          "Producción: descuenta la materia prima de la receta y suma las prendas con su costo. Sin receta, se indica el costo a mano.",
          "Ajuste: suma o resta con motivo, p. ej. conteo físico, merma o prenda dañada (owner y admin).",
          "Las compras entran desde Compras, con su proveedor; las ventas descuentan stock solas.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Los movimientos no se editan ni se borran. Un error o la merma real se corrige con un ajuste.",
          "El costo de cada variante es el promedio ponderado de todo lo que ha entrado.",
          "El stock nunca puede quedar negativo.",
        ],
      },
    ],
  },

  initialStock: {
    title: "Carga inicial de stock",
    chapter: "inventario",
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
    chapter: "configuracion",
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
    chapter: "configuracion",
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
    chapter: "configuracion",
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
    chapter: "clientes",
    summary: "Datos de contacto de los clientes y su historial de compras.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Buscar por nombre, razón social, RIF, teléfono, correo o Instagram.",
          "Crear una persona: nombre y al menos un teléfono, correo o Instagram.",
          "Crear una empresa (restaurante, escuela, hotel): basta con la razón social. RIF, persona de contacto, teléfono y dirección son opcionales.",
          "Si el contacto o el RIF ya existen, se te ofrece abrir ese cliente en vez de duplicarlo.",
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
    chapter: "clientes",
    summary: "Contacto del cliente y todas sus compras.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Llamar, escribir por WhatsApp o abrir su Instagram.",
          "Editar sus datos. Una empresa muestra también su razón social, RIF y persona de contacto (el RIF lo ve todo el equipo; la cédula de una persona, solo owner y admin).",
          "Desactivarlo (owner y admin). Los clientes no se borran porque tienen ventas.",
        ],
      },
      {
        heading: "Mensajes enviados",
        items: ["Los mensajes de WhatsApp que se le prepararon desde ventas, pedidos y Por cobrar (staff ve los suyos)."],
      },
    ],
  },

  movements: {
    title: "Movimientos",
    chapter: "tesoreria",
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
    chapter: "tesoreria",
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
    chapter: "tesoreria",
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
    chapter: "tesoreria",
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
    chapter: "configuracion",
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
    chapter: "configuracion",
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
    chapter: "configuracion",
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
    chapter: "configuracion",
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
    title: "Dashboard",
    chapter: "resultados",
    summary: "Cómo va el negocio en valor real (USDT), por período. Solo owner y admin.",
    sections: [
      {
        heading: "Utilidad real",
        items: [
          "Ingresos − costos − gastos − comisiones − impuestos − sueldos (incluido el del dueño).",
          "El IVA cobrado en ventas o pedidos con IVA no es ingreso: se separa solo de cada cobro y se muestra aparte.",
          "Ingresos vs. egresos de los últimos 12 meses, a dónde va el dinero y cuánto recibió cada persona.",
        ],
      },
      {
        heading: "Asignaciones",
        items: [
          "La política dice qué % de la utilidad va a la reserva y a reinversión.",
          "Se compara con lo que de verdad se transfirió a la cuenta de reserva (USDT) y lo gastado con categoría reinversión.",
          "Reserva y reinversión salen de la utilidad: nunca se restan antes de calcularla.",
        ],
      },
      {
        heading: "Flujo de caja",
        items: ["Por cuenta: saldo al inicio, lo que entró, lo que salió y el saldo al final. Incluye traspasos."],
      },
      {
        heading: "Margen",
        items: [
          "Por producto vendido: ingreso real (con descuento y la tasa de cada venta) menos materiales y mano de obra.",
          "Si una venta no tiene costo registrado, se avisa: ese margen está inflado.",
        ],
      },
      {
        heading: "Efecto de la tasa",
        items: [
          "Ventas en Bs: se cobran a tasa BCV y valen a tasa paralela; la diferencia es pérdida.",
          "Pagos a proveedores en Bs a tasa BCV: cuestan menos en valor real; la diferencia es ganancia.",
        ],
      },
    ],
  },
  purchases: {
    title: "Compras",
    chapter: "compras",
    summary: "Lo que se le compra a los proveedores: materia prima, mercancía y servicios.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Filtrar por mes, proveedor y estado de pago.",
          "Abrir una compra para ver sus líneas y pagos.",
          "Staff ve solo las compras que registró.",
        ],
      },
      {
        heading: "Estados",
        items: [
          "Pagada: el total está cubierto.",
          "Abono: se pagó una parte; queda saldo.",
          "Por pagar: no se ha pagado nada (compra a crédito).",
          "Vencida: pasó su fecha de vencimiento con saldo pendiente.",
          "Anulada: se revirtieron los pagos y el inventario.",
        ],
      },
    ],
  },

  newPurchase: {
    title: "Nueva compra",
    chapter: "compras",
    summary: "Registra lo que se compró, a quién y cómo se pagó.",
    sections: [
      {
        heading: "Pasos",
        items: [
          "Elige el proveedor (o créalo con el botón +).",
          "Agrega materia prima o mercancía: entra al inventario con su costo.",
          "Agrega conceptos sin stock: alquiler, maquila, reparaciones, servicios.",
          "Cada línea lleva su categoría (costo, gasto operativo, reinversión…): así se calcula bien la utilidad.",
          "Indica cómo se pagó y toca Registrar compra.",
        ],
      },
      {
        heading: "Pagos en Bs",
        items: [
          "Elige la tasa del pago: BCV o paralela, siempre la registrada para esa fecha.",
          "El valor real del pago siempre se calcula con la tasa paralela (Binance).",
        ],
      },
      {
        heading: "Crédito (owner y admin)",
        items: [
          "'A crédito' o 'Abono o mixto' dejan saldo pendiente con fecha de vencimiento.",
          "Staff registra solo compras pagadas completas en el momento.",
        ],
      },
      {
        heading: "Costos",
        items: [
          "Los costos se escriben en dólares de referencia y entran al inventario en USDT con la tasa de esa fecha.",
        ],
      },
    ],
  },

  suppliers: {
    title: "Proveedores",
    chapter: "compras",
    summary: "A quién le compramos y cuánto le debemos.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Crear un proveedor: solo el nombre es obligatorio.",
          "Ver lo que le debemos a cada uno (owner y admin).",
          "Abrir un proveedor para ver todas sus compras.",
        ],
      },
      {
        heading: "Recuerda",
        items: ["Los proveedores no se borran: se desactivan (owner y admin)."],
      },
    ],
  },

  supplier: {
    title: "Detalle de proveedor",
    chapter: "compras",
    summary: "Datos de contacto y todas las compras a este proveedor.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Llamar o escribir por WhatsApp.",
          "Ver lo comprado y lo que le debemos (owner y admin).",
          "Editar o desactivar el proveedor (owner y admin).",
        ],
      },
    ],
  },

  payables: {
    title: "Por pagar",
    chapter: "compras",
    summary: "Compras a crédito con saldo pendiente. Solo owner y admin.",
    sections: [
      {
        heading: "Qué ves",
        items: [
          "Las vencidas primero, con los días de atraso.",
          "El saldo en dólares de referencia de cada compra.",
          "Abre una compra para registrar el pago.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "El saldo vive en dólares: un pago en Bs se convierte con la tasa (BCV o paralela) del día en que se paga.",
        ],
      },
    ],
  },

  receivables: {
    title: "Por cobrar",
    chapter: "ventas",
    summary: "Ventas con saldo pendiente: quién nos debe, cuánto y desde cuándo. Solo owner y admin.",
    sections: [
      {
        heading: "Qué ves",
        items: [
          "Cada cliente con el total que debe y su venta pendiente más antigua.",
          "Las ventas rápidas sin cliente aparecen aparte.",
          "Abre una venta para registrar el abono.",
          "WhatsApp: recordatorio de pago con el saldo y sus ventas, listo para enviar.",
        ],
      },
      {
        heading: "Recuerda",
        items: ["Se calcula desde las ventas: no hay que registrar nada aparte."],
      },
    ],
  },

  rawMaterials: {
    title: "Materia prima",
    chapter: "inventario",
    summary: "Telas, botones, cierres e insumos: lo que se usa para fabricar.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Ver existencias y costo de cada material.",
          "Crear un material con su unidad (metro, kilo o unidad) y variantes por color (owner y admin).",
          "Las compras de materia prima se registran en Nueva compra.",
        ],
      },
      {
        heading: "Recuerda",
        items: ["La materia prima no se vende: no aparece al registrar ventas."],
      },
    ],
  },
  combos: {
    title: "Combos",
    chapter: "inventario",
    summary: "Productos que se venden juntos con un precio propio, como el Combo Escuela.",
    sections: [
      {
        heading: "Cómo funcionan",
        items: [
          "Un combo tiene nombre, categoría, fotos y un precio por método de pago.",
          "Sus componentes son productos del catálogo con su cantidad (p. ej. 1 filipina, 1 pantalón, 1 delantal).",
          "No lleva stock propio: al venderlo se elige la talla y el color de cada pieza, y se descuenta de cada una.",
          "Un combo sin componentes no aparece al vender.",
        ],
      },
    ],
  },

  combo: {
    title: "Detalle de combo",
    chapter: "inventario",
    summary: "Componentes, precios, margen y fotos del combo.",
    sections: [
      {
        heading: "Componentes",
        items: [
          "Agrega cada producto con cuántas piezas lleva un combo. Para cambiar la cantidad, quítalo y agrégalo de nuevo.",
          "Las ventas ya registradas guardan lo que llevaban: cambiar el combo solo afecta las ventas nuevas.",
        ],
      },
      {
        heading: "Margen (owner y admin)",
        items: [
          "Costo = costo promedio de cada componente + su mano de obra.",
          "En el dashboard, lo vendido en combos se reparte entre sus productos según el precio de cada uno.",
        ],
      },
    ],
  },

  orderSettings: {
    title: "Pedidos y personalización",
    chapter: "configuracion",
    summary: "Precios de bordados y logos, y los tramos del descuento al mayor. Solo owner y admin.",
    sections: [
      {
        heading: "Personalización",
        items: [
          "Cada tipo tiene precio por unidad en USD de referencia (igual para todos los métodos) y un mínimo de piezas.",
          "Sin precio, un tipo no se puede usar todavía en los pedidos.",
          "Logo de bolsillo: hasta 8 cm. Más grande se considera logo de pecho.",
        ],
      },
      {
        heading: "Descuento al mayor",
        items: [
          "Tramos 'desde N piezas, X%'. Se aplica el más alto alcanzado, solo y aparte del descuento manual.",
          "Productos: cuenta todas las piezas de la venta. Personalización: cuenta las piezas de cada tipo en un pedido.",
          "Cambiar un tramo solo afecta las ventas nuevas.",
        ],
      },
    ],
  },

  orders: {
    title: "Pedidos",
    chapter: "pedidos",
    summary: "Lo que se produce por encargo: fecha prometida, abono, etapas y entrega.",
    sections: [
      {
        heading: "Qué ves",
        items: [
          "Abiertos por fecha prometida; los atrasados resaltados.",
          "'Falta abono': no se puede empezar a producir hasta cubrirlo (o una autorización de owner o admin).",
          "Un pedido es una venta: su dinero aparece en Tesorería y en Resultados como cualquier venta.",
        ],
      },
    ],
  },

  newOrder: {
    title: "Nuevo pedido",
    chapter: "pedidos",
    summary: "Registra un pedido con su cliente, productos, personalización y abono.",
    sections: [
      {
        heading: "Pasos",
        items: [
          "Elige el cliente (obligatorio). Un cliente bloqueado no puede pedir.",
          "Agrega productos o combos. 'Personalizar' añade nombres bordados o logos a una línea.",
          "Inventario: 'reservar y producir lo que falta' aparta lo que hay; 'producir todo' no toca el stock (misma tela).",
          "Revisa la fecha prometida (por defecto 5 días) y registra el pago inicial.",
          "Agregar IVA (opcional): se suma al total después de descuentos, sin el delivery. La tasa es la de Configuración → Presupuestos.",
        ],
      },
      {
        heading: "Abono",
        items: [
          "Desde 500 USD: 60% para empezar y 40% al entregar. Por debajo: pago completo para empezar.",
          "Sin el pago, el pedido queda registrado pero no avanza a producción.",
        ],
      },
      {
        heading: "Personalización",
        items: [
          "Nombres: el mismo texto para todas o un nombre por pieza (pega la lista).",
          "Logos: sube el archivo; el de bolsillo es de hasta 8 cm, más grande es logo de pecho.",
          "Cada tipo tiene un mínimo de piezas por pedido y su propio descuento al mayor.",
        ],
      },
    ],
  },

  order: {
    title: "Detalle de pedido",
    chapter: "pedidos",
    summary: "Etapas de cada línea, pagos, entrega y cancelación.",
    sections: [
      {
        heading: "Arriba",
        items: [
          "El total incluye el IVA si el pedido lo lleva; debajo se ve cuánto es.",
          "Si salió de un presupuesto, el enlace 'Desde el presupuesto' lleva a él.",
        ],
      },
      {
        heading: "Etapas",
        items: [
          "Por producir → corte → confección → personalización → revisión → empaque → listo para entregar.",
          "Las que no aplican se saltan solas (lo que sale del inventario no se corta ni se cose).",
          "Al terminar el corte se descuenta la tela de la receta.",
          "'Asignar' pone la etapa a nombre de una persona o un taller (con su fecha estimada).",
        ],
      },
      {
        heading: "Entregar",
        items: [
          "Se entrega completo cuando todas las líneas están listas.",
          "Con saldo, primero se registra el pago; si no, solo owner o admin entregan, con motivo.",
        ],
      },
      {
        heading: "Cancelar",
        items: [
          "Antes del corte: se devuelve cada pago en su moneda y a su cuenta.",
          "Después del corte: solo owner o admin, descontando materiales y talleres.",
          "El cliente queda bloqueado (regla de negocio).",
        ],
      },
      {
        heading: "Avisar al cliente",
        items: [
          "WhatsApp: pedido confirmado (abono y fecha), pedido listo (saldo para entregar), pedido cancelado (reembolso en la moneda en que pagó) y nota de entrega.",
          "Solo aparecen los que aplican: 'listo' cuando el pedido está listo, 'cancelado' cuando se canceló.",
        ],
      },
    ],
  },

  production: {
    title: "Producción",
    chapter: "pedidos",
    summary: "Qué se está haciendo, en qué etapa y quién lo tiene.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Tablero: una columna por etapa; desliza de lado en el celular. Toca el botón para pasar a la siguiente.",
          "Quién tiene qué: lo asignado a cada persona o taller, y lo que nadie tiene todavía.",
          "Talleres con fecha estimada vencida aparecen como atrasados.",
        ],
      },
    ],
  },

  materials: {
    title: "Material necesario",
    chapter: "pedidos",
    summary: "Tela e insumos que necesitan los pedidos que aún no se cortan, contra lo que hay.",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "Se calcula solo con las recetas, el stock y los pedidos.",
          "'Falta el color': la receta pide tela del color de la prenda y ese color no existe en la materia prima.",
          "Compra lo que falta en Compras → Nueva compra.",
        ],
      },
    ],
  },

  pieceRates: {
    title: "Tarifas a destajo",
    chapter: "equipo",
    summary: "Cuánto se paga por pieza según la categoría y la etapa. Solo owner y admin.",
    sections: [
      {
        heading: "Cómo funciona",
        items: [
          "Las piezas se cuentan al terminar una etapa asignada a una persona que cobra a destajo.",
          "Se paga en Equipo, como un sueldo: piezas × tarifa, menos adelantos.",
          "Una tarifa nueva rige desde hoy; lo ya contado conserva su tarifa.",
        ],
      },
    ],
  },

  businessRules: {
    title: "Reglas del negocio",
    chapter: "configuracion",
    summary: "Cómo trabaja el negocio. Todos las leen; owner y admin las escriben.",
    sections: [
      {
        heading: "Recuerda",
        items: [
          "'La aplica el sistema': se cumple sola (p. ej. el bloqueo de clientes que cancelan con reembolso).",
          "'La aplica el equipo': es una guía que cada persona debe seguir.",
          "Cada cambio queda en el historial.",
        ],
      },
    ],
  },

  periods: {
    title: "Cierres y exportación",
    chapter: "resultados",
    summary: "El Excel del mes para el contador y el cierre de los meses terminados. Solo owner y admin.",
    sections: [
      {
        heading: "Excel",
        items: [
          "Hojas: resumen de utilidad real, ventas, pagos recibidos, compras, movimientos de dinero y sueldos.",
          "Cada monto en su moneda, con su tasa y su valor real en USDT.",
        ],
      },
      {
        heading: "Cerrar un mes",
        items: [
          "Solo meses terminados. Después nadie registra nada con fecha de ese mes, ni owner ni admin.",
          "Se guarda la utilidad del mes tal como quedó.",
          "Solo el owner reabre un mes, con motivo; queda registrado.",
        ],
      },
    ],
  },

  notificationSettings: {
    title: "Avisos",
    chapter: "configuracion",
    summary: "Qué recordatorios se envían, por qué canal y a quién. Solo owner y admin.",
    sections: [
      {
        heading: "Cómo funciona",
        items: [
          "Cada mañana a las 7:00 se junta lo pendiente de cada aviso prendido y se manda: un correo por persona y un push por aviso.",
          "Apagar un canal (correo o push) detiene todos los avisos por esa vía; apagar un aviso lo detiene en todos los canales.",
          "En cada aviso eliges los canales, qué roles lo reciben y, en cobros y pagos, con cuántos días.",
          "Lo ya enviado en el día no se repite.",
        ],
      },
      {
        heading: "Probar",
        items: ["'Enviarme una prueba' te manda ahora, solo a ti, lo pendiente de cada aviso prendido."],
      },
    ],
  },

  businessProfile: {
    title: "Datos de la empresa",
    chapter: "configuracion",
    summary:
      "Lo que ven los clientes: imagen del encabezado, nombre comercial, razón social, RIF, contacto, web y dirección. Solo owner y admin.",
    sections: [
      {
        heading: "Dónde sale",
        items: [
          "En el encabezado de los presupuestos y de la nota de entrega. Lo que quede vacío no se muestra.",
          "La imagen del encabezado (PNG o JPG de hasta 2 MB) va arriba a la izquierda de los presupuestos. Sin imagen, se usa el logo de la marca.",
          "Los teléfonos se escriben como quieras (0414-123.45.67) y se guardan siempre igual.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Cambiar el correo de contacto no cambia el remitente de los correos del sistema (códigos de acceso y avisos): ese va en la configuración del servidor.",
          "Si pones un correo @tuestuchef.com, debe existir para recibir (reenvío en Cloudflare).",
        ],
      },
    ],
  },

  quotes: {
    title: "Presupuestos",
    chapter: "presupuestos",
    summary: "Cotizaciones para empresas y pedidos grandes. Un presupuesto no es una factura ni mueve dinero ni inventario.",
    sections: [
      {
        heading: "Qué ves",
        items: [
          "Cada presupuesto con su número, estado, cliente, fechas, quién lo hizo y su total.",
          "Busca por número o cliente y filtra por estado o fecha.",
          "Un enviado cuya fecha pasó aparece como vencido.",
        ],
      },
    ],
  },

  quoteForm: {
    title: "Nuevo presupuesto",
    chapter: "presupuestos",
    summary: "Cliente, monedas, productos, descuentos, IVA y condiciones. Se guarda como borrador.",
    sections: [
      {
        heading: "Cómo se arma",
        items: [
          "Cliente: elige uno guardado o escribe solo el nombre. A un cliente bloqueado no se le hacen presupuestos.",
          "Monedas: USD, Bs o ambas. Cada moneda sale de la lista de precios de un método de pago; los Bs, a la tasa BCV del día.",
          "Productos con color y talla, combos y personalización. Los nombres y el logo se piden en el pedido.",
          "Descuento por línea o del presupuesto, siempre con motivo; staff tiene el mismo límite que en ventas.",
          "IVA opcional sobre el total. La nota de IGTF es solo texto.",
          "Imagen del encabezado: por defecto la de Datos de la empresa; puedes subir otra solo para este presupuesto.",
        ],
      },
      {
        heading: "Recuerda",
        items: ["Los totales de la pantalla son una vista previa: al guardar, el sistema vuelve a calcular precios, tasa y fecha."],
      },
    ],
  },

  quote: {
    title: "Detalle de presupuesto",
    chapter: "presupuestos",
    summary: "El presupuesto como lo ve el cliente, sus acciones según el estado y su historial.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Borrador: editar, enviar o descartar con motivo. Para enviarlo debe ser de hoy (si no, guárdalo de nuevo).",
          "Enviar: por correo (con el PDF adjunto; las respuestas le llegan a quien lo preparó), por WhatsApp (mensaje con el enlace al PDF) o solo marcarlo como enviado. Reenviar manda el mismo PDF.",
          "Enlace para el cliente: abre el PDF sin descargar nada, hasta 30 días después del vencimiento. Puedes copiarlo, revocarlo y ver cuántas veces se abrió.",
          "Enviado: marcar aceptado o rechazado cuando el cliente responda.",
          "Nueva versión: para cambiar uno enviado, rechazado o vencido. Mismo número con -v2; el anterior queda reemplazado.",
          "Duplicar: un presupuesto nuevo con el mismo contenido y precios de hoy.",
          "Convertir en pedido (aceptado): copia cliente, líneas, personalización y precios del presupuesto. Pide el cliente guardado, con qué lista paga (USD o Bs), inventario, fecha y los nombres o logos que falten. Se convierte una sola vez.",
        ],
      },
      {
        heading: "PDF",
        items: [
          "Abrir PDF: lo muestra completo sin descargarlo (en el teléfono, con su visor). En computadora también hay vista previa dentro de la página.",
          "Descargar PDF: guarda el archivo. Es el mismo documento que recibe el cliente.",
          "En borrador el PDF lleva la marca \"BORRADOR\". Al enviarlo se guarda el PDF oficial y ya no cambia.",
        ],
      },
      {
        heading: "Recuerda",
        items: ["Enviado, ya no cambia. Cada cambio de estado queda en el historial con quién y cuándo."],
      },
    ],
  },

  quoteSettings: {
    title: "Configuración de presupuestos",
    chapter: "configuracion",
    summary: "Numeración, vigencia, listas de precios, IVA y condiciones por defecto de los presupuestos. Solo owner y admin.",
    sections: [
      {
        heading: "Numeración",
        items: [
          "Prefijo y dígitos: TLT + 5 dígitos da TLT00001.",
          "El siguiente número solo puede subir: así nunca se repite uno ya emitido.",
        ],
      },
      {
        heading: "Precios e impuestos",
        items: [
          "Cada presupuesto usa la lista de precios de un método de pago. Aquí eliges las que vienen marcadas: la de USD es de un método que cobra en divisas (efectivo, Zelle, USDT) y la de Bs de uno que cobra en Bs (pago móvil).",
          "Si se muestran ambas monedas, cada una sale de su lista: el monto en Bs usa el precio de esa lista a la tasa BCV del día.",
          "El IVA se suma al total cuando se marca; aquí van la tasa y si viene marcado. La nota de IGTF es solo texto.",
        ],
      },
      {
        heading: "Condiciones",
        items: ["El texto por defecto (vigencia, entrega, abono, métodos de pago, personalización) se puede ajustar en cada presupuesto."],
      },
    ],
  },

  messageTemplates: {
    title: "Mensajes de WhatsApp",
    chapter: "configuracion",
    summary: "El texto de los mensajes listos para enviar a los clientes. Solo owner y admin los editan.",
    sections: [
      {
        heading: "Cómo funciona",
        items: [
          "Cada mensaje tiene datos entre llaves, como {cliente} o {pendiente}, que se completan solos al enviarlo.",
          "Toca un dato para agregarlo donde está el cursor. La vista previa usa datos de ejemplo.",
          "Apagado, el mensaje no aparece en el botón de WhatsApp.",
          "Antes de abrir WhatsApp se puede ajustar el texto solo para ese envío.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Por ahora se abre WhatsApp con el texto y la persona toca enviar: el registro dice 'WhatsApp · Abierto', no 'entregado'.",
          "*texto* sale en negrita y _texto_ en cursiva.",
        ],
      },
    ],
  },

  myNotifications: {
    title: "Mis avisos",
    chapter: "configuracion",
    summary: "Activa los avisos en tu teléfono o computadora y ve lo que te llegó.",
    sections: [
      {
        heading: "Activar el push",
        items: [
          "Toca 'Activar avisos en este dispositivo' y acepta el permiso del navegador. Hazlo en cada dispositivo.",
          "En iPhone, primero instala el panel en la pantalla de inicio (Compartir → Agregar a inicio) y ábrelo desde ahí.",
          "Qué avisos te llegan depende de tu rol; owner y admin lo configuran.",
        ],
      },
    ],
  },

  priceCalculator: {
    title: "Calculadora de precios",
    chapter: "ventas",
    summary: "Para contestar \"¿cuánto cuesta…?\" rápido. No registra nada.",
    sections: [
      {
        heading: "Cómo se usa",
        items: [
          "Toca un producto para sumarlo; la búsqueda encuentra también colores.",
          "En la lista cambias la cantidad con − y +, o la vacías.",
          "Copiar para WhatsApp arma la respuesta: \"Tuestuchef - Lista de Precios\", los productos y el total en Bs (pago móvil) y en USD (efectivo). Zelle y USDT no van en el mensaje.",
        ],
      },
      {
        heading: "Los totales",
        items: [
          "Uno por método de pago, con su propia lista de precios y en su moneda.",
          "Los Bs son el precio de ese método × la tasa BCV de hoy, igual que al vender.",
          "El descuento al mayor se aplica solo, por piezas (un combo cuenta sus piezas).",
          "Si un producto no tiene precio en un método, se avisa y no entra en ese total.",
        ],
      },
    ],
  },

  offlineSales: {
    title: "Ventas pendientes",
    chapter: "ventas",
    summary: "Ventas hechas sin conexión que no pasaron al enviarse. Nunca se pierden.",
    sections: [
      {
        heading: "Sin conexión",
        items: [
          "Sin señal, Nueva venta sigue funcionando con los precios y la tasa de la última vez que tuvo conexión.",
          "La venta se guarda en el teléfono y se envía sola al volver la señal, con la hora en que de verdad se hizo.",
          "Al enviarse se revisa todo de nuevo: stock, cliente bloqueado, tasa de esa fecha y días hacia atrás.",
        ],
      },
      {
        heading: "Si no pasa",
        items: [
          "Queda aquí con su motivo. Owner o admin la reintentan (p. ej. cuando ya hay stock) o la descartan con motivo.",
          "Staff ve solo las suyas.",
        ],
      },
    ],
  },

  team: {
    title: "Equipo",
    chapter: "equipo",
    summary: "Quién cobra sueldo, cuánto, lo pagado este mes y los adelantos por descontar. Solo owner y admin.",
    sections: [
      {
        heading: "Qué puedes hacer",
        items: [
          "Agregar personas del equipo, tengan o no cuenta en el sistema (p. ej. una costurera).",
          "Abrir una persona para definir su sueldo, pagarle o darle un adelanto.",
        ],
      },
      {
        heading: "Recuerda",
        items: [
          "Todo dinero que sale para una persona del equipo (incluido el dueño) es sueldo, adelanto o retiro. Nunca \"prestado\".",
          "Los pagos y adelantos van al libro con categoría Sueldos y restan en la utilidad real.",
        ],
      },
    ],
  },

  teamMember: {
    title: "Persona del equipo",
    chapter: "equipo",
    summary: "Sueldo, pagos y adelantos de una persona.",
    sections: [
      {
        heading: "Sueldo",
        items: [
          "Monto, moneda y frecuencia. Un cambio no edita el anterior: se agrega uno nuevo con su fecha.",
        ],
      },
      {
        heading: "Pagos y adelantos",
        items: [
          "Adelanto: sale dinero y queda pendiente hasta el próximo pago.",
          "Pagar sueldo: se marcan los adelantos a descontar y se sugiere el neto (sueldo − adelantos).",
          "En Bs, el equivalente en dólares usa la tasa BCV de la fecha del pago.",
          "Un error se corrige revirtiendo el movimiento en Movimientos; un adelanto revertido deja de estar pendiente.",
        ],
      },
      {
        heading: "Cuenta en el sistema",
        items: ["Si la persona usa el panel, vincúlala con su usuario: sus retiros y sueldos quedan unidos a su cuenta."],
      },
    ],
  },
} as const satisfies Record<string, HelpTopic>

export type HelpTopicKey = keyof typeof HELP_TOPICS
