<!-- 自动生成，请勿手改；改动会被脚本覆盖 -->

# History — TOC

> 由 `append_history.py gen-toc` 自动生成；每事件正文见 `history/{id}.json`。

- [001 · qna_recorded · 2026-10-16T09:27:28](history/001.json) — 记录用户关于'项目执行流拆解与展示工具'的设计问题与 agent 提案（Q1，含两个 case 背景）。
- [002 · qna_recorded · 2026-10-16T09:35:41](history/002.json) — 记录用户关于'通用流程图标记/符号'的问题与 agent 回答（Q2），并连接到本项目 Workflow Graph 模型。
- [003 · qna_recorded · 2026-10-16T11:29:28](history/003.json) — 记录用户关于'流程图符号参考网页/文章'的问题与 agent 提供的分层参考链接（Q3）。
- [004 · qna_recorded · 2026-10-16T21:17:25](history/004.json) — 记录用户要求'用具体例子演示如何剖析 python/agent 并画流程图'的问题与 agent 双实例回答（Q4）。
- [005 · qna_recorded · 2026-10-16T21:24:07](history/005.json) — 记录用户关于'workflow 与实际不符时如何保住可信度'的问题与 agent 五条机制回答（Q5）。
- [006 · qna_recorded · 2026-10-16T21:28:22](history/006.json) — 记录用户对 Q5 的深化追问(置信度标签本身的正确性 + 一处错致弃用)与 agent 三层回答（Q6）。
- [007 · qna_recorded · 2026-10-16T21:31:30](history/007.json) — 记录用户承接 Q6 的深化追问(头痛医头治根因 + 幻觉)与 agent 三层回答（Q7）。
- [008 · qna_recorded · 2026-10-16T21:33:12](history/008.json) — 记录用户纠正'幻觉=错误纠错方案'定义后的深化追问与 agent 三层回答（Q8）。
- [009 · qna_recorded · 2026-10-16T21:35:21](history/009.json) — 记录用户对'Q5-Q8 像打地鼠'的批评与 agent 的统一根因架构回答（Q9，收敛为单一不变式+验证管线）。
- [010 · qna_recorded · 2026-10-16T21:38:38](history/010.json) — 记录用户'停止反应性、自主第一性原理设计'的要求与 agent 的四类问题+四类机制架构骨架回答（Q10）。
- [011 · qna_recorded · 2026-10-16T21:56:29](history/011.json) — 记录用户'四类是否完备、如何确定完备'的质疑与 agent 的证伪法+外部框架回答（Q11）。
- [012 · qna_recorded · 2026-10-16T22:09:15](history/012.json) — 记录用户'详细列出 ISO/IEC 25010'的请求与 agent 的标准明细+映射校验回答（Q12）。
- [013 · architecture_recorded · 2026-10-17T10:36:58](history/013.json) — 新增架构 v1 方案文档（agent 项目追踪），索引置 latest=1/implemented=0（待评审落地）；未创建任何 skill 实现文件。
- [014 · rule_recorded · 2026-10-17T10:38:07](history/014.json) — 新增 Plan-First 强制规则（alwaysApply），约束：方案改进先写方案、批准后再实现、不得越界。
- [015 · architecture_recorded · 2026-10-17T10:40:59](history/015.json) — 修订 v1 存储与渲染（→前后端 viewer）、交付物（→server+web）；revision=2。
- [016 · architecture_recorded · 2026-10-17T10:42:33](history/016.json) — 新增'输入：如何指定要 trace 的对象'一节；revision=3。
- [017 · architecture_recorded · 2026-10-17T10:46:19](history/017.json) — 澄清 skill 与 FE/BE 共存；'交付物'与'输入'改回以 skill 为交付形态；revision=4。
- [018 · architecture_recorded · 2026-10-17T10:47:55](history/018.json) — 清理全文元描述，重写为纯计划；revision=5。
- [019 · rule_recorded · 2026-10-17T10:48:27](history/019.json) — 新增 No-Meta-Descriptions 强制规则（alwaysApply），禁止文档/注释中的元描述。
- [020 · architecture_recorded · 2026-10-17T10:51:15](history/020.json) — 采集/渲染解耦为两个 skill，trace JSON 为契约；revision=6。
- [021 · implementation · 2026-10-17T10:54:57](history/021.json) — 实现 agent-trace 与 agent-trace-view 两个 skill（采集/渲染解耦）。
- [022 · qna_recorded · 2026-10-17T11:01:44](history/022.json) — 记录 Q13：agent-trace-view 404 根因（server.py WEB 路径算错，指向不存在的 server/web/）。
- [023 · qna_recorded · 2026-10-17T11:01:44](history/023.json) — 记录 Q14：agent-trace-view server 前台阻塞命令行、需强杀的根因（serve_forever 阻塞调用，无后台化/退出机制）。
- [024 · plan_modified · 2026-10-17T11:04:12](history/024.json) — 新建 architecture/002.md（agent-trace-view 渲染侧修复方案，覆盖 Q13/Q14）；architecture_index 新增 v2（latest_version=2，implemented_version=1）；重生成 architectur
- [025 · implementation · 2026-10-17T11:22:10](history/025.json) — 实现 architecture/002：修复 agent-trace-view server 的 WEB 路径（Q13/404）与前台阻塞（Q14/后台守护+看门狗+--stop）；SKILL.md 更新用法；implemented_version 翻至 2。
- [026 · plan_modified · 2026-10-17T11:26:42](history/026.json) — 新增 .gitignore（排除 .tmp/、__pycache__/、*.py[cod]、.DS_Store），支撑 implement 002 的 git 发布链。
- [027 · plan_modified · 2026-10-17T11:55:59](history/027.json) — 新增 architecture/003.md：Agent 自身工作流追踪方案。明确追踪对象改为 Agent 系统级工作流；用菱形节点显式表达条件判断；要求每个节点附带 source（type/path/quote）。
- [028 · plan_modified · 2026-10-17T12:14:03](history/028.json) — 在 003.md 新增「本方案与前序设计的关系」节，明确替代 001；node 定义中 source 升为必填强制字段并加 viewer 校验。
- [029 · plan_modified · 2026-10-17T12:17:13](history/029.json) — 修正 003.md 形状表述：条件=菱形只是形状映射表一条；新增完整节点→形状映射；统一目标/核心修正/渲染要求/交付物四处。
- [030 · plan_modified · 2026-10-17T12:18:38](history/030.json) — 删除 003.md 中三处元描述/澄清式旁白，违反 No Meta-Descriptions 与『禁止澄清式旁白』两条 user rule。
- [031 · qna_recorded · 2026-10-17T12:20:31](history/031.json) — 双录 Q15：规则在上下文却明知故犯的根因分析。
- [032 · plan_modified · 2026-10-17T12:30:15](history/032.json) — 落地 003：采集侧支持 agent_system_workflow 模型（强制 source + decision 分支），产出具体系统工作流 trace；渲染侧按形状映射表渲染全节点类型并展示来源。
- [033 · plan_modified · 2026-10-17T12:41:47](history/033.json) — 新增 architecture/004.md，定义来源可追溯性（file 类型必须含 path+line_start+line_end+quote；system_prompt 类型必须含 section+quote；禁止 inferred）与 viewer 三栏可折叠布局。
- [034 · plan_modified · 2026-10-17T12:52:21](history/034.json) — 落地 004：来源可追溯（file 行号 / system_prompt section，零 inferred），viewer 三栏可折叠且来源居中可见。
