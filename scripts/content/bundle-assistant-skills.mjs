#!/usr/bin/env node
// assistant-skills/<id>/SKILL.md 를 편집기 조수용 번들(src/assets/assistantSkills.json)로 굽는다.
// 원본은 저장소 assistant-skills/ 하나다 — Claude 스킬(심링크)과 편집기 조수(read_assistant_skill)가 같은 글을 읽는다.
//   node scripts/content/bundle-assistant-skills.mjs          # 굽기
//   node scripts/content/bundle-assistant-skills.mjs --check  # 번들이 원본과 다르면 exit 1
// 스킬 폴더의 references/**/*.md 는 «부분(part)» 으로 따로 굽는다(src/assets/assistantSkillParts.json) — 편집기 첫 번들에 넣지 않고
// read_assistant_skill({id, part}) 가 그때 동적 import 로 받는다. 첫 번들 JSON 에는 부분 목록(id·글자 수)만 남긴다.
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = join(root, "assistant-skills");
const out = join(root, "src", "assets", "assistantSkills.json");
const partsOut = join(root, "src", "assets", "assistantSkillParts.json");

function markdownFiles(dir, prefix = "") {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...markdownFiles(join(dir, entry.name), rel));
    else if (entry.name.endsWith(".md")) files.push({ id: rel.slice(0, -3), file: join(dir, entry.name) });
  }
  return files;
}

function parse(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const head = m ? m[1] : "";
  const field = (key) => (head.match(new RegExp(`^${key}:\\s*(.*)$`, "m"))?.[1]?.trim() ?? "").replace(/^(["'])(.*)\1$/s, "$2");
  return { name: field("name"), description: field("description"), body: m ? text.slice(m[0].length).trimStart() : text };
}

const skills = [];
const parts = {};
for (const id of readdirSync(srcDir).sort()) {
  const file = join(srcDir, id, "SKILL.md");
  if (!existsSync(file)) continue;
  const { name, description, body } = parse(readFileSync(file, "utf8"));
  const extras = [];
  const examples = join(srcDir, id, "examples.md");
  if (existsSync(examples)) extras.push({ title: "examples.md", text: readFileSync(examples, "utf8") });
  const refs = markdownFiles(join(srcDir, id, "references")).map((ref) => ({ id: ref.id, text: readFileSync(ref.file, "utf8") }));
  const skillId = name || id;
  if (refs.length) parts[skillId] = refs;
  skills.push({
    id: skillId,
    description,
    body,
    ...(extras.length ? { extras } : {}),
    ...(refs.length ? { parts: refs.map((ref) => ({ id: ref.id, characters: ref.text.length })) } : {}),
  });
}
const json = `${JSON.stringify({ version: 1, source: "assistant-skills/*/SKILL.md", skills }, null, 1)}\n`;
const partsJson = `${JSON.stringify({ version: 1, source: "assistant-skills/*/references/**/*.md", parts }, null, 1)}\n`;
if (process.argv.includes("--check")) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  const curParts = existsSync(partsOut) ? readFileSync(partsOut, "utf8") : "";
  if (cur !== json || curParts !== partsJson) { console.error(`assistantSkills.json / assistantSkillParts.json 이 원본과 다르다 — node scripts/content/bundle-assistant-skills.mjs 로 다시 굽는다`); process.exit(1); }
  console.log(`ok — ${skills.length} skills`);
} else {
  writeFileSync(out, json);
  writeFileSync(partsOut, partsJson);
  console.log(`wrote ${out} — ${skills.length} skills (${json.length} bytes), ${partsOut} (${partsJson.length} bytes)`);
}
