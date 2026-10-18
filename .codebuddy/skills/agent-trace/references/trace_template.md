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
