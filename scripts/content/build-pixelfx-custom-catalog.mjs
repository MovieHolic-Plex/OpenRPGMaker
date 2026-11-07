#!/usr/bin/env node
// src/pixelfx/custom/<분류>/<이름>.js (우리가 저작한 효과, 업스트림 밖)의 meta 로 custom/catalog.json 을 만든다.
// 필드 규칙은 scripts/vendor/sync-pixelfx.mjs 의 vendor catalog.json 과 같다 — 편집기·조수·전투 길이가 한 모양을 본다.
// 사용: node scripts/content/build-pixelfx-custom-catalog.mjs
import { readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "src", "pixelfx", "custom");

function actTimingOf(mod) {
  const a = mod?.act;
  if (!a) return null;
  const D = mod.meta?.duration ?? 1, keys = a.poses ?? [];
  const from = Math.min(0, keys[0]?.[0] ?? 0);
  const last = keys.length ? keys[keys.length - 1][0] : 0;
  return {
    windup: +Math.max(0, -from).toFixed(3),
    recovery: mod.meta?.loop ? 0 : +Math.max(0, last - D).toFixed(3),
    onBody: !!a.onBody,
    hits: (a.hits ?? []).length,
    targets: (a.targets ?? (a.target ? [a.target] : [])).length,
  };
}

const effects = [];
for (const category of readdirSync(dir, { withFileTypes: true })) {
  if (!category.isDirectory()) continue;
  for (const file of readdirSync(join(dir, category.name)).sort()) {
    if (!file.endsWith(".js") || file.startsWith("_")) continue;
    const id = `${category.name}/${file.slice(0, -3)}`;
    const mod = await import(pathToFileURL(join(dir, category.name, file)).href);
    const m = mod.meta ?? {}, o = m.options ?? {}, act = actTimingOf(mod);
    effects.push({
      id, category: category.name, name: m.name ?? id, desc: m.desc ?? "", tags: Array.isArray(m.tags) ? m.tags : [],
      size: m.size ?? [96, 96], origin: m.origin ?? [48, 48], duration: m.duration ?? 1, loop: !!m.loop, fps: m.fps ?? 30,
      palette: Array.isArray(o.palette) ? o.palette : [], actor: m.actor ? 1 : 0,
      back: typeof mod.drawBack === "function" || /drawBack/.test(String(mod.create ?? "")) ? 1 : 0,
      ...(act ? { act } : {}),
    });
  }
}
writeFileSync(join(dir, "catalog.json"), JSON.stringify({ effects }, null, 1) + "\n");
console.log(`custom pixelfx: ${effects.length}개 → src/pixelfx/custom/catalog.json`);
