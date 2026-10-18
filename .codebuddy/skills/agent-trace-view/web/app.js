"use strict";

let current = null;
let selectedId = null;
let fileCache = null;      // { path, content, start, end, isMd }
let fileMode = "raw";      // raw | rendered
let viewerConfig = null;   // { project_root, default_trace } from /api/config
let graphCy = null;        // Cytoscape instance
let currentView = "tree";  // "tree" | "graph"
let expanded = new Set();  // node ids whose children are shown
let nestedById = {};       // id -> raw node (incl. nested)
let lastGraph = null;      // last built graph

const api = (p) => fetch(p).then((r) => r.json());

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
function params() {
  const p = new URLSearchParams();
  if (document.getElementById("showDecisions").checked) p.set("kinds", "decision");
  const q = document.getElementById("search").value.trim();
  if (q) p.set("q", q);
  return p.toString();
}

const SHAPE_BY_KIND = {
  start: "round-rectangle", end: "round-rectangle",
  process: "rectangle", decision: "diamond",
};
const COLOR_BY_KIND = {
  start: "#1d4ed8", end: "#1d4ed8",
  process: "#4a90d9", decision: "#d97706",
};
const SHAPE_ICON = {
  start: "◉", end: "◉", process: "▭", decision: "◇",
};

// ---- build a nested id index + flatten to visible nodes ------------------
function buildNestedIndex(nodes, acc) {
  (nodes || []).forEach((n) => {
    acc[n.id] = n;
    if (Array.isArray(n.nodes)) buildNestedIndex(n.nodes, acc);
  });
}

function firstVisibleId(id) {
  let n = nestedById[id];
  while (n && Array.isArray(n.nodes) && n.nodes.length && expanded.has(n.id)) {
    n = n.nodes[0];
  }
  return n ? n.id : id;
}

function flatten(nodes, parentNext, depth, out) {
  for (const n of (nodes || [])) {
    const hasKids = Array.isArray(n.nodes) && n.nodes.length > 0;
    const open = hasKids && expanded.has(n.id);
    if (open) {
      flatten(n.nodes, n.next, depth + 1, out);
    } else {
      const node = Object.assign({}, n);
      // 嵌套子链的末节点 next=null 时，回落到父节点的 next（父被 children 取代）
      if (node.next == null && parentNext != null) node.next = parentNext;
      node._depth = depth;
      out.push(node);
    }
  }
}

function buildGraph(data) {
  buildNestedIndex(data.nodes || [], nestedById);
  const flat = [];
  flatten(data.nodes || [], null, 0, flat);
  const nodes = {}, edges = [];
  flat.forEach((n) => { nodes[n.id] = n; });
  flat.forEach((n) => {
    const nx = n.next;
    if (nx == null) return;
    const push = (tgt, label) => {
      if (!tgt) return;
      const real = firstVisibleId(tgt);
      if (!nodes[real]) return;
      edges.push({ source: n.id, target: real, label: label || "" });
    };
    if (typeof nx === "string") push(nx, "");
    else if (Array.isArray(nx)) nx.forEach((e) => {
      if (typeof e === "string") push(e, "");
      else push(e.to, e.label);
    });
  });
  const hasIncoming = new Set(edges.map((e) => e.target));
  const roots = [];
  flat.forEach((n) => { if (!hasIncoming.has(n.id)) roots.push(n.id); });
  if (!roots.length && flat.length) roots.push(flat[0].id);
  return { nodes, edges, roots };
}

function render(g) {
  if (!g) return;
  renderNav(g);
  const n = selectedId && g.nodes[selectedId];
  if (n) select(n, false);
}

// ---- left: collapsible tree ----------------------------------------------
function allParentIds() {
  const s = new Set();
  Object.values(nestedById).forEach((n) => {
    if (Array.isArray(n.nodes) && n.nodes.length) s.add(n.id);
  });
  return s;
}
function subtreeMatches(n, term) {
  if (JSON.stringify(n).toLowerCase().includes(term)) return true;
  if (Array.isArray(n.nodes)) return n.nodes.some((c) => subtreeMatches(c, term));
  return false;
}

function renderNav(g) {
  const root = document.getElementById("tree");
  root.innerHTML = "";
  const showDec = document.getElementById("showDecisions").checked;
  const term = document.getElementById("search").value.trim().toLowerCase();
  const eff = term ? allParentIds() : expanded;
  renderNavLevel(current.nodes || [], root, 0, showDec, term, eff);
}

function renderNavLevel(nodes, container, depth, showDec, term, eff) {
  nodes.forEach((n) => {
    const hasKids = Array.isArray(n.nodes) && n.nodes.length > 0;
    if (showDec && n.kind !== "decision") return;
    if (term && !subtreeMatches(n, term)) return;

    const row = document.createElement("div");
    row.className = "node-row kind-" + (n.kind || "process") + (n.id === selectedId ? " selected" : "");
    row.style.marginLeft = (depth * 14) + "px";

    const caret = document.createElement("span");
    caret.className = "node-caret" + (hasKids ? "" : " empty");
    caret.textContent = hasKids ? (eff.has(n.id) ? "▾" : "▸") : "";
    caret.onclick = (e) => {
      e.stopPropagation();
      if (!hasKids) return;
      if (expanded.has(n.id)) expanded.delete(n.id); else expanded.add(n.id);
      rebuild();
    };
    row.appendChild(caret);

    const icon = document.createElement("span");
    icon.className = "node-icon"; icon.textContent = SHAPE_ICON[n.kind] || "▭";
    row.appendChild(icon);
    const idEl = document.createElement("span");
    idEl.className = "node-id"; idEl.textContent = n.id;
    row.appendChild(idEl);
    const label = document.createElement("span");
    label.className = "node-label"; label.textContent = (n.content || n.id).split("\n")[0];
    row.appendChild(label);
    if (n.kind === "decision" && Array.isArray(n.next)) {
      const yes = n.next.find((e) => (typeof e === "string" ? false : e.label === "yes"));
      const no = n.next.find((e) => (typeof e === "string" ? false : e.label === "no"));
      const br = document.createElement("span");
      br.className = "node-branch";
      br.textContent = " ✓" + (yes && yes.to ? yes.to : "?") + " ✗" + (no && no.to ? no.to : "?");
      row.appendChild(br);
    }
    if (n.source && n.source.path && document.getElementById("showSources").checked) {
      const sp = document.createElement("span");
      sp.className = "node-src"; sp.textContent = n.source.path;
      row.appendChild(sp);
    }
    row.onclick = () => select(findRaw(n.id), true);
    container.appendChild(row);

    if (hasKids && eff.has(n.id)) renderNavLevel(n.nodes, container, depth + 1, showDec, term, eff);
  });
}

function findRaw(id) {
  return nestedById[id] || null;
}

// ---- selection: source inspector + file viewer ----------------------------
function select(n, syncNav) {
  selectedId = n.id;
  document.querySelectorAll(".node-row.selected").forEach((el) => el.classList.remove("selected"));
  document.querySelectorAll(".node-row").forEach((el) => {
    const idEl = el.querySelector(".node-id");
    if (idEl && idEl.textContent === n.id) el.classList.add("selected");
  });
  renderSource(n);
  showFile(n);
  if (graphCy && typeof graphCy.getElementById === "function") {
    graphCy.elements().removeClass("selected");
    const el = graphCy.getElementById(n.id);
    if (el && el.length) el.addClass("selected");
  }
}

function renderSource(n) {
  const target = document.getElementById("sourceBody");
  target.innerHTML = "";
  const kind = document.createElement("div");
  kind.className = "src-kind kind-" + (n.kind || "process");
  kind.textContent = (SHAPE_ICON[n.kind] || "▭") + " " + (n.kind || "process") + "  [" + n.id + "]";
  target.appendChild(kind);
  const lines = (n.content || n.id).split("\n");
  const title = document.createElement("h4"); title.textContent = lines[0];
  target.appendChild(title);
  if (lines.length > 1) { const d = document.createElement("div"); d.className = "src-detail"; d.textContent = lines.slice(1).join("\n"); target.appendChild(d); }

  const src = n.source;
  if (src) {
    const box = document.createElement("div"); box.className = "src-box";
    const h = document.createElement("div"); h.className = "src-box-head";
    h.textContent = "来源 (" + src.type + ")"; box.appendChild(h);
    if (src.type === "file") {
      const loc = document.createElement("div"); loc.className = "src-loc";
      const root = (viewerConfig && viewerConfig.project_root) || "";
      const abs = src.path.startsWith("/") ? src.path : (root ? root + "/" + src.path : src.path);
      loc.innerHTML = '<a href="vscode://file/' + abs + ":" + src.line_start + '" title="在 IDE 打开">' +
        esc(src.path) + " : " + src.line_start + "-" + src.line_end + "</a>";
      box.appendChild(loc);
    } else if (src.type === "system_prompt") {
      const sec = document.createElement("div"); sec.className = "src-loc";
      sec.textContent = "section: " + src.section; box.appendChild(sec);
    }
    if (src.quote) { const q = document.createElement("pre"); q.className = "src-quote"; q.textContent = "“" + src.quote + "”"; box.appendChild(q); }
    target.appendChild(box);
  }
  if (n.kind === "decision" && Array.isArray(n.next)) {
    const yes = n.next.find((e) => (typeof e === "string" ? false : e.label === "yes"));
    const no = n.next.find((e) => (typeof e === "string" ? false : e.label === "no"));
    const br = document.createElement("div"); br.className = "src-branch";
    br.textContent = "分支：yes → " + (yes && yes.to ? yes.to : "?") + " ／ no → " + (no && no.to ? no.to : "?");
    target.appendChild(br);
  }
}

// ---- right: File Viewer (whole file, line numbers, target highlight) ------
async function showFile(n) {
  const body = document.getElementById("fileBody");
  const head = document.getElementById("fileTitle");
  const toggle = document.getElementById("fileToggle");
  const src = n && n.source;
  fileCache = null;
  toggle.classList.add("hidden");
  setMdButtons("raw");

  if (!src) {
    head.textContent = "文件查看器";
    body.innerHTML = '<div class="file-hint">该节点无来源。</div>';
    return;
  }
  if (src.type !== "file") {
    head.textContent = "system_prompt 来源";
    body.innerHTML = '<div class="src-box"><div class="src-box-head">section</div>' +
      '<div class="src-detail">' + esc(src.section || "") + "</div>" +
      (src.quote ? '<pre class="src-quote">' + esc(src.quote) + "</pre>" : "") + "</div>";
    return;
  }

  head.textContent = src.path + " : " + (src.line_start || "?") + "-" + (src.line_end || "?");
  body.innerHTML = '<div class="file-hint">加载中…</div>';
  let data;
  try {
    const res = await fetch("/api/file?path=" + encodeURIComponent(src.path));
    data = await res.json();
    if (!res.ok) throw new Error(data.error || res.status);
  } catch (e) {
    body.innerHTML = '<div class="file-hint">读取失败：' + esc(e.message) + "</div>";
    return;
  }
  fileCache = {
    path: src.path, content: data.content,
    start: src.line_start || 0, end: src.line_end || 0,
    isMd: /\.mdx?$/i.test(src.path),
  };
  if (fileCache.isMd) toggle.classList.remove("hidden");
  renderFile();
}

function setMdButtons(mode) {
  document.getElementById("mdRaw").classList.toggle("active", mode === "raw");
  document.getElementById("mdRendered").classList.toggle("active", mode === "rendered");
}

function renderFile() {
  if (!fileCache) return;
  const body = document.getElementById("fileBody");
  if (fileMode === "rendered" && fileCache.isMd) {
    if (typeof marked === "undefined") {
      body.innerHTML = '<div class="file-hint">marked.js（CDN）不可用，回退 Raw。</div>';
      fileMode = "raw"; setMdButtons("raw");
    } else {
      body.innerHTML = '<div class="file-md">' + marked.parse(fileCache.content) + "</div>";
      return;
    }
  }
  const lines = fileCache.content.split("\n");
  const wrap = document.createElement("div");
  wrap.className = "file-raw";
  lines.forEach((ln, i) => {
    const no = i + 1;
    const row = document.createElement("div");
    row.className = "file-line" + (no >= fileCache.start && no <= fileCache.end ? " target" : "");
    const noEl = document.createElement("span");
    noEl.className = "file-no"; noEl.textContent = no;
    const code = document.createElement("span");
    code.className = "file-code"; code.textContent = ln === "" ? " " : ln;
    row.append(noEl, code);
    wrap.appendChild(row);
  });
  body.innerHTML = "";
  body.appendChild(wrap);
  const t = wrap.querySelector(".file-line.target");
  if (t) t.scrollIntoView({ block: "center" });
  else body.scrollTop = 0;
}

// ---- left panel: tree / graph tab switching ---------------------------------
function showTreeView() {
  currentView = "tree";
  document.getElementById("tabTree").classList.add("active");
  document.getElementById("tabGraph").classList.remove("active");
  document.getElementById("treeView").classList.remove("hidden");
  document.getElementById("graphView").classList.add("hidden");
}

function showGraphView() {
  currentView = "graph";
  document.getElementById("tabTree").classList.remove("active");
  document.getElementById("tabGraph").classList.add("active");
  document.getElementById("treeView").classList.add("hidden");
  document.getElementById("graphView").classList.remove("hidden");
  if (lastGraph) renderGraph(lastGraph);
}

// ---- rebuild (nav + graph) on expand/collapse/search/filter -----------------
function rebuild() {
  const g = buildGraph(current);
  lastGraph = g;
  renderNav(g);
  if (currentView === "graph" && g) renderGraph(g);
}

// ---- graph panel ---------------------------------------------------------
function renderGraph(g) {
  const container = document.getElementById("cy");
  if (graphCy && typeof graphCy.destroy === "function") {
    try { graphCy.destroy(); } catch (_) {}
  }
  graphCy = null;
  if (!g) return;
  lastGraph = g;

  const elements = [];
  Object.entries(g.nodes).forEach(([id, n]) => {
    const label = (n.content || n.kind || "process").split("\n")[0];
    const cls = ["key-" + (n.kind || "process")];
    if (id === selectedId) cls.push("selected");
    if (nestedById[id] && Array.isArray(nestedById[id].nodes) && nestedById[id].nodes.length) cls.push("has-children");
    elements.push({ data: { id, label }, classes: cls.join(" ") });
  });
  g.edges.forEach((e) => {
    if (e.source === e.target) elements.push({ data: { id: e.source + ">self", source: e.source, target: e.source }, classes: "loop" });
    else elements.push({ data: { id: e.source + ">" + e.target, source: e.source, target: e.target, label: e.label }, classes: "edge" + (e.label ? " branch" : "") });
  });
  if (typeof cytoscape === "undefined") {
    container.innerHTML = '<div class="graph-fallback"><p>图视图需要 Cytoscape.js（CDN）。</p><p>拓扑：' +
      Object.keys(g.nodes).length + " 节点 / " + g.edges.length + " 边。</p></div>";
    return;
  }
  if (!elements.length) {
    container.innerHTML = '<div class="graph-fallback"><p>当前 trace 没有可渲染节点。</p></div>';
    return;
  }

  function doRender() {
    if (!container.offsetWidth || !container.offsetHeight) {
      setTimeout(doRender, 50);
      return;
    }
    const kindStyles = Object.keys(SHAPE_BY_KIND).map((k) => ({
      selector: ".key-" + k,
      style: {
        shape: SHAPE_BY_KIND[k],
        "background-color": COLOR_BY_KIND[k],
        "border-color": COLOR_BY_KIND[k],
      },
    }));
    graphCy = cytoscape({
      container,
      elements,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      wheelSensitivity: 0.3,
      boxSelectionEnabled: false,
      style: [
        { selector: "node", style: {
          label: "data(label)", "text-wrap": "wrap", "text-max-width": 150,
          "background-color": "#4a90d9", color: "#fff", "font-size": 12,
          "text-valign": "center", "text-halign": "center", width: 150, height: 55,
          "border-width": 2, "border-color": "#2b3a4a", shape: "rectangle" } },
        ...kindStyles,
        { selector: "node.selected", style: { "border-color": "#facc15", "border-width": 4 } },
        { selector: "node.has-children", style: { "border-style": "double", "border-width": 4, "border-color": "#16a34a" } },
        { selector: "edge", style: {
          width: 2, "line-color": "#64748b", "target-arrow-color": "#64748b", "target-arrow-shape": "triangle",
          "curve-style": "bezier", "font-size": 11, label: "data(label)",
          "text-rotation": "autorotate", color: "#b45309" } },
        { selector: "edge.branch", style: { "line-color": "#b45309", "target-arrow-color": "#b45309" } },
        { selector: "edge.loop", style: { "line-style": "dashed", "loop-direction": "0deg", "loop-sweep": "-45deg" } },
      ],
    });

    graphCy.on("tap", "node", (e) => {
      const id = e.target.id();
      const raw = nestedById[id];
      if (!raw) return;
      if (Array.isArray(raw.nodes) && raw.nodes.length) {
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        rebuild();
      }
      const g2 = buildGraph(current);
      lastGraph = g2;
      if (g2.nodes[id]) {
        select(g2.nodes[id], true);
        if (graphCy && typeof graphCy.getElementById === "function") {
          graphCy.elements().removeClass("selected");
          const el = graphCy.getElementById(id);
          if (el && el.length) el.addClass("selected");
        }
      }
    });

    graphCy.resize();
    const layout = graphCy.layout({
      name: "breadthfirst",
      directed: true,
      padding: 20,
      fit: true,
      animate: false,
    });
    layout.on("layoutstop", () => {
      if (graphCy && typeof graphCy.fit === "function") graphCy.fit(graphCy.elements(), 20);
    });
    layout.run();
  }

  setTimeout(doRender, 100);
}

function graphZoom(level) {
  if (!graphCy || typeof graphCy.zoom !== "function") return;
  graphCy.zoom(level);
  graphCy.center();
}

function graphFit() {
  if (!graphCy || typeof graphCy.fit !== "function") return;
  graphCy.fit(graphCy.elements(), 20);
}

// ---- resizable panels ----------------------------------------------------
function loadPanelSizes() {
  try {
    const saved = JSON.parse(localStorage.getItem("atv-panels") || "{}");
    if (saved.tree) document.getElementById("treePanel").style.flex = "0 0 " + saved.tree + "px";
    if (saved.source) document.getElementById("sourcePanel").style.flex = "0 0 " + saved.source + "px";
  } catch (_) {}
}

function savePanelSizes(tree, source) {
  try { localStorage.setItem("atv-panels", JSON.stringify({ tree, source })); } catch (_) {}
}

function setupResizer(resizerId, prevId, nextId, key) {
  const resizer = document.getElementById(resizerId);
  if (!resizer) return;
  let startX = 0, startPrev = 0, startNext = 0;
  function onMove(e) {
    const dx = e.clientX - startX;
    const newPrev = Math.max(180, startPrev + dx);
    const newNext = Math.max(280, startNext - dx);
    document.getElementById(prevId).style.flex = "0 0 " + newPrev + "px";
    document.getElementById(nextId).style.flex = "0 0 " + newNext + "px";
    if (key === "tree") savePanelSizes(newPrev, null);
    if (key === "source") {
      const treeW = document.getElementById("treePanel").getBoundingClientRect().width;
      savePanelSizes(treeW, newPrev);
    }
    if (graphCy && typeof graphCy.resize === "function") graphCy.resize();
  }
  function onUp() {
    resizer.classList.remove("dragging");
    document.body.classList.remove("resizing");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startPrev = document.getElementById(prevId).getBoundingClientRect().width;
    startNext = document.getElementById(nextId).getBoundingClientRect().width;
    resizer.classList.add("dragging");
    document.body.classList.add("resizing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

// ---- load ----------------------------------------------------------------
async function loadList() {
  try { viewerConfig = await api("/api/config"); } catch (e) { viewerConfig = null; }
  const data = await api("/api/traces");
  const sel = document.getElementById("traceSelect");
  sel.innerHTML = "";
  data.traces.forEach((t) => { const o = document.createElement("option"); o.value = t; o.textContent = t; sel.appendChild(o); });
  if (data.default && Array.from(sel.options).some((o) => o.value === data.default)) sel.value = data.default;
  if (data.traces.length) loadTrace(); else document.getElementById("tree").textContent = "没有 trace 文件";
}
async function loadTrace() {
  const name = document.getElementById("traceSelect").value;
  if (!name) return;
  current = await api("/api/traces/" + encodeURIComponent(name) + "?" + params());
  expanded = new Set();
  const firstEntry = (current.nodes || []).find((n) => n.kind === "start") || (current.nodes || [])[0];
  selectedId = (firstEntry || {}).id || null;
  const g = buildGraph(current);
  lastGraph = g;
  renderNav(g);
  if (selectedId && g.nodes[selectedId]) select(g.nodes[selectedId], false);
  if (currentView === "graph") renderGraph(g);
}

// ---- event wiring --------------------------------------------------------
document.getElementById("tabTree").onclick = showTreeView;
document.getElementById("tabGraph").onclick = showGraphView;
document.getElementById("graphZoomIn").onclick = () => graphZoom(graphCy.zoom() * 1.2);
document.getElementById("graphZoomOut").onclick = () => graphZoom(graphCy.zoom() / 1.2);
document.getElementById("graphFit").onclick = graphFit;
window.addEventListener("resize", () => {
  if (graphCy && typeof graphCy.resize === "function" && typeof graphCy.fit === "function" && currentView === "graph") {
    graphCy.resize(); graphCy.fit();
  }
});
document.getElementById("mdRaw").onclick = () => { fileMode = "raw"; setMdButtons("raw"); renderFile(); };
document.getElementById("mdRendered").onclick = () => { fileMode = "rendered"; setMdButtons("rendered"); renderFile(); };
document.getElementById("traceSelect").onchange = loadTrace;
document.getElementById("reload").onclick = loadTrace;
document.getElementById("showDecisions").onchange = () => rebuild();
document.getElementById("showSources").onchange = () => rebuild();
document.getElementById("search").oninput = debounce(() => rebuild(), 300);

loadPanelSizes();
setupResizer("resizerLeft", "treePanel", "sourcePanel", "tree");
setupResizer("resizerRight", "sourcePanel", "filePanel", "source");
loadList();
