#!/usr/bin/env node
// scripts/fetch-bgm-catalog.mjs
// BGM 리뷰 카탈로그(manus.space)에서 CC0 트랙 전량을 스테이징 디렉터리로 내려받는다.
//
// 왜 스크립트인가: 281곡·약 1.5GB 는 git 에 담을 수 없다. 원본은 CDN(DigitalOcean Spaces)에
// 올리고 레포에는 카탈로그 JSON(경로+sha256)만 남긴다. 이 스크립트가 그 재현 경로다.
//
//   node scripts/fetch-bgm-catalog.mjs --password 3658
//   node scripts/fetch-bgm-catalog.mjs --password 3658 --out D:/bgm-staging
//
// 산출물:
//   <out>/audio/<파일명>            — 원본 오디오
//   <out>/catalog.raw.json          — tRPC 응답 원본(재가공 입력)
//   <out>/fetch-report.json         — 곡별 성공/실패·sha256 대조 결과

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createWriteStream, existsSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";

const ORIGIN = "https://bgmreview-h4zeq64k.manus.space";
const DEFAULT_OUT = path.join(process.env.LOCALAPPDATA || process.env.HOME || ".", "rpg-zzu-bgm-staging");
const CONCURRENCY = 6;

function parseArgs(argv) {
  const args = { password: process.env.BGM_REVIEW_PASSWORD ?? "", out: DEFAULT_OUT, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--password") args.password = argv[++i] ?? "";
    else if (flag === "--out") args.out = argv[++i] ?? args.out;
    else if (flag === "--force") args.force = true;
  }
  return args;
}

/** 승인 비밀번호로 세션 쿠키를 받는다. 쿠키 없이는 오디오가 403 이다. */
async function approve(password) {
  const res = await fetch(`${ORIGIN}/api/trpc/bgmAccess.approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ json: { password } }),
  });
  const body = await res.json();
  if (body?.result?.data?.json?.approved !== true) {
    throw new Error(`승인 실패: ${JSON.stringify(body).slice(0, 300)}`);
  }
  // set-cookie 여러 줄을 하나의 Cookie 헤더로 접는다(undici 는 getSetCookie 를 제공한다).
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((line) => line.split(";", 1)[0]).join("; ");
  if (!cookie) throw new Error("승인은 됐지만 쿠키가 없다 — 서버 계약이 바뀌었다.");
  return cookie;
}

async function fetchCatalog(cookie) {
  const res = await fetch(`${ORIGIN}/api/trpc/bgmCatalog.list`, { headers: { cookie } });
  if (!res.ok) throw new Error(`카탈로그 조회 실패 ${res.status}`);
  const body = await res.json();
  const tracks = body?.result?.data?.json;
  if (!Array.isArray(tracks) || tracks.length === 0) throw new Error("카탈로그가 비어 있다.");
  return tracks;
}

async function sha256OfFile(file) {
  const hash = createHash("sha256");
  await pipeline(Readable.from(await readFile(file)), hash);
  return hash.digest("hex");
}

/**
 * 원본이 준 sha256 이 진짜 해시인지. 실측: 60곡(expansion-eighty-five / completion-one-fifteen
 * 릴리스)은 이 필드에 해시 대신 `"release-manifest"` 리터럴이 들어 있다. 그걸 해시로 믿고
 * 비교하면 정상 파일을 전부 불일치로 처리해 스크립트가 실패한다.
 */
function expectedSha256(track) {
  const value = typeof track.sha256 === "string" ? track.sha256.toLowerCase() : "";
  return /^[0-9a-f]{64}$/.test(value) ? value : null;
}

/** 한 곡 내려받기. 이미 있고 sha256 이 맞으면 건너뛴다(재실행 안전). */
async function downloadTrack(track, { cookie, audioDir, force }) {
  const fileName = path.basename(new URL(track.audioUrl, ORIGIN).pathname);
  const target = path.join(audioDir, fileName);
  const expected = expectedSha256(track);

  if (!force && existsSync(target) && statSync(target).size > 0) {
    const actual = await sha256OfFile(target);
    if (!expected || actual === expected) {
      return { trackCode: track.trackCode, fileName, status: "cached", bytes: statSync(target).size, sha256: actual };
    }
  }

  const res = await fetch(`${ORIGIN}${track.audioUrl}`, { headers: { cookie }, redirect: "follow" });
  if (!res.ok) return { trackCode: track.trackCode, fileName, status: "http-error", detail: res.status };
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target));

  const bytes = statSync(target).size;
  const actual = await sha256OfFile(target);
  if (expected === null) {
    // 원본에 해시가 없는 트랙. 검증은 불가하지만 다운로드 자체는 성공이다 —
    // 우리가 계산한 해시를 남겨 다음 실행 때 변조 여부는 비교할 수 있게 한다.
    return { trackCode: track.trackCode, fileName, status: "downloaded-unverified", bytes, sha256: actual };
  }
  const status = actual !== expected ? "sha-mismatch" : "downloaded";
  return { trackCode: track.trackCode, fileName, status, bytes, sha256: actual, expected };
}

/** 고정 폭 워커 풀. 281곡을 한꺼번에 열면 원본 CDN 이 끊는다. */
async function runPool(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          results[index] = { trackCode: items[index]?.trackCode, status: "error", detail: String(error) };
        }
      }
    }),
  );
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.password) {
    console.error("사용법: node scripts/fetch-bgm-catalog.mjs --password <승인 비밀번호> [--out DIR] [--force]");
    process.exit(2);
  }
  const audioDir = path.join(args.out, "audio");
  await mkdir(audioDir, { recursive: true });

  const cookie = await approve(args.password);
  const tracks = await fetchCatalog(cookie);
  await writeFile(path.join(args.out, "catalog.raw.json"), `${JSON.stringify(tracks, null, 2)}\n`, "utf8");
  console.log(`카탈로그 ${tracks.length}곡 → ${args.out}`);

  let done = 0;
  const results = await runPool(tracks, CONCURRENCY, async (track) => {
    const result = await downloadTrack(track, { cookie, audioDir, force: args.force });
    done += 1;
    if (done % 10 === 0 || result.status === "sha-mismatch" || result.status === "http-error") {
      console.log(`[${done}/${tracks.length}] ${result.status} ${result.trackCode} ${result.fileName ?? ""}`);
    }
    return result;
  });

  const tally = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  const bytes = results.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
  await writeFile(
    path.join(args.out, "fetch-report.json"),
    `${JSON.stringify({ origin: ORIGIN, trackCount: tracks.length, tally, totalBytes: bytes, results }, null, 2)}\n`,
    "utf8",
  );
  console.log(`완료: ${JSON.stringify(tally)} / ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  const ok = new Set(["downloaded", "downloaded-unverified", "cached"]);
  const bad = results.filter((r) => !ok.has(r.status));
  if (bad.length > 0) {
    console.error(`실패 ${bad.length}건 — fetch-report.json 확인`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
