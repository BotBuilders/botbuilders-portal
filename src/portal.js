<script>
  (() => {
    const domain = window.location.origin;
    /* Fallback only. The real sprite path is read off the cloned icon at run
       time — the filename carries a build hash that changes on every portal
       deploy, which is what silently blanked the injected icons once already. */
    const SPRITE = "/_nuxt-clientportal/nuxt-svg-icon-sprite/sprite-sidebar.svg";
    // Classes the portal puts on the ACTIVE nav link. Stripped from clones,
    // otherwise every added item inherits the highlighted Courses styling.
    const ACTIVE_LINK_CLASSES = ["router-link-active", "router-link-exact-active", "bg-primary", "text-on-primary", "active", "cp-portal-nav-item__link--active"];
    /* ────────── helpers ────────── */
    function safeJsonParse(raw){ try { return JSON.parse(raw); } catch { return null; } }
    function normalizeText(s){ return (s||"").toString().trim().replace(/^["“”']+|["“”']+$/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
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
      'cp-portal-sidebar-nav-courses':    'Courses',
      'cp-portal-sidebar-nav-affiliates': 'Affiliates',
      'cp-portal-sidebar-nav-documents':  'File Share',
    };
    /* Our injected items are plain <a>s, not Vue <router-link>s, so the portal
       never adds its active classes to them — Calendar and Contact stayed
       unhighlighted while every built-in item turned blue. Paint them from the
       path instead. (Automator AI is external; it is never "current".) */
    const NAV_ACTIVE_PATHS = {
      'custom-menu-calendar-link': /^\/communities\/groups\/support\/events/,
      'custom-menu-contact-link':  /^\/communities\/groups\/support\/about/,
    };
    function markActiveNav(){
      for (const [id, re] of Object.entries(NAV_ACTIVE_PATHS)){
        const a = document.getElementById(id);
        if (!a) continue;
        const on = re.test(location.pathname);
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
      add('Calendar', domain + '/communities/groups/support/events', 'custom-menu-calendar', 'appointments', false, '/communities/groups/support/events');
      add('Contact',  domain + '/communities/groups/support/about',  'custom-menu-contact',  'explore',      false, '/communities/groups/support/about');
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
       Host must be >= 240px (INLINE_MIN_HOST_PX); widget defaults to 560px.

       SIZING IS NOT DONE HERE. The parking style below is inline only because
       it has to beat widget.js to the punch. Once the host is placed, the
       inline style is REMOVED so the stylesheet owns the size:
         #bb-right-col                    { position: relative; min-height: 600px }
         #bb-right-col > [data-bob-embed] { position: absolute; inset: 0 }
       A fixed inline height here would pin the panel to that number and leave
       dead space whenever the left "continue watching" card is taller. */
    const BOB_EMBED_HEIGHT = "600px";    // parked size + the CSS floor. Not the rendered height.
    const BOB_PARK_STYLE   = "position:absolute;left:-10000px;top:0;width:400px;height:" + BOB_EMBED_HEIGHT + ";";
    const onDashboard = () => location.pathname.replace(/\/+$/, "") === "/dashboard";
    /* Lesson pages embed Bob too — the course-level custom JS positions it, but
       the HOST and the loader are owned here, because the widget looks for its
       host once at init and the course box can't reliably beat it. */
    const onLesson    = () => /^\/courses\/products\//.test(location.pathname);
    const needsBob    = () => onDashboard() || onLesson();
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

      const card = document.createElement("section");
      card.id = "bb-help-card";
      card.className = "rounded-xl bg-background p-4 border border-solid border-default shadow-sm";

      const h = document.createElement("h2");
      h.className = "hr-text hr-text-2xl hr-text-semibold text-700";
      h.textContent = "Need Help?";
      card.appendChild(h);

      const body = document.createElement("p");
      body.className = "bb-help-body hr-text text-600";
      body.textContent = HELP_BLURB;
      card.appendChild(body);

      // Stat tiles only render when the location actually has those fields.
      if (state.billingResetDate || state.creditsAvailable){
        const stats = document.createElement("div");
        stats.className = "bb-help-stats";
        const tile = (label, value) => {
          const t = document.createElement("div"); t.className = "bb-help-stat";
          const l = document.createElement("div"); l.className = "bb-help-stat-label"; l.textContent = label;
          const v = document.createElement("div"); v.className = "bb-help-stat-value"; v.textContent = value;
          t.appendChild(l); t.appendChild(v); return t;
        };
        if (state.billingResetDate) stats.appendChild(tile("Billing Reset Date", state.billingResetDate));
        if (state.creditsAvailable) stats.appendChild(tile("Minutes Available", state.creditsAvailable));
        card.appendChild(stats);
      }

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
    // Ensures the row wrapper + top-row (continue-watching + Bob) + panel below exist (instant, no API needed)
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
        host.removeAttribute("style");   // un-park it; the stylesheet owns the size from here
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
        // Heading spacing lives in the stylesheet: #bb-priority-courses h2
        h.textContent = "Assigned Courses";
        panel.appendChild(h);
        const body = document.createElement("div"); body.className = "bb-pc-body";
        panel.appendChild(body);
      }
      // Bottom row: Need Help (left, 1/3) + Assigned Courses (right, 2/3).
      // When the viewer isn't tagged, renderHelp() hides the column and the
      // courses panel takes the full width on its own.
      let bottomRow = document.getElementById("bb-bottom-row");
      if (!bottomRow || !bottomRow.isConnected){
        bottomRow = document.createElement("div"); bottomRow.id = "bb-bottom-row";
      }
      if (bottomRow.parentElement !== row) row.appendChild(bottomRow);

      let helpCol = document.getElementById("bb-help-col");
      if (!helpCol || !helpCol.isConnected){
        helpCol = document.createElement("div"); helpCol.id = "bb-help-col";
      }
      if (helpCol.parentElement !== bottomRow) bottomRow.insertBefore(helpCol, bottomRow.firstChild);
      renderHelp(helpCol);

      if (panel.parentElement !== bottomRow) bottomRow.appendChild(panel);
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
        // title + optional blurb stack on the left, button stays right
        const text = document.createElement('div'); text.className = 'bb-course-text';
        const t = document.createElement('span'); t.className = 'hr-text hr-text-lg text-700 bb-course-title'; t.textContent = c.name;
        text.appendChild(t);
        const desc = COURSE_DESCRIPTIONS[normalizeText(c.name)];
        if (desc){
          const d = document.createElement('div'); d.className = 'bb-course-desc hr-text text-600';
          d.textContent = desc; text.appendChild(d);
        }
        const b = document.createElement('button'); b.type = 'button'; b.className = 'bb-course-btn';
        b.textContent = 'Go to Course'; b.dataset.link = c.link;
        card.appendChild(text); card.appendChild(b); list.appendChild(card);
      });
      body.appendChild(list);
      if (!panel.__clickWired){
        panel.__clickWired = true;
        panel.addEventListener('click', e => { const b = e.target.closest('.bb-course-btn'); if (b) window.location.href = b.dataset.link; });
      }
    }
    /* ────────── run: non-blocking startup ────────── */
    const updateAll = debounceRaf(() => { buildMenu(); fixNavLabels(); fixNavIcons(); markActiveNav(); injectCourses(); });

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
</script>

<script>
  /* ────────── Keep the left menu expanded ──────────
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
      if (course) return;
      document.querySelectorAll('[data-collapsible="icon"]')
        .forEach(el => el.setAttribute('data-collapsible', 'content'));
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
</script>

<script>
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
</script>

<script>
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
      { match: /^\/communities\/groups\/support\/events/, from: 'Support', to: 'Calendar' },
      { match: /^\/communities\/groups\/support\/about/,  from: 'Support', to: 'Contact'  },
    ];
    // Both routes live in the same community, so soft-navigating between them
    // reuses the breadcrumb node without re-rendering it — it still holds the
    // label we wrote on the previous page. Matching only on `from` ("Support")
    // would leave Contact reading "Calendar" forever, so treat every label we
    // might have written as replaceable too.
    const CRUMB_REPLACEABLE = new Set(CRUMB_RENAMES.flatMap(r => [r.from, r.to]));
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
</script>

<script>
  /* ────────── Footer ──────────
     Appended to main.cp-main-content — the scroll container that wraps every
     page's content — and rebuilt if a route change drops it.
     Shown on the four routes in FOOTER_PATHS only; removed elsewhere, since
     the same <main> is reused across routes and the footer would otherwise
     follow you around after a soft navigation. */
  (() => {
    if (window.__bbFooter) return;
    window.__bbFooter = true;

    // Dashboard, Contact, File Share, Affiliates. Prefix matches, so
    // sub-routes (e.g. /affiliates/campaign) count too.
    const FOOTER_PATHS = [
      /^\/dashboard\/?$/,
      /^\/communities\/groups\/support\/about/,
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
</script>
