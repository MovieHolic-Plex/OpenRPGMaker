#!/usr/bin/env node
// 스토어 소식 글 그림(2026-10-25): 출하 플레이어에서 찍은 실제 게임 화면을 공개 CDN 에 올리고, 글에 붙일 마크다운 줄을 찍는다.
//
// 왜: 소식 글이 새 보스·세이브 지점·휴대폰 조작을 말하면서 그림이 하나도 없었다(운영 fallen-star 소식 #1).
// 스토어 글은 그 판본 파일이나 공개 CDN(https://cdn.openrpgmaker.com) 의 그림만 보여 준다(store-server posts.ts postImageResolver).
// 판본 파일에 그림을 넣으려면 새 판본을 올려야 하므로, 이미 나간 판본의 글은 CDN 그림을 쓴다.
//
// 그림은 손으로 고르지 말고 출하 플레이어 체크포인트에서 찍는다(편집기 셸 금지):
//   node scripts/runtime-qa.mjs --scenario checkpoints --checkpoint-set fallen-star --checkpoint valen-squad,save-crystal --parallel 1 --netns
//   → verify-shots/runtime-qa/… 의 PNG 를 고른다.
//
// 쓰는 법:
//   node scripts/store/news-shots.mjs --slug fallen-star "boss.png=발렌과의 세 단계 전투" "shrine.png=별지기 사당의 별 조각"
//   … --push            # 공개 R2(oprn-public)에 올린다. 없으면 webp 만 만들고 주소를 미리 보여 준다.
//   … --scale 2         # 도트가 뭉개지지 않게 최근접 확대(기본 2배)
//   … --out <dir>       # webp 를 둘 곳(기본 tmp/store-news/<slug>)
//
// 키: 환경 변수 또는 .env / ~/.config/oprn-r2/env 의 R2_ACCOUNT_ID·R2_ACCESS_KEY_ID·R2_SECRET_ACCESS_KEY·R2_BUCKET(sync-interview-scenes.mjs 와 같다).
// 키 값은 찍지 않는다. 운영 스토어 글을 고치는 일은 이 스크립트가 하지 않는다 — 찍힌 마크다운 줄을 글 편집 화면(또는 조수 store_game_post 카드)에 붙인다.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const CDN = "https://cdn.openrpgmaker.com";

function parseArgs(argv) {
  const args = { slug: null, push: false, scale: 2, out: null, date: new Date().toISOString().slice(0, 10), shots: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--slug") args.slug = argv[++i];
    else if (a === "--push") args.push = true;
    else if (a === "--scale") args.scale = Number(argv[++i]);
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--date") args.date = argv[++i];
    else if (a.startsWith("--")) throw new Error(`모르는 인자: ${a}`);
    else {
      const eq = a.indexOf("=");
      args.shots.push(eq > 0 ? { file: a.slice(0, eq), caption: a.slice(eq + 1) } : { file: a, caption: "" });
    }
  }
  if (!args.slug || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(args.slug)) throw new Error("--slug <게임 slug> 가 필요하다");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("--date 는 YYYY-MM-DD");
  if (!Number.isInteger(args.scale) || args.scale < 1 || args.scale > 4) throw new Error("--scale 은 1~4");
  if (args.shots.length === 0) throw new Error("그림 파일을 하나 이상 줘라 (파일.png=설명)");
  return args;
}

function loadEnv() {
  for (const file of [join(root, ".env"), join(homedir(), ".config/oprn-r2/env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const slugPart = (name) => basename(name, extname(name)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shot";

const args = parseArgs(process.argv.slice(2));
const outDir = resolve(args.out ?? join(root, "tmp/store-news", args.slug));
mkdirSync(outDir, { recursive: true });
const prefix = `store-news/${args.slug}/${args.date}`;
const made = [];
for (const shot of args.shots) {
  const input = resolve(shot.file);
  if (!existsSync(input)) throw new Error(`없는 파일: ${input}`);
  const output = join(outDir, `${slugPart(input)}.webp`);
  // 도트 그림: 최근접 확대 + 무손실 webp(색이 번지지 않는다).
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-vf", `scale=iw*${args.scale}:ih*${args.scale}:flags=neighbor`, "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", output], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`webp 변환 실패: ${input}`);
  made.push({ ...shot, output, key: `${prefix}/${basename(output)}`, bytes: statSync(output).size });
}

if (args.push) {
  loadEnv();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2_* 키가 없다 — .env 또는 ~/.config/oprn-r2/env");
  const env = { ...process.env, AWS_ACCESS_KEY_ID: R2_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION: "auto" };
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  for (const item of made) {
    const r = spawnSync("aws", ["--endpoint-url", endpoint, "s3", "cp", item.output, `s3://${R2_BUCKET}/${item.key}`,
      "--content-type", "image/webp", "--cache-control", "public, max-age=31536000, immutable", "--only-show-errors"], { env, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`올리기 실패: ${item.key}`);
  }
}

console.log(args.push ? "올렸다. 글에 붙일 줄:" : "(미리 보기 — --push 로 올린다) 글에 붙일 줄:");
for (const item of made) console.log(`![${item.caption.replace(/[\]\n]/g, " ")}](${CDN}/${item.key})`);
console.error(made.map((m) => `${basename(m.output)} ${Math.round(m.bytes / 1024)}KB`).join(" · "));
