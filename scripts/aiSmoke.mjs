// scripts/aiSmoke.mjs
// 라이브 스모크: .env.local의 OPENROUTER_API_KEY로 OpenRouter에 실제 1콜.
// get_project_summary 툴 하나만 주고 "프로젝트 요약해줘"로 tool_call을 유도한다.
// npm test에는 포함하지 않는다(네트워크 의존). 실행: `node scripts/aiSmoke.mjs`
//
// **키를 코드/로그에 절대 출력하지 않는다.** .env.local은 gitignore 대상.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(__dirname, "..", ".env.local");

function parseEnv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_project_summary",
      description: "제목/맵 목록/DB 카운트/스위치·변수/시작점 요약을 반환한다.",
      parameters: { type: "object", properties: {} },
    },
  },
];

async function main() {
  let env;
  try {
    env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  } catch {
    console.error("[smoke] .env.local을 읽을 수 없습니다:", ENV_PATH);
    process.exit(2);
  }

  const apiKey = env.OPENROUTER_API_KEY;
  const model = env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const baseUrl = (env.OPENROUTER_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  if (!apiKey) {
    console.error("[smoke] OPENROUTER_API_KEY가 .env.local에 없습니다.");
    process.exit(2);
  }

  console.log(`[smoke] 엔드포인트=${baseUrl} 모델=${model}`);
  const body = {
    model,
    messages: [
      { role: "system", content: "너는 게임 에디터 어시스턴트다. 프로젝트 상태를 알려면 반드시 get_project_summary 툴을 호출해라." },
      { role: "user", content: "지금 프로젝트를 요약해줘." },
    ],
    tools: TOOLS,
    tool_choice: "auto",
    stream: false,
    max_tokens: 256,
  };

  const started = Date.now();
  let response;
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Title": "RPG ZZU Smoke",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[smoke] 네트워크 오류:", error.message);
    process.exit(1);
  }

  const elapsed = Date.now() - started;
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.error(`[smoke] 실패 status=${response.status} (${elapsed}ms):`, text.slice(0, 400));
    process.exit(1);
  }

  const json = await response.json();
  const choice = json.choices?.[0];
  const msg = choice?.message ?? {};
  const toolCalls = msg.tool_calls ?? [];
  console.log(`[smoke] 응답 ${elapsed}ms, finish_reason=${choice?.finish_reason}`);
  if (toolCalls.length > 0) {
    console.log("[smoke] ✅ tool_call 성공:", toolCalls.map((t) => t.function?.name).join(", "));
    console.log("[smoke] arguments:", toolCalls[0].function?.arguments);
    process.exit(0);
  }
  console.log("[smoke] ⚠️ tool_call 없음. content:", (msg.content ?? "").slice(0, 300));
  console.log("[smoke] → 모델이 tool calling을 내지 않았습니다. tool_choice='required' 강제 또는 다른 프롬프트 필요.");
  process.exit(3);
}

main();
