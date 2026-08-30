/**
 * 실제 LLM 으로 **수정 요청**을 돌려 "고쳐 달랬는데 새로 만들었다"가 재현되는지 본다
 * (2026-08-29 modify 진단 P4 #17).
 *
 * evals/llmSuite.eval.ts 와 과제는 같지만 경로가 다르다 — 이 파일은 에디터가 실제로 쓰는
 * dev 서버 프록시(/api/cpen)와 그 모델 설정을 그대로 통과시킨다. 프록시 계층에서 계약이
 * 달라져도(도구 노출 상한·시스템 프롬프트 조립) 여기서 걸린다.
 *
 * 실행 (dev 서버가 /api/cpen 프록시를 제공해야 한다):
 *   npm run dev  # 별도 터미널, https://127.0.0.1:9999
 *   RPG_ZZU_AI_MAP_EDIT=1 NODE_TLS_REJECT_UNAUTHORIZED=0 \
 *     node scripts/run-vitest.mjs run test/aiMapEditLive.live.test.ts --configLoader bundle
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { chatCompletion, type AiConfig } from "@/ai/llmClient";
import { defaultModelForAuthMode } from "@/ai/modelCatalog";
import { DEFAULT_OH_MY_PI_PROVIDER } from "@/ai/ohMyPiProviders";
import { GOLDEN_TASKS, scoreProject, type GoldenTask } from "@/evals";

/** 수정 과제만 — 신규 시공 과제는 evals 스위트가 본다. */
const MODIFY_TASK_IDS = ["road-fix", "npc-line-fix"] as const;
const TURN_TIMEOUT_MS = Number(process.env.RPG_ZZU_AI_MAP_EDIT_TIMEOUT_MS ?? 180000);

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const file of [".env", ".env.local"]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  }
  return env;
}

function aiConfig(env: Record<string, string>): AiConfig {
  // 모델 기본값은 제공자 레지스트리에서 파생한다 — 문자열을 박지 않는다. 예전 폴백은
  // `src/ai/ohMyPiProviders.ts` 에 등록조차 없는 고아 ID 였다.
  // `defaultModelForAuthMode` 는 그 제공자 카탈로그 첫 항목(= `provider.defaultModel`)을
  // 돌려주므로 에디터가 실제로 쓰는 모델과 이 재현 경로가 갈라지지 않는다.
  const model = env.RPG_ZZU_AI_MODEL
    || env.VITE_LLM_MODEL
    || defaultModelForAuthMode("chatgpt", DEFAULT_OH_MY_PI_PROVIDER);
  return {
    authMode: "apiKey",
    baseUrl: (env.AI_BASE_URL || "https://127.0.0.1:9999/api/cpen").replace(/\/$/, ""),
    model,
    liteModel: model,
    apiKey: env.CPENROUTER_API_KEY || env.VITE_LLM_API_KEY || "",
    maxToolCalls: 24,
    maxTokens: 8192,
    reasoningEffort: "off",
    autoApprove: true,
  };
}

function task(id: string): GoldenTask {
  const found = GOLDEN_TASKS.find((entry) => entry.id === id);
  if (!found) throw new Error(`golden task 없음: ${id}`);
  return found;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`타임아웃(${ms}ms)`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const describeLive = process.env.RPG_ZZU_AI_MAP_EDIT === "1" ? describe : describe.skip;

describeLive("실제 LLM 수정 요청 — 맵을 새로 만들지 않는다 (live)", () => {
  for (const id of MODIFY_TASK_IDS) {
    it(`${id}: 지목된 맵을 그 자리에서 고친다`, async () => {
      const golden = task(id);
      const before = golden.initialProject();
      const mapIdsBefore = Object.keys(before.maps).sort();

      const session = new AssistantSession(before, {
        config: aiConfig(loadEnv()),
        chat: chatCompletion,
        ...(golden.contextOptions ? { contextOptions: golden.contextOptions } : {}),
      });

      const toolLog: { name: string; ok: boolean }[] = [];
      const onEvent = (event: SessionEvent): void => {
        if (event.type === "tool_call") {
          toolLog.push({ name: event.name, ok: event.result.ok });
          // eslint-disable-next-line no-console
          console.log(`  tool ${event.result.ok ? "OK  " : "FAIL"} ${event.name}`);
        }
      };

      const turn = await withTimeout(session.sendUserMessage(golden.prompt, onEvent), TURN_TIMEOUT_MS);
      const after = session.getProposedProject();
      const score = scoreProject(after, golden);
      // eslint-disable-next-line no-console
      console.log(`[${id}] reason=${turn.stoppedReason} score=${score.score.toFixed(2)} tools=${toolLog.length}`);
      for (const result of score.matcherResults) {
        // eslint-disable-next-line no-console
        console.log(`  ${result.passed ? "✓" : "✗"} ${result.describe}`);
      }

      // 하드 실패 1: 맵 집합이 바뀌면 신규 생성으로 우회한 것이다.
      expect(Object.keys(after.maps).sort(), `${id}: 수정 요청에 맵 집합이 바뀌었다`).toEqual(mapIdsBefore);
      // 하드 실패 2: 새 맵도 안 만들고 아무것도 안 고친 경우.
      const brokenInvariance = score.matcherResults.filter((result) => !result.passed && result.describe.startsWith("맵 집합 불변"));
      expect(brokenInvariance.map((result) => result.describe)).toEqual([]);
      expect(score.passed, `${id}: ${JSON.stringify(score.matcherResults)} err=${turn.error ?? ""}`).toBe(true);
    }, TURN_TIMEOUT_MS + 30000);
  }
});
