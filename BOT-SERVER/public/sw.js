const CACHE_NOME = 'clicksim-painel-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/tabs.js',
  '/app.js',
  '/app-perfumes.js',
  '/app-pedidos.js',
  '/app-notas.js',
  '/app-financeiro.js',
  '/logo.png',
  '/logo.ico',
  '/manifest.json',
  '/img/icon-192.png',
  '/img/icon-512.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((nome) => nome !== CACHE_NOME).map((nome) => caches.delete(nome)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  if (evento.request.method !== 'GET' || url.pathname.startsWith('/api/')) {
    return;
  }

  evento.respondWith(
    fetch(evento.request)
      .then((resposta) => {
        const copia = resposta.clone();
        caches.open(CACHE_NOME).then((cache) => cache.put(evento.request, copia));
        return resposta;
      })
      .catch(() => caches.match(evento.request))
  );
});
