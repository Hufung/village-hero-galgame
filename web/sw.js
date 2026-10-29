const V = 'vh-v1';
const SHELL = ['.', 'index.html', 'ui.css', 'story.js', 'game.js', 'manifest.webmanifest', 'icon.png'];
addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => skipWaiting())); });
addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => clients.claim())); });
addEventListener('fetch', e => { e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))); });
