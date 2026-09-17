import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 활동 미러 2종(AI 턴 로그·편집 행위 로그)의 **전송 중립 코어**.
 *
 * 왜 껍데기 밖으로 나왔나 (2026-09-16 I3): 이 로직은 `vite.config.ts` 플러그인 안에만 있었다.
 * 그래서 로그가 남는 곳은 `npm run dev`/`preview` 로 띄운 웹뿐이었고, **일렉트론 앱과
 * `oprn-serve` 에서는 미들웨어 자체가 없어** 클라이언트 POST 가 404 로 떨어졌다. 404 는 fetch 가
 * throw 하지 않고 클라이언트는 첫 실패에 미러를 스스로 끄므로, 두 껍데기에서는 로그가 조용히
 * 0줄이 된다(2026-08-28 `vite preview` 에서 같은 사고를 이미 겪었다).
 *
 * 여기서는 HTTP 를 모른다. 요청을 `{kind, method, url, bodyText, baseDir}` 로 받아
 * `{status, body}` 를 돌려줄 뿐이고, node 스트림(vite·로컬 서버)과 Fetch Request/Response
 * (일렉트론 `app://` 프로토콜)가 각자 얇게 어댑트한다. 경로 상수·상한·요약 규칙이 한 곳에
 * 모이므로 껍데기 사이 드리프트가 생길 자리가 없다.
 */

/** `src/ai/activityLogEndpoint.ts` 의 값과 같아야 한다(계약은 test/aiActivityLogEndpoint.test.ts). */
export const AI_ACTIVITY_DISK_ENDPOINT = "/__oprn/ai-activity";
/** `src/editor/editActivityEndpoint.ts` 의 값과 같아야 한다(계약은 test/editActivityEndpoint.test.ts). */
export const EDIT_ACTIVITY_DISK_ENDPOINT = "/__oprn/edit-activity";

/** `output/ai-activity/` 밖으로 쓰지 못하게 강제 — 영숫자/-/_ 만 허용(경로 구분자·`..` 차단). */
const SAFE_ACTIVITY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
/**
 * 편집 배치 본문 상한(2 MiB). 편집 미러는 1500ms 마다 큐 전체를 보내므로 정상 배치는 수십 KiB 다.
 * 상한이 없으면 스트로크 폭풍이나 오작동 클라이언트가 edits.jsonl 을 무한히 키운다 —
 * 초과분은 413 으로 끊고 클라이언트가 미러를 스스로 끄게 한다.
 */
const EDIT_ACTIVITY_MAX_BODY_BYTES = 2 * 1024 * 1024;
/** index.json 요약 보존 개수. 링버퍼(500)·localStorage(200) 와 같은 자리수로 맞춘다. */
const EDIT_ACTIVITY_INDEX_LIMIT = 200;
/** AI 미러 index.json 요약 보존 개수. */
const AI_ACTIVITY_INDEX_LIMIT = 50;

export const ACTIVITY_MIRROR_LIMITS = {
  editMaxBodyBytes: EDIT_ACTIVITY_MAX_BODY_BYTES,
  editIndexLimit: EDIT_ACTIVITY_INDEX_LIMIT,
  aiIndexLimit: AI_ACTIVITY_INDEX_LIMIT,
};

export function activityMirrorKind(pathname) {
  if (pathname?.startsWith(AI_ACTIVITY_DISK_ENDPOINT)) return "ai";
  if (pathname?.startsWith(EDIT_ACTIVITY_DISK_ENDPOINT)) return "edit";
  return null;
}

export function isActivityMirrorPath(pathname) {
  return activityMirrorKind(pathname) !== null;
}

/** 로그 디렉터리. baseDir 는 껍데기가 정한다 — vite 는 cwd, 앱·로컬 서버는 연 프로젝트 폴더. */
export function activityMirrorDir(kind, baseDir) {
  return join(baseDir, "output", kind === "ai" ? "ai-activity" : "edit-activity");
}

function json(body, status = 200) {
  return { status, contentType: "application/json; charset=utf-8", body };
}

function text(body, status) {
  return { status, contentType: "text/plain; charset=utf-8", body };
}

function readIndex(indexPath) {
  if (!existsSync(indexPath)) return [];
  try {
    const parsed = JSON.parse(readFileSync(indexPath, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** GET: `list` 가 붙으면 index.json, 아니면 latest.json, 둘 다 없으면 `[]`. */
function readMirror(kind, url, dir) {
  const wantsList = url.includes("list");
  const target = wantsList ? join(dir, "index.json") : join(dir, "latest.json");
  if (existsSync(target)) return json(readFileSync(target, "utf8"));
  return json(wantsList ? "[]" : "[]");
}

/**
 * AI 턴 로그 1건을 디스크에 남긴다.
 *
 * `record.id` 는 클라이언트가 보내는 값 그대로다 — `join()` 은 `..` 세그먼트를 그대로 해석하므로
 * 검증 없이 파일명에 쓰면 미러 디렉터리 밖으로 경로 탈출이 가능하다.
 */
function writeAiActivity(dir, raw) {
  const record = JSON.parse(raw);
  const pretty = JSON.stringify(record, null, 2);
  writeFileSync(join(dir, "latest.json"), pretty, "utf8");
  appendFileSync(join(dir, "activity.jsonl"), `${raw.replace(/\n/g, " ")}\n`, "utf8");
  const id =
    typeof record.id === "string" && SAFE_ACTIVITY_ID_PATTERN.test(record.id)
      ? record.id
      : `log_${Date.now()}`;
  writeFileSync(join(dir, `${id}.json`), pretty, "utf8");

  // 요약에 실패 신호를 같이 넣는다 — QA 가 index.json 만 보고 실패 턴을 골라낼 수 있어야 한다.
  const failedTools = (record.toolCalls ?? [])
    .filter((call) => call.ok === false)
    .map((call) => call.name ?? "?");
  const summary = {
    id,
    at: record.at ?? new Date().toISOString(),
    channel: record.channel ?? "other",
    ok: record.result?.ok !== false,
    instruction: record.instruction ?? "",
    ...(record.result?.error ? { error: record.result.error } : {}),
    ...(record.result?.stoppedReason ? { stoppedReason: record.result.stoppedReason } : {}),
    toolCalls: (record.toolCalls ?? []).length,
    ...(failedTools.length > 0 ? { failedTools } : {}),
    ...(record.diagnostics ? { diagnostics: record.diagnostics } : {}),
  };
  const indexPath = join(dir, "index.json");
  const next = [summary, ...readIndex(indexPath).filter((row) => row.id !== id)].slice(
    0,
    AI_ACTIVITY_INDEX_LIMIT,
  );
  writeFileSync(indexPath, JSON.stringify(next, null, 2), "utf8");
}

/**
 * 편집 행위 배치를 디스크에 남긴다. 빈 배치는 정상 응답으로 넘긴다 —
 * 400 을 주면 클라이언트가 미러를 영구히 끈다.
 */
function writeEditActivity(dir, raw) {
  const body = JSON.parse(raw);
  const entries = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) return 204;

  // 한 줄 = 한 엔트리. 줄바꿈이 섞이면 jsonl 이 깨지므로 직렬화 후 공백으로 치환한다.
  const lines = entries.map((entry) => `${JSON.stringify(entry).replace(/\n/g, " ")}\n`).join("");
  appendFileSync(join(dir, "edits.jsonl"), lines, "utf8");
  const last = entries[entries.length - 1];
  writeFileSync(join(dir, "latest.json"), JSON.stringify(last, null, 2), "utf8");

  // 요약은 CLI 표가 쓰는 열만 담는다(fields 상세는 edits.jsonl 에만 남는다) —
  // index.json 이 필드 diff 까지 들면 200건에서 수 MB 가 된다.
  const summaries = entries.map((entry) => ({
    seq: entry.seq,
    at: entry.at ?? new Date().toISOString(),
    scope: entry.scope ?? "project",
    label: entry.label ?? null,
    ...(entry.mapId === undefined ? {} : { mapId: entry.mapId }),
    ...(entry.collection === undefined ? {} : { collection: entry.collection }),
    ...(entry.cellCount === undefined ? {} : { cellCount: entry.cellCount }),
    ...(entry.mergedCount === undefined ? {} : { mergedCount: entry.mergedCount }),
    origin: entry.origin ?? "human",
  }));
  // seq 는 클라이언트 링버퍼에서 단조 증가한다. 병합 엔트리는 같은 seq 로 다시 오므로
  // 최신 값으로 교체한다(그러지 않으면 드래그 한 번이 index 를 같은 seq 로 도배한다).
  const replaced = new Set(summaries.map((row) => row.seq).filter((value) => value !== undefined));
  const indexPath = join(dir, "index.json");
  const next = [
    ...summaries.reverse(),
    // seq 없는 행(구버전 미러·손편집)은 대조 기준이 없으므로 지우지 않고 밀어낸다.
    ...readIndex(indexPath).filter((row) => row.seq === undefined || !replaced.has(row.seq)),
  ].slice(0, EDIT_ACTIVITY_INDEX_LIMIT);
  writeFileSync(indexPath, JSON.stringify(next, null, 2), "utf8");
  return 204;
}

/**
 * 미러 요청 하나를 처리한다. HTTP 를 모르므로 상태 코드와 본문만 돌려준다.
 * 라우팅을 모르는 경로는 `null` — 부르는 쪽이 next() 로 흘려보낸다.
 */
export function handleActivityMirror({ method, url, bodyText = "", baseDir }) {
  const kind = activityMirrorKind(url ?? "");
  if (!kind) return null;
  const dir = activityMirrorDir(kind, baseDir);

  if (method === "GET") return readMirror(kind, url, dir);
  if (method !== "POST") return text("method not allowed", 405);

  const bytes = Buffer.byteLength(bodyText, "utf8");
  if (kind === "edit" && bytes > EDIT_ACTIVITY_MAX_BODY_BYTES) {
    // 상한 초과는 파싱하지 않고 즉시 거절한다 — 다 받아놓고 거절하면 상한이 의미가 없다.
    return text(`payload too large (> ${EDIT_ACTIVITY_MAX_BODY_BYTES} bytes)`, 413);
  }
  try {
    mkdirSync(dir, { recursive: true });
    if (kind === "ai") {
      writeAiActivity(dir, bodyText);
      return { status: 204, contentType: null, body: "" };
    }
    return { status: writeEditActivity(dir, bodyText), contentType: null, body: "" };
  } catch (error) {
    return text(error instanceof Error ? error.message : "bad request", 400);
  }
}
