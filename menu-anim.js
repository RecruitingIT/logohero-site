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
