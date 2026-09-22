#!/usr/bin/env node
// scripts/install-opening-stills.mjs
// 오프닝 스틸 릴리스 팩 설치/검증. bgm 선례와 같은 계약:
//   npm run stills:install            (기본: gh 로 Release 태그에서 tar 다운로드)
//   npm run stills:install -- --archive /경로/rpg-zzu-stills-v1.tar
//   npm run stills:verify             (설치 무결성만 검사)
//
// 설치 위치: <체크아웃>/public/assets/stills/pack/ — openingStillPackCdn.ts 의 로컬 폴백 경로.
// 검증: 카탈로그(oprn-pack-still-*)의 sha256 과 대조. 누락/손상은 목록으로 알린다.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as tar from "tar";

const checkout = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const usage = `오프닝 스틸 팩 설치:
  npm run stills:install
  npm run stills:install -- --archive /경로/rpg-zzu-stills-v1.tar
  npm run stills:verify -- --root /경로/체크아웃
비공개 저장소이므로 기본 다운로드에는 gh 설치와 저장소 접근 권한이 필요합니다.
수동 설치: Releases → stills-v1 에서 rpg-zzu-stills-v1.tar 를 받아 --archive 로 지정하세요.`;

function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
    stream.on("error", rejectHash);
  });
}

async function downloadReleaseTar(manifest, target, signal) {
  const { spawn } = await import("node:child_process");
  const url = "https://github.com/" + manifest.repo + "/releases/download/" + manifest.tag + "/" + manifest.archive.fileName;
  await new Promise((resolveDownload, rejectDownload) => {
    const child = spawn("gh", ["release", "download", manifest.tag, "--repo", manifest.repo, "--pattern", manifest.archive.fileName, "--dir", target], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectDownload);
    child.on("exit", (code) => {
      if (code === 0) resolveDownload();
      else rejectDownload(new Error("gh 다운로드 실패(" + code + "): " + stderr.trim().slice(0, 200)));
    });
    if (signal) signal.addEventListener("abort", () => child.kill("SIGTERM"), { once: true });
  });
}

async function verifyInstalled({ root, manifest, signal }) {
  const dir = join(root, "public/assets/stills/pack");
  const missing = [];
  for (const still of manifest.stills) {
    signal?.throwIfAborted();
    const filePath = join(dir, still.fileName);
    let actual = "";
    try { actual = await sha256(filePath); } catch { actual = ""; }
    if (actual !== still.sha256) missing.push(still.id);
  }
  return { complete: missing.length === 0, verified: manifest.stills.length - missing.length, missing };
}

const controller = new AbortController();
let interruptedExit;
const interrupt = (signal) => {
  interruptedExit = signal === "SIGINT" ? 130 : 143;
  controller.abort(new Error("스틸 작업이 취소됐습니다."));
};
process.on("SIGINT", () => interrupt("SIGINT"));
process.on("SIGTERM", () => interrupt("SIGTERM"));

try {
  const { values } = parseArgs({ options: {
    root: { type: "string" }, archive: { type: "string" }, verify: { type: "boolean" }, help: { type: "boolean" },
  }, allowPositionals: false, strict: true });
  if (values.help) { console.log(usage); }
  else {
    const manifest = JSON.parse(await (await import("node:fs/promises")).readFile(resolve(checkout, "assets/stills-release-v1.json"), "utf8"));
    const root = resolve(values.root ?? checkout);
    if (values.verify && values.archive) throw new Error("--verify와 --archive를 함께 사용할 수 없습니다.");
    if (values.verify) {
      const result = await verifyInstalled({ root, manifest, signal: controller.signal });
      console.log("스틸 검증: " + result.verified + "/" + manifest.stills.length + "장");
      if (!result.complete) {
        console.error("누락/손상 " + result.missing.length + "장: " + result.missing.join(", "));
        process.exitCode = 1;
      }
    } else {
      const staging = await (await import("node:fs/promises")).mkdtemp(join(checkout, ".stills-stage-"));
      const snapshot = join(staging, "verified.tar");
      if (values.archive) {
        const { copyFile } = await import("node:fs/promises");
        await copyFile(resolve(values.archive), snapshot);
      } else {
        await downloadReleaseTar(manifest, staging, controller.signal);
        const { rename } = await import("node:fs/promises");
        await rename(join(staging, manifest.archive.fileName), snapshot);
      }
      // 아카이브 무결성 확인 후 추출
      const archiveHash = await sha256(snapshot);
      if (archiveHash !== manifest.archive.sha256) throw new Error("아카이브 sha256 불일치 — 다운로드가 손상됐거나 버전이 다릅니다.");
      const extractDir = join(staging, "files");
      await mkdir(extractDir, { recursive: true });
      await tar.x({ file: snapshot, cwd: extractDir });
      const target = join(root, "public/assets/stills/pack");
      await mkdir(target, { recursive: true });
      const entries = await readdir(extractDir, { withFileTypes: true });
      let installed = 0;
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const known = manifest.stills.find((still) => still.fileName === entry.name);
        if (!known) continue; // 카탈로그에 없는 파일은 설치하지 않는다.
        const { copyFile } = await import("node:fs/promises");
        await copyFile(join(extractDir, entry.name), join(target, entry.name));
        installed += 1;
      }
      const result = await verifyInstalled({ root, manifest, signal: controller.signal });
      console.log("스틸 " + result.verified + "/" + manifest.stills.length + "장 검증 완료 (" + installed + "장 설치).");
      await rm(staging, { recursive: true, force: true });
    }
  }
} catch (error) {
  console.error("스틸 작업 실패: " + (error?.message ?? error));
  process.exitCode = interruptedExit ?? 1;
}

