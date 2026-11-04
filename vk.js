// ZettelChat: skips video ads that still get through on VK Video.
// Runs before the page's own scripts. When an ad plays, it is muted and run to its end,
// and a "Пропустить" button is pressed as soon as it shows.
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

  function tick() {
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
