---
name: agent-trace
description: 采集并产出 Agent 项目追踪的 trace JSON（养料文件）。当用户想搞清楚"一个 AI Agent / skill / 会话是怎么跑的"时调用；产出结构化 trace.json 落盘到 agent_traces/。Use when user wants to trace how an agent/skill/session works.
---
# Agent Trace（采集侧）

产出一份结构化 trace JSON，记录一个 Agent 运行的完整过程。本 skill 只负责采集与落盘，**不启动任何服务、不负责渲染**。

## 何时用
- 用户想理解某个 agent / skill / 会话的执行过程。
- 用户说"trace 一下 X""记录这次运行"。

## 输入（如何指定要 trace 的对象）
- 自然语言：直接说明要 trace 什么（如"trace agent-trace skill 怎么跑的"）。
- 目标引用：指向 transcript 文件 / 项目目录 / skill 定义文件 / 粘贴文本（可用 `--target` 指定）。

## 产出
- 一个 trace JSON，落盘到 `agent_traces/<id>.json`（<id> 用目标名 + 时间戳）。
- 数据模型见 `references/trace_template.md`。

## 步骤
1. 确定入口：用户的 prompt 原文 → `entry`。
2. 列触发：每条 `{type, name, cond, effect}`。
3. 走执行流：按时间/逻辑顺序列 `flow[]` 节点；遇到并行/循环/分支/异步用对应 kind 并递归 children。
4. 设 `depth`（默认 3）。
5. 用 `scripts/init.py` 生成骨架，或按模板直接写 JSON；写完后跑 `scripts/validate.py` 校验。
6. 告诉用户文件路径，并提示用 `agent-trace-view` skill 查看。

## 原则
- capture-max / render-on-demand：尽量记全，展示由 viewer 控制。
- 并行/循环/分支/异步/派生都用 kind 区分、递归 children，不破坏主体顺序。
- 不启动任何服务、不负责渲染（渲染由 `agent-trace-view` 负责）。
