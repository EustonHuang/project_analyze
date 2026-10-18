<!-- 自动生成，请勿手改；改动会被脚本覆盖 -->

# Questions — TOC

> 由 `append_history.py gen-toc` 自动生成；每问答正文见 `questions/{num}.md`。

- [Q1](questions/001.md) — 设计一个把任何项目执行流（AI Agent 工作流 / 代码执行流）拆解并展示的工具，如何实现的？
- [Q2](questions/002.md) — 一般流程图中的标记/符号包含哪些（开始/结束、步骤、条件、循环、递归等）？
- [Q3](questions/003.md) — 请给流程图符号的参考网页/文章（不要自制HTML，要外部权威资料）。
- [Q4](questions/004.md) — 针对 questions/001.md，举具体例子说明如何剖析 python 代码 / agent 项目并画出流程图（不要泛泛而谈）。
- [Q5](questions/005.md) — 若剖析出的 workflow 与实际有出入（一次出入就损可信度），怎么处理？
- [Q6](questions/006.md) — 你怎么保证置信度标签本身没错（万一说traced实为unverified）？用户发现一处出入就怀疑全局而弃用怎么办？
- [Q7](questions/007.md) — 纠错透明下，怎么解决头痛医头（只修节点不治根因）和幻觉（编造不存在步骤）？
- [Q8](questions/008.md) — 纠错方案本身可能是看似正确实则站不住脚的幻觉（错误的修复方案），怎么解决？
- [Q9](questions/009.md) — 你现在给我的感觉就是在头痛医头脚痛医脚，不是吗？（要求统一根因设计而非堆补丁）
- [Q10](questions/010.md) — 你说消解Q5-Q8你还是在打地鼠，本质是我提什么你写什么。你要自己想想设计追踪系统会遇到哪些问题、怎么解。
- [Q11](questions/011.md) — 你确定这四类机制是完整的吗？你怎么确定他们是完整的？
- [Q12](questions/012.md) — 详细列出 ISO/IEC 25010（作为 Q11 分类外部校验锚）。
- [Q13](questions/013.md) — agent-trace-view 打开 127.0.0.1:8765 返回 404，为什么？
- [Q14](questions/014.md) — 调用 agent-trace-view 后 server 一直前台运行、卡住命令行，为什么？
- [Q15](questions/015.md) — 为什么 rules 在上下文里，你却明知故犯违反元描述规则？
- [Q16](questions/016.md) — P1-P5 与 s1/n1/n10 这些节点 ID 到底是什么关系？P1 下的 s1/s2/s3 是不是步骤 1.1/1.2/1.3？为什么不同 phase 下节点 ID 命名不一样？
- [Q17](questions/017.md) — project_analyze_flow.json 的设计思路是什么？有没有潜在问题？潜在的问题是什么？
- [Q18](questions/018.md) — 本次会话（agent-trace-view 流程图重构）AI 一五一十犯了哪些错误？请翻全部 history 逐条列出。
- [Q19](questions/019.md) — 流程图（agent-trace-view 中的 Flow Graph）到底是什么？
- [Q20](questions/020.md) — 流程图的完整步骤类型是什么？本项目 trace 有没有覆盖所有类型？为什么之前剖析得很完整、真正实现却缺斤少两？
