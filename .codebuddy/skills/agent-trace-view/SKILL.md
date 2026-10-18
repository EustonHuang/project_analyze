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
三栏布局，全部可折叠（左侧 `☰`）：

- 左侧节点列表：扁平展示全部节点（不按 phase 分组）；节点行显示形状图标 + content 首行 + 决策分支目标；支持「只看决策」「显示来源路径」与搜索；点击选中节点。
- 中间 Source Inspector：选中节点时展示节点详情与来源 quote——`file` 类型显示 path + 行号区间（可点击在 IDE 打开）；`system_prompt` 类型显示 section + 原文；未选中时展示 workflow 概览（节点数 / 决策数 / 条件数）。
- 右侧 File Viewer：显示来源文件**全文**（带行号）；目标行区间显著高亮并自动滚动定位；头部显示 `path : start-end`；markdown 文件支持 Raw / Rendered 切换（Rendered 经 marked.js CDN，离线回退 Raw）。文件内容由 server 的 `/api/file` 提供。

流程图：左侧「流程图」标签切换显示；按形状映射表渲染全部节点（start/end 圆角矩形、process 矩形、decision 菱形出边标 yes/no）；点击图节点联动中栏与右栏；Cytoscape 不可用时 fallback 文字拓扑。

形状映射与来源规范见 architecture/012。来源仅 `file` 一类（含 path + 行号 + quote）。

## 约定
- 仅渲染，不修改 trace 文件。
- trace 模型（architecture/012）：极简 `nodes` 数组，每个节点仅含 `kind`（`start`/`process`/`decision`/`end`）、`content`、`next`（字符串=顺序后继 / 数组=分支·并行·循环，带 `label`）与 `source`（file 行号追溯）。无 `phases`/`conditions`/`assumptions` 等外层结构。
- 依赖：Python 3 标准库（无需 pip 安装）；前端图库 Cytoscape.js 经 CDN 加载（需联网，离线时图视图显示 fallback）。
- trace JSON 是采集与渲染之间唯一的契约接口。
