/* botbuilders-portal loader — Bob host stub + portal.js. See README. */
(function () {
  var p = location.pathname;
  if ((p.replace(/\/+$/, '') === '/dashboard' || /^\/courses\/products\//.test(p)) && !document.querySelector('[data-bob-embed], #bob-embed')) {
    var d = document.createElement('div');
    d.setAttribute('data-bob-embed', '');
    d.style.cssText = 'position:absolute;left:-10000px;top:0;width:400px;height:600px;';
    (document.body || document.documentElement).appendChild(d);
  }
  if (window.__bbPortalRan || document.getElementById('bb-portal-js')) return;
  var s = document.createElement('script');
  s.id = 'bb-portal-js';
  s.src = 'https://cdn.jsdelivr.net/gh/BotBuilders/botbuilders-portal@v1.0.19/dist/portal.js';
  (document.head || document.documentElement).appendChild(s);
})();
