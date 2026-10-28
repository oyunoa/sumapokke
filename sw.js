/* すまぽっけ V33.6 -- offline shell only. No personal data or external API responses cached. */
const CACHE='sumapokke-shell-v35_2';
const FILES=["./index.html", "./script.js", "./style.css", "./firebase-config.js", "./manifest.webmanifest", "./assets/app_icon.png", "./assets/background_quest.svg", "./assets/background_room.svg", "./assets/background_theater.svg", "./assets/icon-512.png", "./assets/mascot_chan.webp", "./assets/mascot_chan_sad.webp", "./assets/mascot_chan_sleepy.webp", "./assets/mascot_chan_surprise.webp", "./assets/mascot_chan_thinking.webp", "./assets/mascot_chan_wink.webp", "./assets/mascot_kun.webp", "./assets/mascot_kun_sad.webp", "./assets/mascot_kun_sleepy.webp", "./assets/mascot_kun_surprise.webp", "./assets/mascot_kun_thinking.webp", "./assets/mascot_kun_wink.webp", "./assets/pokke_bgm.mp3"];
const ALLOWED=new Set(FILES.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sumapokke-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin || !ALLOWED.has(url.pathname))return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(hit=>hit||fetch(req)));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    const target=list.find(c=>c.url.startsWith(self.registration.scope));
    if(target){await target.focus();target.postMessage({kind:'sumapokke-notification-click'})}
    else await clients.openWindow('./index.html');
  })());
});
