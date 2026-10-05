import {
  BoxesIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  FileSpreadsheetIcon,
  ImageIcon,
  LayersIcon,
  PackageIcon,
  PackageMinusIcon,
  PackageOpenIcon,
  PackagePlusIcon,
  ScissorsIcon,
  ShirtIcon,
  ShoppingBagIcon,
  TagIcon,
  TruckIcon,
} from "lucide-react"

import { ROLE_GROUPS } from "@/common/lib/constants/roles.constants"
import { ROUTES } from "@/common/lib/constants/routes.constants"

import type { ManualChapter } from "../../types/manual.types"

export const INVENTORY_CHAPTER: ManualChapter = {
  slug: "inventario",
  area: "inventario",
  title: "Catálogo, stock y producción",
  summary:
    "Qué vendemos, cuánto hay de cada cosa, de qué está hecha cada prenda y cuánto cuesta hacerla. El stock nunca se escribe a mano: se calcula con lo que entra y sale.",
  icon: PackageIcon,
  roles: ROLE_GROUPS.ALL,
  screens: [
    { title: "Catálogo", url: ROUTES.PRODUCTS, roles: ROLE_GROUPS.ALL },
    { title: "Combos", url: ROUTES.COMBOS, roles: ROLE_GROUPS.ALL },
    { title: "Stock", url: ROUTES.STOCK, roles: ROLE_GROUPS.ALL },
    { title: "Materia prima", url: ROUTES.RAW_MATERIALS, roles: ROLE_GROUPS.ALL },
    { title: "Carga inicial", url: ROUTES.INITIAL_STOCK, roles: ROLE_GROUPS.MANAGEMENT },
  ],
  related: ["ventas", "compras", "resultados", "configuracion"],
  sections: [
    {
      id: "que-es",
      heading: "Qué es",
      blocks: [
        {
          kind: "text",
          body:
            "El área de **stock y producto**. Tiene dos tipos de cosas: lo que se **vende** (filipinas, delantales, pantalones, gorros…) y la **materia prima** con la que se fabrica (tela, botones, cierres). Las dos viven en el inventario, pero la materia prima no aparece al vender.",
        },
        {
          kind: "flow",
          title: "Cómo se mueve el inventario",
          nodes: [
            { icon: TruckIcon, title: "Entra la tela", detail: "Con una compra, a su costo.", chapter: "compras" },
            { icon: ScissorsIcon, title: "Se produce", detail: "La receta descuenta tela y botones y suma prendas." },
            { icon: ShirtIcon, title: "Prendas en stock", detail: "Con su costo promedio." },
            { icon: ShoppingBagIcon, title: "Se venden", detail: "Cada venta descuenta sola.", chapter: "ventas" },
          ],
        },
      ],
    },
    {
      id: "catalogo",
      heading: "El catálogo: productos y variantes",
      blocks: [
        {
          kind: "text",
          body:
            "Un **producto** es un modelo (p. ej. “Filipina dama broche”). Sus **variantes** son cada combinación de color y talla que de verdad existe (Negra M, Blanca L…). El stock, el costo y el código (**SKU**) son de cada variante.",
        },
        {
          kind: "example",
          title: "Cómo se arma un SKU",
          rows: [
            { label: "Categoría (Filipinas)", value: "FIL" },
            { label: "Género (dama)", value: "D" },
            { label: "Cierre o corte (broche)", value: "BR" },
            { label: "Color (Negro)", value: "NEG" },
            { label: "Talla (M)", value: "M" },
            { label: "SKU de la variante", value: "FIL-D-BR-NEG-M", total: true },
          ],
          conclusion:
            "Los códigos salen de Configuración (categorías, colores y tallas). “Colores × tallas” crea todas las combinaciones de una vez.",
        },
        {
          kind: "effects",
          items: [
            { icon: TagIcon, title: "Precios", effect: "Uno en dólares por método de pago. Vacío = no se vende por ese método.", chapter: "ventas" },
            { icon: ImageIcon, title: "Fotos", effect: "Varias por producto, una principal, y cada una puede ir con un color." },
            { icon: PackageMinusIcon, title: "Stock mínimo", effect: "Al llegar a ese número la variante se marca como stock bajo." },
            { icon: LayersIcon, title: "Inventario o por encargo", effect: "Por encargo: se fabrica al venderse y no lleva stock." },
          ],
        },
      ],
    },
    {
      id: "combos",
      heading: "Combos",
      blocks: [
        {
          kind: "text",
          body:
            "Un **combo** junta varios productos con un precio propio por método de pago (p. ej. Combo Escuela: bandana, filipina, pantalón y delantal). Se crea en **Inventario → Combos** y se le agregan sus componentes con su cantidad.",
        },
        {
          kind: "flow",
          title: "Cómo se vende un combo",
          nodes: [
            { icon: PackageOpenIcon, title: "Se elige el combo", detail: "Con su precio para el método de pago." },
            { icon: ShirtIcon, title: "Talla y color de cada pieza", detail: "Con varios combos se pueden mezclar tallas." },
            { icon: PackageMinusIcon, title: "Sale el stock de cada pieza", detail: "Las piezas por encargo van a producción." },
            { icon: ChartColumnIcon, title: "El ingreso se reparte", detail: "Entre sus productos, según el precio de cada uno.", chapter: "resultados" },
          ],
        },
        {
          kind: "callout",
          tone: "info",
          title: "Un combo no tiene stock propio",
          body:
            "Su disponibilidad es la de sus piezas. Su costo para el margen es la suma del costo promedio y la mano de obra de cada componente.",
        },
      ],
    },
    {
      id: "stock",
      heading: "El stock se calcula, no se escribe",
      blocks: [
        {
          kind: "text",
          body:
            "Nadie escribe “quedan 12”. Cada entrada o salida es un **movimiento de stock**, y el saldo es la suma. Así siempre se sabe por qué hay lo que hay, y quién lo movió.",
        },
        {
          kind: "example",
          title: "La historia de la Filipina Negra M",
          rows: [
            { label: "Carga inicial", value: "+5" },
            { label: "Producción (lote 2)", value: "+4" },
            { label: "Venta V-000031", value: "−2" },
            { label: "Venta V-000038", value: "−1" },
            { label: "Ajuste: prenda dañada", value: "−1", note: "Con motivo; solo owner o admin." },
            { label: "Stock actual", value: "5", total: true },
          ],
        },
        {
          kind: "effects",
          items: [
            { icon: TruckIcon, title: "Compra", effect: "Entra desde Compras, con su proveedor y costo.", chapter: "compras" },
            { icon: ScissorsIcon, title: "Producción", effect: "Suma prendas y descuenta la materia prima de la receta." },
            { icon: ShoppingBagIcon, title: "Venta", effect: "Descuenta sola; una venta anulada devuelve.", chapter: "ventas" },
            { icon: ClipboardCheckIcon, title: "Ajuste", effect: "Conteo físico, merma o daño. Con motivo (owner y admin)." },
          ],
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Nunca negativo, nunca editado",
          body:
            "El stock no puede quedar por debajo de cero: si no alcanza, no se puede vender ni producir. Los movimientos no se editan ni se borran; un error se corrige con un ajuste.",
        },
      ],
    },
    {
      id: "costo",
      heading: "Cuánto cuesta cada prenda",
      blocks: [
        {
          kind: "text",
          body:
            "Cada variante tiene un **costo promedio ponderado** en USDT: cada vez que entra mercancía, el costo se mezcla con lo que ya había según la cantidad. Así no importa si la tela de hoy salió más cara que la del mes pasado.",
        },
        {
          kind: "example",
          title: "Costo promedio de la tela negra",
          rows: [
            { label: "Había 50 m a 4,50", value: "225,00 USDT" },
            { label: "Entran 30 m a 5,00", value: "150,00 USDT" },
            { label: "Total: 80 m", value: "375,00 USDT" },
            { label: "Costo promedio (375 ÷ 80)", value: "4,69 USDT/m", total: true },
          ],
        },
        {
          kind: "example",
          title: "Costo de una filipina (talla M)",
          rows: [
            { label: "Tela: 1,6 m × 4,69", value: "7,50 USDT" },
            { label: "Botones: 8 × 0,08", value: "0,64 USDT" },
            { label: "Materiales", value: "8,14 USDT" },
            { label: "Mano de obra por unidad", value: "4,00 USDT", note: "Solo para el margen (ver abajo)." },
            { label: "Costo para el margen", value: "12,14 USDT", total: true },
          ],
          conclusion:
            "Vendida por pago móvil vale 22,40 USDT reales: margen 10,26. En efectivo vale 25: margen 12,86. Owner y admin lo ven en la pestaña **Margen** de cada producto.",
        },
        {
          kind: "callout",
          tone: "info",
          title: "La mano de obra no se resta dos veces",
          body:
            "El costo de mano de obra de un producto solo sirve para ver su margen. En la [[utilidad-real]] no se resta, porque los sueldos de quien cose ya se restan en Recursos humanos.",
        },
      ],
    },
    {
      id: "produccion",
      heading: "Recetas y producción",
      blocks: [
        {
          kind: "text",
          body:
            "La **receta** dice qué materia prima lleva cada prenda. Una línea puede ser un material exacto (“botones de presión”) o **“del mismo color que la prenda”** (la filipina negra usa tela negra). La cantidad puede cambiar por talla.",
        },
        {
          kind: "steps",
          items: [
            { title: "Ve a Stock → Producción", body: "Elige la variante y cuántas se hicieron." },
            { title: "Se descuenta la receta", body: "Sale la tela y los botones del inventario, a su costo promedio." },
            { title: "Entran las prendas", body: "Con un costo igual a lo que costaron sus materiales." },
            {
              title: "Si falta material",
              body: "No se registra y el aviso dice cuál falta (p. ej. tela vinotinta). Sin receta, se indica el costo a mano.",
            },
          ],
        },
        {
          kind: "text",
          body:
            "Los productos [[por-encargo]] no pasan por aquí: consumen su receta solos cuando la línea de la venta se marca **lista**. La merma real (tela que se perdió) la corrige owner o admin con un ajuste con nota.",
        },
      ],
    },
    {
      id: "materia-prima",
      heading: "Materia prima",
      blocks: [
        {
          kind: "text",
          body:
            "Telas, botones, cierres e insumos. Cada material tiene una **unidad** (metro, kilo o unidad) y variantes por color si hace falta. Entra con **Compras** y sale con la producción; nunca se vende.",
        },
      ],
    },
    {
      id: "carga-inicial",
      heading: "Arrancar con el inventario que ya existe",
      roles: ROLE_GROUPS.MANAGEMENT,
      blocks: [
        {
          kind: "steps",
          items: [
            { title: "Prepara un CSV", body: "Columnas: SKU, cantidad y, si se sabe, costo unitario en USDT." },
            { title: "Stock → Carga inicial", body: "Pega el texto o sube el archivo y toca Revisar." },
            { title: "Confirma", body: "Se carga todo o nada. Solo sirve para variantes sin movimientos." },
          ],
        },
      ],
    },
    {
      id: "conexiones",
      heading: "Con qué se conecta",
      blocks: [
        {
          kind: "connections",
          center: { icon: BoxesIcon, title: "Inventario" },
          inputs: [
            { icon: TruckIcon, title: "Compras", effect: "Tela, insumos y mercancía con su costo", chapter: "compras" },
            { icon: FileSpreadsheetIcon, title: "Configuración", effect: "Categorías, colores y tallas (códigos del SKU)", chapter: "configuracion" },
          ],
          outputs: [
            { icon: ShoppingBagIcon, title: "Ventas", effect: "Qué se puede vender y a qué precio", chapter: "ventas" },
            { icon: PackagePlusIcon, title: "Costo de cada prenda", effect: "Promedio ponderado en USDT" },
            { icon: ChartColumnIcon, title: "Resultados", effect: "Margen por producto vendido", chapter: "resultados" },
          ],
        },
      ],
    },
    {
      id: "quien",
      heading: "Quién puede hacer qué",
      blocks: [
        {
          kind: "roles",
          items: [
            { role: "staff", can: "Ve el catálogo y el stock, y registra producción." },
            {
              role: "admin",
              can: "Crea y edita productos, variantes, precios, fotos y recetas; hace ajustes y la carga inicial; ve costos y márgenes.",
            },
            { role: "owner", can: "Igual que admin." },
          ],
        },
      ],
    },
    {
      id: "preguntas",
      heading: "Preguntas frecuentes",
      blocks: [
        {
          kind: "faq",
          items: [
            {
              question: "Conté y hay 2 filipinas menos de lo que dice el sistema.",
              answer: "Owner o admin registran un ajuste de −2 con el motivo (conteo físico). Nunca se cambia el número a mano.",
            },
            {
              question: "¿Por qué no puedo vender una variante?",
              answer: "No tiene stock, o no tiene precio para el método de pago elegido.",
            },
            {
              question: "¿Por qué el margen de un producto dice “sin costo”?",
              answer: "Falta su receta o un material de la receta no tiene costo. Se muestra vacío para no inventar un margen.",
            },
          ],
        },
      ],
    },
  ],
}
