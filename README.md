# Skill 能力拆解分析

分析任意 Skill 的能力结构，输出结构化能力拆解报告与改造建议。 Invoke when 用户要拆解/复盘/对比/改造一个 Skill，或要把 SKILL.md 写得更可触发、更可交付时。

## Install

```bash
npx skills add https://github.com/Damond-Fung/skill-breakdown-analyzer --skill skill-breakdown-analyzer
```

## Best For

- Complex skills with decision, workflow, and execution layers
- Long-running or multi-mode skills
- Product-like skills with delivery loops

## Agent Targets

- Agent target examples: add `--agent <agent-name>` when publishing to specific agents.

## Structure

- `SKILL.md`
- `scripts/` for execution layer helpers
- `references/` for decision rules, workflow notes, and execution notes

## Notes

- Requires Node.js >= 18.
- For local static scan, run: `node ./scripts/analyze-skill.mjs --skill <nameOrPath>`.
