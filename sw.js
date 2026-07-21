/* HomeCaptain service worker - offline app shell.
   ===========================================================================
   Goal: the app reliably OPENS with a poor or missing connection, and is a real
   installable PWA. Adapted from the MenuCaptain worker, with three differences:
     1. SUBPATH-SAFE. This app is served from a GitHub Pages subpath
        (/homecaptain-app/), not a domain root, so the shell key and our own
        asset URLs are derived from self.location instead of hardcoded "/".
     2. HomeCaptain's own CDN deps (cdnjs React/Babel, jsDelivr supabase-js,
        Google Fonts) rather than MenuCaptain's self-hosted fonts + Leaflet.
     3. No map-tile cache - there is no map in this app.

   The one rule that matters most: never trap anyone on a stale build.
   - The app document is NETWORK-FIRST, so an online user always gets the
     freshest file and the in-app version checker keeps working untouched; the
     cached copy is only served when the network truly fails.
   - Cache names are tied to VERSION and `activate` deletes every cache that
     doesn't match, so each deploy cleanly rolls the cache.
   - VERSION is bumped in lockstep with APP_VERSION in index.html, which changes
     this file's bytes and makes the browser install the new worker.

   Scope by request type:
   - app document              -> network-first, fall back to cached shell
   - version check (?_=...)    -> NOT intercepted (always real network)
   - GET /api/collection/*     -> network-first, fall back to cached data
   - immutable assets (cdnjs, jsDelivr, Google Fonts, our own icons) -> cache-first
   - everything else (photo signed URLs, other API, writes) -> default network
*/

const VERSION      = "0.7.4";                 // keep in lockstep with APP_VERSION
const SHELL_CACHE  = "hc-shell-" + VERSION;
const ASSET_CACHE  = "hc-assets-" + VERSION;
const DATA_CACHE   = "hc-data-v1";            // user collections; UN-versioned so it
                                              // survives app updates (only clearCache wipes it)
// Canonical key for the app document. Derived from the worker's own location so
// this works at a subpath ("/homecaptain-app/") or a domain root ("/").
const SHELL_URL    = new URL("./", self.location).pathname;

// Primed on install so even the very first offline open works.
const CRITICAL_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
  new URL("./manifest.json", self.location).href,
  new URL("./icon-192.png", self.location).href,
  new URL("./icon-512.png", self.location).href,
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Prime immutable assets - allSettled so one CDN hiccup can't fail install.
    const assets = await caches.open(ASSET_CACHE);
    await Promise.allSettled(CRITICAL_ASSETS.map((u) => assets.add(u)));
    // Prime the app shell from the network (best-effort).
    try {
      const shell = await caches.open(SHELL_CACHE);
      const r = await fetch(SHELL_URL, { cache: "no-store" });
      if (r && r.ok) await shell.put(SHELL_URL, r.clone());
    } catch (e) { /* offline at install time - fine, fills on first online load */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Lets the app force a full cache wipe (the update banner does this before reloading).
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data === "clearCache" || (data && data.type === "clearCache")) {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    })());
  }
});

function isImmutableAsset(url) {
  if (url.hostname === "cdnjs.cloudflare.com") return true;   // versioned libs
  if (url.hostname === "cdn.jsdelivr.net") return true;       // supabase-js
  if (url.hostname === "fonts.googleapis.com") return true;   // font css
  if (url.hostname === "fonts.gstatic.com") return true;      // font files
  if (url.origin === self.location.origin &&
      /\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)) return true;  // our icons
  return false;
}

async function shellNetworkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) cache.put(SHELL_URL, fresh.clone());   // canonical key, no ?query pollution
    return fresh;
  } catch (e) {
    const cached = await cache.match(SHELL_URL);
    return cached || Response.error();
  }
}

// Network-first for user collections, with a short timeout so a flaky connection
// falls back to the last saved copy instead of hanging. Online always
// revalidates, so cached data is a fallback - never stale-on-screen while connected.
async function dataNetworkFirst(req) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(req);
  try {
    // Only race the timeout when there IS a cached copy to fall back to. With no
    // cache (e.g. first load against a cold backend), abandoning at 5s just
    // produces an error - so wait for the real response.
    const fresh = cached
      ? await Promise.race([
          fetch(req),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
        ])
      : await fetch(req);
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    if (cached) return cached;
    throw e;                     // no cache -> surface the real error to the app
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && (fresh.ok || fresh.type === "opaque")) cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;                 // never cache writes
  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const isAppDoc = url.origin === self.location.origin &&
                   (url.pathname === SHELL_URL || url.pathname === SHELL_URL + "index.html");

  // App document: network-first. A navigation always counts; a plain (query-less)
  // GET of the doc counts too. The in-app version check appends ?_=<ts>, so it is
  // excluded here and always hits the real network.
  if (isAppDoc && (req.mode === "navigate" || !url.search)) {
    event.respondWith(shellNetworkFirst(req));
    return;
  }

  // User collections -> keep the last good copy for offline reads.
  if (url.pathname.indexOf("/api/collection/") !== -1) {
    event.respondWith(dataNetworkFirst(req));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }
  // Everything else (Supabase signed photo URLs, other API calls) -> default network.
});
