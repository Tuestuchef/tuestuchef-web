import "server-only"

import { z } from "zod"

// Cloudflare R2. Variables solo del servidor (nunca NEXT_PUBLIC_).
// Si faltan, el almacenamiento queda deshabilitado y la app sigue funcionando.
const storageEnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().regex(/^[a-f0-9]{32}$/, "Debe ser el Account ID de Cloudflare (32 caracteres hex)."),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_PUBLIC_BUCKET: z.string().min(1).default("tuestuchef-public"),
  R2_PRIVATE_BUCKET: z.string().min(1).default("tuestuchef-private"),
  R2_PUBLIC_URL: z.url().optional(),
})

const REQUIRED_KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"] as const

export type StorageConfig = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  buckets: { public: string; private: string }
  // Dominio propio del bucket público (sin barra final). Opcional.
  publicUrl: string | null
}

const emptyToUndefined = (value: string | undefined) => (value?.trim() ? value.trim() : undefined)

function readStorageConfig(): StorageConfig | null {
  const raw = {
    R2_ACCOUNT_ID: emptyToUndefined(process.env.R2_ACCOUNT_ID),
    R2_ACCESS_KEY_ID: emptyToUndefined(process.env.R2_ACCESS_KEY_ID),
    R2_SECRET_ACCESS_KEY: emptyToUndefined(process.env.R2_SECRET_ACCESS_KEY),
    R2_PUBLIC_BUCKET: emptyToUndefined(process.env.R2_PUBLIC_BUCKET),
    R2_PRIVATE_BUCKET: emptyToUndefined(process.env.R2_PRIVATE_BUCKET),
    R2_PUBLIC_URL: emptyToUndefined(process.env.R2_PUBLIC_URL),
  }

  const missing = REQUIRED_KEYS.filter((key) => !raw[key])
  if (missing.length === REQUIRED_KEYS.length) return null

  if (missing.length > 0) {
    console.warn(
      `[storage] Configuración de R2 incompleta, comprobantes deshabilitados. Falta: ${missing.join(", ")}`
    )
    return null
  }

  const parsed = storageEnvSchema.safeParse(raw)
  if (!parsed.success) {
    console.warn(
      `[storage] Configuración de R2 inválida, comprobantes deshabilitados: ${z.prettifyError(parsed.error)}`
    )
    return null
  }

  const env = parsed.data
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    buckets: { public: env.R2_PUBLIC_BUCKET, private: env.R2_PRIVATE_BUCKET },
    publicUrl: env.R2_PUBLIC_URL?.replace(/\/+$/, "") ?? null,
  }
}

let cached: StorageConfig | null | undefined

export function getStorageConfig(): StorageConfig | null {
  if (cached === undefined) cached = readStorageConfig()
  return cached
}
