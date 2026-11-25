window.BB_VERSION = '1.0.22 · 2026-11-25';
window.BB_BUILDS = Object.assign(window.BB_BUILDS || {}, { portal: '1.0.22 · 2026-11-25' });
window.BB_CDN = 'https://cdn.jsdelivr.net/gh/BotBuilders/botbuilders-portal@v1.0.22/dist';
/* botbuilders-portal · portal.js · built from src/portal.js (10 script blocks) */

if (!window.__bbPortalRan) {
window.__bbPortalRan = true;

/* ── block 1 ── */
  (() => {
    const domain = window.location.origin;
    /* The support community's slug differs per portal: "services" on the live
       portal (portal.botbuilders.com), "support" on the test portal. Links use
       the right one for this host; route checks accept either. */
    const SUPPORT_GROUP = /(^|\.)portal\.botbuilders\.com$/.test(location.hostname) ? 'services' : 'support';
    window.BB_SUPPORT_GROUP = SUPPORT_GROUP;
    /* Fallback only. The real sprite path is read off the cloned icon at run
       time — the filename carries a build hash that changes on every portal
       deploy, which is what silently blanked the injected icons once already. */
    const SPRITE = "/_nuxt-clientportal/nuxt-svg-icon-sprite/sprite-sidebar.svg";
    // Classes the portal puts on the ACTIVE nav link. Stripped from clones,
    // otherwise every added item inherits the highlighted Courses styling.
    const ACTIVE_LINK_CLASSES = ["router-link-active", "router-link-exact-active", "bg-primary", "text-on-primary", "active", "cp-portal-nav-item__link--active"];
    /* ────────── helpers ────────── */
    function safeJsonParse(raw){ try { return JSON.parse(raw); } catch { return null; } }
    // Periods are dropped so "A.I. Powered Profits" and "AI Powered Profits" are the
    // same key — the course list and the contact field spell these differently.
    function normalizeText(s){ return (s||"").toString().trim().replace(/^["“”']+|["“”']+$/g,"").replace(/\./g,"").replace(/\s+/g," ").trim().toLowerCase(); }
    /* rAF does NOT fire while the tab is hidden. The old version set the
       "scheduled" flag, handed the reset to rAF, and if that callback was never
       delivered (page loaded in a background tab) the flag latched true and
       every later call returned early — block 1 went silent for the whole
       session. The setTimeout is the escape hatch: whichever fires first wins,
       the other is a no-op. */
    function debounceRaf(fn){
      let scheduled = false;
      return (...a) => {
        if (scheduled) return;
        scheduled = true;
        const go = () => { if (!scheduled) return; scheduled = false; fn(...a); };
        requestAnimationFrame(go);
        setTimeout(go, 300);
      };
    }
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
      let email = "", contactId = "", fullName = "", userId = "";
      const absorb = (st) => {
        if (!st) return;
        const prof = (st["current-user"] && st["current-user"].profile) || {};
        const auth = st.auth || {};
        email     = email     || prof.email     || "";
        contactId = contactId || prof.contactId || auth.contactId || "";
        fullName  = fullName  || prof.fullName  || "";
        userId    = userId    || prof._id       || auth.userId    || "";
      };
      const tokenFrom = (st) => (st && st.auth && st.auth.token) || null;

      // 1) live Pinia store — correct after SPA nav / login / logout
      let live = null, payload = null;
      try { live = getPiniaState(); absorb(live); } catch (e) { /* store not ready */ }

      // 2) SSR hydration payload — available before the Vue app mounts
      if (!contactId || !email) {
        try { payload = window.__NUXT__ && window.__NUXT__.pinia; absorb(payload); } catch (e) {}
      }

      // 3) portal JWT claims — clientPortalMeta.contactId
      if (!contactId) {
        try {
          const t = tokenFrom(live) || tokenFrom(payload);
          const seg = t && String(t).split(".")[1];
          if (seg) {
            const j = JSON.parse(atob(seg.replace(/-/g, "+").replace(/_/g, "/")));
            const m = j && j.clientPortalMeta;
            if (m && m.contactId) contactId = m.contactId;
            if (!userId && j && j.authClassId) userId = j.authClassId;
          }
        } catch (e) {}
      }

      // 4) legacy localStorage — only for not-yet-migrated portals
      if (!contactId || !email) {
        try {
          const u = (safeJsonParse(localStorage.getItem("common")) || {}).clientPortalUserData || {};
          contactId = contactId || u.contactId || "";
          email     = email     || u.email     || "";
          fullName  = fullName  || u.fullName  || "";
        } catch (e) {}
        try {
          const ev = safeJsonParse(localStorage.getItem("event")) || {};
          contactId = contactId || ev.contactId || "";
        } catch (e) {}
      }

      return { email, contactId, fullName, userId };
    }
    /* Exposed for the other blocks, the console, AND the section-level custom JS
       (the community box used to reimplement this and hit the webhook a second
       time for the same contact). Four sources, best first:
         1. live Pinia   2. __NUXT__ payload   3. JWT claims   4. legacy keys */
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
      return Array.from(document.querySelectorAll('.app-sidebar-nav-item a')).some(a => a.textContent.trim().toLowerCase() === t);
    }
    /* ────────── Sidebar labels ──────────
       Two jobs in one pass:
         - "Shared files" -> "File Share"
         - re-assert the portal's own labels. On community pages it blanks the
           label spans for its built-in items (Courses, Affiliates render with
           span.textContent === ""), so those rows showed as bare icons while
           our injected items kept their text. File Share never lost its label
           precisely because this function was already rewriting it every tick.
       Keyed by id, so it survives the class churn in the sidebar rebuild. */
    const NAV_LABELS = {
      'cp-portal-sidebar-nav-courses':    'Programs',
      'cp-portal-sidebar-nav-affiliates': 'Affiliates',
      'cp-portal-sidebar-nav-documents':  'File Share',
      'cp-portal-sidebar-nav-events':     'Events',
      'cp-portal-sidebar-nav-loyalty':    'Loyalty',      // live portal only
    };
    /* Our injected items are plain <a>s, not Vue <router-link>s, so the portal
       never adds its active classes to them — Calendar and Contact stayed
       unhighlighted while every built-in item turned blue. Paint them from the
       path instead. (Automator AI is external; it is never "current".) */
    const NAV_ACTIVE_PATHS = {
      'custom-menu-calendar-link': /^\/communities\/groups\/(support|services)\/events/,
      'custom-menu-contact-link':  /^\/communities\/groups\/(support|services)\/about/,
      'custom-menu-roadmap-link':  () => onRoadmap(),
    };
    function markActiveNav(){
      for (const [id, re] of Object.entries(NAV_ACTIVE_PATHS)){
        const a = document.getElementById(id);
        if (!a) continue;
        const on = typeof re === 'function' ? re() : re.test(location.pathname);
        a.classList.toggle('bg-primary', on);
        a.classList.toggle('text-on-primary', on);
      }
    }
    /* ────────── Injected nav icons ──────────
       The sprite filename carries a build hash that changes on every portal
       deploy (Ct8uebB4tr… → PwdMtV_21…), so a hardcoded path silently 404s and
       the injected icons go blank while the portal's own stay fine. Read the
       current path off a portal-owned icon instead, and re-assert it on every
       tick so a later re-render can't leave ours pointing at a dead file. */
    const CUSTOM_ICONS = {
      'custom-menu-roadmap':   'contracts',
      'custom-menu-calendar':  'appointments',
      'custom-menu-contact':   'explore',
      'custom-menu-automator': 'studio',
    };
    function spriteBase(){
      const u = document.querySelector('#cp-portal-sidebar-nav-courses use')
             || document.querySelector('.app-sidebar-nav-item:not([id^="custom-menu-"]) use');
      const h = u ? (u.getAttribute('href') || u.getAttribute('xlink:href') || '') : '';
      return h.split('#')[0] || SPRITE;
    }
    function fixNavIcons(){
      const base = spriteBase();
      if (!base) return;
      for (const [id, icon] of Object.entries(CUSTOM_ICONS)){
        const li = document.getElementById(id);
        const u = li && li.querySelector('use');
        if (!u) continue;
        const want = base + '#' + icon;
        if ((u.getAttribute('href') || '') !== want) u.setAttribute('href', want);
      }
    }
    function fixNavLabels(){
      for (const [id, label] of Object.entries(NAV_LABELS)){
        const link = document.getElementById(id);
        if (!link) continue;
        const span = link.querySelector('span');
        if (span && span.textContent.trim() !== label) span.textContent = label;
      }
      const crs = document.getElementById('cp-portal-sidebar-nav-courses');
      if (crs && crs.getAttribute('aria-label') !== 'Programs') crs.setAttribute('aria-label', 'Programs');
      const docs = document.getElementById('cp-portal-sidebar-nav-documents');
      if (docs && docs.getAttribute('aria-label') === 'Shared files') docs.setAttribute('aria-label', 'File Share');
    }
    /* ────────── 1. Sidebar menu (instant, no API needed) ──────────
       The portal rebuilt its sidebar. Old markup:
         div.items-container > div.selectable-list-item > a.cp-portal-nav-item__link
       New markup:
         section.app-sidebar-group > ul > li.app-sidebar-nav-item > a.app-sidebar-nav-item__link
       .items-container and .selectable-list-item no longer exist there, so the
       old anchor lookup returned null and this whole function bailed on its
       first line — no Calendar / Contact / Automator AI, and no /my-courses
       rewrite on Courses. Anchor off the stable id instead of the markup.
       (The Account Settings rail still uses the OLD classes — leave those be.) */
    function buildMenu(){
      const cl = document.getElementById('cp-portal-sidebar-nav-courses')
              || document.querySelector('.app-sidebar-nav-item a[href*="/courses"]');
      if (!cl) return false;
      cl.setAttribute('href', domain + '/courses/my-courses');
      wireSoftNav(cl, '/courses/my-courses');
      const item = cl.closest('li');
      const container = item && item.parentElement;   // the <ul> inside the group
      if (!container) return false;
      function add(label, href, id, icon, ext, path){
        if (document.getElementById(id) || hasMenuLabel(label)) return; // duplicate-safe
        const el = item.cloneNode(true);
        el.id = id;
        const a = el.querySelector('a');
        a.id = id + '-link';
        a.setAttribute('href', href);
        if (ext){ a.setAttribute('target','_blank'); a.setAttribute('rel','noopener noreferrer'); }
        // active styling now lives on the <a>, not the wrapper
        ACTIVE_LINK_CLASSES.forEach(c => a.classList.remove(c));
        const sp = el.querySelector('span'); if (sp) sp.textContent = label;
        const u = el.querySelector('use');
        if (u) u.setAttribute('href', spriteBase() + '#' + icon);
        container.appendChild(el);
        if (!ext) wireSoftNav(a, path);
      }
      // Calendar is duplicate-safe: skipped if your other custom-JS already adds it.
      const grp = '/communities/groups/' + SUPPORT_GROUP;
      // Roadmap: only for contacts whose roadmap-link field holds a valid URL.
      // Kept directly under Programs, since it can appear after the others.
      if (roadmapLink()){
        add('Roadmap', domain + ROADMAP_PATH, 'custom-menu-roadmap', 'contracts', false, ROADMAP_PATH);
        const rli = document.getElementById('custom-menu-roadmap');
        if (rli && item.nextElementSibling !== rli) item.after(rli);
      } else {
        const rli = document.getElementById('custom-menu-roadmap');
        if (rli) rli.remove();
      }
      add('Calendar', domain + grp + '/events', 'custom-menu-calendar', 'appointments', false, grp + '/events');
      add('Contact',  domain + grp + '/about',  'custom-menu-contact',  'explore',      false, grp + '/about');
      add('Automator AI', 'https://app.automator.ai', 'custom-menu-automator', 'studio', true);
      return true;
    }
    /* ────────── 2. Dynamic Assigned Courses (API-driven, non-blocking) ────────── */
    const API_URL = "https://connect.botbuilders.cloud/webhook/1360de3a-1206-4a2c-8175-56219ea1623b";
    const COURSE_BASE_URL = "https://portal.botbuilders.com/courses/products/";
    const COURSES_FIELD_ID = "dBmTaHpIJPyy2vCwD1wT";
    /* ────────── Need Help card ──────────
       Same webhook as the courses list — it already returns tags, email,
       first_name, last_name and the full custom-field set, so no second call.
       Gated on tags, exactly like the old portal's INNER_CIRCLE_HELP. */
    const HELP_TAGS   = ["global - test tag", "inner circle - active"];
    const HELP_URL    = "https://go.botbuilders.com/ic-help";
    const BILLING_RESET_FIELD_ID = "UNJyx3fzPSZDtSvvQQI8";
    const CREDITS_FIELD_ID       = "T1otPJDLzM2KPuVBqpjU";
    const HELP_BLURB  = "Have a question or need assistance? Reach out to our Inner Circle support team and we'll get back to you as soon as possible.";
    const IDENTITY_TIMEOUT_MS = 15000;   // give up waiting for hydration after this
    /* ────────── Accelerator box ──────────
       Sits under "Pick up where you left off". Every value comes from contact
       custom fields returned by the same webhook. IDs are blank until the
       fields are confirmed — a blank ID simply reads as "no value".
       For previews, window.BB_ACCEL_SAMPLE = { systemsDone, systemsTotal,
       roadmapStart, projectedEnd, mitName, mitUrl, roadmapUrl } bypasses the
       webhook and the tag gate. Never set on the live portal. */
    /* Roadmap page. Unknown portal routes bounce to /dashboard, so the page
       lives at /dashboard?view=roadmap: the dashboard content is hidden and
       the roadmap is iframed full-size in its place (portal.css §6d).
       roadmaps.botbuilders.com only allows framing from portal.botbuilders.com
       (CSP frame-ancestors), so it shows blank on the test portal.
       The link is per contact (ACCEL_FIELDS.roadmapUrl). The Roadmap menu,
       the page and "View details" only exist when it holds a valid http(s)
       URL; otherwise /dashboard?view=roadmap falls back to the dashboard. */
    const ROADMAP_PATH = "/dashboard?view=roadmap";
    // "View details" opens the roadmap at its "Your Build" section (#yours),
    // where the current MIT is the highlighted "YOUR MIT · START HERE" task
    // with its tool and starting prompt. (#mitbox, the summary at the end of
    // that section, ends up under the roadmap's sticky header.)
    const ROADMAP_MIT_PATH = ROADMAP_PATH + "&at=mit";
    const ROADMAP_MIT_ANCHOR = "yours";
    // Empty = no tag gate: the box shows for anyone whose fields below have
    // values. Add a tag (e.g. "accelerator - active") to also require it.
    const ACCEL_TAGS = [];
    const ACCEL_FIELDS = {
      systemsDone:  "eaIWVQFDpFDmuIG8ScvB",   // systems built
      systemsTotal: "SfcXZ8sw1ekL8yG1sZkl",   // total systems
      roadmapStart: "L2RgI2SnzEvxb1adJLxj",   // start date
      projectedEnd: "XM6C0h2Y4k5mGEzsc4y3",   // end date
      mitName:      "va9piIjpZkFyRbIxW2bP",   // current MIT
      mitUrl:       "",
      roadmapUrl:   "Fl8KPXGdCfDi1zEHXfk8",
    };
    const ACCEL_LOGO_URL = "https://files.leadconnectorhq.com/file/6afe34fc8140edeb93cf1e9a/training-botbuilders-accelerator-logo.webp";
    const ACCEL_TIPS = {
      systems:    "Estimates what percent of systems defined on your roadmap we have finished building. All work will be quality checked and is open to your feedback.",
      consulting: "Estimates how much of your 12 weeks have been utilized. It begins after your roadmap is created and does have some flexibility to ensure you are supported.",
      mit:        "Based on conversations with your consultant, this is your Most Important Thing to be working on. Click link to get recommended training and tools in roadmap.",
    };
    /* ────────── Bob inline embed ──────────
       The widget (https://selfhelp.ai/widget.js) mounts itself into the first
       element matching "[data-bob-embed], #bob-embed". It looks for that host
       ONCE, when it initialises, and has no MutationObserver — so if the host
       isn't in the DOM by then it falls back to its floating panel and never
       reconsiders. The dashboard's right column doesn't exist until Vue has
       rendered, which is far too late.
       So: create the host immediately (this block is an inline <script>, so it
       runs long before the async widget.js finishes downloading), parked
       off-screen on <body>, then move it into #bb-bob-box once the shell is
       built. Moving a mounted host is safe — the panel is plain divs, no iframe.
       Host must be >= 240px (INLINE_MIN_HOST_PX); widget defaults to 560px.

       SIZING IS NOT DONE HERE. The parking style below is inline only because
       it has to beat widget.js to the punch. Once the host is placed, the
       inline style is REMOVED so the stylesheet owns the size:
         #bb-bob-box                    { position: relative; height: 600px }
         #bb-bob-box > [data-bob-embed] { position: absolute; inset: 0 }
       The box sits at the top of #bb-right-col (the rail beside the bands). */
    const BOB_EMBED_HEIGHT = "600px";    // parked size + the CSS floor. Not the rendered height.
    const BOB_PARK_STYLE   = "position:absolute;left:-10000px;top:0;width:400px;height:" + BOB_EMBED_HEIGHT + ";";
    const onDashboard = () => location.pathname.replace(/\/+$/, "") === "/dashboard";
    /* Lesson pages embed Bob too — the course-level custom JS positions it, but
       the HOST and the loader are owned here, because the widget looks for its
       host once at init and the course box can't reliably beat it. */
    const onLesson    = () => /^\/courses\/products\//.test(location.pathname);
    const needsBob    = () => onDashboard() || onLesson();
    const onRoadmap   = () => onDashboard() && new URLSearchParams(location.search).get("view") === "roadmap";
    function roadmapLink(){
      const v = (state.accel && state.accel.roadmapUrl) || "";
      if (!v) return "";
      try {
        const u = new URL(v);
        return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.href : "";
      } catch (e){ return ""; }
    }
    function syncRoadmapView(){
      let on = onRoadmap();
      // No valid link for this contact: leave the roadmap URL for the dashboard.
      if (on && state.loaded && !roadmapLink()){
        on = false;
        const rt = getRouter();
        if (rt && rt.replace) rt.replace("/dashboard");
      }
      if (document.documentElement.hasAttribute("data-bb-roadmap") !== on)
        document.documentElement.toggleAttribute("data-bb-roadmap", on);
      let wrap = document.getElementById("bb-roadmap-view");
      if (!on){ if (wrap) wrap.remove(); return; }
      const inner = document.querySelector(".cp-main-content-inner");
      if (!inner) return;
      if (!wrap){
        wrap = document.createElement("div"); wrap.id = "bb-roadmap-view";
        const f = document.createElement("iframe");
        f.title = "Roadmap";
        f.setAttribute("allow", "clipboard-write");
        wrap.appendChild(f);
      }
      if (wrap.parentElement !== inner) inner.insertBefore(wrap, inner.firstChild);
      let src = roadmapLink();
      const f = wrap.firstChild;
      if (!src) return;                  // still loading the contact's fields
      if (new URLSearchParams(location.search).get("at") === "mit"){
        const u = new URL(src); u.hash = ROADMAP_MIT_ANCHOR; src = u.href;
      }
      if (f.getAttribute("src") !== src) f.setAttribute("src", src);
    }
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
    // The course-level JS borrows this host instead of creating its own.
    window.bbBobHost = ensureBobHost;
    // Claim the host now, before widget.js gets a chance to initialise.
    if (needsBob()) ensureBobHost();
    const COURSE_MAP = [
      ["AI Safety & Success","4661547b-6181-42d7-a7fe-d05d6dcdff92"],
      ["Ultimate Webinar Sales System","98a7f792-4fd0-499d-972c-4737bf22f2b2"],
      ["AI Sales Engines","5db31f26-223a-4593-89dd-bf3ae8b08647"],
      ["AI CMO","1ac00804-956e-4cbb-a83c-651821e97582"],
      ["AI Insiders","c4ef7e06-c9d3-4645-b7ab-ff5ecaa889c6"],
      ["Magic Cards","1a18c477-6a49-4a96-bf03-77f7c888cece"],
      ["Connect Event Recording","0de6624c-788d-40f6-ba43-f789f32cd558"],
      ["Inner Circle Program","63ba1de7-856f-43b4-ab6d-dbaddd48df43"],
      ["Building Your Bot & AI Business","6a359b4e-8c3a-4115-a19a-05572a88a56d"],
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
      ["Core Bot System","97f2e80d-0593-4fd9-96f0-3514f4a62dba"],
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
      ["AI Powered Profits","14e8e519-e4df-4c3e-8e18-b05afa17fe8a"],
    ].map(([name,id]) => ({ name, link: COURSE_BASE_URL + id }));
    const byName = new Map(COURSE_MAP.map(c => [normalizeText(c.name), c]));
    /* One-line blurb under each course title. Keyed by the NORMALIZED name from
       COURSE_MAP above (trimmed, whitespace-collapsed, lowercased) so casing and
       punctuation in the source list don't matter. A course with no entry here
       simply renders without a description — nothing breaks. */
    const COURSE_DESCRIPTIONS = {
      "core bot system":      "BotBuilders flagship program that includes everything you need to create a world class bot FAST.",
      "ai powered profits":   "Boost earnings with AI: Learn AI-powered strategies in our Profits course.",
      "meta ads crash course":"Supercharge marketing: Meta Ads Crash Course for maximum impact.",
    };
    function extractFields(d){
      if (Array.isArray(d)) return (d[0] && Array.isArray(d[0].fields)) ? d[0].fields : d;
      if (d && Array.isArray(d.fields)) return d.fields;
      return [];
    }
    const state = {
      fetchedOnce:false, loaded:false, startedAt: Date.now(),
      courseNames:[], tags:[],
      profileEmail:"", firstName:"", lastName:"",
      billingResetDate:"", creditsAvailable:"",
      accel:{},
    };
    function extractRoot(d){
      if (Array.isArray(d)) return d[0] || {};
      return (d && typeof d === "object") ? d : {};
    }
    function fieldValue(fields, id){
      const f = fields.find(x => x && x.id === id);
      const v = f && f.value;
      if (v === null || v === undefined) return "";
      return typeof v === "string" ? v.trim() : String(v).trim();
    }
    async function fetchPortalData(){
      const { email, contactId } = getIdentity();
      const empty = { courseNames:[], tags:[], profileEmail: email || "", firstName:"", lastName:"", billingResetDate:"", creditsAvailable:"" };
      if (!contactId && !email) return empty;
      const res = await fetch(API_URL, { method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify({ email, contact_id: contactId }) });
      if (!res.ok) return empty;
      const data = safeJsonParse(await res.text());
      if (!data) return empty;
      const fields = extractFields(data);
      const root   = extractRoot(data);
      const cf = fields.find(x => x && x.id === COURSES_FIELD_ID);
      return {
        courseNames: Array.isArray(cf?.value) ? cf.value : [],
        tags: Array.isArray(root.tags) ? root.tags.filter(t => typeof t === "string") : [],
        profileEmail: (typeof root.email === "string" && root.email.trim()) || email || "",
        firstName: typeof root.first_name === "string" ? root.first_name.trim() : "",
        lastName:  typeof root.last_name  === "string" ? root.last_name.trim()  : "",
        billingResetDate: fieldValue(fields, BILLING_RESET_FIELD_ID),
        creditsAvailable: fieldValue(fields, CREDITS_FIELD_ID),
        accel: Object.fromEntries(Object.entries(ACCEL_FIELDS).map(([k, id]) => [k, id ? fieldValue(fields, id) : ""])),
      };
    }
    async function ensureFetched(){
      if (state.fetchedOnce) return;
      state.fetchedOnce = true;
      try { Object.assign(state, await fetchPortalData()); }
      catch (e){ console.warn("Portal data fetch failed:", e); state.courseNames = []; state.tags = []; }
      state.loaded = true;
    }
    function hasHelpAccess(){
      const have = new Set((state.tags || []).map(normalizeText));
      return HELP_TAGS.some(t => have.has(normalizeText(t)));
    }
    function renderHelp(helpCol){
      if (!state.loaded) return;                 // don't flash the card before tags are known
      if (!hasHelpAccess()){
        helpCol.style.display = "none";
        if (helpCol.firstChild){ helpCol.innerHTML = ""; helpCol.removeAttribute("data-sig"); }
        return;
      }
      helpCol.style.display = "";
      const sig = [state.profileEmail, state.firstName, state.lastName, state.billingResetDate, state.creditsAvailable].join("|");
      if (helpCol.getAttribute("data-sig") === sig) return;
      helpCol.setAttribute("data-sig", sig);
      helpCol.innerHTML = "";

      // Left: Need Help.  Right: Inner Circle (minutes + billing), only when
      // those custom fields have values. Both share the tag gate above.
      const card = document.createElement("section");
      card.id = "bb-help-card";
      const top = document.createElement("div");
      top.className = "bb-help-top";
      const icon = document.createElement("div");
      icon.className = "bb-help-icon";
      icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z"/></svg>';
      top.appendChild(icon);
      const h = document.createElement("h2");
      h.textContent = "Need Help?";
      top.appendChild(h);
      card.appendChild(top);
      const body = document.createElement("p");
      body.className = "bb-help-body";
      body.textContent = HELP_BLURB;
      card.appendChild(body);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bb-help-btn";
      btn.textContent = "Get Help";
      btn.addEventListener("click", () => {
        const q = new URLSearchParams();
        if (state.profileEmail) q.set("email", state.profileEmail);
        if (state.firstName)    q.set("first_name", state.firstName);
        if (state.lastName)     q.set("last_name", state.lastName);
        const qs = q.toString();
        window.open(qs ? HELP_URL + "?" + qs : HELP_URL, "_blank", "noopener,noreferrer");
      });
      card.appendChild(btn);
      helpCol.appendChild(card);

      if (state.billingResetDate || state.creditsAvailable){
        const plan = document.createElement("section");
        plan.id = "bb-plan-card";
        const pt = document.createElement("div");
        pt.className = "bb-plan-title";
        pt.textContent = "Inner Circle";
        plan.appendChild(pt);
        const tiles = document.createElement("div");
        tiles.className = "bb-plan-tiles";
        const tile = (label, value, unit) => {
          const t = document.createElement("div"); t.className = "bb-plan-tile";
          const l = document.createElement("div"); l.className = "bb-plan-label"; l.textContent = label;
          const v = document.createElement("div"); v.className = "bb-plan-value"; v.textContent = value;
          if (unit){ const u = document.createElement("span"); u.className = "bb-plan-unit"; u.textContent = " " + unit; v.appendChild(u); }
          t.appendChild(l); t.appendChild(v); return t;
        };
        if (state.creditsAvailable){
          const numeric = /^\d[\d,.]*$/.test(state.creditsAvailable);
          tiles.appendChild(tile("Minutes available", state.creditsAvailable, numeric ? "min" : ""));
        }
        if (state.billingResetDate) tiles.appendChild(tile("Billing resets", state.billingResetDate, ""));
        plan.appendChild(tiles);
        helpCol.appendChild(plan);
      }
    }
    /* Dates may arrive as "Aug 27, 2026", "2026-08-27" or a ms timestamp. */
    function parseDate(v){
      if (!v) return null;
      if (/^\d{10,13}$/.test(v)) return new Date(Number(v.length === 10 ? v + "000" : v));
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T00:00:00" : v);
      return isNaN(d) ? null : d;
    }
    function accelData(){
      const sample = window.BB_ACCEL_SAMPLE;
      if (sample && typeof sample === "object") return { a: sample, allowed: true };
      const have = new Set((state.tags || []).map(normalizeText));
      return { a: state.accel || {}, allowed: !ACCEL_TAGS.length || ACCEL_TAGS.some(t => have.has(normalizeText(t))) };
    }
    function renderAccel(box){
      if (!state.loaded && !window.BB_ACCEL_SAMPLE) return;
      const { a, allowed } = accelData();
      const done = parseFloat(a.systemsDone), total = parseFloat(a.systemsTotal);
      const start = parseDate(a.roadmapStart), end = parseDate(a.projectedEnd);
      const hasAny = (total > 0) || (start && end) || a.mitName;
      if (!allowed || !hasAny){ box.hidden = true; box.innerHTML = ""; box.removeAttribute("data-sig"); return; }
      box.hidden = false;
      const sig = JSON.stringify(a) + "|" + roadmapLink() + "|" + spriteBase() + "|" + new Date().toDateString();
      if (box.getAttribute("data-sig") === sig) return;
      box.setAttribute("data-sig", sig);
      box.innerHTML = "";
      const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

      // Head: logo + action buttons
      const head = el("div", "bb-acc-head");
      if (ACCEL_LOGO_URL){
        const img = el("img", "bb-acc-logo"); img.src = ACCEL_LOGO_URL; img.alt = "Accelerator"; head.appendChild(img);
      } else {
        head.appendChild(el("div", "bb-acc-wordmark", "Accelerator"));
      }
      const acts = el("div", "bb-acc-actions");
      const action = (label, href, external, icon) => {
        const b = el("a", "bb-acc-btn");
        b.href = href;
        b.innerHTML = icon;
        b.appendChild(document.createTextNode(label));
        if (external){ b.target = "_blank"; b.rel = "noopener noreferrer"; }
        else b.addEventListener("click", e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          const rt = getRouter();
          if (rt && rt.push){ e.preventDefault(); rt.push(href); }
        });
        return b;
      };
      const ICON_MAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>';
      const ICON_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>';
      // Roadmap button hidden for now (the sidebar has a Roadmap item) — re-add with:
      // acts.appendChild(action("Roadmap", ROADMAP_PATH, false, ICON_MAP));
      // Calendar button held back for now — re-add with:
      // acts.appendChild(action("Calendar", "/communities/groups/" + SUPPORT_GROUP + "/events", false, ICON_CAL));
      if (acts.childElementCount) head.appendChild(acts);
      box.appendChild(head);

      // Label with hover/focus tooltip on the icon + bold name
      // Icons come from the portal's own sidebar sprite, so they match the menu.
      const label = (icon, name, tip) => {
        const l = el("div", "bb-acc-label");
        l.tabIndex = 0;
        const ic = el("span", "bb-acc-ico");
        ic.innerHTML = '<svg aria-hidden="true"><use href="' + spriteBase() + '#' + icon + '"/></svg>';
        l.appendChild(ic);
        l.appendChild(el("strong", "", name));
        const t = el("span", "bb-acc-tip", tip);
        t.setAttribute("role", "tooltip");
        l.appendChild(t);
        return l;
      };
      const bar = (pct, tone) => {
        const b = el("div", "bb-acc-bar" + (tone ? " bb-acc-bar--" + tone : ""));
        b.setAttribute("role", "progressbar");
        b.setAttribute("aria-valuemin", "0"); b.setAttribute("aria-valuemax", "100");
        b.setAttribute("aria-valuenow", String(Math.round(pct)));
        const f = el("span"); f.style.width = Math.max(0, Math.min(100, pct)) + "%";
        b.appendChild(f); return b;
      };
      const grid = el("div", "bb-acc-grid");

      if (total > 0){
        const pct = Math.min(100, (done || 0) / total * 100);
        const c = el("div", "bb-acc-item");
        const top = el("div", "bb-acc-row"); top.appendChild(label("dashboard", "Systems Progress", ACCEL_TIPS.systems));
        top.appendChild(el("span", "bb-acc-pct", Math.round(pct) + "%")); c.appendChild(top);
        c.appendChild(bar(pct));
        c.appendChild(el("div", "bb-acc-cap", (done || 0) + " of " + total + " systems built"));
        grid.appendChild(c);
      }
      if (start && end && end > start){
        const DAY = 864e5, now = Date.now();
        const pct = Math.max(0, Math.min(100, (now - start) / (end - start) * 100));
        const left = Math.max(0, Math.ceil((end - now) / (7 * DAY)));
        const c = el("div", "bb-acc-item");
        const top = el("div", "bb-acc-row"); top.appendChild(label("appointments", "Consulting Status", ACCEL_TIPS.consulting));
        top.appendChild(el("span", "bb-acc-pct", Math.round(pct) + "%")); c.appendChild(top);
        c.appendChild(bar(pct));
        const endTxt = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        c.appendChild(el("div", "bb-acc-cap", (left ? left + (left === 1 ? " week" : " weeks") + " left" : "Completed") + " · ends " + endTxt));
        grid.appendChild(c);
      }
      if (a.mitName){
        const c = el("div", "bb-acc-item bb-acc-item--mit");
        const top = el("div", "bb-acc-row"); top.appendChild(label("loyalty", "Your Current MIT", ACCEL_TIPS.mit)); c.appendChild(top);
        c.appendChild(el("div", "bb-acc-mit", a.mitName));
        if (roadmapLink()){
          const v = el("a", "bb-acc-more", "View details");
          v.href = ROADMAP_MIT_PATH;
          v.addEventListener("click", e => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            const rt = getRouter();
            if (rt && rt.push){ e.preventDefault(); rt.push(ROADMAP_MIT_PATH); }
          });
          v.insertAdjacentHTML("beforeend", '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>');
          c.appendChild(v);
        }
        grid.appendChild(c);
      }
      box.appendChild(grid);
    }
    /* ────────── Upcoming events (dashboard, under Bob) ──────────
       Same request the Calendar page uses for its "Upcoming Events" list, so
       the two always match. Clicking one opens the Calendar page and clicks
       that event in its list, which opens the portal's own popup (Register
       button included). The group id is looked up from SUPPORT_GROUP once. */
    const EVENTS_LIMIT = 6;
    const EVENTS_PATH = "/communities/groups/" + SUPPORT_GROUP + "/events";
    const EVENT_OPEN_KEY = "bb-open-event";
    const evt = { list: null, loading: false, at: 0 };
    function lcHeaders(tok, loc, extra){
      return Object.assign({ Authorization: "Bearer " + tok, source: "PORTAL_USER", channel: "APP", version: "2023-02-21", "x-location-id": loc }, extra || {});
    }
    async function supportGroupId(tok, loc){
      const k = "bb-group-id-" + SUPPORT_GROUP;
      try { const c = sessionStorage.getItem(k); if (c) return c; } catch (e) {}
      const base = "https://services.leadconnectorhq.com/clientportal-middleware/communities/" + loc + "/groups?enabled=true&limit=50&skip=";
      for (let skip = 0; skip < 500; skip += 50){
        const r = await fetch(base + skip, { headers: lcHeaders(tok, loc) });
        if (!r.ok) return "";
        const list = await r.json();
        const g = (Array.isArray(list) ? list : []).find(x => x && x.slug === SUPPORT_GROUP);
        if (g){ try { sessionStorage.setItem(k, g._id); } catch (e) {} return g._id; }
        if (!Array.isArray(list) || list.length < 50) return "";
      }
      return "";
    }
    function loadEvents(){
      if (evt.loading || (evt.list && Date.now() - evt.at < 5 * 60 * 1000)) return;
      const st = getPiniaState();
      const tok = st && st.auth && st.auth.token;
      const loc = st && st.location && st.location.locationId;
      if (!tok || !loc) return;                // not hydrated yet; next tick retries
      evt.loading = true;
      supportGroupId(tok, loc).then(gid => {
        if (!gid) return [];
        const u = "https://services.leadconnectorhq.com/clientportal-middleware/communities/" + loc + "/groups/" + gid +
                  "/events/past-upcoming?currentDate=" + encodeURIComponent(new Date().toISOString()) + "&limit=" + EVENTS_LIMIT;
        return fetch(u, { headers: lcHeaders(tok, loc, { "x-group-id": gid }) })
          .then(r => r.ok ? r.json() : {}).then(j => (j && j.upcomingEvents) || []);
      }).catch(() => []).then(list => {
        evt.list = list.slice(0, EVENTS_LIMIT); evt.at = Date.now();
      }).finally(() => { evt.loading = false; updateAll(); });
    }
    /* Repeating events come back with the series' first clock time, unshifted
       by daylight saving (a 2pm LA weekly from June arrives as 1pm in Nov).
       The Calendar keeps the clock time in the event's timezone, so do the same:
       the series' start time-of-day in e.timezone, on this occurrence's date. */
    function tzParts(d, tz){
      const o = {};
      new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
        .formatToParts(d).forEach(p => { o[p.type] = +p.value; });
      return o;
    }
    function zonedToDate(y, mo, d, h, mi, tz){
      let t = Date.UTC(y, mo - 1, d, h, mi);
      for (let i = 0; i < 2; i++){
        const p = tzParts(new Date(t), tz);
        t -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Date.UTC(y, mo - 1, d, h, mi);
      }
      return new Date(t);
    }
    function eventTimes(e){
      const s = new Date(e.startTime), en = new Date(e.endTime);
      const rs = e.recurringMeta && e.recurringMeta.eventStart;
      if (!e.isRecurring || !rs || !e.timezone) return [s, en];
      try {
        const first = tzParts(new Date(rs), e.timezone), day = tzParts(s, e.timezone);
        const fixed = zonedToDate(day.year, day.month, day.day, first.hour, first.minute, e.timezone);
        return [fixed, new Date(fixed.getTime() + (en - s))];
      } catch (x) { return [s, en]; }
    }
    function renderEvents(box){
      loadEvents();
      const list = evt.list;
      const sig = list ? list.map(e => (e._id || e.eventId) + e.startTime + e.title).join("|") : "__loading";
      if (box.getAttribute("data-sig") === sig) return;
      box.setAttribute("data-sig", sig);
      box.innerHTML = "";
      const head = document.createElement("div"); head.className = "bb-ev-head";
      const h = document.createElement("h2"); h.textContent = "Upcoming Events";
      const all = document.createElement("a"); all.className = "bb-ev-all"; all.href = EVENTS_PATH;
      all.innerHTML = 'View calendar <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      head.appendChild(h); head.appendChild(all); box.appendChild(head);
      if (!list){
        for (let i = 0; i < 3; i++){ const sk = document.createElement("div"); sk.className = "bb-ev-skel"; box.appendChild(sk); }
        return;
      }
      if (!list.length){
        const p = document.createElement("div"); p.className = "bb-ev-empty"; p.textContent = "No upcoming events.";
        box.appendChild(p); return;
      }
      const fmtT = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      let lastDay = "";
      list.forEach(e => {
        const [s, en] = eventTimes(e);
        const day = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
        if (day !== lastDay){
          lastDay = day;
          const d = document.createElement("div"); d.className = "bb-ev-day"; d.textContent = day; box.appendChild(d);
        }
        const a = document.createElement("a"); a.className = "bb-ev-item"; a.href = EVENTS_PATH;
        a.style.setProperty("--ev", e.eventColor || "#004eeb");
        const t = document.createElement("div"); t.className = "bb-ev-title"; t.textContent = e.title || "Event";
        const tm = document.createElement("div"); tm.className = "bb-ev-time";
        tm.textContent = fmtT(s) + (isNaN(en) ? "" : " – " + fmtT(en));
        a.appendChild(t); a.appendChild(tm);
        if (e.rsvpMeta && e.rsvpMeta.hasRegistered){
          const r = document.createElement("span"); r.className = "bb-ev-reg"; r.textContent = "Registered"; a.appendChild(r);
        }
        a.addEventListener("click", ev => {
          if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
          try { sessionStorage.setItem(EVENT_OPEN_KEY, JSON.stringify({ id: e._id || "", title: e.title || "", start: e.startTime, ts: Date.now() })); } catch (x) {}
          const rt = getRouter();
          if (rt && rt.push){ ev.preventDefault(); rt.push(EVENTS_PATH); }
        });
        box.appendChild(a);
      });
      all.addEventListener("click", ev => {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
        const rt = getRouter();
        if (rt && rt.push){ ev.preventDefault(); rt.push(EVENTS_PATH); }
      });
    }
    /* On the Calendar page: open the event picked on the dashboard by clicking
       it in the page's own Upcoming list (recurring events there have no id,
       so fall back to the title, then the n-th one with that title by time). */
    function openPendingEvent(){
      if (!/^\/communities\/groups\/[^/]+\/events\/?$/.test(location.pathname)) return;
      let want;
      try { want = JSON.parse(sessionStorage.getItem(EVENT_OPEN_KEY) || "null"); } catch (e) {}
      if (!want) return;
      if (Date.now() - want.ts > 20000){ try { sessionStorage.removeItem(EVENT_OPEN_KEY); } catch (e) {} return; }
      const btns = [...document.querySelectorAll('button[id^="events-sidebar-event-"]')];
      if (!btns.length) return;
      let b = want.id && document.getElementById("events-sidebar-event-" + want.id);
      if (!b){
        const norm = x => String(x || "").replace(/\s+/g, " ").trim();
        b = btns.find(x => { const p = x.querySelector("p p, .truncate"); return p && norm(p.textContent) === norm(want.title); });
      }
      if (!b) return;                           // list may still be filling in; retry next tick
      try { sessionStorage.removeItem(EVENT_OPEN_KEY); } catch (e) {}
      b.click();
    }
    function makeSkeleton(){
      const g = document.createElement('div'); g.className = 'bb-pg-grid';
      for (let i=0;i<3;i++){ const c = document.createElement('div'); c.className = 'bb-pg-skel'; g.appendChild(c); }
      return g;
    }
    /* ────────── Dashboard v2 ──────────
       One grid (#custom-cw-row, layout in portal.css §17):
         greeting                      | Bob (fixed height)
         Accelerator                   |
         Need Help + Inner Circle      |
         Pick up where you left off    |
         Assigned Programs (image cards)|
       Pick-up is the portal's own section, restyled: image left, text right. */
    function displayFirstName(){
      let n = state.firstName || "";
      if (!n){
        const st = getPiniaState();
        const prof = (st && st["current-user"] && st["current-user"].profile) || {};
        n = prof.firstName || (prof.fullName || "").split(" ")[0] || "";
      }
      n = String(n).trim();
      return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
    }
    function decoratePickup(sec){
      const textCol = sec.querySelector("article .min-w-0.flex-1");
      if (textCol && !textCol.querySelector(".bb-pick-label")){
        const l = document.createElement("div"); l.className = "bb-pick-label";
        l.textContent = "Pick up where you left off";
        textCol.insertBefore(l, textCol.firstChild);
      }
    }
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
      // Main column = three full-width bands (white · grey · white); Bob is
      // the rail beside it. Each band is created once and reused.
      const band = (id, parent) => {
        let el = document.getElementById(id);
        if (!el){ el = document.createElement("div"); el.id = id; el.className = "bb-band"; }
        if (el.parentElement !== parent) parent.appendChild(el);
        return el;
      };
      let main = document.getElementById("bb-main");
      if (!main){ main = document.createElement("div"); main.id = "bb-main"; }
      if (main.parentElement !== row) row.insertBefore(main, row.firstChild);
      const bTop = band("bb-band-top", main);
      const bProgs = band("bb-band-progs", main);
      // Need Help sits in the top band, beside the pick-up card, so it's
      // visible without scrolling. Drop the old separate band if present.
      const oldHelpBand = document.getElementById("bb-band-help");
      if (oldHelpBand) oldHelpBand.remove();
      // Greeting
      let greet = document.getElementById("bb-greeting");
      if (!greet){ greet = document.createElement("h1"); greet.id = "bb-greeting"; }
      if (greet.parentElement !== bTop) bTop.insertBefore(greet, bTop.firstChild);
      const name = displayFirstName();
      const gt = name ? "Good to see you, " + name + "." : "Good to see you.";
      if (greet.textContent !== gt) greet.textContent = gt;
      // Top band, top to bottom: greeting, Accelerator, Need Help + Inner
      // Circle (one full-width row), then Pick up where you left off.
      let accel = document.getElementById("bb-accel");
      if (!accel){ accel = document.createElement("section"); accel.id = "bb-accel"; accel.hidden = true; }
      if (accel.previousElementSibling !== greet) greet.insertAdjacentElement("afterend", accel);
      renderAccel(accel);
      let helpCol = document.getElementById("bb-help-col");
      if (!helpCol || !helpCol.isConnected){
        helpCol = document.createElement("div"); helpCol.id = "bb-help-col";
      }
      if (helpCol.previousElementSibling !== accel) accel.insertAdjacentElement("afterend", helpCol);
      renderHelp(helpCol);
      let topGrid = document.getElementById("bb-top-grid");
      if (!topGrid){ topGrid = document.createElement("div"); topGrid.id = "bb-top-grid"; }
      if (topGrid.previousElementSibling !== helpCol) helpCol.insertAdjacentElement("afterend", topGrid);
      if (sec.parentElement !== topGrid) topGrid.insertBefore(sec, topGrid.firstChild);
      decoratePickup(sec);
      // Bob rail. Same node across rebuilds so the mounted widget survives.
      let right = document.getElementById("bb-right-col");
      if (!right || !right.isConnected){
        if (!bobCol){ bobCol = document.createElement("div"); bobCol.id = "bb-right-col"; }
        right = bobCol;
      }
      bobCol = right;
      let bobBox = right.querySelector("#bb-bob-box");
      if (!bobBox){
        right.textContent = "";
        bobBox = document.createElement("div"); bobBox.id = "bb-bob-box";
        right.appendChild(bobBox);
      }
      const host = ensureBobHost();
      if (host.parentElement !== bobBox){
        bobBox.textContent = "";
        host.removeAttribute("style");
        bobBox.appendChild(host);
      } else if (host.getAttribute("style")){
        host.removeAttribute("style");   // widget stamps height:560px on short hosts
      }
      if (right.parentElement !== row) row.appendChild(right);
      // Upcoming events, under Bob
      let evBox = right.querySelector("#bb-events");
      if (!evBox){ evBox = document.createElement("section"); evBox.id = "bb-events"; }
      if (evBox.previousElementSibling !== bobBox) bobBox.insertAdjacentElement("afterend", evBox);
      renderEvents(evBox);
      // Assigned Programs
      let panel = document.getElementById("bb-priority-courses");
      if (!panel){
        panel = document.createElement("section"); panel.id = "bb-priority-courses";
        const head = document.createElement("div"); head.className = "bb-pc-head";
        const h = document.createElement("h2"); h.textContent = "Assigned Programs";
        const cnt = document.createElement("span"); cnt.className = "bb-pc-count"; cnt.hidden = true;
        const all = document.createElement("a"); all.className = "bb-pc-all";
        all.href = "/courses/my-courses";
        all.innerHTML = 'View all programs <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
        all.addEventListener("click", e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          const rt = getRouter();
          if (rt && rt.push){ e.preventDefault(); rt.push("/courses/my-courses"); }
        });
        head.appendChild(h); head.appendChild(cnt); head.appendChild(all);
        panel.appendChild(head);
        const body = document.createElement("div"); body.className = "bb-pc-body";
        panel.appendChild(body);
      }
      if (panel.parentElement !== bProgs) bProgs.appendChild(panel);
      return panel;
    }
    /* Course images + descriptions from the portal's own library endpoint
       (the same one My Programs uses), with the signed-in user's token.
       A brand-new user's first answer can be empty or missing programs that
       were only just granted, so: only a non-empty answer is cached, and
       while any card still has no entry, injectCourses() asks again with a
       growing delay (3s, 6s, 12s … up to 8 tries). Failure just means cards
       without images until a retry succeeds. */
    const LIB_CACHE_KEY = "bb-course-lib3";
    let lib = null, libLoading = false, libVer = 0, libAt = 0, libTries = 0;
    function libInfo(c){
      if (!lib) return null;
      return lib[c.link.split('/').pop()] || lib['t:' + normalizeText(c.name)] || null;
    }
    function loadLibrary(refresh){
      if (libLoading) return;
      if (refresh){
        if (libTries >= 8 || Date.now() - libAt < 3000 * Math.pow(2, Math.max(0, libTries - 1))) return;
      } else {
        if (lib) return;
        try {
          const c = JSON.parse(sessionStorage.getItem(LIB_CACHE_KEY) || "null");
          if (c && Date.now() - c.ts < 30 * 60 * 1000 && Object.keys(c.map).length){ lib = c.map; libVer++; return; }
        } catch (e) {}
      }
      const st = getPiniaState();
      const tok = st && st.auth && st.auth.token;
      const loc = st && st.location && st.location.locationId;
      if (!tok || !loc) return;              // not hydrated yet; next tick retries
      libLoading = true;
      libTries++;
      fetch("https://services.leadconnectorhq.com/clientportal-middleware/courses/learners/locations/" + loc + "/courses/library", {
        headers: { Authorization: "Bearer " + tok, source: "PORTAL_USER", channel: "APP", version: "2021-07-28", "x-location-id": loc }
      }).then(r => r.ok ? r.json() : []).then(list => {
        // Some posters are a relative path; My Courses serves those from this host.
        const abs = (u) => /^https?:\/\//.test(u) ? u : "https://assetsdrm.clientclub.net/images/courses/gcs_revex-membership-production" + (u.charAt(0) === "/" ? "" : "/") + u + "?fmt=webp&qlt=90&rsz=fill";
        const map = {};
        (Array.isArray(list) ? list : []).forEach(p => {
          if (!p || !p.id) return;
          const info = { id: p.id, img: p.posterImage ? abs(p.posterImage) : "", desc: (p.description || "").trim() };
          map[p.id] = info;
          // also by title: another portal (e.g. the test one) has the same
          // programs under different ids
          const t = normalizeText(p.title || p.name || "");
          if (t && !map["t:" + t]) map["t:" + t] = info;
        });
        if (Object.keys(map).length || !lib) lib = map;   // never swap a good map for an empty one
        if (Object.keys(map).length){
          try { sessionStorage.setItem(LIB_CACHE_KEY, JSON.stringify({ ts: Date.now(), map })); } catch (e) {}
        }
      }).catch(() => { if (!lib) lib = {}; })
        .finally(() => { libLoading = false; libAt = Date.now(); libVer++; updateAll(); });
    }
    function injectCourses(){
      const panel = ensurePanelShell();
      if (!panel) return;
      loadLibrary();
      const body = panel.querySelector('.bb-pc-body');
      if (!state.loaded){
        if (panel.getAttribute('data-sig') !== '__loading'){
          body.innerHTML = ''; body.appendChild(makeSkeleton());
          panel.setAttribute('data-sig','__loading');
        }
        return;
      }
      const matched = (state.courseNames || []).map(n => byName.get(normalizeText(n))).filter(Boolean);
      // a card with no library entry yet -> ask again (throttled inside)
      if (lib && matched.some(c => !libInfo(c))) loadLibrary(true);
      const sig = (matched.length ? matched.map(m => normalizeText(m.name)).join('|') : '__empty') + '#lib' + libVer;
      if (panel.getAttribute('data-sig') === sig) return;
      panel.setAttribute('data-sig', sig);
      body.innerHTML = '';
      const cnt = panel.querySelector('.bb-pc-count');
      if (!matched.length){
        if (cnt) cnt.hidden = true;
        const p = document.createElement('div'); p.className = 'bb-pc-empty';
        p.textContent = 'No assigned programs yet.'; body.appendChild(p); return;
      }
      if (cnt){ cnt.textContent = matched.length + (matched.length === 1 ? ' program' : ' programs'); cnt.hidden = false; }
      const grid = document.createElement('div'); grid.className = 'bb-pg-grid';
      matched.forEach(c => {
        const id = c.link.split('/').pop();
        const info = libInfo(c) || {};
        // link on this portal, to its own copy of the program when found by title
        const card = document.createElement('a'); card.className = 'bb-pg-card';
        card.href = domain + '/courses/products/' + (info.id || id);
        const thumb = document.createElement('div'); thumb.className = 'bb-pg-thumb';
        if (info.img){
          const im = document.createElement('img'); im.src = info.img; im.alt = ''; im.loading = 'lazy';
          im.onerror = () => { im.remove(); thumb.classList.add('bb-pg-thumb--empty'); };
          thumb.appendChild(im);
        } else {
          thumb.classList.add('bb-pg-thumb--empty');
        }
        card.appendChild(thumb);
        const b = document.createElement('div'); b.className = 'bb-pg-body';
        const t = document.createElement('div'); t.className = 'bb-pg-title'; t.textContent = c.name;
        b.appendChild(t);
        const desc = info.desc || COURSE_DESCRIPTIONS[normalizeText(c.name)];
        if (desc){ const d = document.createElement('div'); d.className = 'bb-pg-desc'; d.textContent = desc; b.appendChild(d); }
        const btn = document.createElement('span'); btn.className = 'bb-pg-btn';
        btn.innerHTML = '<span>Go to program</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
        b.appendChild(btn);
        card.appendChild(b);
        grid.appendChild(card);
      });
      body.appendChild(grid);
      if (!panel.__clickWired){
        panel.__clickWired = true;
        // soft navigation inside the portal; modifier-clicks open a new tab as normal
        panel.addEventListener('click', e => {
          const c = e.target.closest('.bb-pg-card'); if (!c) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          const rt = getRouter();
          if (rt && rt.push){ e.preventDefault(); rt.push(new URL(c.href).pathname); }
        });
      }
    }
    /* ────────── run: non-blocking startup ────────── */
    const updateAll = debounceRaf(() => { buildMenu(); fixNavLabels(); fixNavIcons(); markActiveNav(); injectCourses(); syncRoadmapView(); openPendingEvent(); });

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
  /* ────────── Course-page marker (was: keep the left menu expanded) ──────────
     The portal collapses the sidebar two different ways:
       a) dashboard side  -> data-collapsible="icon" on the sidebar wrappers
       b) community side  -> .sidebar-collapsed on #cp-root-container, which
                             shrinks the --cp-sidebar-width variable
     (b) is handled entirely in CSS (see rule 6) so we never fight Vue over a
     class it owns. This script only handles (a), rAF-batched so the observer
     can't spin. */
  (function () {
    // Course pages have their own module/lesson menu, so the portal's full-width
    // sidebar next to it reads as two competing menus. On /courses/products/*
    // we stand down and let the portal keep its icon rail; everywhere else the
    // menu stays pinned open. The marker on <html> is what the CSS keys off.
    const onCourse = () => /^\/courses\/products\//.test(location.pathname);

    let queued = false;
    const force = () => {
      queued = false;
      const course = onCourse();
      document.documentElement.toggleAttribute('data-bb-course', course);
      // No longer forces the menu open: the portal's own collapse button and
      // automatic collapsing work as stock. Only the data-bb-course marker is
      // kept (harmless; other rules may key off it).
    };
    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(force); };
    force();
    new MutationObserver(schedule).observe(document.documentElement, {
      subtree: true, attributes: true, attributeFilter: ['data-collapsible']
    });
    // route changes don't touch data-collapsible, so the observer alone would
    // miss entering/leaving a course
    setInterval(schedule, 400);
    window.addEventListener('popstate', schedule);
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
    const PROGRAMS = 'My Programs';
    const onLesson = () => /^\/courses\/products\//.test(location.pathname);
    let queued = false;

    // Inside a course the "Courses" crumb is kept, renamed "My Programs", and
    // takes you back to the programs list.
    const goPrograms = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); e.stopPropagation();
      const el = document.querySelector('#__nuxt, #cp-root-container, #app, [data-v-app]');
      const rt = el && el.__vue_app__ && el.__vue_app__.config.globalProperties.$router;
      if (rt && rt.push) rt.push('/courses/my-courses'); else location.href = '/courses/my-courses';
    };

    const run = () => {
      queued = false;
      document.querySelectorAll('#cp-topbar-breadcrumb li').forEach(li => {
        const link = li.querySelector('.hr-breadcrumb-item__link');
        if (!link) return;
        const text = link.textContent.trim();
        const last = li === li.parentElement.lastElementChild;
        if (onLesson() && !last && (text === 'Courses' || text === PROGRAMS)){
          if (text !== PROGRAMS) link.textContent = PROGRAMS;
          li.style.display = '';
          link.classList.add('bb-crumb-link');
          // it's the last crumb shown on a course, so drop its trailing ">"
          const sep = li.querySelector('.hr-breadcrumb-item__separator');
          if (sep) sep.style.display = 'none';
          if (!link.__bbProgramsWired){ link.__bbProgramsWired = true; link.addEventListener('click', goPrograms, true); }
          return;
        }
        // On the programs list itself the current-page crumb reads "My courses"
        // on a fresh load but "Courses" after arriving from a lesson.
        if (last && /^\/courses\/my-courses/.test(location.pathname) && (text === 'Courses' || text === 'My courses')){
          link.textContent = PROGRAMS; li.style.display = ''; return;
        }
        if (text === PROGRAMS && !onLesson() && !last){ link.textContent = 'Courses'; link.classList.remove('bb-crumb-link'); }
        { const sep = li.querySelector('.hr-breadcrumb-item__separator'); if (sep && sep.style.display === 'none') sep.style.display = ''; }
        // On a course the breadcrumb is just "Remy's Portal > My Programs" —
        // the course name is already the big title under it.
        if (onLesson() && last){ li.style.display = 'none'; return; }
        // never hide the last crumb — that's the page you're actually on
        const hide = HIDE.includes(link.textContent.trim()) && !last;
        li.style.display = hide ? 'none' : '';
      });
    };

    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(run); };

    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  })();

/* ── block 4 ── */
  /* ────────── Dashboard + topbar tweaks ──────────
     1. Topbar "Dashboard"  ->  "{FirstName}’s Portal"
     2. Removes the "Welcome back, …" header line
     3. Removes the Finances section (invoices / estimates / contracts)
     4. Renames the last breadcrumb on the support-group pages, so the
        sidebar label and the page title agree (both routes live under the
        same community, so both would otherwise read "Support").
     Nodes are hidden rather than removed, because the portal re-renders them.
     Name comes from the same Pinia identity as block 1 (localStorage is gone). */
  (() => {
    if (window.__bbDashTweaks) return;
    window.__bbDashTweaks = true;

    // element id -> replacement label. Add a line per rename; the element
    // must hold text only (no child markup) or its children get wiped.
    const TEXT_RENAMES = {
      'continue-watching-section-heading': 'Pick up where you left off',
    };

    // path -> what the last breadcrumb should say instead.
    // Delete a line here to leave that page's crumb alone.
    const CRUMB_RENAMES = [
      // `from` lists every group display name we replace (test: Support, live: Services)
      { match: /^\/communities\/groups\/(support|services)\/events/, from: ['Support', 'Services'], to: 'Calendar' },
      { match: /^\/communities\/groups\/(support|services)\/about/,  from: ['Support', 'Services'], to: 'Contact'  },
    ];
    // Both routes live in the same community, so soft-navigating between them
    // reuses the breadcrumb node without re-rendering it — it still holds the
    // label we wrote on the previous page. Matching only on `from` ("Support")
    // would leave Contact reading "Calendar" forever, so treat every label we
    // might have written as replaceable too.
    const CRUMB_REPLACEABLE = new Set(CRUMB_RENAMES.flatMap(r => [].concat(r.from, r.to)));
    // Labels we ourselves write into the crumb. Needed for the cleanup below:
    // Vue keeps the crumb node when you soft-navigate to another section and
    // does NOT re-patch the text we replaced, so "Calendar" leaked onto
    // /courses/my-courses. Verified: hard-reloading that page gives the right
    // crumb, soft-navigating from Calendar does not.
    const CRUMB_WRITTEN = new Set(CRUMB_RENAMES.map(r => r.to));

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
        // "Home" is what the root crumb says on sub-pages; "Dashboard" is the
        // page's own crumb on /dashboard. Both should read the portal title.
        const t = el.textContent.trim();
        if (t === 'Dashboard' || t === 'Home' || t === 'My Portal') el.textContent = portalTitle();
      });
      if (location.pathname.replace(/\/+$/, '') === '/dashboard') {
        const t = portalTitle() + ' | Botbuilders';
        if (document.title !== t) document.title = t;
      }

      // 1a. Simple label renames, by element id.
      for (const [id, label] of Object.entries(TEXT_RENAMES)) {
        const el = document.getElementById(id);
        if (el && el.textContent.trim() !== label) el.textContent = label;
      }

      // 1b. Rename the last crumb on the mapped community routes.
      //     Only the last one — that's the page you're actually on.
      const rule = CRUMB_RENAMES.find(r => r.match.test(location.pathname));
      const crumbs = document.querySelectorAll('#cp-topbar-breadcrumb li');
      const last = crumbs[crumbs.length - 1];
      const lastLink = last && last.querySelector('.hr-breadcrumb-item__link');
      if (rule) {
        if (lastLink) {
          const cur = lastLink.textContent.trim();
          if (cur !== rule.to && CRUMB_REPLACEABLE.has(cur)) lastLink.textContent = rule.to;
        }
        const rt = rule.to + ' | Botbuilders';
        if (document.title !== rt) document.title = rt;
      } else if (lastLink) {
        // Off the mapped routes. If the crumb still shows a label we wrote,
        // it's stale — put the real one back. document.title is the portal's
        // own and stays current ("My courses | Botbuilders"), so it's a
        // reliable source for what the crumb should say.
        const cur = lastLink.textContent.trim();
        if (CRUMB_WRITTEN.has(cur)) {
          const fromTitle = (document.title.split('|')[0] || '').trim();
          if (fromTitle && fromTitle !== cur) lastLink.textContent = fromTitle;
        }
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

/* ── block 5 ── */
  /* ────────── Footer ──────────
     Appended to main.cp-main-content — the scroll container that wraps every
     page's content — and rebuilt if a route change drops it.
     Shown on the three routes in FOOTER_PATHS only; removed elsewhere, since
     the same <main> is reused across routes and the footer would otherwise
     follow you around after a soft navigation. */
  (() => {
    if (window.__bbFooter) return;
    window.__bbFooter = true;

    // File Share, Affiliates. Prefix matches, so sub-routes
    // (e.g. /affiliates/campaign) count too. Not the dashboard: its bands
    // and Bob rail run to the bottom of the page, and a footer under them
    // looked detached.
    const FOOTER_PATHS = [
      /^\/shared-files/,
      /^\/affiliates/,
    ];
    const showFooter = () => FOOTER_PATHS.some(re => re.test(location.pathname));

    /* Media-library asset, not a build artifact — this path is stable, unlike
       the hashed sprite filename that broke the nav icons. */
    const LOGO_URL  = 'https://assets.cdn.filesafe.space/QJ103qxfEO9Dj2mFP0BJ/media/6581a1d75567c08ee6ef6c05.png';
    const EMAIL     = 'support@botbuilders.com';
    const COPYRIGHT = '\u00A9BotBuilders. All rights reserved.';
    const LINKS = [
      ['Privacy Policy', 'https://www.botbuilders.com/privacy'],
      ['Terms Of Use',   'https://www.botbuilders.com/terms'],
    ];

    function build(){
      const f = document.createElement('footer');
      f.id = 'bb-footer';

      const img = document.createElement('img');
      img.src = LOGO_URL; img.alt = 'BotBuilders';
      f.appendChild(img);

      const mail = document.createElement('a');
      mail.href = 'mailto:' + EMAIL;
      mail.textContent = EMAIL;
      f.appendChild(mail);

      const copy = document.createElement('div');
      copy.textContent = COPYRIGHT;
      f.appendChild(copy);

      const links = document.createElement('div');
      links.className = 'bb-footer-links';
      LINKS.forEach(([label, href], i) => {
        if (i){
          const sep = document.createElement('span');
          sep.className = 'bb-footer-sep';
          sep.textContent = '|';
          links.appendChild(sep);
        }
        const a = document.createElement('a');
        a.href = href; a.textContent = label;
        a.target = '_blank'; a.rel = 'noopener noreferrer';
        links.appendChild(a);
      });
      f.appendChild(links);

      return f;
    }

    let queued = false;
    const run = () => {
      queued = false;
      const existing = document.getElementById('bb-footer');
      if (!showFooter()){
        if (existing) existing.remove();
        return;
      }
      const main = document.querySelector('main.cp-main-content');
      if (!main) return;
      let f = existing;
      if (!f || !f.isConnected) f = build();
      if (f.parentElement !== main) main.appendChild(f);
    };

    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(run); };
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(schedule, 400);
    window.addEventListener('popstate', schedule);
  })();

/* ── block 6 ── */
  /* ────────── Course code loader ──────────
     Loads dist/courses.css + dist/courses.js on lesson pages, so the
     per-course "Custom CSS / JS" fields are not needed. Same files, same
     tag as this bundle: window.BB_CDN is stamped by the build; when this
     file is pasted straight into the field it falls back to the URL of the
     portal.js <script> tag. courses.js has its own install guard, so a
     course that still carries the old field snippet just loads it twice.
     The stylesheet only applies on lesson pages (media toggle, see below)
     because a couple of its selectors (#brandLogo, the tab-row max-width)
     are not lesson-only.
     Verified: loading from here gives the same computed styles as the
     course-level field on every rule checked (topbar, grid, sidebar, card). */
  (() => {
    if (window.__bbCourseLoader) return;
    window.__bbCourseLoader = true;

    const onLesson = () => /^\/courses\/products\//.test(location.pathname);
    const cdn = () => {
      if (window.BB_CDN) return window.BB_CDN;
      const s = document.querySelector('script[src*="botbuilders-portal@"][src*="/dist/portal.js"]');
      return s ? s.src.replace(/\/[^/]*$/, '') : null;
    };

    /* The stylesheet is switched with `media`, NOT `disabled`. Setting
       disabled=true while the file is still downloading makes Chrome drop the
       request, and re-enabling never restarts it — on a slow connection the
       course CSS then never applied (half-built lesson until a refresh). With
       media="not all" the browser still downloads the file in full and simply
       doesn't apply it; flipping to "all" applies it instantly.
       Failed loads (network blip) are retried a few times. */
    let link = null, script = null, cssTries = 0, jsTries = 0;
    const MAX_TRIES = 4;
    const run = () => {
      const base = cdn();
      if (!base) return;
      const lesson = onLesson();
      if (!link && (lesson || cssTries === 0) && cssTries < MAX_TRIES){
        cssTries++;
        link = document.createElement('link');
        link.id = 'bb-courses-css';
        link.rel = 'stylesheet';
        link.href = base + '/courses.css';
        link.onerror = () => { if (link) link.remove(); link = null; };
        document.head.appendChild(link);
      }
      if (link){
        const want = lesson ? 'all' : 'not all';
        if (link.media !== want) link.media = want;
      }
      if (lesson && !script && !window.__bbCoursesInstalled && jsTries < MAX_TRIES){
        jsTries++;
        script = document.createElement('script');
        script.id = 'bb-courses-js';
        script.src = base + '/courses.js';
        script.onerror = () => { if (script) script.remove(); script = null; };
        document.head.appendChild(script);
      }
    };
    run();
    setInterval(run, 400);
    window.addEventListener('popstate', run);
  })();

/* ── block 7 ── */
  /* ────────── Community code loader ──────────
     Loads dist/communities.js on /communities/* routes. The Community
     "Custom JS" field is rendered inside the portal's app on community pages
     and, on some loads (e.g. the first one after sign-in), never executes —
     no support form, no Register Now redirect, no Week view. Loading it from
     here makes it independent of that field. Every block in communities.js
     has its own install guard, so the field loading it too is harmless. */
  (() => {
    if (window.__bbCommunityLoader) return;
    window.__bbCommunityLoader = true;
    const onCommunity = () => /^\/communities\//.test(location.pathname);
    let script = null, tries = 0;
    const run = () => {
      if (!onCommunity() || script || tries >= 4) return;
      if (window.__bbAboutSupportInstalled && window.__bbWeekViewInstalled && window.__bbEventsExtrasInstalled) return;
      const base = window.BB_CDN;
      if (!base) return;
      tries++;
      script = document.createElement('script');
      script.id = 'bb-communities-js';
      script.src = base + '/communities.js';
      script.onerror = () => { if (script) script.remove(); script = null; };
      document.head.appendChild(script);
    };
    run();
    setInterval(run, 400);
    window.addEventListener('popstate', run);
  })();

/* ── block 8 ── */
  /* ────────── Hover labels for the injected menu items ──────────
     With the sidebar collapsed to icons the portal shows each item's name in
     a tooltip, but it wires those when it renders — Calendar, Contact and
     Automator AI are added later by block 1, so they had none. This shows a
     look-alike (styled in portal.css §12) only while the menu is collapsed. */
  (() => {
    if (window.__bbNavTip) return;
    window.__bbNavTip = true;
    const SEL = '#custom-menu-calendar-link, #custom-menu-contact-link, #custom-menu-automator-link';
    let tip = null;
    const ensure = () => {
      if (tip && tip.isConnected) return tip;
      tip = document.createElement('div');
      tip.id = 'bb-nav-tip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
      return tip;
    };
    const hide = () => { if (tip) tip.classList.remove('bb-show'); };
    document.addEventListener('mouseover', (e) => {
      const a = e.target.closest && e.target.closest(SEL);
      if (!a) return;
      const r = a.getBoundingClientRect();
      if (r.width > 64) { hide(); return; }          // menu expanded: label is already visible
      const label = ((a.querySelector('span') || {}).textContent || '').trim();
      if (!label) return;
      const t = ensure();
      t.textContent = label;
      t.style.left = (r.right + 10) + 'px';
      t.style.top = (r.top + r.height / 2) + 'px';
      t.classList.add('bb-show');
    });
    document.addEventListener('mouseout', (e) => {
      const a = e.target.closest && e.target.closest(SEL);
      if (a && !(e.relatedTarget && a.contains(e.relatedTarget))) hide();
    });
    window.addEventListener('scroll', hide, true);
    document.addEventListener('click', hide, true);
    window.addEventListener('popstate', hide);

    // The portal's own hover label for the Courses item still says "Courses"
    // (it reads the original name). Rename it to "Programs" as it appears.
    let tq = false;
    const renameTips = () => {
      tq = false;
      document.querySelectorAll('.cp-portal-sidebar__tooltip-content, .hr-tooltip__content').forEach(el => {
        if (el.childElementCount === 0 && el.textContent.trim() === 'Courses') el.textContent = 'Programs';
      });
    };
    new MutationObserver(() => { if (!tq) { tq = true; requestAnimationFrame(renameTips); } })
      .observe(document.body, { childList: true, subtree: true, characterData: true });
  })();

/* ── block 9 ── */
  /* ────────── Affiliates: "Become an affiliate" sign-up banner ──────────
     A slim banner above the Affiliates tab bar (Campaigns, Sub Affiliates,
     Leads / Customers…), on every /affiliates/* page, linking to the
     affiliate sign-up. Styled in portal.css §13. */
  (() => {
    if (window.__bbAffCta) return;
    window.__bbAffCta = true;
    const SIGNUP_URL = 'https://affiliate.botbuilders.com/sign-up';
    const onAff = () => /^\/affiliates(\/|$)/.test(location.pathname);
    const build = () => {
      const b = document.createElement('div');
      b.id = 'bb-aff-cta';
      b.innerHTML =
        '<div class="bb-aff-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg></div>' +
        '<div class="bb-aff-text"><div class="bb-aff-title">Become a BotBuilders affiliate</div>' +
        '<div class="bb-aff-sub">Sign up to get your referral links and start earning commissions.</div></div>' +
        '<a class="bb-aff-btn" target="_blank" rel="noopener noreferrer">Sign up</a>';
      b.querySelector('.bb-aff-btn').href = SIGNUP_URL;
      return b;
    };
    let queued = false;
    const run = () => {
      queued = false;
      const existing = document.getElementById('bb-aff-cta');
      if (!onAff()) { if (existing) existing.remove(); return; }
      const tabs = document.querySelector('.affiliates-nav-tabs');
      const host = tabs && tabs.parentElement;
      if (!host) return;
      const cta = existing || build();
      if (cta.parentElement !== host || host.firstElementChild !== cta) host.insertBefore(cta, host.firstElementChild);
    };
    const schedule = () => { if (queued) return; queued = true; requestAnimationFrame(run); };
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    setInterval(schedule, 600);
    window.addEventListener('popstate', schedule);
  })();

/* ── block 10 ── */
  /* ────────── "Programs" wording ──────────
     The portal says "courses" in a few places we don't build ourselves:
     the My courses breadcrumb + tab title, and the "Search courses..." box
     (course list and lesson pages). Rewrite them as they render. */
  (() => {
    if (window.__bbProgramsWording) return;
    window.__bbProgramsWording = true;
    const SWAP = [[/^My courses$/i, 'My Programs'], [/^Search courses\.\.\.$/i, 'Search programs...']];
    const swap = (txt) => { for (const [re, to] of SWAP) if (re.test(txt)) return to; return null; };
    let q = false;
    const run = () => {
      q = false;
      document.querySelectorAll('.hr-breadcrumb-item__link, .hr-input__placeholder span, .hr-input__placeholder').forEach(el => {
        if (el.childElementCount) return;
        const to = swap(el.textContent.trim());
        if (to && el.textContent !== to) el.textContent = to;
      });
      document.querySelectorAll('input[placeholder]').forEach(i => { const to = swap(i.placeholder.trim()); if (to) i.placeholder = to; });
      if (/^My courses\b/i.test(document.title)) document.title = document.title.replace(/^My courses/i, 'My Programs');
    };
    const schedule = () => { if (!q) { q = true; requestAnimationFrame(run); } };
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    new MutationObserver(schedule).observe(document.querySelector('title') || document.head, { childList: true, subtree: true, characterData: true });
  })();

}
