"use strict";

let current = null;

const api = (path) => fetch(path).then((r) => r.json());

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

function params() {
  const p = new URLSearchParams();
  p.set("depth", document.getElementById("depth").value);
  if (document.getElementById("showDecisions").checked)
    p.set("kinds", "decision");
  const q = document.getElementById("search").value.trim();
  if (q) p.set("q", q);
  return p.toString();
}

// Shape mapping per architecture/003: every node kind has a flowchart shape.
const SHAPE_BY_KIND = {
  entry: "round-rectangle",
  exit: "round-rectangle",
  step: "rectangle",
  decision: "diamond",
  io: "rhomboid",
  parallel: "round-rectangle",
  loop: "round-rectangle",
  trigger: "rectangle",
  branch: "diamond",
  async: "rectangle",
  spawn: "rectangle",
};
const COLOR_BY_KIND = {
  entry: "#1d4ed8",
  exit: "#1d4ed8",
  step: "#4a90d9",
  decision: "#d97706",
  io: "#16a085",
  parallel: "#e08e0b",
  loop: "#7b4ea3",
  trigger: "#4a90d9",
  branch: "#2aa198",
  async: "#c0392b",
  spawn: "#c0392b",
};

// ---- model adapters -------------------------------------------------------
// Returns { nodes: {id:node}, edges: [{source,target,label}], roots: [ids] }
function buildGraph(data) {
  const nodes = {};
  const edges = [];
  const roots = [];

  if (data.phases) {
    data.phases.forEach((ph) => {
      (ph.nodes || []).forEach((n) => {
        nodes[n.id] = n;
      });
    });
    Object.values(nodes).forEach((n) => {
      if (n.kind === "entry") roots.push(n.id);
      (n.children || []).forEach((cid) => {
        if (typeof cid === "string") edges.push({ source: n.id, target: cid, label: "" });
      });
      if (n.kind === "decision") {
        if (n.yes_branch) edges.push({ source: n.id, target: n.yes_branch, label: "yes" });
        if (n.no_branch) edges.push({ source: n.id, target: n.no_branch, label: "no" });
      }
    });
    if (!roots.length && data.phases.length)
      (data.phases[0].nodes || []).forEach((n) => { if (n.kind === "entry") roots.push(n.id); });
  } else {
    const seen = {};
    (function walk(list, pid) {
      (list || []).forEach((n, i) => {
        const id = n.id || (pid ? pid + "." + i : "n" + i);
        nodes[id] = n;
        if (pid) edges.push({ source: pid, target: id, label: "" });
        if (n.kind === "entry") roots.push(id);
        if (n.kind === "loop")
          edges.push({ source: id, target: id, label: "", loop: true });
        walk(n.children || [], id);
      });
    })(data.flow || [], null);
  }
  return { nodes, edges, roots };
}

function render() {
  const g = buildGraph(current);
  renderTree(g);
  renderGraph(g);
  document.getElementById("detailBody").textContent = current.entry ||
    (current.meta && current.meta.kind) || "（无入口说明）";
}

function renderTree(g) {
  const byPid = {};
  Object.entries(g.edges).forEach(([_, e]) => {
    if (e.loop) return;
    (byPid[e.source] = byPid[e.source] || []).push(e.target);
  });
  const root = document.getElementById("tree");
  root.innerHTML = "";
  const visited = new Set();
  function build(id) {
    if (visited.has(id)) return null;
    visited.add(id);
    const n = g.nodes[id];
    if (!n) return null;
    const ul = document.createElement("ul");
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "node " + (n.kind || "step");
    const tag = n.kind === "decision" ? "◇ " : n.kind === "entry" || n.kind === "exit" ? "◉ " : "▸ ";
    span.textContent = tag + (n.kind || "step") + ": " + (n.label || "");
    span.onclick = () => showDetail(n);
    li.appendChild(span);
    const kids = byPid[id] || [];
    kids.forEach((cid) => {
      const sub = build(cid);
      if (sub) li.appendChild(sub);
    });
    ul.appendChild(li);
    return ul;
  }
  const top = document.createElement("ul");
  (g.roots.length ? g.roots : Object.keys(g.nodes)).forEach((id) => {
    const sub = build(id);
    if (sub) top.appendChild(sub.firstChild);
  });
  root.appendChild(top);
}

function renderGraph(g) {
  const container = document.getElementById("cy");
  if (window.cy) { window.cy.destroy(); window.cy = null; }
  const showSources = document.getElementById("showSources").checked;

  const elements = [];
  Object.entries(g.nodes).forEach(([id, n]) => {
    const src = n.source || {};
    const sub = src.path ? " [" + src.path + "]" : "";
    const label = (n.label || n.kind || "step") + (showSources && sub ? "\n" + sub : "");
    elements.push({
      data: { id, label },
      classes: n.kind || "step",
    });
  });
  g.edges.forEach((e) => {
    if (e.loop) {
      elements.push({ data: { id: e.source + ">self", source: e.source, target: e.source }, classes: "loop" });
    } else {
      elements.push({
        data: { id: e.source + ">" + e.target, source: e.source, target: e.target, label: e.label },
        classes: "edge" + (e.label ? " branch" : ""),
      });
    }
  });

  if (typeof cytoscape === "undefined") {
    container.innerHTML =
      '<p style="padding:1rem">图视图需要 Cytoscape.js（CDN）。左侧树视图可用；联网后刷新即加载图。</p>';
    return;
  }
  window.cy = cytoscape({
    container,
    elements,
    style: [
      {
        selector: "node", style: {
          label: "data(label)", "text-wrap": "wrap", "text-max-width": 130,
          "background-color": "#4a90d9", color: "#fff", "font-size": 10,
          "text-valign": "center", "text-halign": "center",
          width: 120, height: 50, "border-width": 2, "border-color": "#2b3a4a",
          shape: "rectangle",
        },
      },
      ...Object.entries(SHAPE_BY_KIND).map(([k, s]) => ({
        selector: ".key-" + k, style: { shape: s },
      })),
      ...Object.entries(COLOR_BY_KIND).map(([k, c]) => ({
        selector: ".key-" + k, style: { "background-color": c, "border-color": c },
      })),
      {
        selector: "edge", style: {
          width: 2, "line-color": "#999", "target-arrow-color": "#999",
          "target-arrow-shape": "triangle", "curve-style": "bezier", "font-size": 9,
          label: "data(label)", "text-rotation": "autorotate", color: "#b45309",
        },
      },
      { selector: "edge.branch", style: { "line-color": "#b45309", "target-arrow-color": "#b45309", "line-style": "solid" } },
      { selector: "edge.loop", style: { "line-style": "dashed", "loop-direction": "0deg", "loop-sweep": "-45deg" } },
    ],
    layout: { name: "breadthfirst", directed: true, padding: 20 },
  });
  // assign shape classes
  Object.entries(g.nodes).forEach(([id, n]) => {
    const el = window.cy.getElementById(id);
    if (el) el.addClass("key-" + (n.kind || "step"));
  });
  window.cy.on("tap", "node", (e) => {
    const n = g.nodes[e.target.id()];
    if (n) showDetail(n);
  });
}

function showDetail(node) {
  const d = document.getElementById("detailBody");
  d.innerHTML = "";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = "kind: " + (node.kind || "step");
  d.appendChild(meta);

  const src = node.source;
  if (src) {
    const s = document.createElement("div");
    s.className = "source";
    const head = document.createElement("div");
    head.className = "source-head";
    head.textContent = "来源";
    s.appendChild(head);
    const type = document.createElement("div");
    type.textContent = "type: " + (src.type || "—");
    s.appendChild(type);
    const path = document.createElement("div");
    path.textContent = "path: " + (src.path || "—");
    s.appendChild(path);
    if (src.quote) {
      const q = document.createElement("pre");
      q.textContent = "“" + src.quote + "”";
      s.appendChild(q);
    }
    d.appendChild(s);
  }

  const pre = document.createElement("pre");
  pre.textContent = node.detail || "(无 detail)";
  d.appendChild(pre);

  if (node.children && node.children.length) {
    const c = document.createElement("div");
    c.className = "meta";
    c.textContent = "顺序子节点数: " + node.children.length;
    d.appendChild(c);
  }
  if (node.kind === "decision") {
    const c = document.createElement("div");
    c.className = "meta";
    c.textContent = "分支: yes→" + (node.yes_branch || "?") + " / no→" + (node.no_branch || "?");
    d.appendChild(c);
  }
}

async function loadList() {
  const data = await api("/api/traces");
  const sel = document.getElementById("traceSelect");
  sel.innerHTML = "";
  data.traces.forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    o.textContent = t;
    sel.appendChild(o);
  });
  if (data.traces.length) loadTrace();
  else document.getElementById("tree").textContent = "没有 trace 文件";
}

async function loadTrace() {
  const name = document.getElementById("traceSelect").value;
  if (!name) return;
  current = await api("/api/traces/" + encodeURIComponent(name) + "?" + params());
  render();
}

document.getElementById("traceSelect").onchange = loadTrace;
document.getElementById("reload").onclick = loadTrace;
document.getElementById("depth").oninput = (e) => {
  document.getElementById("depthVal").textContent = e.target.value;
  loadTrace();
};
document.getElementById("showDecisions").onchange = loadTrace;
document.getElementById("showSources").onchange = loadTrace;
document.getElementById("search").oninput = debounce(loadTrace, 300);

loadList();
