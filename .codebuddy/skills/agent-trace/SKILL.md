---
name: agent-trace
description: 采集并产出 Agent 项目追踪的 trace JSON（养料文件）。当用户想搞清楚"一个 AI Agent / skill / 会话是怎么跑的"时调用；产出结构化 trace.json 落盘到 agent_traces/。Use when user wants to trace how an agent/skill/session works.
---
# Agent Trace（采集侧）

产出一份结构化 trace JSON，记录 Agent 的运行过程。本 skill 只负责采集与落盘，**不启动任何服务、不负责渲染**。

## 何时用
- 用户想理解某个 agent / skill / 会话的执行过程。
- 用户说"trace 一下 X""记录这次运行"。

## 数据模型（极简，唯一契约）
trace 只有两层：`meta` + `nodes[]`。每个节点：

- `id`：全局唯一字符串（如 `"1"` / `"n1"`）。
- `kind`：必填，取值 `start` / `process` / `decision` / `end`。
- `content`：该步干什么（第一行为标题，可多行）。
- `next`：后继。
  - string = 单一顺序后继（指向节点 id）。
  - array = 多后继（分支 / 并行 / 循环），每项 `{ to, label }`；`label` 为分支名（如 `yes`/`no`）或空；循环即 `to` 指向上游已有 id。
  - `end` 节点 `next` 为 `null`。
- `source`：必填，追溯出处，**禁止 `inferred`**。
  - `type: "file"`：`{ path, line_start, line_end, quote }`——仓库内真实文件的具体行号区间。
  - `type: "system_prompt"`：`{ section, quote }`——系统提示/工具描述的段落名 + 原文。

**无 `phases` / `conditions` / `yes_branch` / `no_branch` / `children` 等顶层或分支字段**：并行 = 多后继，分支 = 带 `label` 的多后继，循环 = 后继指回上游 id，全部用 `next` 表达。

## 输入
- 自然语言：直接说明要 trace 什么。
- 目标引用：transcript 文件 / 项目目录 / skill 定义文件 / 粘贴文本。

## 产出
- 一个 trace JSON，落盘到 `agent_traces/<id>.json`，数据模型即上。

## 步骤
1. 解析要 trace 的目标（项目本体 / 单次运行 / 某 skill）。
2. 按执行顺序列 `nodes[]`，每个节点填 `kind` / `content` / `next` / `source`。
3. `decision` 节点用 `next` 数组表达 yes/no 分支；并行 / 循环同样用 `next` 表达，无需特殊 `kind`。
4. 每个节点必须带来源（file 行号或 system_prompt section），否则视为非法 trace。
5. 跑 `scripts/validate.py` 校验（nodes 模型）。
6. 告诉用户文件路径，并提示用 `agent-trace-view` skill 查看。

## trace 到底：命令不是黑盒
追踪一个顶层命令或动作时，**如果它内部调用了对流程状态有实质影响的 helper，必须继续把这些 helper 也作为 `process` 节点展开**，并指向 helper 函数的真实行号。例如 `turn_gate begin` 不是单个节点，而要展开为：

- `cmd_begin` 入口；
- `session_id()` —— 确定会话标识；
- `baseline_max_id()` —— 读取当前 max_id；
- `save_state(state)` —— 原子写入 `.codebuddy/hooks/.turn/<session>.json`。

同理，`turn_gate record` 要展开 `load_state()`、路径提取、`in_plan()`/`norm_rel()`/`is_ignored()`、保存/同步；`turn_gate end` 要展开 `load_state()`、`_new_event_targets()`。

不要停在入口函数；用户对照源码时，trace 必须能「钻」到最底层的关键状态变化点。

## trace 一个项目本体（实例化本项目 workflow）
把本仓库作为方法论项目，用其真实文件 + 行号实例化通用工作流：

- 纪律 / 规则 → `.codebuddy/rules/ai-project-standard/RULE.mdc` + 行号。
- 钩子 → `.codebuddy/settings.json` 与 `.plan-standard/scripts/turn_gate.py` + 行号（含 `begin` / `record` / `end` 三步细节）。
- 脚本 → `.plan-standard/scripts/append_history.py` + 行号。
- 产出文件名建议 `project_analyze_flow.json`。

## 原则
- 推断必有出处：任何节点无 `source` 视为非法 trace。
- 不启动任何服务、不负责渲染（渲染由 `agent-trace-view` 负责）。
