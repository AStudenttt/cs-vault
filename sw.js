// Keeps the book on this device: pictures are kept after the first view, and the pages and data
// open from the device while a fresh copy is fetched in the background.
const APP = "cs-vault-app-v1";
const IMG = "cs-vault-img-v1";
const IMG_LIMIT = 4000;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![APP, IMG].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isImage = (url) => /steamstatic\.com|githubusercontent\.com|fonts\.gstatic\.com/.test(url.host);

async function cacheFirst(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") {
    cache.put(req, res.clone());
    trim(cache);
  }
  return res;
}

let trimming = false;
async function trim(cache) {
  if (trimming) return;
  trimming = true;
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - IMG_LIMIT; i++) await cache.delete(keys[i]);
  trimming = false;
}

async function staleWhileRevalidate(e) {
  const cache = await caches.open(APP);
  const hit = await cache.match(e.request, { ignoreSearch: false });
  const fresh = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
  if (hit) { e.waitUntil(fresh); return hit; }
  return fresh;
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (isImage(url)) { e.respondWith(cacheFirst(e.request)); return; }
  if (url.origin === location.origin || url.host === "fonts.googleapis.com") e.respondWith(staleWhileRevalidate(e));
});
