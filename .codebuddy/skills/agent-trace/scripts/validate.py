#!/usr/bin/env python3
"""Validate a trace JSON against the agent-trace data models.

Two models are supported (backward compatible):

1. Legacy prompt_trace model: top-level `flow` + `triggers`.
2. agent_system_workflow model (architecture/003): top-level `phases`
   + `conditions`. Every node MUST carry `source` (type + path); a
   `decision` node MUST declare `yes_branch` and `no_branch`.
"""
import sys
import json

LEGACY_KINDS = {"entry", "trigger", "step", "parallel", "loop",
                "branch", "async", "spawn", "io"}
WORKFLOW_KINDS = {"entry", "decision", "step", "parallel", "loop", "io", "exit"}
TRIG_TYPES = {"rule", "memory", "hook", "skill", "tool"}


def validate_node(node, path, model, ids=None):
    ok = True
    if not isinstance(node, dict):
        print(f"ERROR: {path} 不是对象")
        return False
    for f in ("id", "kind", "label"):
        if f not in node:
            print(f"ERROR: {path} 缺少字段 {f}")
            ok = False
    if model == "workflow":
        if node.get("kind") not in WORKFLOW_KINDS:
            print(f"ERROR: {path} kind={node.get('kind')} 非法（workflow 模型）")
            ok = False
        src = node.get("source")
        if not isinstance(src, dict) or not src.get("type"):
            print(f"ERROR: {path} 缺少 source.type——workflow 模型强制")
            ok = False
        elif src.get("type") == "file":
            if not src.get("path"):
                print(f"ERROR: {path} source.type=file 缺少 path")
                ok = False
            if not isinstance(src.get("line_start"), int) or not isinstance(src.get("line_end"), int):
                print(f"ERROR: {path} source.type=file 缺少 line_start/line_end（整数）")
                ok = False
        elif src.get("type") == "system_prompt":
            if not src.get("section"):
                print(f"ERROR: {path} source.type=system_prompt 缺少 section")
                ok = False
        else:
            print(f"ERROR: {path} source.type={src.get('type')} 非法（仅允许 file / system_prompt，禁止 inferred）")
            ok = False
        if node.get("kind") == "decision":
            for b in ("yes_branch", "no_branch"):
                v = node.get(b)
                if not v:
                    print(f"ERROR: {path} decision 缺少分支 {b}")
                    ok = False
                elif ids is not None and v not in ids:
                    print(f"ERROR: {path} decision {b}={v} 指向不存在的节点")
                    ok = False
        for i, c in enumerate(node.get("children", [])):
            if isinstance(c, dict):
                if not validate_node(c, f"{path}.children[{i}]", model, ids):
                    ok = False
            elif isinstance(c, str):
                if ids is not None and c not in ids:
                    print(f"ERROR: {path}.children[{i}]={c} 指向不存在的节点")
                    ok = False
            else:
                print(f"ERROR: {path}.children[{i}] 既非对象也非 id 引用")
                ok = False
    else:
        if node.get("kind") not in LEGACY_KINDS:
            print(f"ERROR: {path} kind={node.get('kind')} 非法")
            ok = False
        for i, c in enumerate(node.get("children", [])):
            if not validate_node(c, f"{path}.children[{i}]", model, ids):
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
    if "phases" in t:                       # workflow model
        model = "workflow"
        if not isinstance(t["phases"], list) or not t["phases"]:
            print("ERROR: phases 缺失或非数组")
            ok = False
        ids = set()
        for i, ph in enumerate(t["phases"]):
            if not isinstance(ph, dict) or "nodes" not in ph:
                print(f"ERROR: phases[{i}] 缺 nodes")
                ok = False
                continue
            for n in ph["nodes"]:
                if isinstance(n, dict) and n.get("id"):
                    ids.add(n["id"])
        for i, ph in enumerate(t["phases"]):
            if not isinstance(ph, dict):
                continue
            for j, n in enumerate(ph["nodes"]):
                if not validate_node(n, f"phases[{i}].nodes[{j}]", model, ids):
                    ok = False
        for i, c in enumerate(t.get("conditions", [])):
            if not isinstance(c, dict) or "question" not in c or "source" not in c:
                print(f"ERROR: conditions[{i}] 缺 question/source")
                ok = False
    elif "flow" in t:                       # legacy model
        model = "legacy"
        if not isinstance(t["flow"], list):
            print("ERROR: flow 非数组")
            ok = False
        else:
            for i, n in enumerate(t["flow"]):
                if not validate_node(n, f"flow[{i}]", model):
                    ok = False
        for i, tr in enumerate(t.get("triggers", [])):
            if not isinstance(tr, dict) or "type" not in tr or "name" not in tr:
                print(f"ERROR: triggers[{i}] 缺少 type/name")
                ok = False
            elif tr.get("type") not in TRIG_TYPES:
                print(f"ERROR: triggers[{i}] type={tr.get('type')} 非法")
                ok = False
    else:
        print("ERROR: 无法识别模型（需 phases 或 flow）")
        ok = False

    if ok:
        print(f"OK: trace 结构合法（{model} 模型）")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
