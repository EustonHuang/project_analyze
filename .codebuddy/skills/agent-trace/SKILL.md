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
5. 跑 `scripts/validate.py` 校验（nodes 模型，递归校验嵌套节点）。
6. 告诉用户文件路径，并提示用 `agent-trace-view` skill 查看。

## 三条硬规则（不可妥协）

### 规则 A：trace 到底 —— 每个自定义函数与被读全局变量都是节点
追踪一个命令时，把它执行路径上**所有自定义函数**都列为节点（含库调用链上你自己的 helper）。判断标准：
- **你自己写的函数**（如 `save_state`、`state_path`、`load_turngateignore_lines`、`_glob_translate`）→ 必须有节点，并指向真实行号。
- **库内部函数**（`os.path.join`、`json.load`、`subprocess.run`、`pandas.read_csv` 等第三方包实现）→ 不展开。
- **全局变量 = 模块顶层赋值的名字**（按赋值位置判定，与命名风格无关；`import` 绑定是库，不展开）。凡被执行路径上的函数**读取**的全局变量，必须在该函数节点下嵌套一个定义节点（source 指向顶层赋值行）；同一全局变量被多个函数引用时，在每个引用者下都出现。
- 若某自定义函数**从未被本次执行路径触达**，视为死代码：应删掉它以收敛规模，**不要**靠省略 trace 来糊弄。节点数量多是「代码抽象过多」的信号，治本是删函数，不是省节点。

### 规则 B：可折叠 —— 总体步骤 ↔ 深入细节
- 节点可嵌套 `nodes[]`（children，递归）。顶层节点是「总体步骤」；带 `nodes[]` 的节点默认在 viewer 中折叠，用户点一下再深入其 helper，再点收起。
- `next` 在同层内串接；嵌套子节点最后一个 `next` 为 `null` 时，回落到父节点的 `next`（父节点展开后由 children 取代，首 child 承接入边、末 child 出边接到父 `next`）。

### 规则 C：注入类步骤 —— 整文件定位 + 两级 rule 都要展开
- **「把文件全文注入上下文」的步骤**（rule / 规则文件注入）：source 定位**整个文件**（`line_start=1`、`line_end=末行`），不得只截取其中一个小节。
- **「读文件某个区间」的步骤**：source 定位被读区间（如「先读 README.md 的 MANDATORY 节」→ 该节真实行号区间 + 原文 quote）。
- 注入 rule 的步骤必须区分两级并各自成节点：
  - **user-level rule**（跨项目全局纪律，存放于项目之外）→ source 用 `system_prompt` 类型，每条纪律一个子节点。
  - **workspace rule**（项目内 `.codebuddy/rules/**`，`alwaysApply` 注入）→ source 为规则文件全文；其「必读与必做」等条目逐条成子节点（单行定位），条目指向的被读文件（如 README.md 某节、references/workflow.md）再各自成节点并给出真实行号与 quote。

## trace 到底示例
`turn_gate begin` 不是单个节点，而展开为：入口 → `session_id()` → `baseline_max_id()` → `save_state(state)`（→ `state_path()`）→ 打印基线。同理 `turn_gate record` / `turn_gate end` 也要一路展开到最底层自定义函数。

## trace 一个项目本体（实例化本项目 workflow）
把本仓库作为方法论项目，用其真实文件 + 行号实例化通用工作流：

- 纪律 / 规则 → user-level rule（system_prompt section）+ `.codebuddy/rules/ai-project-standard/RULE.mdc` **全文**（注入类步骤整文件定位）+ 其指向的 `.plan-standard/README.md`「MANDATORY」节与 `references/workflow.md`。
- 钩子 → `.codebuddy/settings.json` 与 `.plan-standard/scripts/turn_gate.py` + 行号（含 `begin` / `record` / `end` 三步细节，函数内引用的全局变量同样挖到顶层定义行）。
- 脚本 → `.plan-standard/scripts/append_history.py` + 行号。
- 产出文件名建议 `project_analyze_flow.json`。

## 原则
- 推断必有出处：任何节点无 `source` 视为非法 trace。
- 不启动任何服务、不负责渲染（渲染由 `agent-trace-view` 负责）。
