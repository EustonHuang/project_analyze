---
name: agent-trace-view
description: 启动前后端 viewer 渲染 agent_traces/ 下的 trace JSON，交互式查看 Agent 项目追踪。Use when user wants to view/visualize an existing trace produced by the agent-trace skill.
---
# Agent Trace View（渲染侧）

独立 skill：启动本地前后端 viewer，读取 trace JSON 渲染成交互视图。与采集（agent-trace）解耦，可单独对任意已有 trace 文件使用。

## 用法
- 在会话中说"查看 trace" / "打开 viewer"，或直接运行：
  `python3 server/server.py --trace-dir <agent_traces 目录> --port 8765`
- 默认**后台守护**运行（命令行不被占住），启动即自动打开浏览器 `http://127.0.0.1:8765`；退出 shell 不影响服务。
- 停止：`python3 server/server.py --stop`（读取 PID 文件终止后台 daemon）。
- 调试/前台阻塞：`--foreground`（不分离，Ctrl-C 退出）。
- 空闲自退：`--idle-timeout <秒>`（默认 600，0 关闭）——无请求超过阈值自动 `shutdown()`。

## 功能
- 图视图：执行流图（缩放/平移/拖拽），按节点类型映射流程图形状（architecture/003 形状映射表）：
  - `entry` / `exit` → 圆角矩形（terminator）
  - `step` → 矩形（process）
  - `decision` → 菱形（decision），出边标 `yes` / `no`
  - `io` → 平行四边形（I/O）
  - `parallel` / `loop` → 容器（loop 带虚线回边）
- 可折叠树：左侧大纲，逐层展开。
- 控制条：
  - `只看决策(菱形)`：仅显示 `decision` 节点，快速看清所有条件分支。
  - `显示来源`：节点标签附带 `source.path`。
  - 搜索框。
- 详情面板：点节点看 `detail` 与 `source`（type / path / quote）；`decision` 显示 yes/no 分支目标。

## 约定
- 仅渲染，不修改 trace 文件。
- 同时支持两种模型：`agent_system_workflow`（`phases` + `conditions`）与 legacy `prompt_trace`（`flow` + `triggers`）。
- 依赖：Python 3 标准库（无需 pip 安装）；前端图库 Cytoscape.js 经 CDN 加载（需联网，离线时树视图仍可用）。
- trace JSON 是采集与渲染之间唯一的契约接口。
