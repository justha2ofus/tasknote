// TaskNote：オフラインでもすぐ開けるようにする仕組み（Service Worker）
// ・アプリ本体（index.html と app.js など、このサイトのファイル）を端末に保存しておき、まず保存分を表示する
// ・同時に裏でネットから最新版を取りに行き、中身が変わっていたら画面に「新しい版を受け取りました」と知らせる
// ・GASとの通信（控えの送受信）にはいっさい関与しない
// sw.js 自体を変えたときは CACHE の番号を1つ上げる
const CACHE = 'tasknote-v3';
const ASSETS = ['./', './index.html', './app.js', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 新しい版を受け取った印を残し、開いている画面にも知らせる（画面がまだ準備中でも、あとで印を確認できる）
async function notifyUpdated(cache) {
  await cache.put('./__updated', new Response('1'));
  const list = await self.clients.matchAll({ type: 'window' });
  list.forEach(c => c.postMessage({ type: 'tasknote-updated' }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // 他サイト（GASなど）は素通し
  const isPage = req.mode === 'navigate';
  if (url.pathname.endsWith('/__updated')) { // 画面からの「更新あった？」の問い合わせ
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match('./__updated');
      if (hit) await cache.delete('./__updated');
      return new Response(hit ? '1' : '0', { headers: { 'Cache-Control': 'no-store' } });
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = isPage ? './index.html' : req;
    const hit = await cache.match(key, { ignoreSearch: true });
    const watch = isPage || url.pathname.endsWith('/app.js'); // 中身が変わったら知らせる対象（画面とプログラム本体）
    const before = watch && hit ? hit.clone() : null; // 比較用の写し（hit そのものは画面に渡すため）
    // ブラウザの一時保存を使わず、毎回サーバーに最新かどうかを確かめる
    const net = fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(async r => {
      if (r && r.ok) {
        if (before) {
          const [a, b] = await Promise.all([before.text(), r.clone().text()]);
          await cache.put(key, r.clone());
          if (a !== b) await notifyUpdated(cache);
        } else {
          await cache.put(key, r.clone());
        }
      }
      return r;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || (await cache.match('./index.html')) || Response.error();
  })());
});
