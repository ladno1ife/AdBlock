// ZettelChat: skips video ads that still get through on VK Video.
// Runs before the page's own scripts. When an ad plays, it is muted and run to its end,
// and a "Пропустить" button is pressed as soon as it shows.
// The page is only searched where video plays (video and clip pages, VK Video, the embedded
// player): on the feed, messages or profiles a search every 0.4 s would only slow things down.
(function () {
  if (window.__zcAdSkip) return;
  window.__zcAdSkip = true;
  var SKIP = /^(пропустить( рекламу)?|skip( ad| ads)?)$/i;
  var AD_CLASS = /(^|[-_ ])(ad|ads|advert|adv|preroll|midroll|vast)([-_ ]|$)/i;

  function inAdBlock(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      if (AD_CLASS.test(n.className && n.className.baseVal !== undefined ? n.className.baseVal : n.className || "")) return true;
    }
    return false;
  }

  function videoPage() {
    if (/(^|\.)vkvideo\.ru$/.test(location.hostname)) return true;
    if (/^\/(video|clip|video_ext\.php)/.test(location.pathname)) return true;
    return /[?&#]z=(video|clip)/.test(location.search + location.hash);
  }

  function tick() {
    if (!videoPage()) return; // the address check is cheap; the search below is not
    document.querySelectorAll("button, a, div[role=button], span").forEach(function (el) {
      var text = (el.textContent || "").trim();
      if (text.length < 40 && SKIP.test(text) && el.offsetParent !== null) el.click();
    });
    document.querySelectorAll("video").forEach(function (v) {
      if (!inAdBlock(v)) return;
      v.muted = true;
      if (isFinite(v.duration) && v.duration > 0 && v.currentTime < v.duration - 0.1) {
        try { v.currentTime = v.duration; } catch (e) { v.playbackRate = 16; }
      }
    });
  }
  setInterval(tick, 400);
})();
