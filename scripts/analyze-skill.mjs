import fs from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const options = { skill: [], format: "md" };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    if (key === "skill") {
      options.skill.push(next);
    } else {
      options[key] = next;
    }
    index += 1;
  }

  return options;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function dirExists(dirPath) {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  for (let hops = 0; hops < 20; hops += 1) {
    const candidate = path.join(current, ".trae", "skills");
    if (await dirExists(candidate)) return current;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return path.resolve(startDir);
}

function parseFrontmatter(markdown) {
  const lines = markdown.split(/\r?\n/);
  if (lines[0] !== "---") return { data: {}, body: markdown };
  const endIndex = lines.indexOf("---", 1);
  if (endIndex === -1) return { data: {}, body: markdown };

  const raw = lines.slice(1, endIndex).join("\n");
  const body = lines.slice(endIndex + 1).join("\n");
  const data = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, valueRaw] = match;
    const value = valueRaw.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    data[key] = value;
  }

  return { data, body };
}

function extractSection(markdown, titleCandidates) {
  const lines = markdown.split(/\r?\n/);
  const candidates = new Set(titleCandidates.map((t) => t.toLowerCase()));
  const headings = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.*)\s*$/);
    if (!match) continue;
    headings.push({ index: i, level: match[1].length, title: match[2].trim() });
  }

  for (const heading of headings) {
    if (!candidates.has(heading.title.toLowerCase())) continue;
    const start = heading.index + 1;
    const end = (() => {
      for (const next of headings) {
        if (next.index <= heading.index) continue;
        if (next.level <= heading.level) return next.index;
      }
      return lines.length;
    })();
    return lines.slice(start, end).join("\n").trim();
  }

  return "";
}

function extractTriggerCandidates(markdown, frontmatter) {
  const triggers = new Set();

  const description = String(frontmatter.description || "");
  const invokeWhenMatch = description.match(/Invoke when\s+(.+)$/i);
  if (invokeWhenMatch?.[1]) {
    triggers.add(invokeWhenMatch[1].trim());
  }

  const section = extractSection(markdown, ["什么时候调用", "When to invoke this skill", "Triggers"]);
  for (const line of section.split(/\r?\n/)) {
    const bullet = line.match(/^\s*[-*]\s+(.*)\s*$/);
    if (!bullet) continue;
    const text = bullet[1].trim();
    if (text) triggers.add(text);
  }

  return Array.from(triggers);
}

function inferSkillTypeFromText(frontmatter, markdown, folderFacts) {
  const joined = [
    frontmatter.name,
    frontmatter.description,
    frontmatter["allowed-tools"],
    markdown,
    folderFacts.hasScripts ? "scripts" : "",
    folderFacts.hasReferences ? "references" : "",
    folderFacts.hasBin ? "bin" : "",
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  const hasExecutorSignals =
    /allowed-tools/.test(joined) ||
    /bash\(/.test(joined) ||
    /node\s+\./.test(joined) ||
    /npm\s+/.test(joined) ||
    folderFacts.hasScripts ||
    folderFacts.hasBin;

  const hasWorkflowSignals =
    /workflow/.test(joined) ||
    /phase\s+[a-z0-9]/.test(joined) ||
    /阶段/.test(joined) ||
    /step\s+\d+/.test(joined);

  const hasRouterSignals =
    /route\s+\d+/.test(joined) ||
    /router/.test(joined) ||
    /routing/.test(joined) ||
    /matrix/.test(joined) ||
    /选择/.test(joined) ||
    /分流/.test(joined);

  const hasKnowledgeSignals =
    /best practice/.test(joined) ||
    /guide/.test(joined) ||
    /reference/.test(joined) ||
    /规范/.test(joined) ||
    /原则/.test(joined) ||
    /常见坑/.test(joined);

  if (hasExecutorSignals && (hasWorkflowSignals || hasRouterSignals || folderFacts.hasReferences)) return "hybrid";
  if (hasExecutorSignals) return "executor";
  if (hasRouterSignals) return "router";
  if (hasWorkflowSignals) return "workflow";
  if (hasKnowledgeSignals) return "knowledge";
  return "unknown";
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function collectFolderFacts(skillRootDir) {
  const scriptsDir = path.join(skillRootDir, "scripts");
  const referencesDir = path.join(skillRootDir, "references");
  const binDir = path.join(skillRootDir, "bin");
  const distDir = path.join(skillRootDir, "dist");
  const packageJsonPath = path.join(skillRootDir, "package.json");

  return {
    skillRootDir,
    hasScripts: await dirExists(scriptsDir),
    hasReferences: await dirExists(referencesDir),
    hasBin: await dirExists(binDir),
    hasDist: await dirExists(distDir),
    packageJson: await readJsonIfExists(packageJsonPath),
  };
}

function runStaticChecks(frontmatter, markdown, folderFacts) {
  const findings = [];

  const desc = String(frontmatter.description || "").trim();
  if (!desc) findings.push({ level: "P0", message: "frontmatter 缺少 description，触发与定位会变弱。" });
  if (desc && desc.length < 40) findings.push({ level: "P1", message: "description 偏短，建议补充更明确的触发语句（Invoke when ...）。" });
  if (desc && !/invoke when/i.test(desc)) findings.push({ level: "P1", message: "description 未包含 Invoke when 触发语句，建议补充。" });

  const hasWhenToInvoke =
    Boolean(extractSection(markdown, ["什么时候调用", "When to invoke this skill", "Triggers"])) ||
    /when to invoke|什么时候调用|triggers/i.test(markdown);
  if (!hasWhenToInvoke) findings.push({ level: "P0", message: "缺少“什么时候调用/Triggers”章节，容易误触发或不触发。" });

  const hasIO = /输入与输出|Input|Output/i.test(markdown);
  if (!hasIO) findings.push({ level: "P1", message: "缺少“输入与输出”描述，交付契约不清晰。" });

  const hasBoundaries = /边界|不做的事|Limitations/i.test(markdown);
  if (!hasBoundaries) findings.push({ level: "P1", message: "缺少“边界/不做的事”，容易过度承诺。" });

  const allowedTools = String(frontmatter["allowed-tools"] || "").trim();
  if (folderFacts.hasScripts && !allowedTools) {
    findings.push({ level: "P1", message: "存在 scripts/，但 frontmatter 没有 allowed-tools，执行层能力可能无法触发使用。" });
  }

  return findings;
}

function toMdReport(entry) {
  const lines = [];
  lines.push(`# ${entry.displayName || entry.name || "Skill"} — 快速拆解扫描`);
  lines.push("");
  lines.push("## 基本信息");
  lines.push(`- name: ${entry.name || ""}`);
  lines.push(`- displayName: ${entry.displayName || ""}`);
  lines.push(`- 推断类型: ${entry.inferredType}`);
  lines.push(`- allowed-tools: ${entry.allowedTools || ""}`);
  lines.push("");
  lines.push("## 目录结构");
  lines.push(`- skillRootDir: ${entry.folderFacts.skillRootDir || ""}`);
  lines.push(`- scripts/: ${entry.folderFacts.hasScripts ? "yes" : "no"}`);
  lines.push(`- references/: ${entry.folderFacts.hasReferences ? "yes" : "no"}`);
  lines.push(`- bin/: ${entry.folderFacts.hasBin ? "yes" : "no"}`);
  lines.push(`- dist/: ${entry.folderFacts.hasDist ? "yes" : "no"}`);
  lines.push(`- package.json: ${entry.folderFacts.packageJson ? "yes" : "no"}`);
  lines.push("");
  lines.push("## 触发信号候选");
  if (entry.triggerCandidates.length === 0) {
    lines.push("- (未提取到)");
  } else {
    for (const item of entry.triggerCandidates) lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("## 静态检查（建议）");
  if (entry.findings.length === 0) {
    lines.push("- (无)");
  } else {
    for (const finding of entry.findings) lines.push(`- ${finding.level}: ${finding.message}`);
  }
  lines.push("");
  return lines.join("\n");
}

async function resolveSkillInputToSkillMdPath(repoRoot, input) {
  const normalized = String(input).trim();
  if (!normalized) return null;

  const asPath = path.resolve(process.cwd(), normalized);
  if (await fileExists(asPath) && asPath.toLowerCase().endsWith(".md")) return asPath;
  if (await dirExists(asPath)) {
    const candidate = path.join(asPath, "SKILL.md");
    if (await fileExists(candidate)) return candidate;
  }

  const localCandidate = path.join(repoRoot, ".trae", "skills", normalized, "SKILL.md");
  if (await fileExists(localCandidate)) return localCandidate;

  const publishCandidate = path.join(repoRoot, "publish", normalized, "SKILL.md");
  if (await fileExists(publishCandidate)) return publishCandidate;

  return null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const skills = options.skill;

  if (!skills || skills.length === 0 || options.help) {
    console.log(`Skill Breakdown Analyzer — local scan

Usage:
  node ./scripts/analyze-skill.mjs --skill <nameOrPath> [--skill <nameOrPath> ...] [--format md|json]

Examples:
  node ./scripts/analyze-skill.mjs --skill my-skill-builder
  node ./scripts/analyze-skill.mjs --skill ./.trae/skills/my-music-skill
  node ./scripts/analyze-skill.mjs --skill my-skill-builder --skill my-music-skill --format json
`);
    process.exit(options.help ? 0 : 1);
  }

  const repoRoot = await findRepoRoot(process.cwd());
  const results = [];

  for (const skillInput of skills) {
    const skillMdPath = await resolveSkillInputToSkillMdPath(repoRoot, skillInput);
    if (!skillMdPath) {
      results.push({
        input: skillInput,
        error: "未找到 SKILL.md（支持：skill 名称 / SKILL.md 路径 / skill 目录 / publish 目录）",
      });
      continue;
    }

    const skillRootDir = path.dirname(skillMdPath);
    const markdown = await fs.readFile(skillMdPath, "utf-8");
    const { data: frontmatter, body } = parseFrontmatter(markdown);
    const folderFacts = await collectFolderFacts(skillRootDir);
    const inferredType = inferSkillTypeFromText(frontmatter, markdown, folderFacts);
    const triggerCandidates = extractTriggerCandidates(body, frontmatter);
    const findings = runStaticChecks(frontmatter, body, folderFacts);

    results.push({
      input: skillInput,
      skillMdPath,
      name: frontmatter.name || "",
      displayName: frontmatter.displayName || "",
      description: frontmatter.description || "",
      allowedTools: frontmatter["allowed-tools"] || "",
      inferredType,
      triggerCandidates,
      folderFacts,
      findings,
    });
  }

  const format = String(options.format || "md").toLowerCase();
  if (format === "json") {
    console.log(JSON.stringify({ repoRoot, results }, null, 2));
    return;
  }

  const md = [];
  md.push(`# Skill 拆解扫描结果`);
  md.push("");
  md.push(`- repoRoot: ${repoRoot}`);
  md.push(`- skills: ${skills.join(", ")}`);
  md.push("");
  for (const entry of results) {
    if (entry.error) {
      md.push(`## ${entry.input}`);
      md.push("");
      md.push(`- error: ${entry.error}`);
      md.push("");
      continue;
    }
    md.push(toMdReport(entry).trimEnd());
    md.push("");
  }
  console.log(md.join("\n").trimEnd());
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
