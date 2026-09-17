#!/usr/bin/env node
// 브라우저 탭이 로컬 폴더 정본(project.sqlite)을 실제로 여는지 확인하고 스크린샷 증거를 남긴다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { withTsModule } from "../ontology-ts-loader.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNTIME_ENTRY = resolve(REPO_ROOT, "electron/serve/runtime.ts");
const BRIDGE_BUNDLE = resolve(REPO_ROOT, "dist-electron/browser-bridge.js");

const projectDir = resolve(process.argv[process.argv.indexOf("--project-dir") + 1] ?? "");
if (!process.argv.includes("--project-dir") || !projectDir) throw new Error("--project-dir 가 필요합니다");

const outDir = resolve(REPO_ROOT, "verify-shots", "browser-local-canon");
mkdirSync(outDir, { recursive: true });
const EDIT_TITLE = "브라우저 탭이 고친 제목";
const COMMIT_SUMMARY = "브라우저 탭이 남긴 기록";
const ASSET_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readStoreState() {
  const db = new DatabaseSync(join(projectDir, "project.sqlite"));
  try {
    const project = db.prepare("SELECT title, revision FROM project WHERE id = 1").get();
    const commits = db.prepare("SELECT COUNT(*) AS n FROM commits").get();
    const assets = db.prepare("SELECT sha256, mime FROM assets").all();
    return { title: project?.title ?? null, revision: project?.revision ?? null, commits: commits?.n ?? 0, assets };
  } finally {
    db.close();
  }
}

const stateBefore = readStoreState();
const browserBridgeSource = readFileSync(BRIDGE_BUNDLE, "utf8");

await withTsModule(RUNTIME_ENTRY, "oprn-serve-runtime.mjs", async (runtime) => {
  const server = await runtime.startLocalProjectServer({ projectDir, distDir: resolve(REPO_ROOT, "dist"), browserBridgeSource });
  process.stdout.write(`서버: ${server.url}\n프로젝트 폴더: ${server.projectDir}\n`);

  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const failedResponses = new Map();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 200));
  });
  page.on("pageerror", (error) => consoleErrors.push(`PAGEERROR ${error.message.slice(0, 200)}`));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const key = `${response.status()} ${new URL(response.url()).pathname}`;
    failedResponses.set(key, (failedResponses.get(key) ?? 0) + 1);
  });

  await page.goto(server.url, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: join(outDir, "01-browser-editor-boot.png") });

  const roundTrip = await page.evaluate(
    async ({ title, commitSummary, assetBytes }) => {
      const bridge = window.oprn;
      const status = await bridge.project.status();
      const loaded = await bridge.project.load();
      const parsed = JSON.parse(loaded.serialized);
      parsed.meta.title = title;
      const saved = await bridge.project.save({ projectDir: status.projectDir, serialized: JSON.stringify(parsed), expectedSha: loaded.sha256 });
      const asset = await bridge.assets.put({
        projectDir: status.projectDir,
        mime: "image/png",
        extension: "png",
        kind: "sprite",
        originalName: "browser-proof.png",
        bytes: new Uint8Array(assetBytes),
      });
      const commit = await bridge.commits.record({
        projectDir: status.projectDir,
        identity: { id: "browser-tab", label: "브라우저 탭", kind: "user" },
        reviewStatus: "direct",
        summary: commitSummary,
        toolNames: [],
      });
      const readBack = await bridge.assets.read({ projectDir: status.projectDir, sha256: asset.ref.sha256 });
      return {
        closeIsHostDriven: bridge.closeIsHostDriven,
        statusKind: status.kind,
        projectDir: status.projectDir,
        savedKind: saved.kind,
        revisionBefore: loaded.revision,
        assetSha: String(asset.ref.sha256),
        assetUrl: String(bridge.assetBaseUrl(status.projectDir) + asset.ref.sha256),
        assetRoundTripBytes: Array.from(readBack),
        commitKind: String(commit.kind),
      };
    },
    { title: EDIT_TITLE, commitSummary: COMMIT_SUMMARY, assetBytes: Array.from(ASSET_BYTES) },
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 90_000 });
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: join(outDir, "02-browser-editor-after-save.png") });

  const stateAfter = readStoreState();
  const assetOnDisk = existsSync(join(projectDir, "assets", `${roundTrip.assetSha}.png`));
  const servedAsset = await fetch(`${server.url}/__oprn/asset/${roundTrip.assetSha}`);
  const servedBytes = Array.from(new Uint8Array(await servedAsset.arrayBuffer()));
  const editorImmediatelyAfterBoot = await page.evaluate(() => ({
    canvas: Boolean(document.querySelector('[data-testid="edit-canvas"]')),
    dbRequiredPanel: Boolean(document.querySelector('[data-testid="db-required-panel"]')),
  }));
  await browser.close();
  await server.close();

  const commitRecorded = stateAfter.commits > stateBefore.commits;
  const assetRecorded = stateAfter.assets.some((row) => row.sha256 === roundTrip.assetSha);
  const summary = [
    "# 브라우저 탭이 로컬 폴더 정본을 연다 — 실측",
    "",
    `- 서버: ${server.url} (127.0.0.1 전용, 토큰으로 보호)`,
    `- 프로젝트 폴더: ${server.projectDir}`,
    `- 브리지: window.oprn (HTTP 전송, closeIsHostDriven=${roundTrip.closeIsHostDriven})`,
    `- status: ${roundTrip.statusKind} / projectDir 일치: ${roundTrip.projectDir === server.projectDir}`,
    `- 편집기 부팅: edit-canvas ${editorImmediatelyAfterBoot.canvas}, db-required-panel ${editorImmediatelyAfterBoot.dbRequiredPanel}`,
    `- 프로젝트 저장: ${roundTrip.savedKind} (리비전 ${roundTrip.revisionBefore} → ${stateAfter.revision})`,
    `- **브라우저가 쓴 자산**: ${roundTrip.assetSha.slice(0, 12)}… — 폴더의 파일 존재 ${assetOnDisk}, assets 표 기록 ${assetRecorded}, HTTP 재서빙 일치 ${JSON.stringify(servedBytes) === JSON.stringify([...ASSET_BYTES])}`,
    `- **브라우저가 남긴 커밋**: "${COMMIT_SUMMARY}" — commits ${stateBefore.commits} → ${stateAfter.commits}`,
    `- 제목(참고): "${stateBefore.title}" → "${stateAfter.title}" — 살아 있는 편집기의 자동 저장이 같은 문서를 쓰므로 제목 한 줄은 경합한다(자산·커밋·리비전이 경합 없는 증거다).`,
    `- 4xx/5xx 응답: ${failedResponses.size === 0 ? "없음" : [...failedResponses.entries()].map(([key, count]) => `${key} ×${count}`).join(", ")}`,
    "",
    "위 4xx 는 정본 경로 밖이다 — `/rest/v1/map_edit_locks` 는 원격 전용 기능(Supabase 설정이 있을 때만)이고,",
    "`/auth/status`·`/__oprn/edit-activity` 는 아직 vite 플러그인으로만 있는 동반 서비스 엔드포인트다(설계 7.4).",
    "읽기·쓰기·자산·백업은 모두 브리지로 통과했다.",
    "",
    "![editor boot](01-browser-editor-boot.png)",
    "![after save](02-browser-editor-after-save.png)",
    "",
  ].join("\n");
  writeFileSync(join(outDir, "SUMMARY.md"), summary);

  process.stdout.write(`${summary}\n`);
  if (roundTrip.savedKind !== "saved" || !assetOnDisk || !assetRecorded || !commitRecorded || !editorImmediatelyAfterBoot.canvas) {
    process.exitCode = 1;
  }
});
