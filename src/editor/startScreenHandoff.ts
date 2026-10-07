// Adopt the launcher intent into its matching SQLite folder using the same factory as the editor menu.
// 2026-10-07: 런처 「만들기」는 컨셉 피드에서 확정 기획(gameDesignBrief)을 실어 보낸다. 빈 프로젝트는 기획 없이 온다.
// 기획 없는 AI 인계(옛 한 문장)는 조수에게 그 문장만 넘긴다.

import { createProjectStartSeed } from "./projectStartSeed";
import { projectStartMode } from "@/start/projectStart";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { buildWelcomeFreeTextPrompt, welcomeFreeTextDisplayText } from "@/editor/welcomeGenrePresets";
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import { projectRepository } from "@/project/persistence/repository";
import { isLocalTarget } from "@/project/persistence/target";
import { store } from "@/project/store";
import { START_SCREEN_INTENT_KEY, takeStartScreenIntent, type StartScreenIntent } from "@/start/startIntent";

export type StartScreenHandoff = {
  readonly intent: StartScreenIntent;
  /** 조수에게 보낼 프롬프트. 한 문장을 비워 두었으면 null. */
  readonly prompt: string | null;
  readonly displayText: string | null;
  /** AI 가 준비돼 있으면 바로 보낸다. 아니면 조수 입력창에 담기만 한다. */
  readonly autoSend: boolean;
};

function sessionStore(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** 장르를 골랐으면 한 문장 앞에 장르 계약을 붙인다 — 모델이 장르 엔진(이미 켜져 있다)을 끄지 않게 한다. */
export function startScreenPrompt(intent: Pick<StartScreenIntent, "choiceId" | "intent">): string | null {
  const text = intent.intent.trim();
  if (!text) return null;
  const choice = intent.choiceId ? newProjectChoiceById(intent.choiceId) : undefined;
  const base = buildWelcomeFreeTextPrompt(text);
  if (!choice) return base;
  return [
    base,
    "",
    "선택한 시작 장르: " + choice.label + " — 장르 시스템 설정은 이미 적용돼 있다. 끄지 말고 그 위에 만든다.",
    "장르 톤: " + choice.tone,
  ].join("\n");
}

/**
 * 인계가 없거나 다른 폴더면 null 이고 아무것도 바꾸지 않는다.
 * 저장이 확인되지 않으면 던진다 — 폴더에 없는 씨앗 위에서 AI 를 돌리면 안 된다.
 */
export async function applyStartScreenHandoff(): Promise<StartScreenHandoff | null> {
  const storage = sessionStore();
  if (!storage) return null;
  const target = projectRepository().currentTarget();
  if (!target || !isLocalTarget(target)) return null;
  const intent = takeStartScreenIntent(storage, target.projectDir);
  if (!intent) return null;
  const mode = projectStartMode(intent.choiceId, intent.startMode);
  try {
    const brief = intent.gameDesignBrief === undefined ? undefined : normalizeGameDesignBrief(intent.gameDesignBrief);
    if (brief && (mode !== "ai" || brief.presetId !== intent.choiceId)) throw new Error("게임 기획과 시작 장르가 다릅니다.");
    const seed = await createProjectStartSeed(intent.choiceId, intent.title, mode, intent.screenSize);
    if (brief) seed.gameDesignBrief = { ...brief, generationPending: true };
    store.replaceProject(seed, { label: "새 게임 시작", origin: "system" });
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("새 게임을 폴더에 저장하지 못했습니다.");
  } catch (error) {
    storage.setItem(START_SCREEN_INTENT_KEY, JSON.stringify(intent));
    throw error;
  }
  focusProjectStartMap();
  // A confirmed launcher plan is consumed once by the existing saved-brief execution route.
  const confirmed = intent.gameDesignBrief !== undefined;
  const prompt = !confirmed && mode === "ai" ? startScreenPrompt(intent) : null;
  let autoSend = false;
  if (prompt) {
    try {
      const config = resolveSurfaceAiConfig("chat");
      autoSend = isAssistantEndpointReady(config, getAiConnectionStatus(config));
    } catch {
      autoSend = false;
    }
  }
  return { intent, prompt, displayText: prompt ? welcomeFreeTextDisplayText(intent.intent) : null, autoSend };
}
