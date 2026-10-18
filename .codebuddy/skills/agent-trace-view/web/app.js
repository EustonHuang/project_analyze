"use strict";

let current = null;
let selectedId = null;
let fileCache = null;      // { path, content, start, end, isMd }
let fileMode = "raw";      // raw | rendered
let viewerConfig = null;   // { project_root, default_trace } from /api/config

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
  entry: "round-rectangle", exit: "round-rectangle", step: "rectangle",
  decision: "diamond", io: "rhomboid", parallel: "round-rectangle",
  loop: "round-rectangle", trigger: "rectangle", branch: "diamond",
  async: "rectangle", spawn: "rectangle",
};
const COLOR_BY_KIND = {
  entry: "#1d4ed8", exit: "#1d4ed8", step: "#4a90d9", decision: "#d97706",
  io: "#16a085", parallel: "#e08e0b", loop: "#7b4ea3", trigger: "#4a90d9",
  branch: "#2aa198", async: "#c0392b", spawn: "#c0392b",
};
const SHAPE_ICON = {
  entry: "◉", exit: "◉", step: "▭", decision: "◇", io: "▱",
  parallel: "▤", loop: "↻", trigger: "▭", branch: "◇", async: "▭", spawn: "▭",
};

function buildGraph(data) {
  const nodes = {}, edges = [], roots = [];
  if (data.phases) {
    data.phases.forEach((ph) => (ph.nodes || []).forEach((n) => (nodes[n.id] = n)));
    Object.values(nodes).forEach((n) => {
      if (n.kind === "entry") roots.push(n.id);
      (n.children || []).forEach((cid) => { if (typeof cid === "string") edges.push({ source: n.id, target: cid, label: "" }); });
      if (n.kind === "decision") {
        if (n.yes_branch) edges.push({ source: n.id, target: n.yes_branch, label: "yes" });
        if (n.no_branch) edges.push({ source: n.id, target: n.no_branch, label: "no" });
      }
    });
    if (!roots.length && data.phases.length)
      (data.phases[0].nodes || []).forEach((n) => { if (n.kind === "entry") roots.push(n.id); });
  } else {
    (function walk(list, pid) {
      (list || []).forEach((n, i) => {
        const id = n.id || (pid ? pid + "." + i : "n" + i);
        nodes[id] = n;
        if (pid) edges.push({ source: pid, target: id, label: "" });
        if (n.kind === "entry") roots.push(id);
        if (n.kind === "loop") edges.push({ source: id, target: id, label: "", loop: true });
        walk(n.children || [], id);
      });
    })(data.flow || [], null);
  }
  return { nodes, edges, roots };
}

function render(g) {
  if (!g) return;
  renderNav(g);
  const n = selectedId && g.nodes[selectedId];
  if (n) select(n, false);
}

// ---- left: Phase Navigator (flat, grouped, collapsible) -------------------
function renderNav(g) {
  const root = document.getElementById("tree");
  root.innerHTML = "";
  const showDec = document.getElementById("showDecisions").checked;
  const term = document.getElementById("search").value.trim().toLowerCase();
  const phases = current.phases || [{ id: "_", name: "流程", nodes: Object.values(g.nodes) }];

  phases.forEach((ph, pi) => {
    const visible = (ph.nodes || []).filter((n) => {
      if (showDec && n.kind !== "decision") return false;
      if (term && !JSON.stringify(n).toLowerCase().includes(term)) return false;
      return true;
    });
    if (!visible.length) return;

    const block = document.createElement("div");
    block.className = "phase-block";

    const head = document.createElement("div");
    head.className = "phase-head";
    const badge = document.createElement("span");
    badge.className = "phase-badge " + (ph.kind || "");
    badge.textContent = ph.kind || "";
    head.appendChild(badge);
    const title = document.createElement("span");
    title.className = "phase-title";
    title.textContent = "P" + (pi + 1) + " · " + (ph.name || ph.id || "");
    head.appendChild(title);
    head.onclick = () => block.classList.toggle("collapsed");
    block.appendChild(head);

    const list = document.createElement("div");
    list.className = "phase-list";
    visible.forEach((n) => {
      const row = document.createElement("div");
      row.className = "node-row kind-" + (n.kind || "step") + (n.id === selectedId ? " selected" : "");
      const icon = document.createElement("span");
      icon.className = "node-icon"; icon.textContent = SHAPE_ICON[n.kind] || "▭";
      row.appendChild(icon);
      const idEl = document.createElement("span");
      idEl.className = "node-id"; idEl.textContent = n.id;
      row.appendChild(idEl);
      const label = document.createElement("span");
      label.className = "node-label"; label.textContent = n.label || n.id;
      row.appendChild(label);
      if (n.kind === "decision") {
        const br = document.createElement("span");
        br.className = "node-branch";
        br.textContent = " ✓" + (n.yes_branch || "?") + " ✗" + (n.no_branch || "?");
        row.appendChild(br);
      }
      if (n.source && n.source.path && document.getElementById("showSources").checked) {
        const sp = document.createElement("span");
        sp.className = "node-src"; sp.textContent = n.source.path;
        row.appendChild(sp);
      }
      row.onclick = () => select(n, true);
      list.appendChild(row);
    });
    block.appendChild(list);
    root.appendChild(block);
  });
}

// ---- selection: source inspector + file viewer ----------------------------
function select(n, scrollNav) {
  selectedId = n.id;
  document.querySelectorAll(".node-row.selected").forEach((el) => el.classList.remove("selected"));
  document.querySelectorAll(".node-row").forEach((el) => {
    const idEl = el.querySelector(".node-id");
    if (idEl && idEl.textContent === n.id) el.classList.add("selected");
  });
  renderSource(n);
  showFile(n);
}

function renderSource(n) {
  const target = document.getElementById("sourceBody");
  target.innerHTML = "";
  const kind = document.createElement("div");
  kind.className = "src-kind kind-" + (n.kind || "step");
  kind.textContent = (SHAPE_ICON[n.kind] || "▭") + " " + (n.kind || "step") + "  [" + n.id + "]";
  target.appendChild(kind);
  const title = document.createElement("h4"); title.textContent = n.label || n.id;
  target.appendChild(title);
  if (n.detail) { const d = document.createElement("div"); d.className = "src-detail"; d.textContent = n.detail; target.appendChild(d); }

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
  if (n.kind === "decision") {
    const br = document.createElement("div"); br.className = "src-branch";
    br.textContent = "分支：yes → " + (n.yes_branch || "?") + " ／ no → " + (n.no_branch || "?");
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

// ---- graph overlay -------------------------------------------------------
function renderGraph(g) {
  const container = document.getElementById("cy");
  if (window.cy) { window.cy.destroy(); window.cy = null; }
  const showSources = document.getElementById("showSources").checked;
  const elements = [];
  Object.entries(g.nodes).forEach(([id, n]) => {
    const s = n.source || {};
    const sub = s.path ? " [" + s.path + "]" : "";
    const label = (n.label || n.kind || "step") + (showSources && sub ? "\n" + sub : "");
    elements.push({ data: { id, label }, classes: n.kind || "step" });
  });
  g.edges.forEach((e) => {
    if (e.loop) elements.push({ data: { id: e.source + ">self", source: e.source, target: e.source }, classes: "loop" });
    else elements.push({ data: { id: e.source + ">" + e.target, source: e.source, target: e.target, label: e.label }, classes: "edge" + (e.label ? " branch" : "") });
  });
  if (typeof cytoscape === "undefined") {
    container.innerHTML = '<div class="graph-fallback"><p>图视图需要 Cytoscape.js（CDN）。</p><p>拓扑：' +
      Object.keys(g.nodes).length + " 节点 / " + g.edges.length + " 边。</p></div>";
    return;
  }
  window.cy = cytoscape({
    container,
    elements,
    style: [
      { selector: "node", style: {
        label: "data(label)", "text-wrap": "wrap", "text-max-width": 130,
        "background-color": "#4a90d9", color: "#fff", "font-size": 10,
        "text-valign": "center", "text-halign": "center", width: 120, height: 50,
        "border-width": 2, "border-color": "#2b3a4a", shape: "rectangle" } },
      ...Object.entries(SHAPE_BY_KIND).map(([k, s]) => ({ selector: ".key-" + k, style: { shape: s } })),
      ...Object.entries(COLOR_BY_KIND).map(([k, c]) => ({ selector: ".key-" + k, style: { "background-color": c, "border-color": c } })),
      { selector: "edge", style: {
        width: 2, "line-color": "#999", "target-arrow-color": "#999", "target-arrow-shape": "triangle",
        "curve-style": "bezier", "font-size": 9, label: "data(label)",
        "text-rotation": "autorotate", color: "#b45309" } },
      { selector: "edge.branch", style: { "line-color": "#b45309", "target-arrow-color": "#b45309" } },
      { selector: "edge.loop", style: { "line-style": "dashed", "loop-direction": "0deg", "loop-sweep": "-45deg" } },
    ],
    layout: { name: "breadthfirst", directed: true, padding: 20, fit: true },
  });
  Object.entries(g.nodes).forEach(([id, n]) => {
    const el = window.cy.getElementById(id);
    if (el) el.addClass("key-" + (n.kind || "step"));
  });
  window.cy.on("tap", "node", (e) => {
    const n = g.nodes[e.target.id()];
    if (n) select(n, true);
  });
}

function openGraph() {
  if (!current) return;
  document.getElementById("graphOverlay").classList.add("open");
  renderGraph(buildGraph(current));
}
function closeGraph() {
  document.getElementById("graphOverlay").classList.remove("open");
}

// ---- load ----------------------------------------------------------------
async function loadList() {
  try {
    viewerConfig = await api("/api/config");
  } catch (e) {
    viewerConfig = null;
  }
  const data = await api("/api/traces");
  const sel = document.getElementById("traceSelect");
  sel.innerHTML = "";
  data.traces.forEach((t) => { const o = document.createElement("option"); o.value = t; o.textContent = t; sel.appendChild(o); });
  if (data.default && Array.from(sel.options).some((o) => o.value === data.default)) {
    sel.value = data.default;
  }
  if (data.traces.length) loadTrace(); else document.getElementById("tree").textContent = "没有 trace 文件";
}
async function loadTrace() {
  const name = document.getElementById("traceSelect").value;
  if (!name) return;
  current = await api("/api/traces/" + encodeURIComponent(name) + "?" + params());
  const firstEntry = current.phases && current.phases
    .flatMap((ph) => ph.nodes || [])
    .find((n) => n.kind === "entry");
  selectedId = (firstEntry || {}).id || null;
  const g = buildGraph(current);
  renderNav(g);
  if (selectedId && g.nodes[selectedId]) select(g.nodes[selectedId], false);
  else render(g);
  if (document.getElementById("graphOverlay").classList.contains("open")) renderGraph(g);
}

document.getElementById("toggleTree").onclick = () => document.getElementById("treePanel").classList.toggle("collapsed");
document.getElementById("toggleGraph").onclick = () => {
  const ov = document.getElementById("graphOverlay");
  if (ov.classList.contains("open")) closeGraph(); else openGraph();
};
document.getElementById("closeGraph").onclick = closeGraph;
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeGraph(); });
document.getElementById("mdRaw").onclick = () => { fileMode = "raw"; setMdButtons("raw"); renderFile(); };
document.getElementById("mdRendered").onclick = () => { fileMode = "rendered"; setMdButtons("rendered"); renderFile(); };
document.getElementById("traceSelect").onchange = loadTrace;
document.getElementById("reload").onclick = loadTrace;
document.getElementById("showDecisions").onchange = () => { renderNav(buildGraph(current || { nodes: {} })); };
document.getElementById("showSources").onchange = () => { renderNav(buildGraph(current || { nodes: {} })); };
document.getElementById("search").oninput = debounce(() => { renderNav(buildGraph(current || { nodes: {} })); }, 300);

loadList();
