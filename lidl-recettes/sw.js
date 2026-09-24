// Service worker : l'appli reste utilisable sans réseau (dans le magasin, en cuisine).
// Changer CACHE_VERSION à chaque mise en ligne pour que les téléphones récupèrent la nouvelle version.
const CACHE_VERSION = 'semainier-v6';
const APP_SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/favicon-32.png',
  'js/app.js',
  'js/catalog.js',
  'js/cook-mode.js',
  'js/dom.js',
  'js/format.js',
  'js/install-prompt.js',
  'js/list-text.js',
  'js/meal-structure.js',
  'js/nutrition-facts.js',
  'js/nutrition.js',
  'js/planner.js',
  'js/preferences.js',
  'js/recipes.js',
  'js/render-weight.js',
  'js/render.js',
  'js/settings.js',
  'js/shopping-list.js',
  'js/stock.js',
  'js/storage.js',
  'js/wake-lock.js',
  'js/week.js',
  'js/weight-log.js'
];

async function precacheAppShell() {
  const cache = await caches.open(CACHE_VERSION);
  await cache.addAll(APP_SHELL);
}

async function deleteOldCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.filter((cacheName) => cacheName !== CACHE_VERSION).map((cacheName) => caches.delete(cacheName)));
}

const MEDIA_PATH_PATTERN = /\/(images|icons)\//;

// GitHub Pages demande aux navigateurs de garder les fichiers 10 minutes : sans revalidation,
// une mise à jour publiée n'arriverait qu'après ce délai. « no-cache » redemande au serveur
// si le fichier a changé (réponse légère s'il est identique).
function fetchFresh(request) {
  // Une requête de navigation ne peut pas être recopiée avec des options : on repart de son adresse.
  if (request.mode === 'navigate') {
    return fetch(request.url, { cache: 'no-cache', credentials: 'same-origin' });
  }
  return fetch(request, { cache: 'no-cache' });
}

// Page, scripts et styles : réseau d'abord, pour que la page et son code restent toujours
// de la même version ; la copie en cache ne sert que hors ligne.
async function respondNetworkFirst(request, cacheKey = request) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const networkResponse = await fetchFresh(request);
    if (networkResponse.ok) {
      await cache.put(cacheKey, networkResponse.clone());
    }
    return networkResponse;
  } catch (networkError) {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw networkError;
  }
}

// Photos et icônes : elles ne changent pas, la copie en cache est servie tout de suite.
async function respondFromCacheThenRefresh(request, backgroundTasks) {
  const cache = await caches.open(CACHE_VERSION);
  const cachedResponse = await cache.match(request);
  const networkUpdate = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        await cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((networkError) => {
      if (!cachedResponse) {
        throw networkError;
      }
      return cachedResponse;
    });
  if (cachedResponse) {
    backgroundTasks(networkUpdate.catch(() => undefined));
    return cachedResponse;
  }
  return networkUpdate;
}

self.addEventListener('install', (installEvent) => {
  installEvent.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (activateEvent) => {
  activateEvent.waitUntil(deleteOldCaches().then(() => self.clients.claim()));
});

self.addEventListener('fetch', (fetchEvent) => {
  const { request } = fetchEvent;
  const isSameOrigin = new URL(request.url).origin === self.location.origin;
  if (request.method !== 'GET' || !isSameOrigin) {
    return;
  }
  if (request.mode === 'navigate') {
    fetchEvent.respondWith(respondNetworkFirst(request, 'index.html'));
    return;
  }
  if (MEDIA_PATH_PATTERN.test(new URL(request.url).pathname)) {
    fetchEvent.respondWith(respondFromCacheThenRefresh(request, (task) => fetchEvent.waitUntil(task)));
    return;
  }
  fetchEvent.respondWith(respondNetworkFirst(request));
});
