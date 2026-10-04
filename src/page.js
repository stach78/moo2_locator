// Single-page UI served by the worker. Kept free of backticks and "${" so it can live in a template literal.
export const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MOO2 Locator</title>
<style>
  :root {
    --bg: #f4f5f8; --panel: #ffffff; --text: #1b1e27; --muted: #5d6475; --border: #d8dbe3;
    --accent: #3b5bdb; --accent-text: #ffffff; --space: #0d1020; --grid: rgba(255,255,255,0.14);
    --star: rgba(255,255,255,0.55); --me: #ffd43b; --other: #ff6b6b;
    --ok: #2b8a3e; --ok-bg: #e6f4ea; --warn: #c92a2a; --warn-bg: #fdecec;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #10131c; --panel: #181c28; --text: #e6e8ef; --muted: #9aa1b3; --border: #2b3142;
      --accent: #5c7cfa; --ok: #69db7c; --ok-bg: #16301f; --warn: #ff8787; --warn-bg: #3a1a1d;
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  .sub { color: var(--muted); margin: 0 0 24px; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  button { font: inherit; border: 0; border-radius: 8px; padding: 10px 16px; cursor: pointer;
    background: var(--accent); color: var(--accent-text); }
  button.secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
  button:disabled { opacity: 0.5; cursor: default; }
  input { font: inherit; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border);
    background: var(--bg); color: var(--text); text-transform: uppercase; width: 9em; }
  code { font-size: 1.1em; letter-spacing: 0.1em; }
  .map { position: relative; width: 100%; aspect-ratio: 4 / 3; background: var(--space);
    border-radius: 10px; overflow: hidden; cursor: crosshair; touch-action: manipulation; margin: 12px 0; }
  .map.locked { cursor: default; }
  .map svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .result { border-radius: 10px; padding: 16px; font-size: 1.15rem; }
  .result.ok { background: var(--ok-bg); color: var(--ok); }
  .result.bad { background: var(--warn-bg); color: var(--warn); }
  .muted { color: var(--muted); }
  .error { color: var(--warn); }
  .hidden { display: none !important; }
  .legend span { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin: 0 4px 0 12px; }
</style>
</head>
<body>
<main>
  <h1>MOO2 Locator</h1>
  <p class="sub">Find out whether the two human empires start far apart, without telling each other where you are.</p>

  <section id="home" class="panel hidden">
    <p>One player starts a round and sends the link to the other.</p>
    <div class="row">
      <button id="newRound">Start a new round</button>
      <span class="muted">or</span>
      <input id="joinCode" placeholder="CODE" maxlength="6" aria-label="Round code">
      <button id="join" class="secondary">Join</button>
    </div>
  </section>

  <section id="room" class="hidden">
    <div class="panel">
      <div class="row" style="justify-content: space-between">
        <div>Round <code id="code"></code></div>
        <button id="copyLink" class="secondary">Copy link for the other player</button>
      </div>
    </div>

    <div id="pick" class="panel hidden">
      <strong>Where is your homeworld?</strong>
      <p class="muted" style="margin: 4px 0 0">Click its approximate position on the galaxy map. You can adjust it until you lock it in.</p>
      <div id="pickMap" class="map"></div>
      <div class="row">
        <button id="lock" disabled>Lock in my position</button>
        <span class="muted">You cannot change it afterwards.</span>
      </div>
    </div>

    <div id="full" class="panel hidden">
      Both players have already submitted for this round. If you were one of them, open it in the browser you used.
    </div>

    <div id="status" class="panel hidden">
      <div id="waiting" class="muted">Position locked. Waiting for the other player…</div>
      <div id="resultBox" class="result hidden"></div>
      <div id="rerollActions" class="row hidden" style="margin-top: 12px">
        <button id="newRound2">Start a new round</button>
      </div>
      <div id="revealBlock" class="hidden" style="margin-top: 20px">
        <strong>After the game</strong>
        <p class="muted" style="margin: 4px 0 8px">Both positions are shown only once both players ask for it.</p>
        <div class="row">
          <button id="reveal" class="secondary">Reveal positions</button>
          <span id="revealState" class="muted"></span>
        </div>
        <div id="revealMapWrap" class="hidden">
          <div id="revealMap" class="map locked"></div>
          <div class="legend muted"><span style="background: var(--me); margin-left: 0"></span>You<span style="background: var(--other)"></span>Other player
            <span id="revealDist" style="width: auto; height: auto; background: none"></span></div>
        </div>
      </div>
    </div>
  </section>

  <p id="error" class="error"></p>
</main>

<script>
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var SVGNS = "http://www.w3.org/2000/svg";
  var memoryTokens = {};
  var code = null, token = null, picked = null, pollTimer = null;

  function loadToken(c) {
    try { return localStorage.getItem("moo2loc:" + c) || memoryTokens[c] || null; }
    catch (e) { return memoryTokens[c] || null; }
  }
  function saveToken(c, t) {
    memoryTokens[c] = t;
    try { localStorage.setItem("moo2loc:" + c, t); } catch (e) {}
  }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }
  function err(msg) { $("error").textContent = msg || ""; }

  async function api(method, path, body) {
    var res = await fetch(path, {
      method: method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || "Request failed.");
    return data;
  }

  // Draws the empty galaxy with a faint 3x3 grid and a few decorative stars.
  function buildMap(el) {
    el.innerHTML = "";
    var svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("viewBox", "0 0 400 300");
    svg.setAttribute("preserveAspectRatio", "none");
    for (var i = 1; i < 3; i++) {
      line(svg, i * 400 / 3, 0, i * 400 / 3, 300);
      line(svg, 0, i * 100, 400, i * 100);
    }
    var seed = 7;
    for (var s = 0; s < 70; s++) {
      seed = (seed * 9301 + 49297) % 233280; var x = seed / 233280 * 400;
      seed = (seed * 9301 + 49297) % 233280; var y = seed / 233280 * 300;
      var c = document.createElementNS(SVGNS, "circle");
      c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", 0.9);
      c.setAttribute("fill", "var(--star)");
      svg.appendChild(c);
    }
    el.appendChild(svg);
    return svg;
  }
  function line(svg, x1, y1, x2, y2) {
    var l = document.createElementNS(SVGNS, "line");
    l.setAttribute("x1", x1); l.setAttribute("y1", y1); l.setAttribute("x2", x2); l.setAttribute("y2", y2);
    l.setAttribute("stroke", "var(--grid)"); l.setAttribute("stroke-width", 1);
    l.setAttribute("vector-effect", "non-scaling-stroke");
    svg.appendChild(l);
  }
  function marker(svg, p, color) {
    var g = document.createElementNS(SVGNS, "g");
    var ring = document.createElementNS(SVGNS, "ellipse");
    var dot = document.createElementNS(SVGNS, "ellipse");
    [ring, dot].forEach(function (e) {
      e.setAttribute("cx", p.x * 400); e.setAttribute("cy", p.y * 300);
      e.setAttribute("vector-effect", "non-scaling-stroke");
    });
    ring.setAttribute("rx", 9); ring.setAttribute("ry", 9);
    ring.setAttribute("fill", "none"); ring.setAttribute("stroke", color); ring.setAttribute("stroke-width", 2);
    dot.setAttribute("rx", 3.5); dot.setAttribute("ry", 3.5); dot.setAttribute("fill", color);
    g.appendChild(ring); g.appendChild(dot);
    svg.appendChild(g);
    return g;
  }

  function setupPicker() {
    var el = $("pickMap");
    var svg = buildMap(el);
    var m = null;
    el.addEventListener("click", function (ev) {
      var r = el.getBoundingClientRect();
      picked = {
        x: Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)),
        y: Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height))
      };
      if (m) m.remove();
      m = marker(svg, picked, "var(--me)");
      $("lock").disabled = false;
    });
  }

  async function createRound() {
    err("");
    try {
      var data = await api("POST", "/api/rooms");
      location.href = "?r=" + data.code;
    } catch (e) { err(e.message); }
  }

  async function lockIn() {
    if (!picked) return;
    if (!confirm("Lock in this position? You cannot change it for this round.")) return;
    $("lock").disabled = true;
    err("");
    try {
      var data = await api("POST", "/api/rooms/" + code + "/submit", picked);
      token = data.token;
      saveToken(code, token);
      show("pick", false);
      startPolling();
    } catch (e) { err(e.message); $("lock").disabled = false; }
  }

  function startPolling() {
    show("status", true);
    refresh();
    clearInterval(pollTimer);
    pollTimer = setInterval(refresh, 3000);
  }

  var TEXT = {
    far: "Far apart (more than 2/3 of the galaxy width). Good to play!",
    medium: "Medium distance (1/3 to 2/3 of the galaxy width). Good to play!",
    reroll: "Too close. Regenerate the galaxy and start a new round."
  };

  async function refresh() {
    try {
      var s = await api("GET", "/api/rooms/" + code + "?token=" + encodeURIComponent(token));
      err("");
      if (!s.isPlayer) { clearInterval(pollTimer); show("status", false); show("full", true); return; }
      var done = !!s.result;
      show("waiting", !done);
      show("resultBox", done);
      if (!done) return;
      $("resultBox").textContent = TEXT[s.result];
      $("resultBox").className = "result " + (s.result === "reroll" ? "bad" : "ok");
      show("rerollActions", s.result === "reroll");
      show("revealBlock", true);
      var v = s.revealVotes;
      $("reveal").disabled = v.you;
      $("revealState").textContent = s.reveal ? "" :
        v.you ? "Waiting for the other player to agree…" :
        v.other ? "The other player has asked to reveal." : "";
      if (s.reveal) {
        clearInterval(pollTimer);
        show("revealMapWrap", true);
        var svg = buildMap($("revealMap"));
        marker(svg, s.reveal.you, "var(--me)");
        marker(svg, s.reveal.other, "var(--other)");
        $("revealDist").textContent = " · distance " + Math.round(s.reveal.distance * 100) + "% of galaxy width";
      }
    } catch (e) { err(e.message); }
  }

  async function reveal() {
    if (!confirm("Only do this after the game. Ask to reveal both positions?")) return;
    try {
      await api("POST", "/api/rooms/" + code + "/reveal", { token: token });
      refresh();
    } catch (e) { err(e.message); }
  }

  async function openRoom(c) {
    code = c;
    $("code").textContent = c;
    show("room", true);
    token = loadToken(c);
    if (token) { startPolling(); return; }
    try {
      var s = await api("GET", "/api/rooms/" + c);
      if (s.submitted >= 2) { show("full", true); return; }
      show("pick", true);
      setupPicker();
    } catch (e) { err(e.message); }
  }

  $("newRound").onclick = createRound;
  $("newRound2").onclick = createRound;
  $("lock").onclick = lockIn;
  $("reveal").onclick = reveal;
  $("join").onclick = function () {
    var c = $("joinCode").value.trim().toUpperCase();
    if (c) location.href = "?r=" + encodeURIComponent(c);
  };
  $("copyLink").onclick = function () {
    var link = location.origin + location.pathname + "?r=" + code;
    navigator.clipboard.writeText(link).then(function () {
      $("copyLink").textContent = "Link copied";
    }, function () { prompt("Copy this link:", link); });
  };

  var r = new URLSearchParams(location.search).get("r");
  if (r) openRoom(r.toUpperCase()); else show("home", true);
})();
</script>
</body>
</html>`;
