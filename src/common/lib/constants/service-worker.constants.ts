// URL del service worker (sin conexión y avisos push). Todos los registros usan esta misma URL:
// si dos registran URLs distintas, el navegador los reemplaza uno al otro.
//
// En desarrollo los archivos de /_next/static no cambian de nombre al editar el código, así que el
// service worker no debe guardarlos (si no, sirve JavaScript viejo). En producción llevan hash y
// sí se guardan, para que Nueva venta funcione sin señal. Para probar el modo sin conexión en
// desarrollo: NEXT_PUBLIC_SW_CACHE_IN_DEV=1.
const cacheAssets = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_CACHE_IN_DEV === "1"

export const SERVICE_WORKER_URL = cacheAssets ? "/sw.js" : "/sw.js?cache=off"
