// Service worker del panel.
// · Sin conexión: guarda "Nueva venta" (y los archivos que usa) para poder registrar ventas sin señal;
//   las demás pantallas muestran una página de "sin conexión". Las ventas se guardan en el teléfono
//   (IndexedDB) y la app las envía sola al volver la señal.
// · Avisos push: los muestra y abre la pantalla correspondiente al tocarlos.

// Con ?cache=off (desarrollo) no se guardan los archivos de /_next/static: ahí no cambian de nombre
// al editar el código y se serviría JavaScript viejo. Ver service-worker.constants.ts.
const CACHE_ASSETS = new URL(self.location.href).searchParams.get("cache") !== "off"

const PAGES = "tuestuchef-pages-v1"
const ASSETS = "tuestuchef-assets-v1"
const SALE_PAGE = "/ventas/nueva"
const OFFLINE_PAGE = "/offline.html"

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()))
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Sin caché de archivos (desarrollo) también se borra la que hubiera quedado.
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, ...(CACHE_ASSETS ? [ASSETS] : [])].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// Guarda Nueva venta y los archivos estáticos que pide su HTML.
async function warmSalePage() {
  if (!CACHE_ASSETS) return
  const response = await fetch(SALE_PAGE, { credentials: "include" })
  if (!response.ok || response.redirected) return
  const html = await response.clone().text()
  await (await caches.open(PAGES)).put(SALE_PAGE, response)
  const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]))]
  const cache = await caches.open(ASSETS)
  await Promise.all(assets.map((url) => cache.match(url).then((hit) => hit || cache.add(url).catch(() => undefined))))
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "warm") event.waitUntil(warmSalePage().catch(() => undefined))
  // Al cerrar sesión: se borran las páginas guardadas (las ventas en cola no se tocan).
  if (event.data?.type === "clear-pages") event.waitUntil(caches.delete(PAGES))
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Archivos estáticos de Next (con hash): primero la caché. En desarrollo, siempre la red.
  if (url.pathname.startsWith("/_next/static/")) {
    if (!CACHE_ASSETS) return
    event.respondWith(
      caches.open(ASSETS).then((cache) =>
        cache.match(request).then(
          (hit) =>
            hit ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone())
              return response
            })
        )
      )
    )
    return
  }

  if (request.mode !== "navigate") return

  // Nueva venta: red primero (siempre lo más nuevo) y, sin señal, la guardada.
  if (url.pathname === SALE_PAGE) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !response.redirected) caches.open(PAGES).then((cache) => cache.put(SALE_PAGE, response.clone()))
          return response
        })
        .catch(() => caches.match(SALE_PAGE).then((hit) => hit || caches.match(OFFLINE_PAGE)))
    )
    return
  }

  // Otras pantallas: sin señal, la página de "sin conexión".
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_PAGE)))
})

self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: "Tuestuchef", body: event.data ? event.data.text() : "" }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Tuestuchef", {
      body: data.body || "",
      tag: data.tag,
      icon: data.icon,
      badge: data.icon,
      data: { url: data.url || "/" },
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients.find((client) => client.url.startsWith(self.location.origin))
      if (open) {
        open.navigate(url)
        return open.focus()
      }
      return self.clients.openWindow(url)
    })
  )
})
