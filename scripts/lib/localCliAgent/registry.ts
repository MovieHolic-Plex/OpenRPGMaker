// 로컬 에이전트 CLI 어댑터 목록·감지·건강 확인 — 설정 화면(백엔드 API)과 실행기가 같이 쓴다.
import { claudeAdapter } from "./claude.ts";
import { codexAdapter } from "./codex.ts";
import { geminiAdapter } from "./gemini.ts";
import { LOCAL_CLI_IDS, localCliProviderId, type LocalCliAdapter, type LocalCliId, type LocalCliStatus } from "./types.ts";

export const LOCAL_CLI_ADAPTERS: Readonly<Record<LocalCliId, LocalCliAdapter>> = { claude: claudeAdapter, codex: codexAdapter, gemini: geminiAdapter };

/** 바이너리 경로를 바꿔 시험할 때(OPRN_LOCAL_CLI_CLAUDE=/path/claude 등). 평소에는 PATH 의 이름. */
export function localCliBinary(id: LocalCliId): string {
  return process.env[`OPRN_LOCAL_CLI_${id.toUpperCase()}`] || id;
}

let cache: { at: number; rows: LocalCliStatus[] } | undefined;

/** 설치·로그인 상태 전부. 30초 동안은 같은 답(설정 화면이 여러 번 물어도 CLI 를 매번 띄우지 않게). */
export async function detectLocalClis(options: { fresh?: boolean } = {}): Promise<LocalCliStatus[]> {
  if (!options.fresh && cache && Date.now() - cache.at < 30_000) return cache.rows;
  const rows = await Promise.all(LOCAL_CLI_IDS.map((id) => LOCAL_CLI_ADAPTERS[id].detect(localCliBinary(id)).catch((error): LocalCliStatus => ({
    id, label: LOCAL_CLI_ADAPTERS[id].label, state: "error", stateLabel: "확인 실패", found: false, billing: "unknown", models: [],
    defaults: { routine: "", deep: "" }, install: { command: "", help: "", url: "" }, login: { command: "", help: "" },
    problem: error instanceof Error ? error.message : String(error),
  }))));
  cache = { at: Date.now(), rows };
  return rows;
}

/** 자동 기본값: 연결된 CLI 중 첫째(claude → codex → gemini). 없으면 undefined — 안내 카드를 띄운다. */
export function pickDefaultLocalCli(rows: readonly LocalCliStatus[]): { provider: string; routineModel: string; deepModel: string } | undefined {
  const ready = rows.find((row) => row.state === "ready");
  return ready ? { provider: localCliProviderId(ready.id), routineModel: ready.defaults.routine, deepModel: ready.defaults.deep } : undefined;
}

/** 건강 확인 — 도구 없이 아주 짧은 한 차례. 로그인·모델·네트워크가 실제로 되는지 본다(한도를 조금 쓴다). */
export async function healthCheckLocalCli(id: LocalCliId, model?: string, signal?: AbortSignal): Promise<{ ok: boolean; ms: number; reply?: string; problem?: string }> {
  const started = Date.now();
  try {
    const reply = await LOCAL_CLI_ADAPTERS[id].complete("Reply with exactly: OK", { binary: localCliBinary(id), ...(model ? { model } : {}), ...(signal ? { signal } : {}) });
    const ok = /\bOK\b/u.test(reply);
    return { ok, ms: Date.now() - started, reply: reply.slice(0, 80), ...(ok ? {} : { problem: reply ? "예상한 답이 아닙니다" : "답이 비었습니다" }) };
  } catch (error) {
    return { ok: false, ms: Date.now() - started, problem: error instanceof Error ? error.message : String(error) };
  }
}
