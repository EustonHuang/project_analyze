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
三栏布局，全部可折叠（左侧 `☰`、右侧 `图` 按钮）：

- 左侧 Phase Navigator：按 phase 分组平铺，不深缩进；节点行显示形状图标 + label + 决策分支目标；支持「只看决策」「显示来源路径」与搜索；点击选中节点。
- 中间 Source Inspector：选中节点时直接展示来源——`file` 类型显示 path + 行号区间（可点击在 IDE 打开）与原文 quote；`system_prompt` 类型显示 section + 原文；未选中时展示 workflow 概览（节点数 / 决策数 / 条件数）。
- 右侧 Graph View：按形状映射表渲染全部节点类型（`entry`/`exit` 圆角矩形、`step` 矩形、`decision` 菱形出边标 yes/no、`io` 平行四边形、`parallel`/`loop` 容器），默认收起，展开时显示；Cytoscape 不可用时 fallback 文字拓扑。

形状映射表见 architecture/003。来源两类（`file` 含行号 / `system_prompt` 含 section）见 architecture/004。

## 约定
- 仅渲染，不修改 trace 文件。
- 同时支持两种模型：`agent_system_workflow`（`phases` + `conditions` + `assumptions`）与 legacy `prompt_trace`（`flow` + `triggers`）。
- 依赖：Python 3 标准库（无需 pip 安装）；前端图库 Cytoscape.js 经 CDN 加载（需联网，离线时图视图显示 fallback）。
- trace JSON 是采集与渲染之间唯一的契约接口。
