/* Shared drop-down menu animation helper. Works out the open height and the timing of each
   menu item from the panel's real layout. The page's own script still opens and closes the
   menu by toggling the "open" class; this only prepares the numbers just before it does. */
(function () {
  var TOTAL = 500;   /* ms for the panel to grow / shrink */
  var IN_LEAD = 0;   /* ms: item starts popping in as soon as the panel is tall enough for it */
  var OUT_DUR = 180; /* ms: how long an item takes to shrink away */

  function measure() {
    var panel = document.getElementById('menu-panel');
    if (!panel) return;
    var content = panel.scrollHeight;
    if (!content) return;
    var border = panel.offsetHeight - panel.clientHeight;
    panel.style.setProperty('--menu-h', (content + border) + 'px');
    panel.querySelectorAll('a').forEach(function (a) {
      if (!a.offsetParent) return;
      var top = a.offsetTop, bottom = top + a.offsetHeight;
      var inDelay = Math.max(0, TOTAL * bottom / content - IN_LEAD);
      var outDelay = Math.max(0, TOTAL * (1 - top / content) - OUT_DUR);
      a.style.setProperty('--in-delay', Math.round(inDelay) + 'ms');
      a.style.setProperty('--out-delay', Math.round(outDelay) + 'ms');
    });
  }

  /* Measure just before the page's own handler toggles the menu (capture phase). */
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('#menu-btn')) measure();
  }, true);

  /* Pop sounds: one soft "pop" per menu item, synthesised with Web Audio (no audio files), timed
     to the same delays the CSS uses for each item. Watches the panel's "open" class so it works
     however the page opens or closes the menu. */
  var audioCtx = null, bus = null;
  function getCtx() {
    if (audioCtx) return audioCtx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audioCtx = new AC(); } catch (err) { return null; }
    return audioCtx;
  }
  /* One shared output chain: a master gain with headroom, then a gentle limiter, so several pops
     landing close together can't add up and clip. */
  function getBus(ctx) {
    if (bus) return bus;
    var master = ctx.createGain();
    master.gain.value = 0.7;
    var out = master;
    if (ctx.createDynamicsCompressor) {
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.12;
      master.connect(comp);
      comp.connect(ctx.destination);
    } else {
      master.connect(ctx.destination);
    }
    bus = master;
    return bus;
  }
  function pop(delayMs, opening, i) {
    var ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    var t = ctx.currentTime + delayMs / 1000;
    var osc = ctx.createOscillator();
    var filter = ctx.createBiquadFilter();
    var gain = ctx.createGain();
    /* Close pops start higher and fall by less, and are quieter: a low, fast downward sweep with a
       hard attack is what made them thump and distort. */
    var base = opening ? 380 + i * 35 : 420 - i * 12;
    var peak = opening ? 0.12 : 0.11;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * (opening ? 2.2 : 0.75), t + 0.08);
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    filter.Q.value = 0.5;
    /* Soft attack (no click) and a smooth tail that reaches silence before the oscillator stops. */
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + 0.015);
    gain.gain.setTargetAtTime(0, t + 0.02, 0.03);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(getBus(ctx));
    osc.start(t);
    osc.stop(t + 0.22);
  }
  function playPops(opening) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var panel = document.getElementById('menu-panel');
    if (!panel) return;
    var n = 0;
    panel.querySelectorAll('a').forEach(function (a) {
      if (!a.offsetParent) return;
      var d = parseFloat(a.style.getPropertyValue(opening ? '--in-delay' : '--out-delay')) || 0;
      pop(d, opening, n++);
    });
  }
  (function watch() {
    var panel = document.getElementById('menu-panel');
    if (!panel || !window.MutationObserver) return;
    var was = panel.classList.contains('open');
    new MutationObserver(function () {
      var now = panel.classList.contains('open');
      if (now !== was) { was = now; playPops(now); }
    }).observe(panel, { attributes: true, attributeFilter: ['class'] });
  })();

  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  /* When a menu link goes to another page, let the menu finish closing first, then navigate.
     The page's own handler closes the menu on click; this runs after it (bubbling phase) and holds
     the navigation back for the length of the close animation. Same-page links (#anchors), new-tab
     links, modifier-clicks and links a page handles itself (e.g. Sign out) are left alone. */
  var navigating = false;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#menu-panel a');
    if (!a || e.defaultPrevented || navigating) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;   /* mailto:, tel: etc. */
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;   /* same page */
    e.preventDefault();
    navigating = true;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () { location.href = url.href; }, reduce ? 0 : TOTAL + 30);
  });
})();
