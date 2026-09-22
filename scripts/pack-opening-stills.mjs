#!/usr/bin/env node
// scripts/pack-opening-stills.mjs
// 스테이징 디렉터리(--staging)의 그림 + manifest.json 으로 Release tar 3종 생성:
//   artifacts/stills-release/{rpg-zzu-stills-v1.tar, stills-release-v1.json, SHA256SUMS}
// 사용: node scripts/pack-opening-stills.mjs --staging /경로/still-staging
// 스테이징에는 build-opening-still-catalog.mjs 가 읽는 manifest.json 과 그림 파일이 있어야 한다.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import * as tar from "tar";

function sha256(filePath) {
  return new Promise((resolveHash, rejectHash) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
    stream.on("error", rejectHash);
  });
}

const { values } = parseArgs({ options: { staging: { type: "string" } }, allowPositionals: false, strict: true });
if (!values.staging) {
  console.error("사용: node scripts/pack-opening-stills.mjs --staging <스테이징 디렉터리>");
  process.exit(1);
}
const staging = resolve(values.staging);
const manifest = JSON.parse(await readFile(join(staging, "manifest.json"), "utf8"));
const stills = manifest.stills;
if (!Array.isArray(stills) || stills.length === 0) throw new Error("manifest.stills 가 비어 있다");

const outDir = join(resolve(process.cwd()), "artifacts/stills-release");
await mkdir(outDir, { recursive: true });

// tar 에 담을 그림 검증 + 해시 기록
const entries = await readdir(staging, { withFileTypes: true });
let totalBytes = 0;
for (const still of stills) {
  const filePath = join(staging, still.fileName);
  const info = await stat(filePath);
  const hash = await sha256(filePath);
  if (still.sha256 && still.sha256 !== hash) throw new Error("해시 불일치: " + still.id);
  still.sha256 = hash;
  still.bytes = info.size;
  totalBytes += info.size;
}

const tarPath = join(outDir, "rpg-zzu-stills-v1.tar");
const fileNames = stills.map((still) => still.fileName);
await tar.c({ gzip: false, file: tarPath, cwd: staging }, fileNames);

const tarBytes = (await stat(tarPath)).size;
const archiveHash = await sha256(tarPath);

const releaseManifest = {
  schemaVersion: 1,
  repo: "MovieHolic-Plex/rpg-zzu",
  tag: "stills-v1",
  archive: { fileName: "rpg-zzu-stills-v1.tar", bytes: tarBytes, sha256: archiveHash },
  count: stills.length,
  totalBytes,
  license: manifest.license ?? "project-generated",
  stills: stills.map((still) => ({ id: still.id, fileName: still.fileName, bytes: still.bytes, sha256: still.sha256 })),
};
const manifestPath = join(outDir, "stills-release-v1.json");
await writeFile(manifestPath, JSON.stringify(releaseManifest, null, 2) + "\n");

const sumsPath = join(outDir, "SHA256SUMS");
const sums = [
  archiveHash + "  rpg-zzu-stills-v1.tar",
  (await sha256(manifestPath)) + "  stills-release-v1.json",
].join("\n") + "\n";
await writeFile(sumsPath, sums);

// 고정 목록 카피 — 설치기가 읽는 assets/stills-release-v1.json
const { copyFile } = await import("node:fs/promises");
await copyFile(manifestPath, join(resolve(process.cwd()), "assets/stills-release-v1.json"));

console.log("팩 생성 완료: " + stills.length + "장 · tar " + tarBytes + " bytes");
console.log("출력: " + outDir);

