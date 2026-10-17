# Trace 模板

```json
{
  "entry": "用户的入口 prompt 原文",
  "depth": 3,
  "triggers": [
    {
      "type": "rule|memory|hook|skill|tool",
      "name": "触发组件名",
      "cond": "触发条件",
      "effect": "导致什么"
    }
  ],
  "flow": [
    {
      "id": "n1",
      "kind": "entry|trigger|step|parallel|loop|branch|async|spawn|io",
      "label": "步骤简述",
      "detail": "触发条件 / 来源 / 耗时等",
      "children": []
    }
  ]
}
```

## kind 含义
- entry：入口
- trigger：触发组件生效
- step：普通顺序步骤
- parallel：children 为并行成员（无先后顺序）
- loop：children 执行完 loop-back 回本节点
- branch：children 为各分支（条件择一）
- async / spawn：children 为并发任务（异步 / 新进程或子 agent）
- io：读写文件 / 调外部接口

## 约定
- 并行/循环/分支/异步/派生都用 kind 区分、递归 children，不破坏主体顺序。
- depth 控下钻层数；记全，渲染再折叠。
- 节点 id 在单个 trace 内唯一即可；可省略，省略时由渲染端自动编号。
