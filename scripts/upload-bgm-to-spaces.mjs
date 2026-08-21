#!/usr/bin/env node
// scripts/upload-bgm-to-spaces.mjs
// 스테이징의 CC0 BGM 281곡을 DigitalOcean Spaces 로 업로드한다.
//
// 왜 SDK 없이 직접 서명하는가: 이 레포의 런타임 의존성은 jimp/phaser 둘뿐이다.
// 업로드 한 번을 위해 aws-sdk(수십 MB)를 끌어들이지 않고 SigV4 를 직접 만든다 —
// PUT 하나에 필요한 서명은 40줄이면 끝난다.
//
// 자격증명(.env.local 또는 셸 환경, 모두 non-VITE — 클라이언트 번들에 절대 들어가지 않는다):
//   DO_SPACES_KEY      Spaces 액세스 키
//   DO_SPACES_SECRET   Spaces 시크릿
//   DO_SPACES_BUCKET   Space 이름
//   DO_SPACES_REGION   리전 슬러그(nyc3 / sgp1 / fra1 …)
//
//   node scripts/upload-bgm-to-spaces.mjs --staging <디렉터리>
//   node scripts/upload-bgm-to-spaces.mjs --dry-run          # 서명/키만 확인
//   node scripts/upload-bgm-to-spaces.mjs --verify           # 업로드 없이 원격 존재/크기만 대조
//
// 업로드가 끝나면 출력되는 `VITE_BGM_CDN_BASE=` 줄을 .env.local 에 넣으면 에디터가 CDN 을 쓴다.

import { createHash, createHmac } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
/** bgmCdn.ts 의 BGM_CDN_PREFIX 와 반드시 같아야 한다. 어긋나면 전곡 404 다. */
const KEY_PREFIX = "bgm/v1";
const CONCURRENCY = 4;
/** 콘텐츠 해시가 파일명에 박혀 있으므로 영구 캐시로 둔다. */
const CACHE_CONTROL = "public, max-age=31536000, immutable";

const CONTENT_TYPES = {
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
};

function parseArgs(argv) {
  const args = {
    staging: path.join(process.env.LOCALAPPDATA || process.env.HOME || ".", "rpg-zzu-bgm-staging"),
    dryRun: false,
    verify: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--staging") args.staging = argv[++i] ?? args.staging;
    else if (flag === "--dry-run") args.dryRun = true;
    else if (flag === "--verify") args.verify = true;
    else if (flag === "--force") args.force = true;
  }
  return args;
}

/** .env.local 을 얕게 읽는다 — vite 는 서버 측에서 이 파일을 읽지만 스크립트는 스스로 읽어야 한다. */
async function loadEnvLocal() {
  const file = path.join(REPO_ROOT, ".env.local");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function resolveConfig(env) {
  const pick = (name) => (process.env[name] ?? env[name] ?? "").trim();
  const config = {
    key: pick("DO_SPACES_KEY"),
    secret: pick("DO_SPACES_SECRET"),
    bucket: pick("DO_SPACES_BUCKET"),
    region: pick("DO_SPACES_REGION"),
    cdnBase: pick("DO_SPACES_CDN_BASE"),
  };
  const missing = ["key", "secret", "bucket", "region"].filter((field) => config[field] === "");
  return { config, missing };
}

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

/**
 * AWS SigV4 (Spaces 는 S3 호환). 서명 대상은 단일 오브젝트 PUT/HEAD 뿐이라
 * 쿼리 문자열 정규화 같은 일반 케이스는 다루지 않는다.
 */
export function signRequest({ method, host, key, region, accessKey, secretKey, payloadHash, headers = {}, now = new Date() }) {
  const amzDate = `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${key.split("/").map(encodeURIComponent).join("/")}`;

  // 헤더 이름은 소문자로 한 번만 정규화한다 — 서명 문자열과 실제 전송 헤더가 어긋나면
  // 403 SignatureDoesNotMatch 가 나고 원인을 찾기 어렵다.
  const allHeaders = {};
  for (const [name, value] of Object.entries({
    host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...headers,
  })) {
    allHeaders[name.toLowerCase()] = String(value).trim();
  }
  const sortedNames = Object.keys(allHeaders).sort();
  const canonicalHeaders = sortedNames.map((name) => `${name}:${allHeaders[name]}\n`).join("");
  const signedHeaders = sortedNames.join(";");

  const canonicalRequest = [method, canonicalUri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, dateStamp), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

  return {
    ...allHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

function objectUrl(config, key) {
  return `https://${config.bucket}.${config.region}.digitaloceanspaces.com/${key.split("/").map(encodeURIComponent).join("/")}`;
}

/** 원격에 이미 같은 크기로 있는지. 있으면 1.21GB 를 다시 올리지 않는다. */
async function headObject(config, key) {
  const host = `${config.bucket}.${config.region}.digitaloceanspaces.com`;
  const headers = signRequest({
    method: "HEAD",
    host,
    key,
    region: config.region,
    accessKey: config.key,
    secretKey: config.secret,
    payloadHash: sha256Hex(""),
  });
  const res = await fetch(objectUrl(config, key), { method: "HEAD", headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${key} → ${res.status}`);
  return { bytes: Number(res.headers.get("content-length") ?? 0) };
}

async function putObject(config, key, body, contentType) {
  const host = `${config.bucket}.${config.region}.digitaloceanspaces.com`;
  const extra = {
    "content-type": contentType,
    "cache-control": CACHE_CONTROL,
    // 에디터가 브라우저에서 직접 재생하므로 공개 읽기여야 한다.
    "x-amz-acl": "public-read",
  };
  const headers = signRequest({
    method: "PUT",
    host,
    key,
    region: config.region,
    accessKey: config.key,
    secretKey: config.secret,
    payloadHash: sha256Hex(body),
    headers: extra,
  });
  const res = await fetch(objectUrl(config, key), { method: "PUT", headers, body });
  if (!res.ok) throw new Error(`PUT ${key} → ${res.status} ${(await res.text()).slice(0, 200)}`);
}

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
          results[index] = { fileName: items[index]?.fileName, status: "error", detail: String(error) };
        }
      }
    }),
  );
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tracks = JSON.parse(await readFile(path.join(args.staging, "catalog.raw.json"), "utf8"));
  const audioDir = path.join(args.staging, "audio");

  const files = tracks.map((track) => {
    const fileName = path.basename(new URL(track.audioUrl, "https://x.invalid").pathname);
    return { trackCode: track.trackCode, fileName, local: path.join(audioDir, fileName) };
  });
  const absent = files.filter((file) => !existsSync(file.local));
  if (absent.length > 0) {
    throw new Error(`스테이징에 없는 파일 ${absent.length}건 — 먼저 fetch-bgm-catalog.mjs 를 돌린다.`);
  }
  const totalBytes = files.reduce((sum, file) => sum + statSync(file.local).size, 0);

  const { config, missing } = resolveConfig(await loadEnvLocal());
  if (missing.length > 0) {
    console.error(`자격증명 없음: ${missing.map((f) => `DO_SPACES_${f.toUpperCase()}`).join(", ")}`);
    console.error(".env.local 에 넣거나 셸 환경변수로 준다. 파일 목록만 확인하려면 --dry-run.");
    if (!args.dryRun) process.exit(2);
  }

  console.log(`대상 ${files.length}곡 / ${(totalBytes / 1024 / 1024 / 1024).toFixed(2)}GB → ${KEY_PREFIX}/`);
  if (args.dryRun) {
    for (const file of files.slice(0, 5)) console.log(`  ${KEY_PREFIX}/${file.fileName}`);
    console.log(`  … 총 ${files.length}개`);
    return;
  }

  let done = 0;
  const results = await runPool(files, CONCURRENCY, async (file) => {
    const key = `${KEY_PREFIX}/${file.fileName}`;
    const bytes = statSync(file.local).size;
    const remote = await headObject(config, key);
    done += 1;
    const progress = `[${done}/${files.length}]`;

    if (remote !== null && remote.bytes === bytes && !args.force) {
      if (done % 20 === 0) console.log(`${progress} skip ${file.fileName}`);
      return { fileName: file.fileName, key, bytes, status: "already-present" };
    }
    if (args.verify) {
      const status = remote === null ? "missing" : "size-mismatch";
      console.log(`${progress} ${status} ${file.fileName}`);
      return { fileName: file.fileName, key, bytes, status, remoteBytes: remote?.bytes ?? 0 };
    }
    const extension = path.extname(file.fileName).toLowerCase();
    await putObject(config, key, await readFile(file.local), CONTENT_TYPES[extension] ?? "application/octet-stream");
    if (done % 10 === 0) console.log(`${progress} uploaded ${file.fileName}`);
    return { fileName: file.fileName, key, bytes, status: "uploaded" };
  });

  const tally = results.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  await writeFile(
    path.join(args.staging, args.verify ? "verify-report.json" : "upload-report.json"),
    `${JSON.stringify({ bucket: config.bucket, region: config.region, keyPrefix: KEY_PREFIX, tally, results }, null, 2)}\n`,
    "utf8",
  );
  console.log(`완료: ${JSON.stringify(tally)}`);

  const failed = results.filter((r) => r.status === "error" || r.status === "missing" || r.status === "size-mismatch");
  if (failed.length > 0) {
    console.error(`문제 ${failed.length}건 — ${args.verify ? "verify" : "upload"}-report.json 확인`);
    process.exit(1);
  }
  if (!args.verify) {
    const base = config.cdnBase || `https://${config.bucket}.${config.region}.cdn.digitaloceanspaces.com`;
    console.log("");
    console.log("에디터에 물리려면 .env.local 에 다음 한 줄을 넣는다:");
    console.log(`VITE_BGM_CDN_BASE=${base}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
