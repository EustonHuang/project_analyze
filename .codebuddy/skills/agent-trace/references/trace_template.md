# Trace 模板

architecture/003 定义了两种 trace 模型，向后兼容。

## 模型 A：`agent_system_workflow`（architecture/003 主线）

追踪 Agent 系统级工作流，与具体 prompt 无关。节点按类型映射流程图形状，每个节点必须带来源。

```json
{
  "meta": {
    "kind": "agent_system_workflow",
    "target": "CodeBuddy agent",
    "created_at": "2026-10-17"
  },
  "phases": [
    {
      "id": "P1",
      "name": "会话启动与上下文加载",
      "kind": "sequence",
      "required": true,
      "source": { "type": "system_prompt", "path": "always_applied_*_rules", "quote": "..." },
      "nodes": [
        {
          "id": "n1",
          "kind": "entry",
          "label": "接收用户 query",
          "detail": "用户本轮输入",
          "source": { "type": "system_prompt", "path": "user_info", "quote": "..." },
          "children": ["n2"]
        },
        {
          "id": "n3",
          "kind": "decision",
          "label": "是否存在全局 user rules？",
          "detail": "条件判断",
          "source": { "type": "user_rule", "path": "always_applied_user_rules", "quote": "..." },
          "yes_branch": "n4",
          "no_branch": "n5"
        }
      ]
    }
  ],
  "conditions": [
    {
      "id": "C1",
      "question": "是否存在全局 user rules？",
      "kind": "rule_presence",
      "source": { "type": "system_prompt", "path": "always_applied_user_rules", "quote": "..." }
    }
  ]
}
```

### 节点 kind → 流程图形状（全套映射，非仅条件）

| kind | 形状 | 说明 |
|------|------|------|
| `entry` / `exit` | 圆角矩形（terminator） | 起止 |
| `step` | 矩形（process） | 顺序处理 |
| `decision` | 菱形（decision） | 条件；出边标 yes / no |
| `io` | 平行四边形（I/O） | 读写文件 / 调外部接口 |
| `parallel` | 虚线框容器 | 内含并行成员 |
| `loop` | 圆角框容器 + 回边 | 循环体 |

### 字段约束

- `source`（**必填**）：`{ type, path, quote }`。缺 `type` 或 `path` 视为非法 trace。
- `decision` 必须声明 `yes_branch` 与 `no_branch`（指向节点 id）。
- 顺序流用 `children` 串接；条件流用 `yes_branch` / `no_branch`。
- 节点 id 在单个 trace 内全局唯一即可。

## 模型 B：`prompt_trace`（legacy，兼容保留）

旧模型，仍以 `flow[]` + `triggers[]` 表达单次运行。本 skill 不改动其兼容能力。

```json
{
  "entry": "用户的入口 prompt 原文",
  "depth": 3,
  "triggers": [
    { "type": "rule|memory|hook|skill|tool", "name": "触发组件名", "cond": "触发条件", "effect": "导致什么" }
  ],
  "flow": [
    { "id": "n1", "kind": "entry|trigger|step|parallel|loop|branch|async|spawn|io",
      "label": "步骤简述", "detail": "触发条件 / 来源 / 耗时等", "children": [] }
  ]
}
```
