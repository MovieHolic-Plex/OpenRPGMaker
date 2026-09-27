// editor/startScreenHandoff.ts
// 데스크톱 시작 화면에서 「만들기」로 넘어온 첫 부팅을 마무리한다.
//
// 시작 화면은 빈 폴더만 만들고(편집기 트리를 싣지 않으려고) 고른 장르·한 문장을 sessionStorage 에 남긴다.
// 편집기가 **그 폴더를** 열었을 때만 여기서 장르 씨앗을 채택·저장하고, 한 문장이 있으면 조수에게 넘길 프롬프트를 만든다.
// 씨앗은 메뉴의 「새 프로젝트」와 같은 정본 경로(createNewProjectSeed)다 — 두 표면이 다른 시작점을 만들지 않는다.

import { createNewProjectSeed } from "@/editor/genrePacks";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { buildWelcomeFreeTextPrompt, welcomeFreeTextDisplayText } from "@/editor/welcomeGenrePresets";
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { projectRepository } from "@/project/persistence/repository";
import { isLocalTarget } from "@/project/persistence/target";
import { store } from "@/project/store";
import { takeStartScreenIntent, type StartScreenIntent } from "@/start/startIntent";

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
  const packId = intent.choiceId ? newProjectChoiceById(intent.choiceId)?.packId ?? null : null;
  const seed = createNewProjectSeed(packId, intent.title);
  store.replaceProject(seed, { label: "새 게임 시작", origin: "system" });
  const saved = await store.flush();
  if (saved.kind !== "saved") throw new Error("새 게임을 폴더에 저장하지 못했습니다.");
  focusProjectStartMap();
  const prompt = startScreenPrompt(intent);
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
