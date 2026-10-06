# Botbuilders Client Portal — customization context

**Read this first.** It exists so a new chat (or a new person) can pick up the work
without re-deriving everything. Attach this file plus `custom-js.html` and
`custom-css.css` to the conversation and you're caught up.

---

## 1. What this is

The Botbuilders client portal runs on ClientClub (HighLevel). It's a Nuxt/Vue SPA.
There is **no source repo** — every customization lives in two settings fields in
the portal admin:

| Field | File here | Contents |
|---|---|---|
| Custom JS | `custom-js.html` | 4 `<script>` blocks |
| Custom CSS | `custom-css.css` | 9 numbered sections |

Both files are **full replacements** for their field. Paste over everything.

Live URL: `https://ytbwqmaimh8jlryngydm.app.clientclub.net`
(the client-facing domain is `portal.botbuilders.com`)

---

## 2. The one thing that matters most

**Everything here depends on the portal's DOM, which the vendor changes without
notice.** This has already broken things twice:

1. **`localStorage["common"]` disappeared.** It used to hold the logged-in user.
   The portal migrated away from it (it now sets a `clientportal:migrationGuard`
   flag in sessionStorage). `localStorage` is now completely empty. Every
   identity lookup silently returned `""` and the assigned-courses panel went blank.
2. **The sidebar markup was rebuilt.** `div.items-container >
   div.selectable-list-item > a.cp-portal-nav-item__link` became
   `section.app-sidebar-group > ul > li.app-sidebar-nav-item >
   a.app-sidebar-nav-item__link`. The menu-building function bailed on its first
   line, so Calendar / Contact / Automator AI vanished and Courses stopped
   redirecting. Two CSS rules died with it. Around the same time the root
   breadcrumb label changed from "Dashboard" to "Home".

**Rule of thumb: prefer ids over classes.** Ids survived both rebuilds; classes
did not. Where a class is unavoidable, note it in a comment so the next failure
is quick to find.

**Symptom → first thing to check:** if a customization silently does nothing,
one of its selectors now matches zero elements. Run the diagnostics in §6.

---

## 3. Who the user is (identity)

Source of truth is the **Pinia store**, not localStorage:

```js
const st = document.querySelector('#__nuxt').__vue_app__
             .config.globalProperties.$pinia.state.value;

st['current-user'].profile  // { _id, contactId, email, fullName, slug, ... }
st.auth                     // { contactId, userId, isAuthenticated, status, ... }
```

Exposed by block 1 as `window.bbGetIdentity()` → `{ email, contactId, fullName }`,
with the old localStorage lookup kept as a fallback for older portal builds.

**It hydrates a beat after first paint**, so anything reading it must tolerate a
brief empty window. Block 1 handles this with `maybeRefetch()` on a 400ms tick
(fires the moment identity appears, and again if it ever changes) plus a 15s
timeout so the loading skeleton can't spin forever.

Test account (Remy): `remy+1@botbuilders.com`, contactId `20Os9gVMgXDuPgr56p0o`.
Note the **`+1` alias** — tagging `remy@botbuilders.com` in the CRM does nothing
for this login; it's a different contact record.

---

## 4. The data call

One webhook, called once per identity, powering both the courses panel and the
Need Help card:

```
POST https://connect.botbuilders.cloud/webhook/1360de3a-1206-4a2c-8175-56219ea1623b
body: { email, contact_id }
```

Returns (array or object — both shapes handled):

```
root.fields[]      ~203 custom fields for this location
root.tags[]        contact tags
root.email, root.first_name, root.last_name, root.automator_user
```

Field ids in use:

| Id | Meaning |
|---|---|
| `dBmTaHpIJPyy2vCwD1wT` | Assigned courses (array of names) |
| `UNJyx3fzPSZDtSvvQQI8` | Billing Reset Date |
| `T1otPJDLzM2KPuVBqpjU` | Credits / Minutes Available |

Course names are matched against `COURSE_MAP` in block 1 (name → product UUID),
normalized (trim, collapse whitespace, lowercase, strip quotes). A course missing
from that map simply won't render — add it there.

---

## 5. What the code does

### custom-js.html

**Block 1 — sidebar + assigned courses + Need Help.** The big one.
- `getIdentity()` / `window.bbGetIdentity()` — see §3.
- `buildMenu()` — rewrites Courses to `/courses/my-courses`, then clones the
  Courses `<li>` to add **Calendar**, **Contact**, **Automator AI**. Anchors off
  `#cp-portal-sidebar-nav-courses`. Strips `ACTIVE_LINK_CLASSES` from clones.
- `fixNavLabels()` — re-asserts labels by id. The portal **blanks its own label
  spans on community pages** (Courses and Affiliates render with empty text), so
  these have to be rewritten every tick. This is also where Shared files → File
  Share happens.
- `markActiveNav()` — the injected items are plain `<a>`s, not Vue
  `<router-link>`s, so the portal never marks them current. Toggles `bg-primary`
  by path. Paired with a CSS rule forcing white text (see below).
- `ensurePanelShell()` — builds the dashboard layout: `#custom-cw-row` →
  `#bb-top-row` (continue-watching + `#bb-right-col` for Bob) and
  `#bb-bottom-row` (`#bb-help-col` + `#bb-priority-courses`). Caches node
  references so dashboard re-renders don't destroy what's mounted inside.
- `renderHelp()` — the Need Help card, gated on tags (see §7).
- Runs `updateAll()` on a MutationObserver, the router's `afterEach`, and a
  400ms `tick()`.

**Block 2** — keeps the sidebar expanded (`data-collapsible` attribute).
**Block 3** — hides Courses / Communities from the breadcrumb (text-matched;
never hides the last crumb).
**Block 4 — dashboard + topbar tweaks.**
- `TEXT_RENAMES` — id → label map. Currently the continue-watching heading.
- `CRUMB_RENAMES` — path → last-crumb label (Calendar / Contact). Both routes are
  in the same community, so soft-navigating between them **reuses the crumb node
  without re-rendering it** — hence `CRUMB_REPLACEABLE`, which treats any label we
  might have written as replaceable. Matching only on "Support" left Contact
  reading "Calendar" forever.
- Portal title: `Dashboard` / `Home` / `My Portal` → `{FirstName}'s Portal`.
- Hides the welcome line and the Finances section.

### custom-css.css

Nine sections, each headed. The non-obvious ones carry comments explaining *why*,
because all three look arbitrary and are easy to "simplify" back into bugs:

- **`flex: 2 1 0` not percentages.** With a 16px gap, percentage bases overflow
  the row and get shrunk back unevenly. A zero basis splits what's left after the
  gap, giving a true 2:1.
- **`position: absolute; inset: 0` for the Bob host, not `flex:1` or
  `min-height`.** `.bob-panel` sizes itself with `height:100%`, which only
  resolves against a parent with a *definite* height. The other two aren't
  definite and the panel collapses to ~180px.
- **The mobile media query must stay last.** It has the same specificity as the
  2:1 rules; when it sat higher in the file, `flex: 2 1 0` won on phones and the
  stacked columns sized off a zero basis.
- **`#custom-menu-*-link.bg-primary { color: #fff !important }`.** `bg-primary`
  alone gives a blue pill with dark text and a dark icon; the portal's own color
  rule wins otherwise. Adding `router-link-active` does *not* help.

---

## 6. Diagnostics

Paste into the browser console on the portal.

**Who does the portal think I am**
```js
(() => {
  const st = document.querySelector('#__nuxt').__vue_app__.config.globalProperties.$pinia.state.value;
  console.log(st['current-user'].profile, st.auth.contactId, st.auth.status);
})()
```

**What does the webhook return for me**
```js
(async () => {
  const id = window.bbGetIdentity();
  const r = await fetch('https://connect.botbuilders.cloud/webhook/1360de3a-1206-4a2c-8175-56219ea1623b',
    { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email: id.email, contact_id: id.contactId }) });
  const d = await r.json(); const root = Array.isArray(d) ? d[0] : d;
  console.log({ tags: root.tags, email: root.email, fields: root.fields.length });
})()
```

**Are my selectors still alive** (zero on any of these = something moved)
```js
['.app-sidebar-nav-item','.app-sidebar-group','#cp-portal-sidebar-nav-courses',
 '#cp-topbar-breadcrumb','#continue-watching-section-root','#dashboard-page-root',
 '#dashboard-welcome-root','#dashboard-billings-section','.items-container']
  .forEach(s => console.log(s, document.querySelectorAll(s).length));
```
(`.items-container` is expected to be 0 in the sidebar but **non-zero on
`/account`** — that page still uses the old markup.)

**Is the dashboard shell built**
```js
['custom-cw-row','bb-top-row','bb-right-col','bb-bottom-row','bb-help-col','bb-priority-courses']
  .forEach(id => console.log(id, !!document.getElementById(id)));
```

**Is Bob inline**
```js
console.log(window.BOB?.isInline(), window.BOB?.visibility(),
            document.querySelectorAll('[data-bob-embed]').length);
```

---

## 7. Gotchas worth remembering

**Need Help is tag-gated.** `HELP_TAGS = ["global - test tag", "inner circle - active"]`,
any-of, exact match after trim + lowercase. `purchased - global buyer tag` looks
similar and does **not** qualify. If the card doesn't appear, check the tags on
the contact before touching code.

**The Bob widget must find its host before it initializes.** It looks for
`[data-bob-embed], #bob-embed` **once**, at init, with no MutationObserver — if
the host isn't there yet it falls back to a floating panel and never reconsiders.
The dashboard column doesn't exist until Vue renders, far too late. So block 1
creates the host immediately, parked off-screen on `<body>`, and moves it into
`#bb-right-col` once the shell is built. Moving a mounted host is safe (plain
divs, no iframe). Host must be ≥ 240px (`INLINE_MIN_HOST_PX`); the widget
defaults to 560px if you give it no height.

**Two widget builds exist.** `selfhelp.ai/widget.js?t=bk_…` supports
`data-bob-embed`; the older `bob.botbuilders.cloud/widget.js` does not. The
loader lives in the portal's header code, not in these files.

**There was a dead `http://localhost:3000/widget.js` tag** in the header code —
plain http on an https page, blocked as mixed content, never ran. Check it's gone.

**Bob's visibility is configured per path** in the selfhelp admin. It returns
`"public"` on `/dashboard` and `"authorized"` on `/courses/my-courses`, where
nothing renders. That's config, not a bug in this code.

**`/account` still uses the old markup.** Its rail rules intentionally use
`.selectable-list-item`. Don't "fix" them to match the sidebar.

**Hiding a nav item doesn't block the route.** `/account/notifications` etc. still
load if typed or bookmarked. Would need a JS guard if that matters.

---

## 8. Change log

| Change | Where |
|---|---|
| Topbar → `{FirstName}'s Portal`, welcome line removed, Finances hidden | block 4 |
| Priority Courses → Assigned Courses | block 1 |
| Identity moved from localStorage to Pinia | block 1 |
| Bob embedded inline on the dashboard (1/3 of the top row) | block 1 + CSS 2–3 |
| Heading spacing, Bob sizing moved from inline JS styles to CSS | CSS 2, 5 |
| Account Settings rail trimmed to Profile + Account | CSS 1 |
| Sidebar logo highlights blue on the dashboard | CSS 7 |
| Support → Calendar / Contact in the breadcrumb | block 4 |
| "Pick where you left off" → "Pick up where you left off" | block 4 |
| Need Help card ported from the old portal, 1/3 on the right | block 1 + CSS 6 |
| Sidebar rebuild fixes (menu, labels, active state, Home crumb) | block 1, 4 + CSS 1 |

---

## 9. Open items

- Remy's contact has neither Need Help tag by default — add `global - test tag`
  to contact `20Os9gVMgXDuPgr56p0o` to see the card.
- `order: 2` puts Need Help on the right visually, but the DOM order is still
  help-first, so tab order hits it before the courses panel. Fix by moving the
  append in `ensurePanelShell()` if it matters.
- The stat tiles only render when those two field ids have values. They were
  absent on this location at one point and present later — worth confirming
  they're populated for real Inner Circle contacts.
