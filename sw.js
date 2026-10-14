/* Matematiklar — oflayn ishlash uchun service worker.
   Har safar sayt fayllari o'zgarganda quyidagi V versiyasini oshiring (gm-v4 → gm-v5 ...).
   Ilova qobig'i keshlanadi; Supabase va Telegram so'rovlari hech qachon keshlanmaydi. */
const V = 'gm-v8';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'data/general-math/ch01.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
const CDN = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Source+Serif+4:wght@400;600&display=swap'
];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    // Bittasi topilmasa ham o'rnatish to'xtab qolmasin
    await Promise.all(SHELL.map(u => c.add(u).catch(() => {})));
    await Promise.all(CDN.map(u => c.add(new Request(u, { mode: 'no-cors' })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Tarmoq 4 soniyada javob bermasa, keshdagi nusxa ko'rsatiladi (sekin internet uchun)
function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

async function netFirst(req) {
  const c = await caches.open(V);
  try {
    const res = await Promise.race([fetch(req), timeout(4000)]);
    if (res && res.ok) c.put(req, res.clone());
    return res;
  } catch (e) {
    return (await c.match(req)) || (await c.match('index.html')) || (await c.match('./')) ||
      new Response('Oflayn. Internetga ulanib, sahifani bir marta oching.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

async function swr(req) {
  const c = await caches.open(V);
  const cached = await c.match(req);
  const fresh = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fresh;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  // Ma'lumotlar bazasi va Telegram: faqat tarmoq orqali, keshlanmaydi
  if (u.hostname.endsWith('supabase.co') || u.hostname === 'api.telegram.org') return;
  if (req.mode === 'navigate') { e.respondWith(netFirst(req)); return; }
  if (u.origin === self.location.origin || CDN_HOSTS.includes(u.hostname)) e.respondWith(swr(req));
});
