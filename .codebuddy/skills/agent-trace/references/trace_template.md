# Trace 模板（极简模型，唯一契约）

trace 只有两层：`meta` + `nodes[]`。**不接受 `phases` / `flow` / `conditions` 等旧模型。**

## 节点字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✓ | 全局唯一字符串 |
| `kind` | ✓ | `start` / `process` / `decision` / `end` |
| `content` | ✓ | 步骤内容（首行标题，可多行） |
| `next` | ✓ | string（单后继）/ array`[{to,label}]`（分支·并行·循环）/ `null`（`end`） |
| `source` | ✓ | `file{path,line_start,line_end,quote}` 或 `system_prompt{section,quote}` |

## 约定
- **顺序**：`next` 为 string，指向下一个节点 id。
- **分支**：`next` 为 array，`decision` 节点用 `label: "yes"` / `"no"`。
- **并行**：`next` 为 array（无 label 或多 label，多个并发后继）。
- **循环**：`next` 的 `to` 指向已有上游 id。
- **无** `phases` / `conditions` / `yes_branch` / `no_branch` / `children`。

## 示例

```json
{
  "meta": { "kind": "agent_workflow", "target": "project_analyze", "created_at": "2026-10-18" },
  "nodes": [
    {
      "id": "1", "kind": "start",
      "content": "接收用户 prompt（UserPromptSubmit → turn_gate begin）",
      "next": "2",
      "source": { "type": "file", "path": ".codebuddy/settings.json", "line_start": 6, "line_end": 10, "quote": "command: ... turn_gate.py begin" }
    },
    {
      "id": "3", "kind": "decision",
      "content": "是否涉及方案改进 / 新功能 / 架构变更？",
      "next": [ { "to": "4", "label": "yes" }, { "to": "6", "label": "no" } ],
      "source": { "type": "file", "path": ".codebuddy/rules/ai-project-standard/RULE.mdc", "line_start": 11, "line_end": 16, "quote": "受管文件（任何改动必须留痕）" }
    },
    {
      "id": "9", "kind": "end",
      "content": "结束本轮（Stop → turn_gate end 放行）",
      "next": null,
      "source": { "type": "file", "path": ".codebuddy/settings.json", "line_start": 29, "line_end": 33, "quote": "command: ... turn_gate.py end" }
    }
  ]
}
```

## trace 到底示例（命令不是黑盒）

下面展示 `turn_gate begin` 如何展开为其内部关键 helper 节点：

```json
{
  "nodes": [
    {
      "id": "2", "kind": "process",
      "content": "turn_gate begin 入口：准备建立本轮 session state",
      "next": "2a",
      "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 292, "line_end": 301, "quote": "def cmd_begin(args): ..." }
    },
    {
      "id": "2a", "kind": "process",
      "content": "session_id()：取 CODEBUDDY_SESSION_ID 或 fallback 到 local pid",
      "next": "2b",
      "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 39, "line_end": 43, "quote": "def session_id(): return os.environ.get(...) or ('local-%d' % os.getpid())" }
    },
    {
      "id": "2b", "kind": "process",
      "content": "baseline_max_id()：读取 history_index.json 的 max_id",
      "next": "2c",
      "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 67, "line_end": 74, "quote": "def baseline_max_id(): ... int(idx.get('max_id', 0))" }
    },
    {
      "id": "2c", "kind": "process",
      "content": "save_state(state)：原子写入 .codebuddy/hooks/.turn/<session>.json",
      "next": "3",
      "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 59, "line_end": 65, "quote": "def save_state(state): ... os.replace(tmp, state_path())" }
    }
  ]
}
```
