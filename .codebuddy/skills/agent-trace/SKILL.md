---
name: agent-trace
description: 采集并产出 Agent 项目追踪的 trace JSON（养料文件）。当用户想搞清楚"一个 AI Agent / skill / 会话是怎么跑的"时调用；产出结构化 trace.json 落盘到 agent_traces/。Use when user wants to trace how an agent/skill/session works.
---
# Agent Trace（采集侧）

产出一份结构化 trace JSON，记录 Agent 的运行过程。本 skill 只负责采集与落盘，**不启动任何服务、不负责渲染**。

## 何时用
- 用户想理解某个 agent / skill / 会话的执行过程。
- 用户说"trace 一下 X""记录这次运行"。

## 两种模型（向后兼容）

### agent_system_workflow（architecture/003 主线）
追踪 Agent **系统级工作流**：无论用户输入什么 prompt，Agent 都经过哪些阶段、哪些路径是条件分支。节点按类型映射流程图形状，每个节点必须带来源 `source { type, path, quote }`，`decision` 必须声明 `yes_branch` / `no_branch`。

- 结构：`{ meta, phases[], conditions[] }`。
- `phases[]`：`{ id, name, kind(sequence|conditional|loop|parallel), required, source, nodes[] }`。
- `conditions[]`：显式登记所有决策条件，避免 if 隐藏在 step 里。
- 形状映射见 `references/trace_template.md`。

### prompt_trace（legacy）
旧模型，仍以 `flow[]` + `triggers[]` 表达单次运行；本 skill 不改动其兼容能力。

## 输入
- 自然语言：直接说明要 trace 什么。
- 目标引用：transcript 文件 / 项目目录 / skill 定义文件 / 粘贴文本。

## 产出
- 一个 trace JSON，落盘到 `agent_traces/<id>.json`。
- 数据模型与形状映射见 `references/trace_template.md`。

## 步骤
1. 确定模型：系统工作流用 `agent_system_workflow`；单次运行用 `prompt_trace`。
2. 列阶段 `phases[]`，每阶段内按逻辑顺序列 `nodes[]`。
3. 每个「是否……」写成 `decision` 节点，带 `yes_branch` / `no_branch`；其余动作为 `step` / `entry` / `exit` / `io` / `parallel` / `loop`。
4. 为每个节点填 `source.type` / `source.path` / `source.quote`（引用具体规则 / skill / 系统提示段落）。
5. 写完后跑 `scripts/validate.py` 校验（workflow 模型强制 source 与 decision 分支）。
6. 告诉用户文件路径，并提示用 `agent-trace-view` skill 查看。

### trace 一个项目本体（实例化 architecture/003）
当目标是「trace 这个项目本身」时，用 `architecture/003` 的 Agent 工作流作骨架，把其中的
categories（rules / skills / hooks / tools / managed dirs）**逐项映射到目标项目的具体文件 + 行号**：
- rules → `<project>/.codebuddy/rules/` 下的 RULE.mdc + 行号。
- skills → `<project>/.codebuddy/skills/<name>/SKILL.md` + 行号。
- hooks → `<project>/.codebuddy/settings.json` 与 `.plan-standard/scripts/turn_gate.py` + 行号。
- tools/scripts → 具体脚本（如 `validate.py` / `server.py` / `append_history.py`）+ 行号。
- managed dirs → `append_history.py` + 行号。
某一步在当前项目找不到具体文件，则放入 `assumptions[]`，**不引用系统提示或运行时变量**（如模型名）。
产出文件名建议 `<project>_flow.json`。

## 原则
- 节点按类型映射形状，而非只有条件用菱形。
- 推断必有出处：任何节点无 `source` 视为非法 trace。
- 不启动任何服务、不负责渲染（渲染由 `agent-trace-view` 负责）。
