#!/usr/bin/env python3
"""Validate a trace JSON against the minimal agent-trace data model.

Model (architecture/012-014): top-level `nodes` array. Each node has
`id`, `kind` (start|process|decision|end), `content`, `next`, `source`.
- `next`: string (single successor) | array of {to,label} (branch/parallel
  /loop) | null (end node).
- `source`: file {path,line_start,line_end,quote} or system_prompt
  {section,quote}; `inferred` is forbidden.
No `phases` / `flow` / `conditions` / `yes_branch` / `no_branch` / `children`.
"""
import sys
import json

KINDS = {"start", "process", "decision", "end"}


def validate_node(node, path, ids):
    ok = True
    if not isinstance(node, dict):
        print(f"ERROR: {path} 不是对象")
        return False
    for f in ("id", "kind", "content"):
        if f not in node:
            print(f"ERROR: {path} 缺少字段 {f}")
            ok = False
    if node.get("kind") not in KINDS:
        print(f"ERROR: {path} kind={node.get('kind')} 非法（仅允许 {sorted(KINDS)}）")
        ok = False

    # source
    src = node.get("source")
    if not isinstance(src, dict) or not src.get("type"):
        print(f"ERROR: {path} 缺少 source.type——强制")
        ok = False
    elif src.get("type") == "file":
        if not src.get("path"):
            print(f"ERROR: {path} source.type=file 缺少 path")
            ok = False
        if not isinstance(src.get("line_start"), int) or not isinstance(src.get("line_end"), int):
            print(f"ERROR: {path} source.type=file 缺少 line_start/line_end（整数）")
            ok = False
        if not src.get("quote"):
            print(f"ERROR: {path} source.type=file 缺少 quote")
            ok = False
    elif src.get("type") == "system_prompt":
        if not src.get("section"):
            print(f"ERROR: {path} source.type=system_prompt 缺少 section")
            ok = False
        if not src.get("quote"):
            print(f"ERROR: {path} source.type=system_prompt 缺少 quote")
            ok = False
    else:
        print(f"ERROR: {path} source.type={src.get('type')} 非法（仅允许 file / system_prompt，禁止 inferred）")
        ok = False

    # next
    nx = node.get("next")
    if nx is None:
        if node.get("kind") != "end":
            print(f"ERROR: {path} next 为 null 但 kind 非 end")
            ok = False
    elif isinstance(nx, str):
        if ids is not None and nx not in ids:
            print(f"ERROR: {path} next={nx} 指向不存在的节点")
            ok = False
    elif isinstance(nx, list):
        if not nx:
            print(f"ERROR: {path} next 为空数组")
            ok = False
        for i, e in enumerate(nx):
            if not isinstance(e, dict) or "to" not in e:
                print(f"ERROR: {path} next[{i}] 缺少 to")
                ok = False
            elif ids is not None and e.get("to") not in ids:
                print(f"ERROR: {path} next[{i}].to={e.get('to')} 指向不存在的节点")
                ok = False
    else:
        print(f"ERROR: {path} next 类型非法（需 string/array/null）")
        ok = False
    return ok


def main():
    if len(sys.argv) < 2:
        print("usage: validate.py <trace.json>")
        sys.exit(2)
    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            t = json.load(f)
    except Exception as e:
        print("ERROR: 无法读取/解析 JSON:", e)
        sys.exit(1)

    if "nodes" not in t or not isinstance(t["nodes"], list) or not t["nodes"]:
        print("ERROR: 顶层需 nodes[] 数组且非空（极简模型，不接受 phases/flow）")
        sys.exit(1)

    ok = True
    ids = set()
    for n in t["nodes"]:
        if isinstance(n, dict) and n.get("id"):
            ids.add(n["id"])
    for i, n in enumerate(t["nodes"]):
        if not validate_node(n, f"nodes[{i}]", ids):
            ok = False

    kinds_present = {n.get("kind") for n in t["nodes"] if isinstance(n, dict)}
    if "start" not in kinds_present:
        print("ERROR: 缺少 kind=start 的入口节点")
        ok = False
    if "end" not in kinds_present:
        print("ERROR: 缺少 kind=end 的结束节点")
        ok = False

    if ok:
        print(f"OK: trace 结构合法（nodes 模型，{len(t['nodes'])} 节点）")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
