import "server-only"

import { AwsClient } from "aws4fetch"

import type { StorageConfig } from "@/common/lib/config/storage.config"
import type { StorageBucket, StorageProvider } from "@/common/lib/types/storage.types"

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/")

// R2 habla el API de S3. aws4fetch firma las URLs sin el SDK completo de AWS.
export function createR2Storage(config: StorageConfig): StorageProvider {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  })

  const objectUrl = (bucket: StorageBucket, path: string) =>
    new URL(
      `https://${config.accountId}.r2.cloudflarestorage.com/${config.buckets[bucket]}/${encodePath(path)}`
    )

  async function presign(
    url: URL,
    method: "GET" | "PUT",
    expiresInSeconds: number,
    headers?: Record<string, string>
  ) {
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds))
    // allHeaders: aws4fetch no firma Content-Type por defecto; aquí sí queremos firmarlo.
    const signed = await client.sign(new Request(url, { method, headers }), {
      aws: { signQuery: true, allHeaders: true },
    })
    return signed.url
  }

  return {
    // Content-Type queda firmado: R2 rechaza la subida si el navegador manda otro.
    createUploadUrl: ({ bucket, path, contentType, expiresInSeconds }) =>
      presign(objectUrl(bucket, path), "PUT", expiresInSeconds, {
        "Content-Type": contentType,
      }),

    createDownloadUrl: ({ bucket, path, expiresInSeconds }) =>
      presign(objectUrl(bucket, path), "GET", expiresInSeconds),

    async getObjectInfo({ bucket, path }) {
      const response = await client.fetch(objectUrl(bucket, path), { method: "HEAD" })
      if (response.status === 404) return null
      if (!response.ok) {
        throw new Error(`R2 respondió ${response.status} al consultar ${path}`)
      }
      return {
        size: Number(response.headers.get("content-length") ?? 0),
        contentType: response.headers.get("content-type"),
      }
    },

    async deleteObject({ bucket, path }) {
      const response = await client.fetch(objectUrl(bucket, path), { method: "DELETE" })
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 respondió ${response.status} al borrar ${path}`)
      }
    },

    getPublicUrl: (path) => (config.publicUrl ? `${config.publicUrl}/${encodePath(path)}` : null),
  }
}
