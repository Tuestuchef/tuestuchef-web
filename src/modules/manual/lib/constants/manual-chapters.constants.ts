import type { ManualChapter, ManualChapterStub } from "../types/manual.types"
import { CUSTOMERS_CHAPTER, SALES_CHAPTER } from "./chapters/comercial.constants"
import { PURCHASES_CHAPTER } from "./chapters/compras.constants"
import { SETTINGS_CHAPTER } from "./chapters/configuracion.constants"
import { TEAM_CHAPTER } from "./chapters/equipo.constants"
import { INVENTORY_CHAPTER } from "./chapters/inventario.constants"
import { ORDERS_CHAPTER } from "./chapters/pedidos.constants"
import { QUOTES_CHAPTER } from "./chapters/presupuestos.constants"
import { RESULTS_CHAPTER } from "./chapters/resultados.constants"
import { TREASURY_CHAPTER } from "./chapters/tesoreria.constants"

// Capítulos escritos, en el orden de las áreas.
export const MANUAL_CHAPTERS: readonly ManualChapter[] = [
  SALES_CHAPTER,
  QUOTES_CHAPTER,
  CUSTOMERS_CHAPTER,
  INVENTORY_CHAPTER,
  ORDERS_CHAPTER,
  PURCHASES_CHAPTER,
  TREASURY_CHAPTER,
  RESULTS_CHAPTER,
  TEAM_CHAPTER,
  SETTINGS_CHAPTER,
]

// Capítulos planificados: aparecen en el índice como "Pronto" hasta que se escriban.
export const MANUAL_STUBS: readonly ManualChapterStub[] = []
