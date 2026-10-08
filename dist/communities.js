window.BB_VERSION = '1.0.8 · 2026-10-09';
window.BB_BUILDS = Object.assign(window.BB_BUILDS || {}, { communities: '1.0.8 · 2026-10-09' });
window.BB_CDN = 'https://cdn.jsdelivr.net/gh/BotBuilders/botbuilders-portal@v1.0.8/dist';
/* botbuilders-portal · communities.js · built from src/communities.js (3 script blocks) */

/* ── block 1 ── */
/* ============================================================
   BLOCK 1 — About page: support form + user identity lookup
   (unchanged)
   ============================================================ */
(function(){
  if (window.__bbAboutSupportInstalled) { window.__bbAboutSupportRerun && window.__bbAboutSupportRerun(); return; }
  window.__bbAboutSupportInstalled = true;

  var API_URL = "https://connect.botbuilders.cloud/webhook/1360de3a-1206-4a2c-8175-56219ea1623b";
  var ABOUT_PATH = "/communities/groups/support/about";
  var CARD_SELECTOR = "main.main-content div.w-full > div.w-full.bg-background.p-4.rounded-lg.border.border-default.border-solid.shadow-sm";
  var ABOUT_FORM_WRAP_ID = "bb-about-support-form-wrap";
  var HIDE_STYLE_ID = "bb-about-support-hide-style";
  var SUPPORT_FIELD_ID = "wqcLvEaDr6j4e3I1C34V";
  var SUPPORT_TYPE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  var SUPPORT_TYPE_CACHE_KEY = "bb-about-support-type-cache";
  var SUPPORT_PAGES_BY_TYPE = {
    "General Support": { url: "https://go.botbuilders.com/general-support-form-page", title: "General Support Form", heightPx: 900 },
    "VIP Support": { url: "https://go.botbuilders.com/launchpad-vip-support-form-page", title: "VIP Support Form", heightPx: 900 }
  };

  /* ------------------------------------------------------------------ *
   * USER LOOKUP  (rewritten for the migrated client portal)
   *
   * The portal no longer writes localStorage "event" / "common".
   * Identity now lives in the Nuxt/Pinia store, and the session token
   * is an HttpOnly cookie. Four sources, best first:
   *   1. live Pinia state   - correct after SPA nav / login / logout
   *   2. __NUXT__ payload   - available before the Vue app mounts
   *   3. portal JWT claims  - clientPortalMeta.contactId
   *   4. legacy localStorage - only for not-yet-migrated portals
   * ------------------------------------------------------------------ */
  /* Identity is owned by the PORTAL-LEVEL custom JS, which exposes it as
     window.bbGetIdentity(). It resolves the same four sources this function
     used to (live Pinia -> __NUXT__ payload -> JWT clientPortalMeta -> legacy
     localStorage) and caches the webhook result, so two scripts no longer
     resolve the same contact and POST to the webhook independently.
     The inline fallback below only runs if the general file failed to load. */
  function getClientPortalUserInfo(){
    if (typeof window.bbGetIdentity === 'function') {
      try {
        var id = window.bbGetIdentity();
        if (id && id.contactId) return { email: id.email || null, contactId: id.contactId, userId: id.userId || null };
      } catch(e){}
    }
    // fallback: live Pinia only — see the general file for the full chain
    try {
      var root  = document.getElementById("__nuxt");
      var app   = root && root.__vue_app__;
      var pinia = app && app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
      var s     = pinia && pinia.state && pinia.state.value;
      var p     = s && s["current-user"] && s["current-user"].profile;
      var a     = s && s.auth;
      var contactId = (p && p.contactId) || (a && a.contactId) || null;
      if (contactId) return { email: (p && p.email) || null, contactId: contactId, userId: (p && p._id) || (a && a.userId) || null };
    } catch(e){}
    return null;
  }

  function isAboutPage(){ return location.pathname === ABOUT_PATH; }

  function ensureHideStyle(){
    if(document.getElementById(HIDE_STYLE_ID)) return;
    var st=document.createElement("style"); st.id=HIDE_STYLE_ID;
    st.textContent = CARD_SELECTOR + " { display: none !important; }";
    (document.head||document.documentElement).appendChild(st);
  }
  function removeHideStyle(){ var s=document.getElementById(HIDE_STYLE_ID); if(s) s.remove(); }

  function cacheKeyForUser(u){ return u && u.contactId ? u.contactId : ""; }
  var memo=null;
  function readCachedSync(u){
    var key=cacheKeyForUser(u), now=Date.now();
    if(memo && memo.userKey===key && now-memo.ts<SUPPORT_TYPE_CACHE_TTL) return memo.value;
    try{ var raw=sessionStorage.getItem(SUPPORT_TYPE_CACHE_KEY); if(raw){ var p=JSON.parse(raw); if(p&&p.userKey===key&&now-p.ts<SUPPORT_TYPE_CACHE_TTL){ memo=p; return p.value; } } }catch(e){}
    return undefined;
  }
  function writeCached(u,v){ var e={userKey:cacheKeyForUser(u),value:v,ts:Date.now()}; memo=e; try{sessionStorage.setItem(SUPPORT_TYPE_CACHE_KEY,JSON.stringify(e));}catch(x){} }

  var supportTypePromise = null;
  function fetchSupportTypeFromAPI(){
    var u=getClientPortalUserInfo();
    if(!u || !u.contactId) return Promise.resolve(undefined);
    var body={ contact_id:u.contactId }; if(u.email) body.email=u.email;
    return fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(function(res){ return res.text().then(function(raw){
        if(!res.ok) throw new Error("API error "+res.status);
        if(!raw||!raw.trim()) return null;
        var data; try{ data=JSON.parse(raw); }catch(e){ return null; }
        var fields;
        if(Array.isArray(data)&&data[0]&&Array.isArray(data[0].fields)) fields=data[0].fields;
        else if(Array.isArray(data)) fields=data;
        else if(data&&Array.isArray(data.fields)) fields=data.fields;
        else fields=[];
        for(var i=0;i<fields.length;i++){ if(fields[i]&&fields[i].id===SUPPORT_FIELD_ID){ return typeof fields[i].value==="string"?fields[i].value.trim():null; } }
        return null;
      }); });
  }

  function getSupportTypePromise(){
    if(supportTypePromise) return supportTypePromise;
    var u=getClientPortalUserInfo();
    // Do NOT memoize a miss: the store may not be hydrated yet. Memoizing
    // here is what made the old version fail permanently for a page load.
    if(!u) return Promise.resolve(undefined);
    var cached=readCachedSync(u);
    if(cached!==undefined){ supportTypePromise=Promise.resolve(cached); return supportTypePromise; }
    supportTypePromise = fetchSupportTypeFromAPI().then(function(v){ if(v!==undefined) writeCached(u,v); return v; });
    return supportTypePromise;
  }

  function createPageIframe(cfg){
    var f=document.createElement("iframe");
    f.src=cfg.url; f.title=cfg.title; f.loading="eager"; f.setAttribute("importance","high");
    f.setAttribute("allow","clipboard-write; geolocation; microphone; camera");
    f.setAttribute("referrerpolicy","no-referrer-when-downgrade");
    f.style.width="100%"; f.style.height=cfg.heightPx+"px"; f.style.border="none";
    f.style.borderRadius="8px"; f.style.display="block"; f.style.background="transparent";
    return f;
  }
  function buildWrap(){
    var w=document.createElement("div");
    w.id=ABOUT_FORM_WRAP_ID; w.style.display="block"; w.style.width="100%";
    w.style.marginTop="16px"; w.style.marginBottom="16px";
    return w;
  }
  function removeWrap(){ var w=document.getElementById(ABOUT_FORM_WRAP_ID); if(w) w.remove(); }

  var lastSupportType=null, inFlight=false, queued=false;

  function waitForElement(sel,timeout){
    timeout=timeout||15000;
    return new Promise(function(resolve){
      var f=document.querySelector(sel); if(f) return resolve(f);
      var obs=new MutationObserver(function(){ var el=document.querySelector(sel); if(el){ obs.disconnect(); resolve(el); } });
      obs.observe(document.documentElement,{childList:true,subtree:true});
      setTimeout(function(){ obs.disconnect(); resolve(null); }, timeout);
    });
  }

  function placeForm(anchor, type){
    if(type===undefined) return; // unresolved: leave as-is
    var cfg=SUPPORT_PAGES_BY_TYPE[type];
    if(!cfg){ removeWrap(); lastSupportType=null; return; }
    var existing=document.getElementById(ABOUT_FORM_WRAP_ID);
    var correctPos = existing && anchor.previousElementSibling===existing;
    if(existing && correctPos && lastSupportType===type) return;
    if(existing) existing.remove();
    var wrap=buildWrap();
    wrap.appendChild(createPageIframe(cfg));
    anchor.insertAdjacentElement("beforebegin", wrap);
    lastSupportType=type;
  }

  function upsert(){
    if(!isAboutPage()){ removeWrap(); removeHideStyle(); lastSupportType=null; return Promise.resolve(); }
    if(inFlight){ queued=true; return Promise.resolve(); }
    inFlight=true;
    ensureHideStyle();
    var u=getClientPortalUserInfo();
    var cachedNow = readCachedSync(u);
    return waitForElement(CARD_SELECTOR).then(function(anchor){
      if(!anchor) return;
      if(!isAboutPage()){ removeWrap(); removeHideStyle(); lastSupportType=null; return; }
      ensureHideStyle();
      // FAST PATH: cached type -> render immediately, no await
      if(cachedNow!==undefined) placeForm(anchor, cachedNow);
      return getSupportTypePromise().catch(function(e){ console.warn("[BB About Form] type failed:",e); return undefined; })
        .then(function(type){
          if(!isAboutPage()){ removeWrap(); removeHideStyle(); lastSupportType=null; return; }
          var a=document.querySelector(CARD_SELECTOR); if(!a) return;
          ensureHideStyle();
          placeForm(a, type);
        });
    }).finally(function(){
      inFlight=false;
      if(queued){ queued=false; Promise.resolve().then(upsert); }
    });
  }
  window.__bbAboutSupportRerun = upsert;

  // Warm the fetch as soon as the user is resolvable. The store is not
  // populated at document-parse time, so poll briefly instead of firing once.
  (function warmWhenUserReady(tries){
    if(getClientPortalUserInfo()){ getSupportTypePromise(); if(isAboutPage()) upsert(); return; }
    if(tries < 80) setTimeout(function(){ warmWhenUserReady(tries+1); }, 250); // ~20s
  })(0);

  (function patchHistory(){
    if(window.__bb_about_hist2) return; window.__bb_about_hist2=true;
    var _p=history.pushState,_r=history.replaceState;
    history.pushState=function(){ var x=_p.apply(this,arguments); window.dispatchEvent(new Event("bb:urlchange-about2")); return x; };
    history.replaceState=function(){ var x=_r.apply(this,arguments); window.dispatchEvent(new Event("bb:urlchange-about2")); return x; };
    window.addEventListener("popstate", function(){ window.dispatchEvent(new Event("bb:urlchange-about2")); });
  })();
  window.addEventListener("bb:urlchange-about2", upsert);
  document.addEventListener("visibilitychange", function(){ if(!document.hidden && isAboutPage()) upsert(); });

  var tick=null;
  new MutationObserver(function(){
    if(tick) return;
    tick=requestAnimationFrame(function(){
      tick=null;
      if(!isAboutPage()){ removeWrap(); removeHideStyle(); lastSupportType=null; return; }
      ensureHideStyle();
      var anchor=document.querySelector(CARD_SELECTOR);
      if(!anchor) return;
      var wrap=document.getElementById(ABOUT_FORM_WRAP_ID);
      if(!wrap || anchor.previousElementSibling!==wrap) upsert();
    });
  }).observe(document.body,{childList:true,subtree:true});

  ensureHideStyle(); // hide early so the section never flashes
  upsert();
  setTimeout(upsert,150);
  setTimeout(upsert,800);
})();

/* ── block 2 ── */
/* ============================================================
   BLOCK 2 — Events calendar defaults to Week view
   (unchanged)
   ============================================================ */
  /* Default the community events calendar to Week view.
     The portal keeps no view preference, so we drive the dropdown.
     IMPORTANT: check the rendered FullCalendar view, not the dropdown label —
     on SPA navigation the label stays "Week" while the calendar re-mounts as
     dayGridMonth, so a label check would think it was already done. */
  (() => {
    if (window.__bbWeekViewInstalled) return;
    window.__bbWeekViewInstalled = true;

    const VIEW = 'Week';
    const FC_WEEK = 'fc-timeGridWeek-view';
    const SELECT_ID = 'events-header-calendar-view-select';
    const RETRY_MS = 300;
    const MAX_TRIES = 50;

    let path = null, tries = 0, forcedOnce = false, busy = false;

    const isEventsPage = () => /\/events\/?$/.test(location.pathname);
    const isWeekRendered = () => {
      const v = document.querySelector('.fc-view-harness .fc-view');
      return !!v && v.classList.contains(FC_WEEK);
    };

    function apply(sel) {
      if (busy) return;
      busy = true;
      const trigger = sel.querySelector('.hr-base-selection') || sel;
      trigger.click();
      setTimeout(() => {
        const opt = [...document.querySelectorAll('[role="option"]')]
          .find(o => o.textContent.trim() === VIEW);
        if (opt) opt.click();
        else trigger.click();            // options not up yet, close and retry
        setTimeout(() => { busy = false; }, 400);
      }, 150);
    }

    function tick() {
      if (path !== location.pathname) {  // route changed -> start over
        path = location.pathname; tries = 0; forcedOnce = false;
      }
      if (!isEventsPage()) return;

      const sel = document.getElementById(SELECT_ID);
      const view = document.querySelector('.fc-view-harness .fc-view');
      if (!sel || !view) { tries++; return; }   // not rendered yet

      if (isWeekRendered()) { forcedOnce = true; return; }   // nothing to do

      // Label says Week but the calendar rendered Month -> always correct it.
      if (sel.textContent.trim() === VIEW) { apply(sel); return; }

      // Label says Month: force once per visit, then respect a manual switch.
      if (forcedOnce || tries++ > MAX_TRIES) return;
      apply(sel);
      forcedOnce = true;
    }

    setInterval(tick, RETRY_MS);
    tick();
    window.addEventListener('popstate', tick);
  })();

/* ── block 3 ── */
/* ============================================================
   BLOCK 3 — Events page behaviour                        [NEW]
   A. "Register Now" opens the event's Location link (listed events only)
   B. Create Event defaults the timezone to America/Phoenix
   ============================================================ */
(function () {
  if (window.__bbEventsExtrasInstalled) return;
  window.__bbEventsExtrasInstalled = true;

  /* ----------------------------------------------------------
     A. "Register Now" -> the link shown under Location
     ----------------------------------------------------------
     The event view modal renders one "Location" row, #event-location-value.
     Whatever the event has there (a Zoom URL, a bare domain like
     "botbuilders.com", or a street address) is what shows under the label,
     so that is what we read.

     If the value does not look like a URL we do NOT intercept — the button
     keeps whatever the portal normally does. Better a working default than
     a dead click.

     Only the events listed in REGISTER_REDIRECT_TITLES get the redirect
     (carried over from the old calendar UI). Every other event registers
     normally even if its Location holds a link.                            */

  var OPEN_IN_NEW_TAB = true;   // false -> navigate in the same tab

  // Each entry = words that must ALL appear in the event title
  // (case-insensitive). Add a line per event that should redirect.
  var REGISTER_REDIRECT_TITLES = [
    ['business model', 'workshop'],       // Business Model / Offers Workshop
    ['lead generation', 'workshop'],      // Lead Generation / Funnels Workshop
    ['automated systems', 'workshop'],    // Automated Systems / Workflows Workshop
    ['sales optimization', 'workshop'],   // Sales Optimization / Conversion Workshop
    ['traffic sources', 'workshop'],      // Traffic Sources / Ads Workshop
    ['ai insiders', 'workshop', '(basics)'],
    ['ai insiders', 'workshop', '(advanced)']
  ];

  function eventTitle() {
    var el = document.getElementById('event-view-title');   // the modal's heading
    return el ? (el.textContent || '').trim() : '';
  }
  function titleAllowed(title) {
    if (!title) return false;
    var t = title.toLowerCase();
    return REGISTER_REDIRECT_TITLES.some(function (words) {
      return words.every(function (w) { return t.indexOf(w) !== -1; });
    });
  }

  function locationUrl() {
    var el = document.getElementById('event-location-value');
    if (!el) return null;

    // If the portal ever renders it as a real anchor, trust that first.
    var a = el.querySelector && el.querySelector('a[href]');
    if (a && a.href) return a.href;

    var raw = (el.textContent || '').trim();
    if (!raw || /\s/.test(raw)) return null;          // empty, or an address
    if (/^https?:\/\//i.test(raw)) return raw;        // already absolute
    if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(raw)) {    // bare domain + path
      return 'https://' + raw;
    }
    return null;                                      // not a link
  }

  // Capture phase so we run before the portal's own handler.
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('#event-register-now-button');
    if (!btn) return;

    if (!titleAllowed(eventTitle())) return;          // not a listed event -> normal registration
    var url = locationUrl();
    if (!url) return;                                 // leave default behaviour

    e.preventDefault();
    e.stopPropagation();
    if (OPEN_IN_NEW_TAB) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = url;
    }
  }, true);


  /* ----------------------------------------------------------
     B. Create Event -> default timezone America/Phoenix
     ----------------------------------------------------------
     Notes that matter:

     * The SAME form (#event-form-timezone) is used for Create AND Edit.
       Forcing the timezone on an Edit form would silently rewrite an
       existing event, so we only act when the modal heading reads
       "Create Event".

     * The timezone dropdown is a VIRTUALISED list (.hr-virtual-list):
       only ~10 of its ~72 options exist in the DOM at any moment, and
       there is no search box. So we cannot just query the option — we
       page the scroller down until America/Phoenix renders, then click it.
       It lands on step 9 of 25.

     * We act once per opened form (dataset flag). If you change the
       timezone by hand afterwards, we leave it alone.                     */

  var TARGET_TZ = 'America/Phoenix';
  var STEP_PX   = 280;   // scroll increment
  var STEP_MS   = 70;    // let the virtual list render between steps
  var MAX_STEPS = 25;

  function isCreateForm(tzEl) {
    // Walk up to the modal, then read its heading.
    var el = tzEl;
    for (var i = 0; i < 14 && el; i++) {
      var h = el.querySelector && el.querySelector('p.hr-text-xl.hr-text-semibold');
      if (h) return /create\s+event/i.test(h.textContent || '');
      el = el.parentElement;
    }
    return false;   // heading not found -> do nothing, fail safe
  }

  function pickTimezone(tzEl) {
    if ((tzEl.textContent || '').trim().indexOf(TARGET_TZ) === 0) return;  // already right

    (tzEl.querySelector('.hr-base-selection') || tzEl).click();

    setTimeout(function () {
      var menu = null, boxes = document.querySelectorAll('[role="listbox"]');
      for (var i = 0; i < boxes.length; i++) {
        if (/GMT[+-]/.test(boxes[i].textContent || '') &&
            boxes[i].getBoundingClientRect().width > 0) { menu = boxes[i]; break; }
      }
      if (!menu) return;

      var scroller = menu.querySelector('.hr-virtual-list') || menu.querySelector('.hr-scrollbar');
      if (!scroller) return;

      var pos = 0, steps = 0;
      (function step() {
        var opts = menu.querySelectorAll('[role="option"]');
        for (var i = 0; i < opts.length; i++) {
          if ((opts[i].textContent || '').trim().indexOf(TARGET_TZ) === 0) {
            opts[i].click();
            return;
          }
        }
        if (steps++ > MAX_STEPS || pos > scroller.scrollHeight) return;   // give up quietly
        pos += STEP_PX;
        scroller.scrollTop = pos;
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        setTimeout(step, STEP_MS);
      })();
    }, 300);
  }

  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var tz = document.getElementById('event-form-timezone');
      if (!tz || tz.dataset.bbTzHandled) return;
      if (!isCreateForm(tz)) return;
      tz.dataset.bbTzHandled = '1';
      pickTimezone(tz);
    });
  }).observe(document.body, { childList: true, subtree: true });
})();
