#!/usr/bin/env node
// assistant-skills/<id>/SKILL.md 를 편집기 조수용 번들(src/assets/assistantSkills.json)로 굽는다.
// 원본은 저장소 assistant-skills/ 하나다 — Claude 스킬(심링크)과 편집기 조수(read_assistant_skill)가 같은 글을 읽는다.
//   node scripts/content/bundle-assistant-skills.mjs          # 굽기
//   node scripts/content/bundle-assistant-skills.mjs --check  # 번들이 원본과 다르면 exit 1
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = join(root, "assistant-skills");
const out = join(root, "src", "assets", "assistantSkills.json");

function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const head = m ? m[1] : "";
  const field = (key) => (head.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "").replace(/^(["'])(.*)\1$/s, "$2");
  return { name: field("name"), description: field("description"), body: m ? text.slice(m[0].length).trimStart() : text };
}

const skills = [];
for (const id of readdirSync(srcDir).sort()) {
  const file = join(srcDir, id, "SKILL.md");
  if (!existsSync(file)) continue;
  const { name, description, body } = parse(readFileSync(file, "utf8"));
  const extras = [];
  const examples = join(srcDir, id, "examples.md");
  if (existsSync(examples)) extras.push({ title: "examples.md", text: readFileSync(examples, "utf8") });
  skills.push({ id: name || id, description, body, ...(extras.length ? { extras } : {}) });
}
const json = `${JSON.stringify({ version: 1, source: "assistant-skills/*/SKILL.md", skills }, null, 1)}\n`;
if (process.argv.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur !== json) { console.error(`assistantSkills.json 이 원본과 다르다 — node scripts/content/bundle-assistant-skills.mjs 로 다시 굽는다`); process.exit(1); }
  console.log(`ok — ${skills.length} skills`);
} else {
  writeFileSync(out, json);
  console.log(`wrote ${out} — ${skills.length} skills (${json.length} bytes)`);
}
