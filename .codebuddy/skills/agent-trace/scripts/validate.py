#!/usr/bin/env python3
"""Validate a trace JSON against the agent-trace data model."""
import sys
import json

KINDS = {"entry", "trigger", "step", "parallel", "loop",
         "branch", "async", "spawn", "io"}
TRIG_TYPES = {"rule", "memory", "hook", "skill", "tool"}


def validate_node(node, path):
    ok = True
    if not isinstance(node, dict):
        print(f"ERROR: {path} 不是对象")
        return False
    for f in ("id", "kind", "label"):
        if f not in node:
            print(f"ERROR: {path} 缺少字段 {f}")
            ok = False
    if node.get("kind") not in KINDS:
        print(f"ERROR: {path} kind={node.get('kind')} 非法")
        ok = False
    for i, c in enumerate(node.get("children", [])):
        if not validate_node(c, f"{path}.children[{i}]"):
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

    ok = True
    if "entry" not in t:
        print("ERROR: 缺少 entry")
        ok = False
    if "flow" not in t or not isinstance(t["flow"], list):
        print("ERROR: flow 缺失或非数组")
        ok = False
    else:
        for i, n in enumerate(t["flow"]):
            if not validate_node(n, f"flow[{i}]"):
                ok = False
    for i, tr in enumerate(t.get("triggers", [])):
        if not isinstance(tr, dict) or "type" not in tr or "name" not in tr:
            print(f"ERROR: triggers[{i}] 缺少 type/name")
            ok = False
        elif tr.get("type") not in TRIG_TYPES:
            print(f"ERROR: triggers[{i}] type={tr.get('type')} 非法")
            ok = False

    if ok:
        print("OK: trace 结构合法")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
