// ZettelChat: fewer distractions on VK and YouTube in the app's browser.
// window.__zcFocus = { clips, home, only } comes from the app's switches:
//   clips — hide VK Clips and YouTube Shorts everywhere and don't open them;
//   home  — no home page: go to subscriptions instead;
//   only  — on a video page only the player: nothing under it (title, channel, description,
//           recommendations, comments), no end-screen tiles or autoplay.
// Sites change their markup often, so things are found by links and headings where possible.
(function () {
  if (window.__zcFocusOn) return;
  window.__zcFocusOn = true;
  var cfg = window.__zcFocus || { clips: true, home: true, only: true };
  var host = location.hostname;
  var YT = /(^|\.)youtube\.com$/.test(host);
  var VKVIDEO = /(^|\.)vkvideo\.ru$/.test(host);
  var VK = VKVIDEO || /(^|\.)(vk\.com|vk\.ru)$/.test(host);
  if (!YT && !VK) return;

  // ---- Where things are -------------------------------------------------------------------
  function subscriptions() {
    if (YT) return "/feed/subscriptions";
    if (VKVIDEO) return "/subscriptions";
    return "/video/subscriptions";
  }
  function isHome(path) {
    if (YT) return path === "/" || path === "";
    if (VKVIDEO) return path === "/" || path === "";
    return path === "/video" || path === "/video/";
  }
  function isShortForm(path) {
    if (YT) return /^\/shorts(\/|$)/.test(path);
    return /^\/(clips?([\/-]|$)|clip-?\d)/.test(path);
  }
  var SHORT_LINK = YT ? 'a[href^="/shorts"], a[href*="youtube.com/shorts"]'
                      : 'a[href*="/clip-"], a[href*="/clips"], a[href*="/clip/"], a[href*="z=clip"]';
  var CARD = YT
    ? "ytm-rich-item-renderer, ytm-video-with-context-renderer, ytm-compact-video-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytm-reel-item-renderer, ytm-pivot-bar-item-renderer, li, .item"
    : "li, article, [class*=Card], [class*=card], [class*=item], [class*=Item]";
  var SHELF_TITLES = YT ? /^(shorts)$/i : /^(клипы|clips)$/i;

  // The site's menus and tab bars. Clips / Shorts / Home are removed from them one button at a
  // time: a label or link found there must never take the whole bar (or, climbing up from it,
  // the whole page) with it.
  var NAV = "nav, [role=navigation], [role=tablist], ytm-pivot-bar-renderer, ytm-mobile-topbar-renderer, " +
    "header, [class*=Tabbar], [class*=tabbar], [class*=TabBar], [class*=BottomNav], [class*=bottom-nav]";

  function inNav(el) {
    if (el.closest(NAV)) return true;
    // Bars stuck to the screen edge are menus too, whatever their markup.
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var pos = getComputedStyle(n).position;
      if (pos === "fixed" || pos === "sticky") return true;
    }
    return false;
  }
  // A menu's button: YouTube's whole bar item (not just the tab inside it), else the nearest item.
  function navItem(el) {
    return el.closest("ytm-pivot-bar-item-renderer") || el.closest("[role=tab], li, a") || el;
  }
  // Too big to be a shelf or a card: the page, the app, a menu, or anything with the player.
  function tooBig(node) {
    if (!node || node === document.body || node === document.documentElement) return true;
    if (/^(YTM-APP|MAIN)$/.test(node.tagName) || node.id === "app") return true;
    if (node.matches(NAV) || node.querySelector(NAV)) return true;
    if (node.querySelector("video, ytm-player, #player")) return true;
    return node.getBoundingClientRect().height > window.innerHeight * 0.9;
  }

  // ---- Styles that need no searching (YouTube's mobile site) ----------------------------------
  var css = "";
  // YouTube's bottom bar: each button is a ytm-pivot-bar-item-renderer whose tab has a class
  // naming it: pivot-w2w (Home, "what to watch"), pivot-shorts, pivot-subs, pivot-you.
  if (YT && cfg.clips) css += "ytm-reel-shelf-renderer, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, ytm-reel-item-renderer, [tab-identifier=FEshorts], ytm-pivot-bar-item-renderer:has(.pivot-shorts) { display: none !important; }\n";
  if (YT && cfg.home) css += "[tab-identifier=FEwhat_to_watch], ytm-pivot-bar-item-renderer:has(.pivot-w2w) { display: none !important; }\n";
  // On a video page (html.zc-watch) everything under the player is marked by sweep() and hidden;
  // leaving the video page drops the class, so the same blocks show again elsewhere.
  if (cfg.only) css += "html.zc-watch [data-zc-under] { display: none !important; }\n";
  // VK's playlist bar stuck to the bottom ("Далее: … · 1/468").
  if (!YT && cfg.only) css += "html.zc-watch [data-testid=playlist_modal_snackbar], html.zc-watch [class*=PlaylistSnackbar], " +
    "html.zc-watch .vkuiFixedLayout__host:has([data-testid=playlist_modal_snackbar], [class*=PlaylistSnackbar]) { display: none !important; }\n";
  if (YT && cfg.only) css += "html.zc-watch ytm-related-chip-cloud-renderer, ytm-engagement-panel-section-list-renderer[panel-target-id*=comment], .ytp-ce-element, .ytp-endscreen-content, .ytp-autonav-endscreen, .ytm-autonav-bar, ytm-autonav-toggle-button-container { display: none !important; }\n";
  var style = document.createElement("style");
  style.textContent = css;
  // At the very start the page may have no elements yet; then the styles go in with the first sweep.
  function addStyle() {
    var root = document.head || document.documentElement;
    if (css && root && !style.isConnected) root.appendChild(style);
  }
  addStyle();

  // ---- Page rules: home → subscriptions, Shorts / Clips not opened --------------------------
  var notice = null;
  function showBlocked(what) {
    if (notice) return;
    notice = document.createElement("div");
    notice.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#151927;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font:18px sans-serif;gap:16px";
    notice.textContent = what + " скрыты";
    var back = document.createElement("button");
    back.textContent = "Назад";
    back.style.cssText = "font:16px sans-serif;padding:10px 24px;border-radius:20px;border:0;background:#3E74E8;color:#fff";
    back.onclick = function () { if (history.length > 1) history.back(); else location.replace(subscriptions()); };
    notice.appendChild(back);
    (document.body || document.documentElement).appendChild(notice);
  }
  function hideBlocked() { if (notice) { notice.remove(); notice = null; } }

  var lastUrl = "";
  function checkPage() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    var path = location.pathname;
    if (cfg.home && isHome(path)) { location.replace(subscriptions()); return; }
    if (cfg.clips && isShortForm(path)) showBlocked(YT ? "Shorts" : "Клипы"); else hideBlocked();
  }
  // Both sites change pages without reloading: watch history and the address.
  ["pushState", "replaceState"].forEach(function (name) {
    var original = history[name];
    history[name] = function () { var r = original.apply(this, arguments); setTimeout(sweep, 0); return r; };
  });
  window.addEventListener("popstate", function () { sweep(); });
  checkPage();

  // ---- Hiding blocks on the page -------------------------------------------------------------
  function hide(el) {
    if (!el || el.style.display === "none") return;
    el.style.setProperty("display", "none", "important");
  }

  // The block a heading names: climb from the heading until the block holds more than it.
  // Whether [parent] holds more than the shelf [node] is in: other posts, videos, links.
  function holdsOtherContent(parent, node) {
    for (var c = parent.firstElementChild; c; c = c.nextElementSibling) {
      if (c === node || c.contains(node)) continue;
      if (c.matches(SHORT_LINK) || c.querySelector(SHORT_LINK)) continue; // the shelf's own clips
      if ((c.textContent || "").trim().length > 30 || c.matches("a[href], video, img") ||
          c.querySelector("a[href], video, img")) return true;
    }
    return false;
  }
  // The shelf a "Клипы" / "Shorts" heading names. Never climbs into a block that is too big
  // (see tooBig) or holds other content next to the shelf: then the block found so far goes.
  function blockOf(heading) {
    var node = heading;
    for (var i = 0; i < 6; i++) {
      var parent = node.parentElement;
      if (tooBig(parent) || holdsOtherContent(parent, node)) break;
      node = parent;
      if (node.children.length > 1 && (node.textContent || "").length > (heading.textContent || "").length + 20) return node;
    }
    return node;
  }
  // The card around a Clips / Shorts link; in a menu only its button, never a whole list.
  function cardOf(link) {
    if (inNav(link)) return navItem(link);
    var card = link.closest(CARD);
    return card && !tooBig(card) ? card : link;
  }
  function headings(re) {
    var found = [];
    document.querySelectorAll("h1, h2, h3, h4, [role=heading], span, div").forEach(function (el) {
      if (el.children.length > 1) return;
      var text = (el.textContent || "").trim();
      if (text.length && text.length < 40 && re.test(text)) found.push(el);
    });
    return found;
  }
  function onWatchPage() {
    var p = location.pathname;
    if (YT) return p === "/watch";
    return /^\/(video-?\d|video\/|watch)/.test(p) || /z=video/.test(location.search + location.hash);
  }

  // The player: the site's own box where known, else the box around the biggest video.
  function player() {
    var box = document.querySelector(YT ? "#player-container-id, ytm-player, #player" : "#mvk-video-page-root-container .vkuiAspectRatio__host, [id^=video-player-wrapper], #video_player");
    // The site's own box is the player even before the video has its size.
    if (box) return box;
    var best = null, size = 0;
    document.querySelectorAll("video, iframe[src*='video_ext'], iframe[src*='youtube']").forEach(function (v) {
      var r = v.getBoundingClientRect();
      if (r.width * r.height > size) { size = r.width * r.height; best = v; }
    });
    if (!best) return null;
    var h = best.getBoundingClientRect().height, node = best;
    // Until the video has its size, the player can't be told from what's around it.
    if (h < 100) return null;
    // Climb while the box is still about the video's size: that also takes in its controls. A box
    // holding what's already hidden is not the player, though it may now look its size.
    while (node.parentElement && node.parentElement !== document.body &&
           !node.parentElement.querySelector("[data-zc-under]") &&
           node.parentElement.getBoundingClientRect().height <= h * 1.3 + 60) node = node.parentElement;
    return node;
  }
  // Never hidden under the player: the site's top bar, and the menus and panels the player's own
  // buttons open (settings, chapters). A block holding one is not hidden whole, only its other parts.
  var OPEN = "header, #header-bar, ytm-mobile-topbar-renderer, [role=banner], [role=dialog], dialog, " +
    "bottom-sheet-container, ytm-bottom-sheet-renderer, ytm-menu-popup-renderer, tp-yt-paper-dialog, " +
    "ytm-engagement-panel, ytm-engagement-panel-section-list-renderer:not([panel-target-id*=comment]), " +
    "[class*=bottom-sheet], [class*=BottomSheet], [class*=ModalRoot], [class*=PopoutRoot]";
  // A recommended video's own ⋮ menu is a bottom sheet too, but it doesn't keep its card.
  var CARD = "ytm-media-item, ytm-video-with-context-renderer, ytm-compact-video-renderer, " +
    "ytm-rich-item-renderer, ytm-reel-item-renderer, ytm-compact-playlist-renderer, " +
    "ytm-compact-radio-renderer, ytm-compact-channel-renderer, ytm-playlist-video-renderer";
  function cardMenu(el) {
    return el.matches(".media-item-menu") || !!el.closest(CARD);
  }
  function holdsOpen(el) {
    var found = el.querySelectorAll(OPEN);
    for (var i = 0; i < found.length; i++) if (!cardMenu(found[i])) return true;
    return false;
  }
  function mark(el) {
    if (el === notice || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName) || (el.matches(OPEN) && !cardMenu(el))) return;
    if (holdsOpen(el)) {
      el.removeAttribute("data-zc-under");
      for (var i = 0; i < el.children.length; i++) mark(el.children[i]);
      return;
    }
    if (el.hasAttribute("data-zc-under")) return;
    // Bars stuck to the screen (site menus, pop-ups) and empty boxes stay.
    if (!el.getBoundingClientRect().height) return;
    var pos = getComputedStyle(el).position;
    if (pos === "fixed" || pos === "sticky") return;
    el.setAttribute("data-zc-under", "");
  }
  // Marks everything after the player, at every level up to the page: title, channel, description,
  // recommendations, comments.
  function markUnderPlayer() {
    var box = player();
    if (!box) return;
    box.querySelectorAll("[data-zc-under]").forEach(function (el) { el.removeAttribute("data-zc-under"); });
    for (var node = box; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      node.removeAttribute("data-zc-under");
      for (var next = node.nextElementSibling; next; next = next.nextElementSibling) mark(next);
    }
  }

  function sweep() {
    addStyle();
    if (cfg.clips) {
      document.querySelectorAll(SHORT_LINK).forEach(function (a) { hide(cardOf(a)); });
      // A "Shorts" / "Клипы" label in a menu is that menu's button, not a shelf heading.
      headings(SHELF_TITLES).forEach(function (h) { hide(inNav(h) ? navItem(h) : blockOf(h)); });
      if (YT) document.querySelectorAll("[tab-identifier=FEshorts], .pivot-shorts").forEach(function (t) { hide(navItem(t)); });
    }
    if (cfg.home) {
      // The Home item in the site's menus.
      document.querySelectorAll('a[href="/"], a[href="https://' + host + '/"]').forEach(function (a) {
        if ((a.textContent || "").trim().match(/^(главная|home)$/i)) hide(a.closest("li, ytm-pivot-bar-item-renderer") || a);
      });
      if (YT) document.querySelectorAll("ytm-pivot-bar-item-renderer").forEach(function (item) {
        if (item.querySelector(".pivot-w2w, [tab-identifier=FEwhat_to_watch], .pivot-home, [class*=pivot-home]")) hide(item);
      });
    }
    document.documentElement.classList.toggle("zc-watch", cfg.only && onWatchPage());
    if (cfg.only && onWatchPage()) {
      markUnderPlayer();
      // No next video by itself: switch autoplay off and cancel a countdown to the next one.
      document.querySelectorAll('[aria-label*="автовоспроизв" i][aria-pressed=true], [aria-label*="autoplay" i][aria-pressed=true], [aria-checked=true][aria-label*="автовоспроизв" i]').forEach(function (b) { b.click(); });
      document.querySelectorAll(".ytp-autonav-endscreen-upnext-cancel-button, [aria-label*='Отменить' i]").forEach(function (b) { if (b.offsetParent) b.click(); });
    }
    checkPage();
  }
  // What's under the player is hidden right before the page is drawn, so it never shows for a moment;
  // the rest waits for the page to settle.
  var marking = false;
  function markSoon() {
    if (marking || !cfg.only) return;
    marking = true;
    requestAnimationFrame(function () {
      marking = false;
      if (!onWatchPage()) return;
      document.documentElement.classList.add("zc-watch");
      markUnderPlayer();
    });
  }
  new MutationObserver(function () { markSoon(); clearTimeout(sweep.t); sweep.t = setTimeout(sweep, 150); })
    .observe(document, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", sweep);
})();
