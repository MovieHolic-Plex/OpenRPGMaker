#!/usr/bin/env node
// 인터뷰 선택 배경 PNG 를 공개 R2 와 맞춘다. 그림은 저장소에 넣지 않는다(.gitignore) — 앱은 cdn.openrpgmaker.com 에서 읽는다.
//
//   node scripts/content/sync-interview-scenes.mjs push   하네스 build 가 만든 public/assets/harnesses/interview-scene-bank/ 와
//                                                         harness-data/interview-scene-bank/edit-sources/ 를 R2 로 올린다(aws CLI).
//   node scripts/content/sync-interview-scenes.mjs pull   목록(src/editor/interviewSceneBank.json)의 배경을 CDN 에서 받아 같은 폴더에 둔다.
//                                                         새 체크아웃에서 하네스 gate/build 를 다시 돌릴 때 쓴다. 키가 필요 없다.
//   node scripts/content/sync-interview-scenes.mjs check  목록의 모든 배경이 CDN 에 있고 해시가 맞는지 확인한다.
//
// push 의 키: 환경 변수 또는 .env / ~/.config/oprn-r2/env 의 R2_ACCOUNT_ID·R2_ACCESS_KEY_ID·R2_SECRET_ACCESS_KEY·R2_BUCKET.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const CDN = "https://cdn.openrpgmaker.com/interview-scene-bank/";
const LOCAL_PREFIX = "/assets/harnesses/interview-scene-bank/";
const sceneDir = join(root, "public/assets/harnesses/interview-scene-bank");
const editDir = join(root, "harness-data/interview-scene-bank/edit-sources");

function loadEnv() {
  for (const file of [join(root, ".env"), join(homedir(), ".config/oprn-r2/env")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

function scenes() {
  const bank = JSON.parse(readFileSync(join(root, "src/editor/interviewSceneBank.json"), "utf8"));
  return Object.entries(bank.scenes).map(([key, e]) => {
    if (!e.url.startsWith(LOCAL_PREFIX)) throw new Error(`${key}: 예상 밖 주소 ${e.url}`);
    return { key, name: e.url.slice(LOCAL_PREFIX.length), sha256: e.sha256 };
  });
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex");

async function fetchScene(s) {
  const res = await fetch(CDN + s.name);
  if (!res.ok) return { s, error: `HTTP ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  return sha(buf) === s.sha256 ? { s, buf } : { s, error: "해시 다름" };
}

async function each(list, n, fn) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(...(await Promise.all(list.slice(i, i + n).map(fn))));
  return out;
}

const cmd = process.argv[2];
if (cmd === "push") {
  loadEnv();
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) throw new Error("R2_* 키가 없다 — .env 또는 ~/.config/oprn-r2/env");
  const env = { ...process.env, AWS_ACCESS_KEY_ID: R2_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: R2_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION: "auto" };
  const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  for (const [dir, prefix] of [[sceneDir, "interview-scene-bank/"], [editDir, "interview-scene-bank/edit-sources/"]]) {
    if (!existsSync(dir)) { console.log(`건너뜀(없음): ${dir}`); continue; }
    // 파일 이름에 해시가 들어 있어 바뀌지 않는다 — 오래 캐시해도 된다. 지우지는 않는다(--delete 없음).
    const r = spawnSync("aws", ["--endpoint-url", endpoint, "s3", "sync", dir, `s3://${R2_BUCKET}/${prefix}`,
      "--exclude", "*", "--include", "*.png", "--content-type", "image/png", "--cache-control", "public, max-age=31536000, immutable", "--only-show-errors"],
      { env, stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status ?? 1);
    console.log(`올림: ${dir} → ${prefix}`);
  }
} else if (cmd === "pull" || cmd === "check") {
  const list = scenes();
  const results = await each(list, 16, fetchScene);
  const bad = results.filter((r) => r.error);
  if (cmd === "pull") {
    mkdirSync(sceneDir, { recursive: true });
    for (const r of results) if (r.buf) writeFileSync(join(sceneDir, r.s.name), r.buf);
  }
  console.log(`${cmd}: ${list.length - bad.length}/${list.length} 맞음`);
  for (const r of bad.slice(0, 20)) console.log(`  ${r.s.key}: ${r.error}`);
  if (bad.length) process.exit(1);
} else {
  console.log("사용법: node scripts/content/sync-interview-scenes.mjs push|pull|check");
  process.exit(2);
}
