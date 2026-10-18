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

## trace 到底示例（命令不是黑盒，每个自定义函数都展开）

下面展示 `turn_gate begin` 如何用嵌套 `nodes[]` 展开为内部全部自定义函数；`save_state` 又嵌套了它调用的 `state_path()`（自定义函数，必须展开）。

```json
{
  "nodes": [
    {
      "id": "2", "kind": "process",
      "content": "turn_gate begin 入口：准备建立本轮 session state",
      "next": "6",
      "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 292, "line_end": 301, "quote": "def cmd_begin(args): ..." },
      "nodes": [
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
          "next": "2d",
          "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 59, "line_end": 65, "quote": "def save_state(state): ... os.replace(tmp, state_path())" },
          "nodes": [
            {
              "id": "2c1", "kind": "process",
              "content": "state_path()：拼接 .codebuddy/hooks/.turn/<session>.json 路径",
              "next": null,
              "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 45, "line_end": 47, "quote": "def state_path(): return os.path.join(TURN_DIR, '%s.json' % session_id())" }
            }
          ]
        },
        {
          "id": "2d", "kind": "process",
          "content": "print 本轮 begin 基线信息",
          "next": null,
          "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 300, "line_end": 301, "quote": "print('turn_gate begin: baseline_max_id=%s ...')" }
        }
      ]
    }
  ]
}
```

- 顶层节点 `2` 是「总体步骤」，viewer 默认折叠显示其一行的 `content`。
- `2.nodes` 是深入细节；点 caret / 图节点展开为 `2a→2b→2c(→2c1)→2d`，末节点 `2d.next=null` 回落到父 `2.next`（即 `6`）。
- 库内部调用（`os.path.join` 的实现）不展开；但 `state_path()` 是你自己写的函数，必须作为节点存在。

## 全局变量也是节点（规则 A）

**定义**：全局变量 = 模块顶层赋值的名字（按赋值位置判定，与是否全大写无关）；`import` 绑定不展开。凡被执行路径上的函数读取的全局变量，在该函数节点下嵌套定义节点，source 指向顶层赋值行。

```json
{
  "id": "2b", "kind": "process",
  "content": "baseline_max_id()：读取 history_index.json 的 max_id",
  "next": "2c",
  "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 67, "line_end": 74, "quote": "def baseline_max_id(): ... idx = json.load(open(HISTORY_INDEX, ...))" },
  "nodes": [
    {
      "id": "2b1", "kind": "process",
      "content": "全局变量 HISTORY_INDEX（模块顶层定义）：history_index.json 绝对路径",
      "next": null,
      "source": { "type": "file", "path": ".plan-standard/scripts/turn_gate.py", "line_start": 32, "line_end": 32, "quote": "HISTORY_INDEX = os.path.join(PLAN_ROOT, \"history_index.json\")" }
    }
  ]
}
```

## 注入类节点（规则 C）

**定位**：把文件全文注入上下文的步骤 → source 为整个文件（1 到末行）；读文件某区间的步骤 → source 为被读区间；规则内的单条要求 → 单行定位，作为注入节点的子节点。user-level rule（项目外）用 `system_prompt` 类型。

```json
{
  "id": "4", "kind": "process",
  "content": "注入 workspace rule：ai-project-standard v0.8（alwaysApply 全文注入）",
  "next": "5",
  "source": { "type": "file", "path": ".codebuddy/rules/ai-project-standard/RULE.mdc", "line_start": 1, "line_end": 18, "quote": "alwaysApply: true … ## 必读与必做 1. 先读 README.md「MANDATORY」节…" },
  "nodes": [
    {
      "id": "4a", "kind": "process",
      "content": "必读①：改动受管文件前，先读 .plan-standard/README.md「MANDATORY」节与 references/workflow.md",
      "next": "4b",
      "source": { "type": "file", "path": ".codebuddy/rules/ai-project-standard/RULE.mdc", "line_start": 15, "line_end": 15, "quote": "1. 改动上述任何文件前，先读 <project>/.plan-standard/README.md 的「MANDATORY」节与 references/workflow.md。" },
      "nodes": [
        {
          "id": "4a1", "kind": "process",
          "content": "读 README.md「MANDATORY」节：任何改动必须进 history（受管文件清单 + 事件类型映射）",
          "next": "4a2",
          "source": { "type": "file", "path": ".plan-standard/README.md", "line_start": 72, "line_end": 88, "quote": "MANDATORY — any change must land in history … any modification to a plan file must be logged in history/" }
        },
        {
          "id": "4a2", "kind": "process",
          "content": "读 references/workflow.md：录入步骤与逐条 checklist",
          "next": null,
          "source": { "type": "file", "path": ".plan-standard/references/workflow.md", "line_start": 1, "line_end": 205, "quote": "# Workflow: When & How to Record (folder form) …" }
        }
      ]
    },
    {
      "id": "4b", "kind": "process",
      "content": "必做②：任何改动必须在 history/ 留痕（双录：提问写 questions/ + 追加 qna_recorded；改进进 improvements/）",
      "next": "4c",
      "source": { "type": "file", "path": ".codebuddy/rules/ai-project-standard/RULE.mdc", "line_start": 16, "line_end": 16, "quote": "2. 任何改动**必须**在 history/ 留痕（双录…）。" }
    },
    {
      "id": "4c", "kind": "process",
      "content": "必做③：本规则新会话自动注入；刚安装/升级需新建对话会话生效",
      "next": null,
      "source": { "type": "file", "path": ".codebuddy/rules/ai-project-standard/RULE.mdc", "line_start": 17, "line_end": 17, "quote": "3. 本规则在**新会话开始**自动注入；若刚安装/升级，请**新建对话会话**使其生效。" }
    }
  ]
}
```
