#!/usr/bin/env node
// qwencloud(qwen3.8-max-preview) 코딩 워커 — 백그라운드에서 도는 서브에이전트.
//
// 왜 이 스크립트인가: 감독자(Claude)의 Agent 툴은 Claude 모델만 띄운다. qwen 에 일을 시키려면
// 툴 루프를 직접 돌려야 한다. qwencloud 는 OpenAI 호환이고 tool_calls 왕복이 정상 동작함을
// 실측 확인했으므로(auth → tool_calls → tool 결과 반영 → stop), 표준 루프면 충분하다.
//
// 실행 (감독자는 run_in_background 로 띄우고 즉시 손을 뗀다):
//   node scripts/qwen-worker.mjs --task <task.json>
//   node scripts/qwen-worker.mjs --prompt "..." --cwd <dir> --name <name>
//
// 산출물: <stateRoot>/<name>-<stamp>/ 에 log.jsonl · status.json · result.md
//
// 신뢰 모델: 워커는 --cwd 밖의 파일을 읽거나 쓰지 못한다(경로 이탈 차단). run_bash 는
// --cwd 에서 실행되지만 셸이므로 완전한 격리는 아니다 — 그래서 **워크트리 안에서만** 돌린다.
// 메인 워킹트리를 --cwd 로 주지 말 것.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join, resolve, relative, isAbsolute, dirname } from "node:path";

const DEFAULT_BASE_URL = "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen3.8-max-preview";
const DEFAULT_MAX_STEPS = 60;
// 툴 결과 상한은 **삽입 시점**에 적용한다. 히스토리를 나중에 고쳐 쓰면(오래된 결과 축약 등)
// 메시지 배열 접두사가 매 스텝 달라져 **프롬프트 캐시가 100% 무효화**된다(실측: cached_tokens=0).
// 히스토리는 append-only 로 유지해야 접두사가 바이트 단위로 안정되고 캐시가 적중한다.
const READ_CAP = 14_000;   // 한 번의 파일 읽기 상한 — 더 필요하면 모델이 offset/limit 로 이어 읽는다
const BASH_CAP = 12_000;   // 한 번의 셸 출력 상한

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const taskFile = arg("--task");
const task = taskFile ? JSON.parse(readFileSync(taskFile, "utf8")) : {};
const NAME = arg("--name", task.name ?? "task");
const ROOT = resolve(arg("--cwd", task.cwd ?? process.cwd()));
const PROMPT = arg("--prompt", task.prompt);
const MODEL = arg("--model", task.model ?? DEFAULT_MODEL);
const MAX_STEPS = Number(arg("--max-steps", task.maxSteps ?? DEFAULT_MAX_STEPS));
const BASE_URL = (process.env.QWENCLOUD_BASE_URL ?? task.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");

if (!PROMPT) {
  console.error("[error] --prompt 또는 --task 의 prompt 가 필요합니다.");
  process.exit(2);
}

// 키는 환경변수 우선, 없으면 워크트리의 .env.local 에서 읽는다(워크트리마다 복사돼 있음).
function apiKey() {
  if (process.env.QWENCLOUD_API_KEY?.trim()) return process.env.QWENCLOUD_API_KEY.trim();
  for (const dir of [ROOT, process.cwd()]) {
    const envLocal = join(dir, ".env.local");
    if (!existsSync(envLocal)) continue;
    const match = /^QWENCLOUD_API_KEY=(.+)$/m.exec(readFileSync(envLocal, "utf8"));
    if (match) return match[1].trim();
  }
  return "";
}

const KEY = apiKey();
if (!KEY) {
  console.error("[error] QWENCLOUD_API_KEY 를 찾지 못했습니다 (env 또는 <cwd>/.env.local).");
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = resolve(arg("--out", task.stateRoot ?? join(process.cwd(), ".omo", "qwen-tasks")), `${NAME}-${stamp}`);
mkdirSync(outDir, { recursive: true });
const logPath = join(outDir, "log.jsonl");

function log(entry) {
  appendFileSync(logPath, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`, "utf8");
}

// --cwd 밖으로 나가는 경로를 차단한다. 워커가 메인 워킹트리를 건드리는 사고를 막는 마지막 방어선.
function safePath(candidate) {
  const target = isAbsolute(candidate) ? resolve(candidate) : resolve(ROOT, candidate);
  const rel = relative(ROOT, target);
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error(`작업 루트 밖 경로 거부: ${candidate}`);
  return target;
}

function clip(text, cap) {
  return text.length > cap ? `${text.slice(0, cap)}\n…[${text.length - cap}자 잘림]` : text;
}

// 이 저장소 파일은 대부분 CRLF 다. 모델은 LF 로 문자열을 만들기 때문에 그대로 비교하면
// edit_file 이 항상 실패한다(실측: 한 작업에서 3회 실패 → 모델이 임시 node 스크립트로 우회하며
// 30스텝 소진). 따라서 **비교는 LF 로 정규화해서 하고, 쓸 때 원본 줄바꿈을 복원**한다.
function detectEol(text) {
  return text.includes("\r\n") ? "\r\n" : "\n";
}
function toLf(text) {
  return text.replace(/\r\n/g, "\n");
}

const TOOLS = {
  read_file({ path, offset = 0, limit = 2000 }) {
    // \r 을 제거해 모델에게 항상 LF 로 보여준다 — 보이지 않는 \r 을 그대로 베껴 쓰는 사고 방지.
    const lines = toLf(readFileSync(safePath(path), "utf8")).split("\n");
    const slice = lines.slice(offset, offset + limit);
    return clip(slice.map((line, index) => `${offset + index + 1}\t${line}`).join("\n"), READ_CAP);
  },
  write_file({ path, content }) {
    const target = safePath(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, "utf8");
    return `기록 완료: ${path} (${content.length}자)`;
  },
  edit_file({ path, old_string, new_string }) {
    const target = safePath(path);
    const raw = readFileSync(target, "utf8");
    const eol = detectEol(raw);
    const before = toLf(raw);
    const needle = toLf(old_string);
    const count = before.split(needle).length - 1;
    if (count === 0) throw new Error("old_string 을 찾지 못했습니다. read_file 로 정확한 원문을 확인하세요.");
    if (count > 1) throw new Error(`old_string 이 ${count}곳에서 일치합니다. 더 긴 고유 문자열을 쓰세요.`);
    const next = before.replace(needle, toLf(new_string));
    writeFileSync(target, eol === "\r\n" ? next.replace(/\n/g, "\r\n") : next, "utf8");
    return `수정 완료: ${path}`;
  },
  list_files({ pattern = "**/*" }) {
    const result = spawnSync("git", ["ls-files", pattern], { cwd: ROOT, encoding: "utf8" });
    return clip(result.stdout || "(일치 없음)", 20_000);
  },
  grep({ pattern, glob }) {
    const grepArgs = ["grep", "-n", "-I", "--untracked", "-e", pattern];
    if (glob) grepArgs.push("--", glob);
    const result = spawnSync("git", grepArgs, { cwd: ROOT, encoding: "utf8" });
    return clip(result.stdout || "(일치 없음)", 24_000);
  },
  run_bash({ cmd, timeout_ms = 180_000 }) {
    const result = spawnSync(cmd, {
      cwd: ROOT, encoding: "utf8", shell: true, timeout: timeout_ms, maxBuffer: 32 * 1024 * 1024,
    });
    // 진짜 종료 코드를 그대로 넘긴다 — 파이프에 가려진 exit 0 을 믿다가 낭패본 전례가 있다.
    return clip(`exit=${result.status ?? -1}\n${result.stdout ?? ""}${result.stderr ?? ""}`, BASH_CAP);
  },
};

const TOOL_SCHEMA = [
  ["read_file", "파일을 읽는다(행 번호 포함).", { path: { type: "string" }, offset: { type: "integer" }, limit: { type: "integer" } }, ["path"]],
  ["write_file", "파일을 통째로 쓴다(신규 생성 또는 전체 교체).", { path: { type: "string" }, content: { type: "string" } }, ["path", "content"]],
  ["edit_file", "파일에서 old_string 을 new_string 으로 정확히 1회 치환한다.", { path: { type: "string" }, old_string: { type: "string" }, new_string: { type: "string" } }, ["path", "old_string", "new_string"]],
  ["list_files", "glob 으로 추적 파일 목록을 얻는다.", { pattern: { type: "string" } }, []],
  ["grep", "정규식으로 코드 내용을 검색한다.", { pattern: { type: "string" }, glob: { type: "string" } }, ["pattern"]],
  ["run_bash", "작업 루트에서 셸 명령을 실행한다(테스트·타입체크 등).", { cmd: { type: "string" }, timeout_ms: { type: "integer" } }, ["cmd"]],
].map(([name, description, properties, required]) => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, required } },
}));

const SYSTEM_PROMPT = `당신은 rpg-zzu 저장소에서 일하는 코딩 워커다. 작업 루트: ${ROOT}

규칙:
- 반드시 툴로 실제 파일을 읽고 수정한다. 추측으로 코드를 쓰지 않는다.
- 수정 후에는 run_bash 로 검증한다: npx tsc --noEmit -p tsconfig.app.json, 관련 테스트는
  npx vitest run <파일> --configLoader runner.
- 검증 결과를 보고할 때는 **실제 exit 코드**를 인용한다. 파이프를 태우면 종료 코드가 가려지므로
  tail 등으로 넘기지 말 것.
- 기존 코드의 주석 밀도·명명·관용구를 따른다. 주석은 한국어.
- 요청 범위를 넘어서는 리팩터링을 하지 않는다.
- 막히면 추측해서 진행하지 말고, 무엇이 왜 막혔는지 명확히 적고 끝낸다.

작업이 끝나면 마지막 메시지에 다음을 포함한다:
1) 변경한 파일 목록  2) 검증 명령과 실제 exit 코드  3) 못 끝낸 것과 그 이유`;

async function callModel(messages) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOL_SCHEMA, tool_choice: "auto" }),
    });
    if (response.status === 429 || response.status >= 500) {
      const wait = 2000 * 2 ** attempt;
      log({ kind: "retry", status: response.status, waitMs: wait });
      await new Promise((done) => setTimeout(done, wait));
      continue;
    }
    if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response.json();
  }
  throw new Error("재시도 한도 초과(429/5xx)");
}

const messages = [
  { role: "system", content: SYSTEM_PROMPT },
  { role: "user", content: PROMPT },
];

let status = "completed";
let finalText = "";
let steps = 0;
let promptTokens = 0;
let completionTokens = 0;
let cachedTokens = 0;

log({ kind: "start", name: NAME, model: MODEL, root: ROOT, prompt: PROMPT });

try {
  while (steps < MAX_STEPS) {
    steps += 1;
    const data = await callModel(messages);
    const stepPrompt = data.usage?.prompt_tokens ?? 0;
    const stepCached = data.usage?.prompt_tokens_details?.cached_tokens ?? 0;
    promptTokens += stepPrompt;
    cachedTokens += stepCached;
    completionTokens += data.usage?.completion_tokens ?? 0;
    // 캐시 적중률을 남긴다 — 히스토리를 고쳐 쓰면 접두사가 깨져 0% 가 되므로 감시가 필요하다.
    log({ kind: "usage", step: steps, prompt: stepPrompt, cached: stepCached, messages: messages.length });
    const choice = data.choices?.[0];
    const message = choice?.message ?? {};
    // reasoning_content 는 대화 히스토리에 되돌려 넣지 않는다(호환 모드 규약).
    messages.push({ role: "assistant", content: message.content ?? "", ...(message.tool_calls ? { tool_calls: message.tool_calls } : {}) });

    if (!message.tool_calls?.length) {
      finalText = message.content ?? "";
      log({ kind: "final", step: steps, content: finalText });
      break;
    }

    for (const call of message.tool_calls) {
      const name = call.function?.name;
      let result;
      try {
        const parsed = JSON.parse(call.function?.arguments || "{}");
        if (!TOOLS[name]) throw new Error(`알 수 없는 툴: ${name}`);
        result = TOOLS[name](parsed);
        log({ kind: "tool", step: steps, name, args: parsed, ok: true, bytes: result.length });
      } catch (error) {
        result = `ERROR: ${error instanceof Error ? error.message : String(error)}`;
        log({ kind: "tool", step: steps, name, ok: false, error: result });
      }
      messages.push({ role: "tool", tool_call_id: call.id, content: result });
    }
  }
  if (steps >= MAX_STEPS && !finalText) status = "max-steps-exceeded";
} catch (error) {
  status = "error";
  finalText = error instanceof Error ? error.message : String(error);
  log({ kind: "error", error: finalText });
}

writeFileSync(join(outDir, "result.md"), finalText || "(출력 없음)", "utf8");
writeFileSync(
  join(outDir, "status.json"),
  `${JSON.stringify({ name: NAME, status, steps, model: MODEL, root: ROOT, promptTokens, cachedTokens, completionTokens, cacheHitRate: promptTokens ? Math.round((cachedTokens / promptTokens) * 100) + "%" : "n/a", outDir }, null, 2)}\n`,
  "utf8"
);

console.log(`[qwen-worker] ${NAME} → ${status} (steps=${steps}, tokens=${promptTokens}+${completionTokens})`);
console.log(`[qwen-worker] 산출물: ${outDir}`);
process.exit(status === "completed" ? 0 : 1);
