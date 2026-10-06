window.BB_VERSION = '1.0.0 · 2026-10-07';
window.BB_BUILDS = Object.assign(window.BB_BUILDS || {}, { portal: '1.0.0 · 2026-10-07' });
/* botbuilders-portal · portal.js · built from src/portal.js (4 script blocks) */

/* ── block 1 ── */
  (() => {
    const domain = window.location.origin;
    const SPRITE = "/_nuxt-clientportal/nuxt-svg-icon-sprite/sprite-sidebar.Ct8uebB4tr-IdFpdxFOlWShiv38MzFA6A-xK4m5iJIs.svg";
    const NORMAL_ITEM_CLASS = "selectable-list-item cursor-pointer hover:bg-sidebar-hover text-700 rounded-md";
    /* ────────── helpers ────────── */
    function safeJsonParse(raw){ try { return JSON.parse(raw); } catch { return null; } }
    function normalizeText(s){ return (s||"").toString().trim().replace(/^["“”']+|["“”']+$/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
    function debounceRaf(fn){ let s=false; return (...a)=>{ if(s)return; s=true; requestAnimationFrame(()=>{ s=false; fn(...a); }); }; }
    function getVueApp(){
      const el = document.querySelector('#__nuxt, #cp-root-container, #app, [data-v-app]');
      return el && el.__vue_app__;
    }
    function getRouter(){
      const app = getVueApp();
      return app && app.config && app.config.globalProperties && app.config.globalProperties.$router;
    }
    function getPiniaState(){
      const app = getVueApp();
      const pinia = app && app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
      return pinia && pinia.state && pinia.state.value;
    }
    /* ────────── WHO IS THE USER? ──────────
       The portal moved off localStorage["common"] (see the
       "clientportal:migrationGuard" flag it now sets), so that object is
       gone and the old lookup silently returned empty strings.
       The live source of truth is the Pinia store:
         $pinia.state.value["current-user"].profile  -> { contactId, email, fullName, _id, slug }
         $pinia.state.value.auth                     -> { contactId, userId, isAuthenticated, ... }
       It hydrates a beat after first paint, so callers must tolerate a
       brief empty window — see the identity poll at the bottom.
       localStorage is kept as a fallback for older portal builds.        */
    function getIdentity(){
      try {
        const st = getPiniaState();
        if (st) {
          const prof = (st["current-user"] && st["current-user"].profile) || {};
          const auth = st.auth || {};
          const email     = prof.email || "";
          const contactId = prof.contactId || auth.contactId || "";
          const fullName  = prof.fullName || "";
          if (email || contactId) return { email, contactId, fullName };
        }
      } catch (e) { /* store not ready */ }
      try {
        const u = (safeJsonParse(localStorage.getItem("common")) || {}).clientPortalUserData || {};
        if (u.email || u.contactId) return { email: u.email || "", contactId: u.contactId || "", fullName: u.fullName || "" };
      } catch (e) {}
      return { email: "", contactId: "", fullName: "" };
    }
    // Exposed so the other blocks (and the console) can reuse it: bbGetIdentity()
    window.bbGetIdentity = getIdentity;

    function wireSoftNav(a, path){
      if (a.__softWired) return; a.__softWired = true;
      a.addEventListener('click', function(e){
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        const rt = getRouter();
        if (rt && rt.push){ e.preventDefault(); e.stopPropagation(); rt.push(path); }
      }, true);
    }
    function hasMenuLabel(l){
      const t = l.toLowerCase();
      return Array.from(document.querySelectorAll('.items-container a')).some(a => a.textContent.trim().toLowerCase() === t);
    }
    /* ────────── Rename "Shared files" -> "File Share" ────────── */
    function renameSharedMenu(){
      const link = document.getElementById('cp-portal-sidebar-nav-documents');
      if (!link) return;
      const span = link.querySelector('span');
      if (span && span.textContent.trim() !== 'File Share') span.textContent = 'File Share';
      if (link.getAttribute('aria-label') === 'Shared files') link.setAttribute('aria-label', 'File Share');
    }
    /* ────────── 1. Sidebar menu (instant, no API needed) ────────── */
    function buildMenu(){
      const cl = document.querySelector('.items-container a[href*="/courses"]');
      if (!cl) return false;
      cl.setAttribute('href', domain + '/courses/my-courses');
      wireSoftNav(cl, '/courses/my-courses');
      const item = cl.parentElement, container = item.parentElement;
      if (!container) return false;
      function add(label, href, id, icon, ext, path){
        if (document.getElementById(id) || hasMenuLabel(label)) return; // duplicate-safe
        const el = item.cloneNode(true);
        el.id = id;
        el.className = NORMAL_ITEM_CLASS;           // reset wrapper -> no stuck blue highlight
        const a = el.querySelector('a');
        a.id = id + '-link';
        a.setAttribute('href', href);
        if (ext){ a.setAttribute('target','_blank'); a.setAttribute('rel','noopener noreferrer'); }
        a.classList.remove('active','cp-portal-nav-item__link--active','router-link-active','router-link-exact-active');
        const sp = el.querySelector('span'); if (sp) sp.textContent = label;
        const u = el.querySelector('use'); if (u) u.setAttribute('href', SPRITE + '#' + icon);
        container.appendChild(el);
        if (!ext) wireSoftNav(a, path);
      }
      // Calendar is duplicate-safe: skipped if your other custom-JS already adds it.
      add('Calendar', domain + '/communities/groups/support/events', 'custom-menu-calendar', 'appointments', false, '/communities/groups/support/events');
      add('Contact',  domain + '/communities/groups/support/about',  'custom-menu-contact',  'explore',      false, '/communities/groups/support/about');
      add('Automator AI', 'https://app.automator.ai', 'custom-menu-automator', 'studio', true);
      return true;
    }
    /* ────────── 2. Dynamic Assigned Courses (API-driven, non-blocking) ────────── */
    const API_URL = "https://connect.botbuilders.cloud/webhook/1360de3a-1206-4a2c-8175-56219ea1623b";
    const COURSE_BASE_URL = "https://portal.botbuilders.com/courses/products/";
    const COURSES_FIELD_ID = "dBmTaHpIJPyy2vCwD1wT";
    const IDENTITY_TIMEOUT_MS = 15000;   // give up waiting for hydration after this
    /* ────────── Bob inline embed ──────────
       The widget (https://selfhelp.ai/widget.js) mounts itself into the first
       element matching "[data-bob-embed], #bob-embed". It looks for that host
       ONCE, when it initialises, and has no MutationObserver — so if the host
       isn't in the DOM by then it falls back to its floating panel and never
       reconsiders. The dashboard's right column doesn't exist until Vue has
       rendered, which is far too late.
       So: create the host immediately (this block is an inline <script>, so it
       runs long before the async widget.js finishes downloading), parked
       off-screen on <body>, then move it into #bb-right-col once the shell is
       built. Moving a mounted host is safe — the panel is plain divs, no iframe.
       Host must be >= 240px (INLINE_MIN_HOST_PX); widget defaults to 560px. */
    // Parking style is inline because it has to be in effect before any
    // stylesheet-dependent layout matters — the host just needs a real size so
    // the widget accepts it (>= 240px). Once it's placed in the column the
    // inline style is dropped and the CSS file takes over:
    //   #bb-right-col                    { position: relative; min-height: 600px }
    //   #bb-right-col > [data-bob-embed] { position: absolute; inset: 0 }
    const BOB_EMBED_HEIGHT = "600px";
    const BOB_PARK_STYLE   = "position:absolute;left:-10000px;top:0;width:400px;height:" + BOB_EMBED_HEIGHT + ";";
    const onDashboard = () => location.pathname.replace(/\/+$/, "") === "/dashboard";
    let bobCol  = null;                  // cached #bb-right-col node (survives re-renders)
    let bobHost = null;                  // cached [data-bob-embed] node (keeps Bob mounted)

    function ensureBobHost(){
      if (bobHost && bobHost.isConnected) return bobHost;
      const existing = document.querySelector("[data-bob-embed], #bob-embed");
      if (existing){ bobHost = existing; return bobHost; }
      bobHost = document.createElement("div");
      bobHost.setAttribute("data-bob-embed", "");
      bobHost.style.cssText = BOB_PARK_STYLE;
      (document.body || document.documentElement).appendChild(bobHost);
      return bobHost;
    }
    // Claim the host now, before widget.js gets a chance to initialise.
    if (onDashboard()) ensureBobHost();
    const COURSE_MAP = [
      ["Core Bot System","97f2e80d-0593-4fd9-96f0-3514f4a62dba"],
      ["AI Powered Profits","14e8e519-e4df-4c3e-8e18-b05afa17fe8a"],
      ["Launchpad Mentoring Calls","c25c8e61-7fac-4770-bfe8-5f9df783d03e"],
      ["Preparing for Liftoff","c1340408-4844-40f1-8c04-0a06b314601f"],
      ["BLAST Scaling System","8782a449-b0c9-4678-b3cd-e9156feb3745"],
      ["Facebook Flip Factory","7366376b-ca41-47f7-9a48-3a9e316f8ed2"],
      ["Google Ads Crash Course","cea9bb54-98fb-4100-8245-67e574af87d1"],
      ["Psychology of the Sale","9d700605-7ec4-41e5-9342-5319417d03a4"],
      ["Chatbase Mini Course","4dcb994a-5b3c-4c19-bfc8-0704416fdf3f"],
      ["Affiliate Commission Crash Course","87ee8e38-99ad-42a1-a521-9adbfeff60a0"],
      ["Automator AI Training","9856271a-2c4d-40ee-a1d3-857782b67f18"],
      ["Ultimate Affiliate Offers","6c553bda-3cfa-4856-a1f4-be68e6a31d0b"],
      ["7 Figure Offer Formula","e167b14b-1fc8-40f2-90ae-8b323dbf8585"],
      ["Ninja Conversion Hack","cad8401d-85af-44e2-af82-623397678d11"],
      ["Webinar Breakthrough Formula","d57a9e9d-e9e9-457d-8b8a-bc282f9bbcca"],
      ["Executive Membership","6ff791d3-0ebc-4a84-bee8-01a2f01fb77e"],
      ["Bot Business in a Box","1656c2c6-bfcf-4f72-a7ca-1e6173c183aa"],
      ["Writing to Convert","abec7bfe-8958-4160-b09a-0227cff5c3d0"],
      ["BotBuilder Bonus","2dfbea86-db51-4614-92a5-1b0024346bf6"],
      ["BotBuilders Quick Tips","eeb7cd42-2d94-4238-ae10-78e73e85e20d"],
      ["Accelerator Mentoring","3e712922-b319-4a2c-a974-a4786a9d7b47"],
      ["10X Marketing Systems","50564122-0f82-4391-9d40-26d8e77394df"],
      ["Webinar Automator Academy","baca11fd-54bc-4f7c-90eb-7e9028cd97ba"],
      ["AI + Automation Challenge","6a5924c6-17c7-4f06-9404-b7b5e05f034a"],
      ["Automator AI Quickstart","bd909d34-d6a0-4019-8b92-b1f6d7d43fc8"],
      ["Get Started!","8f01eb36-c56b-488f-8f9b-9b57f5794446"],
      ["Smile Analysis Lead Generator","56266480-e88e-4d12-9b77-d9d0ab849623"],
      ["Orthodontic Video Ads","bb94ee16-a6a3-4c92-a10e-7d70123ae9fc"],
      ["Facebook & Instagram Automated A.I.","51bcf6b8-d276-4d12-a88d-ce31196c2bcb"],
      ["Meta Ads Crash Course","92f6a48a-0549-4a9a-ace4-c600869316bc"],
      ["A.I. Marketing Helper","dbba6cb2-604a-4d0a-96e9-2dd1cf5d45b1"],
      ["Building Your Brand","b8ee6a77-cad8-4a88-87bb-4c7dc18b0001"],
      ["A.I. Specialist Certification","7005bc18-a760-481e-b561-e5e849a3c3cd"],
      ["Abundance Membership","7d766357-f1ab-4c7f-9a15-e0d086fd1404"],
    ].map(([name,id]) => ({ name, link: COURSE_BASE_URL + id }));
    const byName = new Map(COURSE_MAP.map(c => [normalizeText(c.name), c]));
    function extractFields(d){
      if (Array.isArray(d)) return (d[0] && Array.isArray(d[0].fields)) ? d[0].fields : d;
      if (d && Array.isArray(d.fields)) return d.fields;
      return [];
    }
    const state = { fetchedOnce:false, loaded:false, courseNames:[], startedAt: Date.now() };
    async function fetchCourses(){
      const { email, contactId } = getIdentity();
      if (!contactId && !email) return [];
      const res = await fetch(API_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email, contact_id: contactId }) });
      if (!res.ok) return [];
      const data = safeJsonParse(await res.text());
      if (!data) return [];
      const f = extractFields(data);
      const cf = f.find(x => x && x.id === COURSES_FIELD_ID);
      return Array.isArray(cf?.value) ? cf.value : [];
    }
    async function ensureFetched(){
      if (state.fetchedOnce) return;
      state.fetchedOnce = true;
      try { state.courseNames = await fetchCourses(); }
      catch (e){ console.warn("Assigned courses fetch failed:", e); state.courseNames = []; }
      state.loaded = true;
    }
    function makeSkeleton(){
      const w = document.createElement('div');
      w.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
      for (let i=0;i<3;i++){
        const c = document.createElement('div'); c.className='bb-course-card';
        const t = document.createElement('div'); t.style.cssText='height:16px;width:55%;background:#eceef1;border-radius:6px;';
        const b = document.createElement('div'); b.style.cssText='height:32px;width:110px;background:#eceef1;border-radius:8px;';
        c.appendChild(t); c.appendChild(b); w.appendChild(c);
      }
      return w;
    }
    // Ensures the row wrapper + top-row (continue-watching + "Bob") + panel below exist (instant, no API needed)
    function ensurePanelShell(){
      const sec = document.getElementById("continue-watching-section-root");
      if (!sec) return null;
      let row = document.getElementById("custom-cw-row");
      if (!row || !row.isConnected){
        const oldP = document.getElementById("bb-priority-courses");
        if (row){ if (row.contains(sec)) row.parentElement.insertBefore(sec, row); row.remove(); }
        if (oldP) oldP.remove();
        row = document.createElement("div"); row.id = "custom-cw-row";
        sec.parentElement.insertBefore(row, sec);
      }
      // Top row: continue-watching (left) + Bob embed (right)
      let topRow = document.getElementById("bb-top-row");
      if (!topRow || !topRow.isConnected){
        topRow = document.createElement("div"); topRow.id = "bb-top-row";
        row.insertBefore(topRow, row.firstChild);
      }
      if (sec.parentElement !== topRow) topRow.appendChild(sec);
      // Bob slot. Reuse the SAME node across rebuilds (bobCol) instead of
      // recreating it — otherwise every dashboard re-render throws away
      // whatever the Bob widget mounted inside and it has to start over.
      let right = document.getElementById("bb-right-col");
      if (!right || !right.isConnected){
        if (!bobCol){ bobCol = document.createElement("div"); bobCol.id = "bb-right-col"; }
        right = bobCol;
      }
      bobCol = right;
      const host = ensureBobHost();
      if (host.parentElement !== right){
        right.textContent = "";
        host.removeAttribute("style");   // un-park it; sizing comes from the CSS file
        right.appendChild(host);
      }
      if (right.parentElement !== topRow) topRow.appendChild(right);
      // Assigned Courses panel: full-width, BELOW the top row
      let panel = document.getElementById("bb-priority-courses");
      if (!panel){
        panel = document.createElement("section"); panel.id = "bb-priority-courses";
        panel.className = "rounded-xl bg-background p-4 border border-solid border-default shadow-sm";
        const h = document.createElement("h2");
        h.className = "hr-text hr-text-2xl hr-text-semibold text-700";
        // spacing lives in the CSS file: #bb-priority-courses h2
        h.textContent = "Assigned Courses";
        panel.appendChild(h);
        const body = document.createElement("div"); body.className = "bb-pc-body";
        panel.appendChild(body);
      }
      if (panel.parentElement !== row) row.appendChild(panel); // ensure it sits after topRow
      return panel;
    }
    function injectCourses(){
      const panel = ensurePanelShell();
      if (!panel) return;
      const body = panel.querySelector('.bb-pc-body');
      // Still loading (or still waiting on identity) -> show skeleton once
      if (!state.loaded){
        if (panel.getAttribute('data-sig') !== '__loading'){
          body.innerHTML = ''; body.appendChild(makeSkeleton());
          panel.setAttribute('data-sig','__loading');
        }
        return;
      }
      const matched = (state.courseNames || []).map(n => byName.get(normalizeText(n))).filter(Boolean);
      const sig = matched.length ? matched.map(m => normalizeText(m.name)).join('|') : '__empty';
      if (panel.getAttribute('data-sig') === sig) return;
      panel.setAttribute('data-sig', sig);
      body.innerHTML = '';
      if (!matched.length){
        const p = document.createElement('div'); p.className = 'hr-text text-600';
        p.textContent = 'No assigned courses yet.'; body.appendChild(p); return;
      }
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
      matched.forEach(c => {
        const card = document.createElement('div'); card.className = 'bb-course-card';
        const t = document.createElement('span'); t.className = 'hr-text hr-text-lg text-700'; t.textContent = c.name;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'bb-course-btn';
        b.textContent = 'Go to Course'; b.dataset.link = c.link;
        card.appendChild(t); card.appendChild(b); list.appendChild(card);
      });
      body.appendChild(list);
      if (!panel.__clickWired){
        panel.__clickWired = true;
        panel.addEventListener('click', e => { const b = e.target.closest('.bb-course-btn'); if (b) window.location.href = b.dataset.link; });
      }
    }
    /* ────────── run: non-blocking startup ────────── */
    const updateAll = debounceRaf(() => { buildMenu(); renameSharedMenu(); injectCourses(); });

    // Identity arrives asynchronously. Fetch the moment it appears, and
    // re-fetch if it ever changes (account switch, re-login).
    let lastKey = "";
    function maybeRefetch(){
      const { email, contactId } = getIdentity();
      const key = `${contactId}|${email}`;
      if (key === "|" || key === lastKey) return;
      lastKey = key;
      state.fetchedOnce = false; state.loaded = false; state.startedAt = Date.now();
      ensureFetched().then(updateAll);
    }
    function tick(){
      maybeRefetch();
      // never spin the skeleton forever if identity never shows up
      if (!state.loaded && !state.fetchedOnce && (Date.now() - state.startedAt) > IDENTITY_TIMEOUT_MS){
        const { email, contactId } = getIdentity();
        if (!email && !contactId){ state.fetchedOnce = true; state.loaded = true; }
      }
      updateAll();
    }

    // Apply instant changes NOW; identity + courses resolve in the background.
    updateAll();
    maybeRefetch();
    // Catch sidebar + dashboard re-renders (debounced + guarded, so cheap)
    new MutationObserver(updateAll).observe(document.body, { childList:true, subtree:true });
    // Reliable trigger on SPA route changes
    const router = getRouter();
    if (router && typeof router.afterEach === "function" && !router.__bbHooked){
      router.__bbHooked = true;
      router.afterEach(() => { requestAnimationFrame(updateAll); setTimeout(updateAll, 250); });
    }
    // Safety net: re-render + identity watch
    setInterval(tick, 400);
    window.addEventListener("popstate", updateAll);
  })();

/* ── block 2 ── */
  /* ────────── Keep the left menu expanded ──────────
     The portal collapses the sidebar two different ways:
       a) dashboard side  -> data-collapsible="icon" on the sidebar wrappers
       b) community side  -> .sidebar-collapsed on #cp-root-container, which
                             shrinks the --cp-sidebar-width variable
     (b) is handled entirely in CSS (see rule 6) so we never fight Vue over a
     class it owns. This script only handles (a), rAF-batched so the observer
     can't spin. */
  (function () {
    let queued = false;
    const force = () => {
      queued = false;
      document.querySelectorAll('[data-collapsible="icon"]')
        .forEach(el => el.setAttribute('data-collapsible', 'content'));
    };
    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(force); };
    force();
    new MutationObserver(schedule).observe(document.documentElement, {
      subtree: true, attributes: true, attributeFilter: ['data-collapsible']
    });
  })();

/* ── block 3 ── */
  /* Hide "Courses" and "Communities" from the topbar breadcrumb.
     Breadcrumb <li>s carry no id or href, so they can only be matched by
     label text — hence JS rather than CSS. Each <li> holds its own ">"
     separator, so hiding the <li> takes the separator with it. */
  (() => {
    if (window.__bbCrumbInstalled) return;
    window.__bbCrumbInstalled = true;

    const HIDE = ['Courses', 'Communities'];
    let queued = false;

    const run = () => {
      queued = false;
      document.querySelectorAll('#cp-topbar-breadcrumb li').forEach(li => {
        const link = li.querySelector('.hr-breadcrumb-item__link');
        if (!link) return;
        // never hide the last crumb — that's the page you're actually on
        const hide = HIDE.includes(link.textContent.trim())
                  && li !== li.parentElement.lastElementChild;
        li.style.display = hide ? 'none' : '';
      });
    };

    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(run); };

    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();

/* ── block 4 ── */
  /* ────────── Dashboard tweaks ──────────
     1. Topbar "Dashboard"  ->  "{FirstName}’s Portal"
     2. Removes the "Welcome back, …" header line
     3. Removes the Finances section (invoices / estimates / contracts)
     Nodes are hidden rather than removed, because the portal re-renders them.
     Name comes from the same Pinia identity as block 1 (localStorage is gone). */
  (() => {
    if (window.__bbDashTweaks) return;
    window.__bbDashTweaks = true;

    function identity(){
      if (typeof window.bbGetIdentity === 'function') {
        try { return window.bbGetIdentity(); } catch (e) {}
      }
      try {
        const el = document.querySelector('#__nuxt, #cp-root-container, #app, [data-v-app]');
        const app = el && el.__vue_app__;
        const pinia = app && app.config && app.config.globalProperties && app.config.globalProperties.$pinia;
        const st = pinia && pinia.state && pinia.state.value;
        const prof = (st && st['current-user'] && st['current-user'].profile) || {};
        if (prof.fullName || prof.email) return prof;
      } catch (e) {}
      try {
        return (JSON.parse(localStorage.getItem('common')) || {}).clientPortalUserData || {};
      } catch (e) { return {}; }
    }
    function firstName(){
      return ((identity().fullName || '').trim().split(/\s+/)[0]) || '';
    }
    function portalTitle(){
      const n = firstName();
      return n ? n + '’s Portal' : 'My Portal';
    }

    let queued = false;
    const run = () => {
      queued = false;

      // 1. Rename the topbar crumb (and the tab title while on /dashboard)
      document.querySelectorAll('#cp-topbar-breadcrumb .hr-breadcrumb-item__link').forEach(el => {
        const t = el.textContent.trim();
        if (t === 'Dashboard' || t === 'My Portal') el.textContent = portalTitle();
      });
      if (location.pathname.replace(/\/+$/, '') === '/dashboard') {
        const t = portalTitle() + ' | Botbuilders';
        if (document.title !== t) document.title = t;
      }

      // 2. Hide the "Welcome back, …" header
      const welcome = document.getElementById('dashboard-welcome-root');
      if (welcome) welcome.style.display = 'none';

      // 3. Hide Finances
      const fin = document.getElementById('dashboard-billings-section');
      if (fin) fin.style.display = 'none';

      // collapse the wrapper grid if nothing visible is left inside it
      const grid = document.getElementById('dashboard-middle-grid');
      if (grid) {
        const any = [...grid.children].some(c => c.style.display !== 'none' && c.getClientRects().length);
        grid.style.display = any ? '' : 'none';
      }
    };

    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(run); };
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(schedule, 400);          // catches late identity hydration
    window.addEventListener('popstate', schedule);
  })();
