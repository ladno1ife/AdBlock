// ZettelChat: the video window over the notes. Only the page's video shows, filling the window, and it
// starts by itself, with sound. window.__zcVideo() gives that video to the window's buttons (back 15 s, pause).
(function () {
  if (window.__zcMiniOn) return;
  window.__zcMiniOn = true;

  // Everything on the page is hidden but the player's box; the video is shown again by its own styles below.
  var style = document.createElement("style");
  style.textContent = "html, body { background: #000 !important; overflow: hidden !important; }\n" +
    "body *:not(.zc-mini-box):not(.zc-mini-box *) { visibility: hidden !important; }";
  function addStyle() {
    var root = document.head || document.documentElement;
    if (root && !style.isConnected) root.appendChild(style);
  }
  addStyle();

  // The page's videos, also those inside players' own (shadow) trees, as VK's player keeps them,
  // where the page's styles and searches don't reach.
  function videos(root, found) {
    found = found || [];
    root.querySelectorAll("video").forEach(function (v) { found.push(v); });
    root.querySelectorAll("*").forEach(function (el) { if (el.shadowRoot) videos(el.shadowRoot, found); });
    return found;
  }
  // The box holding a node, across the edge of a shadow tree.
  function up(node) {
    return node.parentElement || (node.parentNode && node.parentNode.host) || null;
  }

  // Set on the elements themselves, so they hold inside shadow trees too.
  var VIDEO = {
    visibility: "visible", position: "fixed", left: "0", top: "0", right: "auto", bottom: "auto",
    width: "100vw", height: "100vh", "max-width": "none", "max-height": "none", margin: "0",
    transform: "none", "object-fit": "contain", background: "#000", "z-index": "2147483647",
  };
  // A box around the video that is moved, clipped or contained as a whole would hold the video inside it.
  var AROUND = {
    transform: "none", translate: "none", scale: "none", filter: "none", "backdrop-filter": "none",
    contain: "none", "container-type": "normal", "content-visibility": "visible",
    "will-change": "auto", perspective: "none", "clip-path": "none", zoom: "1",
  };
  function restyle(el, props) {
    if (el.__zcStyle === undefined) el.__zcStyle = el.getAttribute("style");
    for (var name in props) el.style.setProperty(name, props[name], "important");
  }
  function unstyle(el) {
    if (el.__zcStyle === undefined) return;
    if (el.__zcStyle === null) el.removeAttribute("style"); else el.setAttribute("style", el.__zcStyle);
    el.__zcStyle = undefined;
  }
  function mark(v, on, look) {
    if (on) restyle(v, look); else unstyle(v);
    for (var node = up(v); node && node !== document.documentElement; node = up(node)) {
      if (on) restyle(node, AROUND); else unstyle(node);
    }
  }

  // VK's player shows the playing video deep in its own closed tree, out of reach; but it fills its
  // box, so there the box fills the window and the video is left as the player lays it out.
  var VK = /(^|\.)(vkvideo\.ru|vk\.com|vk\.ru)$/.test(location.hostname);
  var YT = /(^|\.)youtube\.com$/.test(location.hostname);
  var BOX = "[id^=video-player-wrapper], #video_player";
  var box = null, styled = null, current = null;

  // The video to show: one the page shows at all (previews under the player are hidden), then the one
  // really playing, else one with something loaded, else the one shown already, else the biggest. An
  // empty player waiting for its video counts as playing once play() was called on it (VK keeps one).
  function pick() {
    var best = null, score = -1;
    videos(document).forEach(function (v) {
      var s = (v.getClientRects().length ? 16 : 0) + (!v.paused && v.readyState >= 2 ? 8 : 0) + (v.readyState > 0 ? 4 : 0) + (v === current ? 2 : 0) +
        Math.min(1, v.offsetWidth * v.offsetHeight / 1e6);
      if (s > score) { score = s; best = v; }
    });
    return best;
  }
  function sweep() {
    addStyle();
    var v = pick();
    current = v;
    var found = VK ? document.querySelector(BOX) : null;
    var shown = found ? null : v;
    // Styles come off first: the box and the video share the boxes around them.
    if (styled && styled !== shown) { mark(styled, false, VIDEO); styled = null; }
    if (box && box !== found) { box.classList.remove("zc-mini-box"); mark(box, false, VIDEO); box = null; }
    if (found && found !== box) { box = found; box.classList.add("zc-mini-box"); mark(box, true, VIDEO); }
    if (shown && shown !== styled) { styled = shown; mark(shown, true, VIDEO); }
    if (!v) return;
    // Sites start a video without sound until it's tapped (YouTube); the window wants it heard.
    if (v.muted) v.muted = false;
    if (v.volume === 0) v.volume = 1;
    // Starts once by itself; a pause from the window's button stays.
    if (!v.__zcStarted) {
      v.__zcStarted = true;
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
  }
  window.__zcVideo = function () { return current; };

  // The window's speed. VK's player puts its own speed back on the video, so on the shown video the
  // page's own writes to the speed are ignored and only the window's go through.
  var RATE = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate");
  var DEFAULT_RATE = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "defaultPlaybackRate");
  var rate = null;
  function lockRate(v) {
    if (v.__zcRateLocked) return;
    v.__zcRateLocked = true;
    [["playbackRate", RATE], ["defaultPlaybackRate", DEFAULT_RATE]].forEach(function (pair) {
      Object.defineProperty(v, pair[0], {
        configurable: true,
        get: function () { return pair[1].get.call(this); },
        set: function (x) { if (rate === null) pair[1].set.call(this, x); },
      });
    });
  }
  window.__zcSetRate = function (x) {
    rate = x;
    var v = current;
    if (!v) return;
    lockRate(v);
    if (DEFAULT_RATE.get.call(v) !== x) DEFAULT_RATE.set.call(v, x);
    if (RATE.get.call(v) !== x) RATE.set.call(v, x);
  };

  // ---- Chapters ---------------------------------------------------------------------------------
  // The video's chapters as [{t: seconds, title}] for the window's list: YouTube's own, else time codes
  // in the description (VK makes its chapters from those too). Empty when there are none.
  var chapters = null;
  window.__zcChapters = function () {
    if (chapters) return chapters;
    var found = YT ? youTubeChapters() : [];
    if (!found.length) found = fromText(YT ? youTubeDescription() : vkDescription());
    if (found.length) chapters = found;
    return found;
  };

  // YouTube's page data; the mobile site keeps it as JSON text.
  function ytData(name) {
    var data = window[name];
    if (typeof data === "string") { try { data = JSON.parse(data); } catch (e) { data = null; } }
    return data || null;
  }
  function ytText(t) {
    if (!t) return "";
    return t.simpleText || (t.runs || []).map(function (r) { return r.text; }).join("");
  }
  function youTubeChapters() {
    var found = [], seen = {};
    (function walk(o, depth) {
      if (!o || typeof o !== "object" || depth > 60) return;
      var c = o.chapterRenderer;
      if (c) {
        var t = Math.round((c.timeRangeStartMillis || 0) / 1000);
        if (!seen[t]) { seen[t] = true; found.push({ t: t, title: ytText(c.title) }); }
        return;
      }
      for (var k in o) walk(o[k], depth + 1);
    })(ytData("ytInitialData"), 0);
    return found.sort(function (a, b) { return a.t - b.t; });
  }
  function youTubeDescription() {
    var player = ytData("ytInitialPlayerResponse");
    return (player && player.videoDetails && player.videoDetails.shortDescription) || "";
  }
  // On VK the description is the block right under the player.
  function vkDescription() {
    var node = document.querySelector("#mvk-video-page-root-container .vkuiAspectRatio__host") || document.querySelector(BOX);
    while (node && !node.nextElementSibling) node = node.parentElement;
    return node ? textOf(node.nextElementSibling) : "";
  }
  // An element's text with its lines: the block may be hidden, and hidden text loses its line breaks.
  function textOf(el) {
    var out = "";
    (function walk(n) {
      if (n.nodeType === 3) { out += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      var block = /^(BR|DIV|P|LI|SECTION|ARTICLE|H\d)$/.test(n.tagName);
      if (block) out += "\n";
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
      if (block) out += "\n";
    })(el);
    return out;
  }
  // Time codes with what follows them on their line: `05:12 Причины`. Chapters start at 0:00 and go
  // forward; other times in the text (a date, a mention in passing) don't make a list.
  function fromText(text) {
    var STAMP = /(^|[^\d:])((?:\d{1,2}:)?\d{1,2}:\d{2})(?![\d:])/g;
    var marks = [], m;
    while ((m = STAMP.exec(text))) {
      var t = m[2].split(":").reduce(function (sum, part) { return sum * 60 + parseInt(part, 10); }, 0);
      var title = text.slice(STAMP.lastIndex).split("\n")[0].replace(/^[\s\-–—:.)|]+/, "").trim().slice(0, 80);
      marks.push({ t: t, title: title });
    }
    var start = -1;
    for (var i = 0; i < marks.length; i++) if (marks[i].t === 0) { start = i; break; }
    if (start < 0) return [];
    var list = [marks[start]];
    for (var j = start + 1; j < marks.length; j++) if (marks[j].t > list[list.length - 1].t) list.push(marks[j]);
    return list.length >= 2 ? list : [];
  }

  var queued = false;
  new MutationObserver(function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; sweep(); });
  }).observe(document, { childList: true, subtree: true });
  setInterval(sweep, 1000);
})();
