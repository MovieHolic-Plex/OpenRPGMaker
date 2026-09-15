// 생성 에셋 러너 계약 — dry-run 가짜가 승격되지 않는다.
//
// 실측 2026-09-15: public/assets/generated/starter/ 안에 potion-red-icon/image · bronze-sword-icon/image ·
// hero-01-charset.png **5장**이 dry-run 이 쓰는 가짜 픽셀(x*17+y*31 그라데이션) 그대로 들어가 있었고,
// 계획 파일에는 `status: "promoted"` 로 기록돼 있었다. 검증이 "공백이 아니다" 만 봤기 때문이다.
// 이 테스트는 그 경계를 잠근다: 가짜는 실패로 표시되고, 실제 그림은 통과한다.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, copyFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);
const root = process.cwd();
const REAL_ICON = path.join(root, "public", "assets", "generated", "starter", "battle-icon-bag.png");
const workspaces = [];

async function workspace() {
  const dir = await mkdtemp(path.join(tmpdir(), "oprn-generated-assets-"));
  workspaces.push(dir);
  return dir;
}

after(async () => {
  await Promise.all(workspaces.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function runRunner(mode, options) {
  const args = [path.join(root, "scripts", "oprn-generated-assets.mjs"), mode];
  for (const [key, value] of Object.entries(options)) args.push(`--${key}`, value);
  return run(process.execPath, args, { cwd: root });
}

async function manifestFor(dir, id) {
  const manifest = path.join(dir, "manifest.json");
  await writeFile(manifest, JSON.stringify({ version: 1, assets: [
    { id, target: "itemIcon", resourceKind: "picture", resourceId: `generated-item-${id}`,
      expectedDimensions: { width: 64, height: 64 }, prompt: "x", negativePrompt: "y", status: "planned" },
  ] }));
  return manifest;
}

test("dry-run 가짜는 승격 가능으로 통과하지 않는다", async () => {
  const dir = await workspace();
  const manifest = await manifestFor(dir, "potion-red-image");
  const rawRoot = path.join(dir, "raw");

  await runRunner("dry-run", { manifest, "raw-root": rawRoot, out: path.join(dir, "dry.json") });
  const out = path.join(dir, "validated.json");
  await runRunner("validate-only", { manifest, "raw-root": rawRoot, out });
  const [entry] = JSON.parse(await readFile(out, "utf8")).validations;

  assert.equal(entry.ok, false, "dry-run 가짜는 통과하면 안 된다");
  assert.equal(entry.promotion, null, "가짜에는 승격 기록이 붙으면 안 된다");
  assert.match(entry.issues.join(" | "), /dry-run fake placeholder/);
});

test("실제 그림은 같은 경로 규약에서 통과하고 승격 기록을 받는다", async () => {
  const dir = await workspace();
  const manifest = await manifestFor(dir, "battle-icon-bag");
  const rawRoot = path.join(dir, "raw");

  // 러너가 기대하는 raw 경로 규약(<id>-<stableEightHex>.png)을 dry-run 으로 먼저 만든 뒤, 가짜를 진짜 그림으로 덮는다.
  const probe = path.join(dir, "dry.json");
  await runRunner("dry-run", { manifest, "raw-root": rawRoot, out: probe });
  const [{ path: rawPath }] = JSON.parse(await readFile(probe, "utf8")).validations;
  await copyFile(REAL_ICON, rawPath);

  const out = path.join(dir, "validated.json");
  await runRunner("validate-only", { manifest, "raw-root": rawRoot, out });
  const [entry] = JSON.parse(await readFile(out, "utf8")).validations;

  assert.equal(entry.ok, true, entry.issues?.join(" | "));
  assert.equal(entry.promotion?.promotedPath, "public/assets/generated/starter/battle-icon-bag.png");
});
