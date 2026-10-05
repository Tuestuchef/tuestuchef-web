// Cola de ventas hechas sin conexión, guardada en el teléfono (IndexedDB).
// Solo navegador. Cada venta lleva su id propio (clientRef): reenviarla nunca la duplica.

export type QueuedSale = {
  clientRef: string
  // Lo mismo que se envía a createSaleAction, más occurred_at (ISO).
  payload: Record<string, unknown>
  // Para mostrar en pantalla.
  label: string
  totalUsd: number
  queuedAt: string
}

const DB_NAME = "tuestuchef-offline"
const STORE = "sales"
export const QUEUE_CHANGED_EVENT = "offline-queue-changed"

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "clientRef" })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = work(tx.objectStore(STORE))
    tx.oncomplete = () => {
      db.close()
      resolve(request.result)
    }
    tx.onerror = () => reject(tx.error)
  })
}

const notify = () => window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT))

export async function queueSale(sale: QueuedSale) {
  await run("readwrite", (store) => store.put(sale))
  notify()
}

export async function listQueuedSales(): Promise<QueuedSale[]> {
  const rows = await run<QueuedSale[]>("readonly", (store) => store.getAll())
  return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
}

export async function removeQueuedSale(clientRef: string) {
  await run("readwrite", (store) => store.delete(clientRef))
  notify()
}

// ¿El error es de red (sin conexión) y no una respuesta del servidor?
export const isNetworkError = (error: unknown) =>
  !navigator.onLine || error instanceof TypeError || (error instanceof Error && /fetch|network|Failed to/i.test(error.message))
