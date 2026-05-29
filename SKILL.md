---
name: "skill-breakdown-analyzer"
displayName: "Skill Breakdown Analyzer"
allowed-tools: Bash(node *)
description: "分析任意 Skill 的能力结构，输出结构化能力拆解报告与改造建议。Invoke when 用户要拆解/复盘/对比/改造一个 Skill，或要把 SKILL.md 写得更可触发、更可交付时。"
---


# Skill 能力拆解分析

把一个 Skill 的“定位、触发、能力、结构、执行层、边界”拆解成可复用的分析报告，并给出克制且可执行的改造建议。

本 Skill 是独立的“拆解 Skill 的 Skill”：
- 既能纯文档拆解（只给 `SKILL.md` 也能做）
- 也支持本地快速扫描（可选执行脚本，自动提取目录结构与关键字段）

## 什么时候调用

- 当用户说“帮我拆解/复盘/分析这个 skill”时调用
- 当用户要对比两个 skill、找差异、给出改造建议时调用
- 当用户想把“SKILL.md 写得更可触发、更可交付”时调用

## 输入与输出

### 输入
- 必选其一：`SKILL.md` 内容 / skill 名称（本地目录名）/ 仓库或发布包链接
- 可选：拆解深度（摘要版/标准版/深挖版，默认标准版）
- 可选：是否需要“改造建议”（默认需要，且保持克制）
- 可选：是否需要“对比分析”（当给出两个或多个 skill 时自动开启）

### 输出
- 产物 1：能力拆解报告（结构化 Markdown）
- 产物 2：改造建议清单（按收益优先级排序，避免过度设计）
- 可选：对比分析表（同一维度下对齐比较）

## 可选执行脚本（本地快速扫描）

当用户给的是“skill 名称”或“本地目录”，先运行脚本收集事实，再基于事实做拆解。

### 用法

```bash
node ./scripts/analyze-skill.mjs --skill my-skill-builder
```

```bash
node ./scripts/analyze-skill.mjs --skill ./path/to/your/skill-dir
```

```bash
node ./scripts/analyze-skill.mjs --skill my-skill-builder --skill my-music-skill --format json
```

### 输出内容（脚本层）
- frontmatter 字段（name/description/allowed-tools 等）
- 目录结构概览（是否存在 scripts/ references/ dist/ bin/ package.json）
- 触发信号候选（从文档中提取“什么时候调用/Triggers/Invoke when”）
- 静态质量检查（缺失章节、描述过泛、输出契约缺失等）

## 工作流（按顺序执行）

### Phase A：获取材料（Source）
1. 识别输入来源
2. 明确输出目标与深度

### Phase B：结构扫描（Structure Scan）
1. 提取 frontmatter / 触发信号 / 路由与工作流 / 执行层 / 约束

### Phase C：类型与分层（Classify）
1. 判断类型：knowledge / router / workflow / executor / hybrid
2. 三层拆解：判断层 / workflow 层 / 执行层

### Phase D：能力树（Capability Map）
1. 用户可感知能力 vs 执行层能力
2. 输入/输出契约与关键路径

### Phase E：边界与风险（Boundaries）
1. 不做什么 + 误用场景 + 风险点清单

### Phase F：改造建议（Refactor Plan）
按“收益优先、改动克制”的原则输出建议，并为每条建议写清楚目标/变更点/风险/验收。

## 边界

- 不虚构不存在的脚本、接口、依赖与效果
- 不输出任何密钥、token、内部链接等敏感信息
- 不为了“看起来完整”而硬造路由或阶段
- 不把“CLI/脚本”当成业务能力；必须把用户能力与执行能力拆开写
- 不输出任何论坛/社区发帖文案或宣传稿（只做工程化拆解与改造建议）
