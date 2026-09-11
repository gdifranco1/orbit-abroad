"use strict";
const CACHE = "orbit-abroad-v1";
const ASSETS = [
  "./", "./index.html", "./site.css", "./site.js", "./app.html", "./app.css", "./app.js",
  "./core.js", "./smart-inbox.js", "./privacy.html", "./manifest.webmanifest",
  "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png", "./assets/og-card.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (!response || response.status !== 200) return response;
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  })));
});
