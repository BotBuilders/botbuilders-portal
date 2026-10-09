window.BB_VERSION = '1.0.9 · 2026-10-10';
window.BB_BUILDS = Object.assign(window.BB_BUILDS || {}, { courses: '1.0.9 · 2026-10-10' });
window.BB_CDN = 'https://cdn.jsdelivr.net/gh/BotBuilders/botbuilders-portal@v1.0.9/dist';
/* botbuilders-portal · courses.js · built from src/courses.js (1 script block) */

/* ── block 1 ── */
try {(() => {

  // Loaded by the course-loader block in portal.js on lesson pages. A course
  // that still carries the old per-course field snippet loads this twice —
  // the guard makes the second copy a no-op.
  if (window.__bbCoursesInstalled) return;
  window.__bbCoursesInstalled = true;

  const TOTAL_SEGMENTS = 10;

  // Lesson pages only. The portal injects this field's script the first time a
  // lesson opens, and it then stays alive for the rest of the SPA session — so
  // every function below also runs on the dashboard unless it is gated here.
  // Without the gate, buildBotCol() pulled the shared Bob element into
  // #bb-bot-host (which is hidden off lesson pages) on every DOM change and
  // fought the portal script for it: Bob vanished from the dashboard after
  // visiting any lesson.
  const onLesson = () => /^\/courses\/products\//.test(location.pathname);

  function computeProgress(){
    const lessons=[...document.querySelectorAll('a.postqueue-lesson')];
    const total=lessons.length||0;
    let completed=0;
    lessons.forEach(l=>{ const img=l.querySelector('img'); if(img && /complet/i.test(img.alt||'')) completed++; });
    return { total, completed, pct: total?Math.round(completed/total*100):0 };
  }

  // Measures the portal header height so the lesson layout fills exactly the rest of the screen
  function setShellTop(){
    const m=document.getElementById('cp-main-content');
    if(m) document.documentElement.style.setProperty('--bb-shell-top', Math.round(m.getBoundingClientRect().top)+'px');
  }

  // Remove the portal's centred 1730px max-width (gaps left & right) on lesson pages.
  // Done in JS because the portal scopes Custom CSS under .membership-preview-remote,
  // and this wrapper sits ABOVE that scope, so CSS can't reach it.
  function setFullWidth(){
    const inner=document.querySelector('.cp-main-content-inner');
    if(!inner) return;
    if(document.getElementById('post-details-container')){
      inner.style.setProperty('max-width','none','important');
      inner.style.setProperty('width','100%','important');
      inner.style.setProperty('margin-left','0','important');
      inner.style.setProperty('margin-right','0','important');
    } else {
      ['max-width','width','margin-left','margin-right'].forEach(p=>inner.style.removeProperty(p));
    }
  }

  function buildTopBar(){
    const container=document.getElementById('post-details-container');
    if(!container) return;
    const courseName=(document.querySelector('.breadCrumb__nav')?.textContent||'Course').trim();
    const {total,completed,pct}=computeProgress();
    let bar=document.getElementById('bb-topbar');
    if(!bar){ bar=document.createElement('div'); bar.id='bb-topbar'; container.insertBefore(bar, container.firstChild); }

    // left: course name (build once, update text only)
    let left=bar.querySelector('.bb-course-left');
    if(!left){
      left=document.createElement('div');
      left.className='bb-course-left';
      left.innerHTML = `<div class="eyebrow">Course</div><div class="cname"></div>`;
      bar.appendChild(left);
    }
    const cname=left.querySelector('.cname');
    if(cname.textContent!==courseName) cname.textContent=courseName;

    // right: REUSE the existing native progress bar (no duplicate)
    let wrap=bar.querySelector('.bb-progress-wrap');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='bb-progress-wrap';
      bar.appendChild(wrap);
    }
    const color=document.querySelector('.lesson-progress__color');
    const track=color?color.closest('.progress'):null;
    if(track){
      track.classList.add('bb-native-track');
      if(!wrap.contains(track)) wrap.insertBefore(track, wrap.firstChild);
    }
    let pctEl=wrap.querySelector('.bb-pct');
    if(!pctEl){ pctEl=document.createElement('div'); pctEl.className='bb-pct'; wrap.appendChild(pctEl); }
    let dot=wrap.querySelector('.bb-dot');
    if(!dot){ dot=document.createElement('span'); dot.className='bb-dot'; dot.textContent='·'; wrap.appendChild(dot); }
    let countEl=wrap.querySelector('.bb-count');
    if(!countEl){ countEl=document.createElement('div'); countEl.className='bb-count'; wrap.appendChild(countEl); }
    const pctTxt=pct+'%';
    const cntTxt=completed+' / '+total+' lessons';
    if(pctEl.textContent!==pctTxt) pctEl.textContent=pctTxt;
    if(countEl.textContent!==cntTxt) countEl.textContent=cntTxt;
  }

  function buildRightCol(){
    const RIGHT_BANNERS = [
      { href: "https://qj103qxfeo9dj2mfp0bj.memberships.msgsndr.com/library-v2",
        src:  "https://d11n7da8rpqbjy.cloudfront.net/botbuilders/9069356_1586649220235800px_BotBuilders_Command_Center_Button.png" },
      { href: "https://link.automator.ai/widget/booking/ZvIBEyXRlcTAWBFRC7Ex",
        src:  "https://d11n7da8rpqbjy.cloudfront.net/botbuilders/1322345918473Hire_Us_copy.png" }
    ];
    const grid = document.querySelector('.grid.grid-cols-12');
    if(!grid) return;
    let col = document.getElementById('bb-course-banners');
    if(!col){ col = document.createElement('div'); col.id = 'bb-course-banners'; grid.appendChild(col); }
    if(col.dataset.built) return;            // build once
    let html = '';
    RIGHT_BANNERS.forEach(function(b){
      html += '<a class="bb-banner" href="'+b.href+'" target="_blank" rel="noopener"><img src="'+b.src+'" alt="" /></a>';
    });
    col.innerHTML = html;
    col.dataset.built = '1';
  }

  function buildLessonHead(){
    const main=document.querySelector('.main-section');
    if(!main) return;
    const active=document.querySelector('a.postqueue-lesson.post-highlight .custom-word-break');
    const titleText=(active?.textContent||document.querySelector('.breadCrumb__nav')?.textContent||'Lesson').trim();
    const activeLink=document.querySelector('a.postqueue-lesson.post-highlight');
    let eyebrow='';
    if(activeLink){
      const nodes=[...document.querySelectorAll('.category-title.postqueue-category, a.postqueue-lesson')];
      const idx=nodes.indexOf(activeLink);
      for(let i=idx;i>=0;i--){ if(nodes[i].classList.contains('category-title')){ eyebrow=nodes[i].textContent.trim(); break; } }
    }
    eyebrow=eyebrow.replace(/^[\-\+− \s]+/,'').trim();

    let head=document.getElementById('bb-lesson-head');
    if(!head){ head=document.createElement('div'); head.id='bb-lesson-head'; main.insertBefore(head, main.firstChild); }
    if(!head.querySelector('.bb-title-block')){
      head.innerHTML = `<div class="bb-title-block"><div class="bb-eyebrow"></div><h1 class="bb-title"></h1></div>`;
    }
    const ey=head.querySelector('.bb-eyebrow');
    if(ey.textContent!==eyebrow) ey.textContent=eyebrow;
    ey.style.display=eyebrow?'block':'none';
    const titleEl=head.querySelector('.bb-title');
    if(titleEl.textContent!==titleText) titleEl.textContent=titleText;

    // ---- Mark As Complete + Next Lesson sit together in #bb-mark-slot (flex row) ----
    let slot=document.getElementById('bb-mark-slot');
    if(!slot){ slot=document.createElement('div'); slot.id='bb-mark-slot'; head.insertAdjacentElement('afterend', slot); }

    // The native completion button keeps id="post-completion-btn" in both states.
    // When the SPA re-renders it creates a NEW button while the moved one stays
    // orphaned -> drop stale slot copies and always move the current one in.
    const allCompleteBtns = [...document.querySelectorAll('#post-completion-btn')];
    const nativeBtn = allCompleteBtns.find(b => !slot.contains(b));
    if (nativeBtn) {
      slot.querySelectorAll('#post-completion-btn').forEach(b => b.remove());
      slot.insertBefore(nativeBtn, slot.firstChild);
    }

    // move Next Lesson button beside Mark As Complete (after it)
    const nextBtn=[...document.querySelectorAll('button')].find(b=>/next lesson/i.test(b.textContent||'') && b.classList.contains('border-nova-blue-800'));
    if(nextBtn && !slot.contains(nextBtn)) slot.appendChild(nextBtn);
  }

  function buildContentCard(){
    const main=document.querySelector('.main-section');
    if(!main) return;
    const postDetails=main.querySelector('.post-details');
    if(!postDetails) return;
    const attached=[...main.children].find(c=>c.classList.contains('mt-4'));
    let card=document.getElementById('bb-content-card');
    if(!card){ card=document.createElement('div'); card.id='bb-content-card'; postDetails.parentElement.insertBefore(card, postDetails); }
    if(!card.contains(postDetails)) card.appendChild(postDetails);
    if(attached && !card.contains(attached)) card.appendChild(attached);
  }

  // ---- Bob chat bot ----
  // The widget only initialises once per page load, so the bot must NOT live inside
  // the lesson grid (the portal rebuilds that when you change lessons/courses).
  // Instead: an empty #bb-bot-slot reserves the right column in the grid, and the
  // real bot (#bb-bot-host, attached to <body>) is pinned over that slot.
  const BOT_HEIGHT = 0.6;   // bot height as a share of the screen height

  /* OWNERSHIP: the Bob host and the widget loader belong to the PORTAL-LEVEL
     custom JS. It parks a [data-bob-embed] box on <body> before widget.js
     initialises, which matters because the widget looks for its host exactly
     once, at init, and never reconsiders.
     This file no longer injects widget.js and no longer creates its own box —
     it borrows the shared one and only decides where it sits on a lesson page.
     Off lesson pages it must not touch the element at all (see onLesson), or
     it takes the dashboard's Bob with it.
     That also retires the old 5-try remount loop, which existed purely because
     two fields were competing to own the same widget. */
  function sharedEmbed(){
    return (typeof window.bbBobHost === 'function' ? window.bbBobHost() : null)
        || document.querySelector('[data-bob-embed]');
  }

  function buildBotCol(){
    const grid=document.querySelector('#post-details-container > .grid.grid-cols-12');
    if(grid && !document.getElementById('bb-bot-slot')){
      const slot=document.createElement('div');
      slot.id='bb-bot-slot';
      grid.appendChild(slot);
    }
    let host=document.getElementById('bb-bot-host');
    if(!host){
      host=document.createElement('div');
      host.id='bb-bot-host';
      host.style.cssText='position:fixed;z-index:20;display:none;background:#fff;border:1px solid #e4e7ec;'
        +'border-radius:16px;overflow:hidden;box-shadow:0 1px 2px rgba(16,24,40,.04),0 1px 3px rgba(16,24,40,.06);';
      document.body.appendChild(host);
    }
    const emb=onLesson() ? sharedEmbed() : null;
    if(emb && emb.parentElement!==host){
      emb.removeAttribute('style');      // drop the parked off-screen positioning
      emb.style.height='100%';
      host.appendChild(emb);
    }
    placeBot();
  }
  function placeBot(){
    const host=document.getElementById('bb-bot-host');
    if(!host) return;
    const slot=document.getElementById('bb-bot-slot');
    const r=(slot && slot.isConnected && slot.offsetParent) ? slot.getBoundingClientRect() : null;
    // not a lesson page / mobile / layout still loading -> hide
    if(!r || r.width<200 || r.height<200){ host.style.display='none'; return; }
    const PAD_TOP=28, PAD_RIGHT=24;
    host.style.display='block';
    host.style.top=(r.top+PAD_TOP)+'px';
    host.style.left=r.left+'px';
    host.style.width=(r.width-PAD_RIGHT)+'px';
    // 60% of the screen height; only shrinks if that would run off the bottom
    const top=r.top+PAD_TOP, BOTTOM_GAP=24;
    const h=Math.min(window.innerHeight*BOT_HEIGHT, window.innerHeight-top-BOTTOM_GAP);
    host.style.height=Math.max(240, Math.round(h))+'px';   // 240 = the widget's INLINE_MIN_HOST_PX
    // The widget stamps height:560px on an embed it finds shorter than 240px,
    // and this box is display:none for a moment while the lesson layout loads.
    // If its poll lands in that window the panel is pinned at 560px inside a
    // shorter box and the input row is clipped off the bottom (seen on short
    // screens). Re-assert 100% every tick so the panel always matches the box.
    const emb=host.querySelector('[data-bob-embed]');
    if(emb && emb.style.height!=='100%') emb.style.height='100%';
  }

  function run(){
    try{
      setFullWidth();                           // also undoes the full-width styles after leaving a lesson
      if(!onLesson()){ placeBot(); return; }    // placeBot() hides #bb-bot-host off lesson pages
      setShellTop(); buildTopBar(); buildLessonHead(); buildContentCard(); buildRightCol(); buildBotCol();
    }catch(e){ /* no-op */ }
  }

  window.addEventListener('resize', () => { setShellTop(); placeBot(); });
  document.addEventListener('scroll', placeBot, true);   // keep bot aligned if the page scrolls
  // the portal loads lessons in stages, so keep re-aligning the bot (cheap: reads one box)
  setInterval(placeBot, 500);

  // ---- loop-safe scheduler ----
  let lastKey = '';
  function currentKey(){
    const active = document.querySelector('a.postqueue-lesson.post-highlight');
    return (active ? (active.id || active.textContent.trim()) : '') + '|' + location.pathname;
  }
  const obs = new MutationObserver(() => {
    const key = currentKey();
    if(!onLesson()){
      // Off lesson pages: nothing per mutation. Tidy up once when the route
      // changes (run() only touches styles here, so this cannot loop).
      if(key !== lastKey){ lastKey = key; run(); }
      return;
    }
    const needsBuild = key !== lastKey
      || !document.getElementById('bb-topbar')
      || !document.getElementById('bb-content-card')
      || !document.getElementById('bb-lesson-head')
      || !document.getElementById('bb-bot-slot')
      || document.querySelectorAll('#post-completion-btn').length > 1;
    if(!needsBuild) return;
    lastKey = key;
    obs.disconnect();        // stop observing while WE mutate the DOM
    run();
    obs.observe(document.body, { childList:true, subtree:true });
  });

  function start(){
    lastKey = currentKey();
    run();
    obs.observe(document.body, { childList:true, subtree:true });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('customDOMContentLoaded', start);
  } else {
    start();
  }

  window.addEventListener('popstate', () => { lastKey=''; });

})();} catch(error) { console.warn('Error executing custom code:', error) }
