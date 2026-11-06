// Browser: no ads on YouTube.
// Runs before the page's own scripts, in three layers:
//  1. The player's data comes without its ads: adPlacements / adSlots / playerAds are taken
//     out of ytInitialPlayerResponse and of every JSON the page reads (the /player answers).
//  2. An ad that still plays (built into the stream) is muted and run to its end, and
//     "Пропустить" is pressed as soon as it shows.
//  3. Ad cards in the feed, search and under the video are hidden.
(function () {
  if (window.__zcYtAds) return;
  window.__zcYtAds = true;

  // ---- 1. Player data without ads ------------------------------------------------------------
  var AD_KEYS = ["adPlacements", "adSlots", "playerAds", "adBreakHeartbeatParams"];

  function prune(o) {
    if (!o || typeof o !== "object") return o;
    try {
      var targets = [o, o.playerResponse, o.response && o.response.playerResponse];
      if (Array.isArray(o)) o.forEach(function (x) { if (x) targets.push(x.playerResponse); });
      targets.forEach(function (t) {
        if (!t || typeof t !== "object") return;
        AD_KEYS.forEach(function (k) { if (k in t) delete t[k]; });
      });
    } catch (e) {}
    return o;
  }

  // The first video's data is set by an inline script: var ytInitialPlayerResponse = {...}.
  ["ytInitialPlayerResponse", "playerResponse"].forEach(function (name) {
    try {
      var value = window[name];
      Object.defineProperty(window, name, {
        configurable: true,
        get: function () { return value; },
        set: function (v) { value = prune(v); }
      });
    } catch (e) {}
  });

  // Later videos come from fetch / XHR answers that the page turns into objects.
  var parse = JSON.parse;
  JSON.parse = function () {
    return prune(parse.apply(this, arguments));
  };
  try {
    var json = Response.prototype.json;
    Response.prototype.json = function () {
      return json.apply(this, arguments).then(prune);
    };
  } catch (e) {}

  // ---- 2. An ad that still plays -------------------------------------------------------------
  var SKIP = ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, " +
    ".ytp-ad-skip-button-slot button, .ytp-ad-overlay-close-button";
  var muted = null; // the video we muted for an ad, to give its sound back

  function tick() {
    var player = document.querySelector(".html5-video-player");
    if (!player) return;
    var video = player.querySelector("video");
    var ad = player.classList.contains("ad-showing") || player.classList.contains("ad-interrupting");
    if (ad && video) {
      document.querySelectorAll(SKIP).forEach(function (b) { try { b.click(); } catch (e) {} });
      if (!video.muted) { video.muted = true; muted = video; }
      if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.1) {
        try { video.currentTime = video.duration; } catch (e) { video.playbackRate = 16; }
      }
    } else if (muted) {
      // Back to the video: sound as it was.
      if (muted === video) video.muted = false;
      muted = null;
    }
  }
  setInterval(tick, 300);

  // ---- 3. Ad cards -------------------------------------------------------------------------------
  var css =
    "ad-slot-renderer, ytm-promoted-sparkles-web-renderer, ytm-promoted-sparkles-text-search-renderer, " +
    "ytm-promoted-video-renderer, ytm-companion-ad-renderer, ytm-companion-slot, ytm-display-ad-renderer, " +
    "ytm-in-feed-ad-layout-renderer, ytm-banner-promo-renderer, ytm-mealbar-promo-renderer, " +
    "ytm-rich-item-renderer:has(> * > ad-slot-renderer), ytm-rich-item-renderer:has(ad-slot-renderer), " +
    "ytm-item-section-renderer:has(> ytm-promoted-sparkles-web-renderer), " +
    "ytm-item-section-renderer:has(ad-slot-renderer), " +
    "ytm-engagement-panel-section-list-renderer[target-id=engagement-panel-ads], " +
    "#player-ads, .ytp-ad-overlay-container, .ytp-ad-image-overlay, .ytp-ad-text-overlay, " +
    "ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-promoted-sparkles-web-renderer, " +
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer), #masthead-ad " +
    "{ display: none !important; }\n";
  function addStyle() {
    var root = document.head || document.documentElement;
    if (!root) return false;
    var style = document.createElement("style");
    style.textContent = css;
    root.appendChild(style);
    return true;
  }
  if (!addStyle()) document.addEventListener("DOMContentLoaded", addStyle);
})();
