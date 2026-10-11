import type { ProductionStage } from "../constants/orders.constants"

// Estados por los que pasa una línea de pedido, en orden (igual que line_stage_applies en la base):
// corte y confección solo si se produce algo; personalización solo si la lleva.
export const lineStages = (source: string, toMake: number, customized: boolean): ProductionStage[] =>
  source === "combo"
    ? []
    : [
        "to_produce",
        ...(source === "made_to_order" && toMake > 0 ? (["cutting", "sewing"] as const) : []),
        ...(customized ? (["customization"] as const) : []),
        "quality_check",
        "packing",
        "ready",
        "delivered",
      ]
