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
  const kind = document.getElementById("kind").value;
  if (kind) p.set("kinds", kind);
  const q = document.getElementById("search").value.trim();
  if (q) p.set("q", q);
  return p.toString();
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

function collect(flow) {
  const items = [];
  (function walk(list, pid) {
    list.forEach((n, i) => {
      const id = n.id || (pid ? pid + "." + i : "n" + i);
      items.push({ id, node: n, pid });
      walk(n.children || [], id);
    });
  })(flow || [], null);
  return items;
}

function render() {
  const items = collect(current.flow || []);
  renderTree(items);
  renderGraph(items);
  document.getElementById("detailBody").textContent = current.entry || "";
}

function renderTree(items) {
  const byPid = {};
  items.forEach((it) => {
    (byPid[it.pid] = byPid[it.pid] || []).push(it);
  });
  const root = document.getElementById("tree");
  root.innerHTML = "";
  function build(pid) {
    const ul = document.createElement("ul");
    (byPid[pid] || []).forEach((it) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.className = "node " + (it.node.kind || "step");
      span.textContent = "▸ " + (it.node.kind || "step") + ": " + (it.node.label || "");
      span.onclick = () => showDetail(it.node);
      li.appendChild(span);
      if (byPid[it.id] && byPid[it.id].length) li.appendChild(build(it.id));
      ul.appendChild(li);
    });
    return ul;
  }
  root.appendChild(build(null));
}

function renderGraph(items) {
  const container = document.getElementById("cy");
  if (window.cy) {
    window.cy.destroy();
    window.cy = null;
  }
  if (typeof cytoscape === "undefined") {
    container.innerHTML =
      '<p style="padding:1rem">图视图需要 Cytoscape.js（CDN）。左侧树视图可用；联网后刷新即加载图。</p>';
    return;
  }
  const elements = [];
  items.forEach((it) => {
    elements.push({
      data: { id: it.id, label: (it.node.kind || "step") + "\n" + (it.node.label || "") },
      classes: it.node.kind || "step",
    });
    if (it.pid)
      elements.push({ data: { id: it.pid + ">" + it.id, source: it.pid, target: it.id }, classes: it.node.kind || "step" });
    if (it.node.kind === "loop")
      elements.push({ data: { id: it.id + ">self", source: it.id, target: it.id }, classes: "loop" });
  });
  window.cy = cytoscape({
    container,
    elements,
    style: [
      { selector: "node", style: {
        label: "data(label)", "text-wrap": "wrap", "text-max-width": 120,
        "background-color": "#4a90d9", color: "#fff", "font-size": 10,
        "text-valign": "center", "text-halign": "center", width: 90, height: 44,
        shape: "round-rectangle",
      } },
      { selector: "edge", style: {
        width: 2, "line-color": "#999", "target-arrow-color": "#999",
        "target-arrow-shape": "triangle", "curve-style": "bezier",
      } },
      { selector: "edge.loop", style: { "line-style": "dashed", "loop-direction": "0deg", "loop-sweep": "-45deg" } },
      { selector: ".parallel", style: { "background-color": "#e08e0b" } },
      { selector: ".loop", style: { "background-color": "#7b4ea3" } },
      { selector: ".branch", style: { "background-color": "#2aa198" } },
      { selector: ".async, .spawn", style: { "background-color": "#c0392b" } },
      { selector: ".io", style: { "background-color": "#16a085" } },
    ],
    layout: { name: "breadthfirst", directed: true, padding: 20 },
  });
  window.cy.on("tap", "node", (e) => {
    const it = items.find((x) => x.id === e.target.id());
    if (it) showDetail(it.node);
  });
}

function showDetail(node) {
  const d = document.getElementById("detailBody");
  d.innerHTML = "";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = "kind: " + (node.kind || "step");
  d.appendChild(meta);
  const pre = document.createElement("pre");
  pre.textContent = node.detail || "(无 detail)";
  d.appendChild(pre);
  if (node.children && node.children.length) {
    const c = document.createElement("div");
    c.textContent = "子节点数: " + node.children.length;
    d.appendChild(c);
  }
}

document.getElementById("traceSelect").onchange = loadTrace;
document.getElementById("reload").onclick = loadTrace;
document.getElementById("depth").oninput = (e) => {
  document.getElementById("depthVal").textContent = e.target.value;
  loadTrace();
};
document.getElementById("kind").onchange = loadTrace;
document.getElementById("search").oninput = debounce(loadTrace, 300);

loadList();
