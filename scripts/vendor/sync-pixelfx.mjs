#!/usr/bin/env node
// pixelfx (MIT, https://github.com/patch-gg/pixelfx) 를 src/vendor/pixelfx 로 가져온다.
//
//   node scripts/vendor/sync-pixelfx.mjs [--src /tmp/pixelfx]
//
// 원본 src/core 와 src/fx 를 바이트 그대로 복사하고(우리 쪽 수정 없음, OPRN 이 쓴 *.d.ts 만 보존), LICENSE·NOTICE.md 를 옮기고,
// 원본 커밋을 UPSTREAM.json 에 적고, 에디터·조수·런타임이 효과 코드를 읽지 않고도 쓰는 목록
// catalog.json(id·분류·이름·설명·태그·크기·원점·길이·반복·기본 팔레트·actor)과 길이표 timing.json 을 다시 만든다.
// gallery/fonts 의 Patch Pixel 글꼴은 MIT 가 아니므로 절대 가져오지 않는다.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const argv = process.argv.slice(2);
const srcArg = argv.indexOf("--src");
const src = resolve(srcArg >= 0 ? argv[srcArg + 1] : "/tmp/pixelfx");
const dest = join(repo, "src/vendor/pixelfx");

if (!existsSync(join(src, "src/core/index.js"))) {
  console.error(`pixelfx 원본이 없다: ${src}\n  git clone https://github.com/patch-gg/pixelfx ${src}`);
  process.exit(1);
}

const git = (...a) => execFileSync("git", ["-C", src, ...a], { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const committedAt = git("log", "-1", "--format=%cI");

// OPRN 이 쓴 타입 선언(core/index.d.ts)은 원본에 없으므로 복사 전에 들고 있다가 되돌린다.
const keep = new Map();
for (const sub of ["core", "fx"]) {
  const dir = join(dest, sub);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) if (f.endsWith(".d.ts")) keep.set(join(dir, f), readFileSync(join(dir, f)));
}
for (const sub of ["core", "fx"]) {
  rmSync(join(dest, sub), { recursive: true, force: true });
  cpSync(join(src, "src", sub), join(dest, sub), { recursive: true });
}
for (const [file, body] of keep) writeFileSync(file, body);
cpSync(join(src, "LICENSE"), join(dest, "LICENSE"));
cpSync(join(src, "NOTICE.md"), join(dest, "NOTICE.md"));

// catalog.json — 효과 모듈을 실제로 불러 meta 만 뽑는다(효과 코드는 순수 JS, DOM 없음).
const { effects } = await import(pathToFileURL(join(dest, "fx/index.js")).href);
const { categories } = await import(pathToFileURL(join(dest, "fx/categories.js")).href);
const out = [];
for (const [id, mod] of Object.entries(effects)) {
  const m = mod.meta ?? {};
  const o = m.options ?? {};
  out.push({
    id,
    category: id.split("/")[0],
    name: m.name ?? id,
    desc: m.desc ?? "",
    tags: Array.isArray(m.tags) ? m.tags : [],
    size: m.size ?? [96, 96],
    origin: m.origin ?? [48, 48],
    duration: m.duration ?? 1,
    loop: !!m.loop,
    fps: m.fps ?? 30,
    palette: Array.isArray(o.palette) ? o.palette : [],
    actor: m.actor ? 1 : 0,
    back: typeof mod.drawBack === "function" || /drawBack/.test(String(mod.create ?? "")) ? 1 : 0,
  });
}
// 효과 파일이 index 에 다 들어 있는지(원본 생성 파일이 낡았으면 바로 알린다)
let files = 0;
for (const c of readdirSync(join(dest, "fx"), { withFileTypes: true }))
  if (c.isDirectory())
    for (const f of readdirSync(join(dest, "fx", c.name))) if (f.endsWith(".js") && !f.startsWith("_")) files++;
if (files !== out.length) console.warn(`경고: 효과 파일 ${files}개, index 에는 ${out.length}개`);

mkdirSync(dest, { recursive: true });
writeFileSync(
  join(dest, "catalog.json"),
  JSON.stringify({ categories: categories.map((c) => ({ id: c.id, name: c.name, blurb: c.blurb })), effects: out }) + "\n",
);
// timing.json — 규칙 층(전투 시퀀서)이 효과 코드 없이 길이를 알도록: { id: [길이 ms, 반복 1/0] }.
writeFileSync(
  join(dest, "timing.json"),
  JSON.stringify(Object.fromEntries(out.map((e) => [e.id, [Math.round(e.duration * 1000), e.loop ? 1 : 0]]))) + "\n",
);
writeFileSync(
  join(dest, "UPSTREAM.json"),
  JSON.stringify({ repo: "https://github.com/patch-gg/pixelfx", commit, committedAt, license: "MIT", effects: out.length }, null, 2) + "\n",
);
console.log(`pixelfx ${commit.slice(0, 7)} (${committedAt}) → ${dest}: 효과 ${out.length}개`);
