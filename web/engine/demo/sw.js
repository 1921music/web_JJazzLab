"use strict";

const scope = self.registration.scope;
const cachePrefix = `jjazzlab-shell:${scope}:`;
const cacheName = cachePrefix + "PWA_BUILD_ID";
const shell = new URL("index.html", scope).href;
const files = [shell, ...["manifest.webmanifest", "icon-192.png", "icon-512.png"].map(file => new URL(file, scope).href)];

self.addEventListener("install", event => {
    event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files.map(url => new Request(url, { cache: "reload" })))));
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    url.search = "";
    const navigation = request.mode === "navigate" && (url.href === scope || url.href === shell);
    if (navigation) {
        event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match(shell)));
    } else if (files.includes(url.href)) {
        event.respondWith((async () => (await (await caches.open(cacheName)).match(url.href)) ?? fetch(request))());
    }
});
