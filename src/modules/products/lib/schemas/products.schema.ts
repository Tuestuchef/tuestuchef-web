import { z } from "zod"

import { Constants } from "@/common/lib/db/database.types"
import {
  booleanFieldSchema,
  optionalTextSchema,
  pastOrTodayDateSchema,
  positiveAmountSchema,
} from "@/common/lib/schemas/form-fields.schema"
import { parseAmount } from "@/common/lib/utils/parse-amount.util"

import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_TYPES, type ProductImageType } from "../constants/products.constants"
import { normalizeSku, normalizeSkuPart, SKU_PATTERN } from "../utils/build-sku.util"

const E = Constants.public.Enums

const optionalUuid = z
  .string()
  .optional()
  // "none" = opción "sin valor" de los selectores.
  .transform((value) => (value && value !== "none" ? value : undefined))
  .pipe(z.uuid().optional())

// "" → null para atributos opcionales.
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? value : null))
    .pipe(z.enum(values).nullable())

export const catalogItemSchema = z.object({
  kind: z.enum(["product_categories", "sizes", "colors"]),
  id: optionalUuid,
  name: z.string().trim().min(1, { error: "Escribe un nombre." }).max(40),
  code: z
    .string()
    .transform(normalizeSkuPart)
    .pipe(z.string().min(1, { error: "Escribe un código (letras y números)." }).max(6, { error: "Máximo 6 caracteres." })),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: booleanFieldSchema.default(true),
})

export const productSchema = z.object({
  id: optionalUuid,
  category_id: z.uuid({ error: "Elige la categoría." }),
  name: z.string().trim().min(2, { error: "Escribe el nombre." }).max(120),
  description: optionalTextSchema(500),
  // Producto terminado o materia prima. Solo se fija al crear.
  kind: z.enum(E.product_kind).default("finished_good"),
  fulfillment_type: z.enum(E.fulfillment_type, { error: "Elige cómo se despacha." }),
  unit: z.enum(E.product_unit).default("unit"),
  gender: optionalEnum(E.product_gender),
  closure: optionalEnum(E.product_closure),
  fit: optionalEnum(E.product_fit),
  // Mano de obra por unidad en USDT: solo para el margen (nunca se resta de la utilidad).
  labor_cost_usdt: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value?.trim()) return 0
      const parsed = parseAmount(value, 6)
      if (parsed === null || parsed < 0) {
        ctx.addIssue({ code: "custom", message: "Revisa la mano de obra." })
        return z.NEVER
      }
      return parsed
    }),
  is_active: booleanFieldSchema.default(true),
})

const minStockSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value?.trim()) return 0
    const parsed = parseAmount(value, 3)
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "Revisa el stock mínimo." })
      return z.NEVER
    }
    return parsed
  })

const optionalSkuSchema = z
  .string()
  .optional()
  .transform((value) => (value ? normalizeSku(value) : undefined))
  .refine((value) => value === undefined || SKU_PATTERN.test(value), { error: "SKU inválido." })

export const variantSchema = z.object({
  id: optionalUuid,
  product_id: z.uuid(),
  color_id: optionalUuid,
  size_id: optionalUuid,
  // Vacío = se genera a partir de los códigos.
  sku: optionalSkuSchema,
  min_stock: minStockSchema,
  is_active: booleanFieldSchema.default(true),
})

// Crear varias variantes a la vez: colores × tallas.
export const bulkVariantsSchema = z.object({
  product_id: z.uuid(),
  color_ids: z.array(z.uuid()).default([]),
  size_ids: z.array(z.uuid()).default([]),
})

// Precios en USD de referencia por método de pago. Vacío = sin precio para ese método.
export const pricesSchema = z.object({
  product_id: z.uuid(),
  prices: z.record(
    z.uuid(),
    z
      .string()
      .transform((value, ctx) => {
        if (!value.trim()) return null
        const parsed = parseAmount(value)
        if (parsed === null || parsed <= 0) {
          ctx.addIssue({ code: "custom", message: "Precio inválido." })
          return z.NEVER
        }
        return parsed
      })
  ),
})

export const stockMovementSchema = z
  .object({
    variant_id: z.uuid({ error: "Elige el producto y la variante." }),
    movement_type: z.enum(["production", "adjustment"], { error: "Elige el tipo." }),
    quantity: positiveAmountSchema("la cantidad", 3),
    // Solo ajustes: suma o resta.
    direction: z.enum(["in", "out"]).default("in"),
    unit_cost_usdt: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value?.trim()) return undefined
        const parsed = parseAmount(value, 6)
        if (parsed === null) {
          ctx.addIssue({ code: "custom", message: "Revisa el costo." })
          return z.NEVER
        }
        return parsed
      }),
    note: optionalTextSchema(200),
    date: pastOrTodayDateSchema,
  })
  // Producción: el costo sale de la receta; sin receta, la base exige el costo unitario.
  .refine((v) => v.movement_type !== "adjustment" || Boolean(v.note), {
    error: "Indica el motivo del ajuste.",
    path: ["note"],
  })

// Línea de receta: material "variant:<id>" (específico) o "product:<id>" (mismo color que la prenda).
export const recipeLineSchema = z.object({
  product_id: z.uuid(),
  material: z.string().regex(/^(variant|product):[0-9a-f-]{36}$/, { error: "Elige el material." }),
  size_id: optionalUuid,
  quantity: positiveAmountSchema("la cantidad", 4),
})

export const initialStockSchema = z.object({
  csv: z.string().trim().min(1, { error: "Pega o sube el CSV." }).max(200_000),
})

const imageTypes = Object.keys(PRODUCT_IMAGE_TYPES) as [ProductImageType, ...ProductImageType[]]

export const productImageUploadSchema = z.object({
  product_id: z.uuid(),
  contentType: z.enum(imageTypes, { error: "Solo fotos JPG, PNG o WEBP." }),
  size: z
    .number()
    .int()
    .positive({ error: "El archivo está vacío." })
    .max(PRODUCT_IMAGE_MAX_BYTES, { error: "La foto pesa más de 8 MB." }),
})

export const productImageRegisterSchema = z.object({
  product_id: z.uuid(),
  path: z.string().regex(/^products\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/),
  color_id: optionalUuid,
})

export const productImageUpdateSchema = z.object({
  id: z.uuid(),
  color_id: optionalUuid,
})

export type CatalogItemInput = z.infer<typeof catalogItemSchema>
export type ProductInput = z.infer<typeof productSchema>
export type RecipeLineInput = z.infer<typeof recipeLineSchema>
export type RecipeLineField = keyof RecipeLineInput
export type VariantInput = z.infer<typeof variantSchema>
export type StockMovementInput = z.infer<typeof stockMovementSchema>
export type ProductField = keyof ProductInput
export type VariantField = keyof VariantInput
export type CatalogField = keyof CatalogItemInput
export type StockMovementField = keyof StockMovementInput
