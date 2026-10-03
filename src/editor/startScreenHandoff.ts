// Adopt the launcher intent into its matching SQLite folder using the same factory as the editor menu.
// Example and blank starts open the first-edit guide; AI starts continue through the planning interview.

import { createNewProjectSeed } from "./genrePacks";
import { createProjectStartSeed } from "./projectStartSeed";
import { projectStartMode } from "@/start/projectStart";
import { focusProjectStartMap } from "@/editor/mapSelection";
import { newProjectChoiceById } from "@/editor/newProjectChoices";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import {
  buildWelcomeFreeTextPrompt,
  welcomeFreeTextDisplayText,
  welcomeGenrePresetById,
  type WelcomeGenrePresetId,
} from "@/editor/welcomeGenrePresets";
import { isAssistantEndpointReady, resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import { projectRepository } from "@/project/persistence/repository";
import { isLocalTarget } from "@/project/persistence/target";
import { store } from "@/project/store";
import { START_SCREEN_INTENT_KEY, takeStartScreenIntent, type StartScreenIntent } from "@/start/startIntent";

export type StartScreenHandoff = {
  readonly intent: StartScreenIntent;
  /** 프리셋 장르를 골랐으면 그 id. 셸이 뜬 뒤 인터뷰를 연다. 빈 프로젝트면 null. */
  readonly presetId: WelcomeGenrePresetId | null;
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
    const seed = await createProjectStartSeed(intent.choiceId, intent.title, mode, intent.screenSize);
    store.replaceProject(seed, { label: "새 게임 시작", origin: "system" });
    const saved = await store.flush();
    if (saved.kind !== "saved") throw new Error("새 게임을 폴더에 저장하지 못했습니다.");
  } catch (error) {
    storage.setItem(START_SCREEN_INTENT_KEY, JSON.stringify(intent));
    throw error;
  }
  focusProjectStartMap();
  const presetId = mode === "ai" && welcomeGenrePresetById(intent.choiceId ?? undefined) ? intent.choiceId as WelcomeGenrePresetId : null;
  const prompt = mode === "ai" ? startScreenPrompt(intent) : null;
  let autoSend = false;
  if (prompt) {
    try {
      const config = resolveSurfaceAiConfig("chat");
      autoSend = isAssistantEndpointReady(config, getAiConnectionStatus(config));
    } catch {
      autoSend = false;
    }
  }
  return { intent, presetId, prompt, displayText: prompt ? welcomeFreeTextDisplayText(intent.intent) : null, autoSend };
}

export type StartScreenPresetDependencies = {
  readonly ensureAiConnected: (presetLabel: string) => Promise<boolean>;
  readonly interview: (presetId: WelcomeGenrePresetId, initialAnswer: string) => Promise<GameDesignBrief | null>;
};

const productionPresetDependencies: StartScreenPresetDependencies = {
  ensureAiConnected: async (presetLabel) => {
    const { ensureAiConnectedForPreset } = await import("@/editor/ui/aiConnectGate");
    return ensureAiConnectedForPreset({ presetLabel });
  },
  interview: async (presetId, initialAnswer) => {
    const { showProjectInterview } = await import("@/editor/ui/projectInterviewDialog");
    return showProjectInterview(presetId, { initialAnswer });
  },
};

/**
 * 프리셋 장르로 만든 새 게임의 기획을 받는다. 확정하면 기획을 generationPending 으로 심고 "brief" —
 * 저장과 팀 첫 생성 전달은 호출부의 prepareProjectInterviewStartup 이 맡는다(메뉴 경로와 같은 소비 지점).
 * 관문에서 「나중에」, 인터뷰 취소, 그 사이 다른 프로젝트로 바뀐 경우는 아무것도 바꾸지 않고 "declined".
 */
export async function runStartScreenPresetInterview(
  handoff: StartScreenHandoff,
  dependencies: StartScreenPresetDependencies = productionPresetDependencies,
): Promise<"brief" | "declined"> {
  const presetId = handoff.presetId;
  if (!presetId) return "declined";
  const label = newProjectChoiceById(presetId)?.label ?? presetId;
  const scope = JSON.stringify(store.getProjectIdentity());
  const connected = await dependencies.ensureAiConnected(label).catch(() => false);
  if (!connected) return "declined";
  const brief = await dependencies.interview(presetId, handoff.intent.intent);
  if (!brief || JSON.stringify(store.getProjectIdentity()) !== scope) return "declined";
  const chosen = newProjectChoiceById(brief.presetId);
  if (!chosen) return "declined";
  store.update(project => {
    // The fresh folder was seeded before the interview. Replace only its system defaults when
    // the author chooses another engine; do not leave collection/battle flags from the first seed.
    if (brief.presetId !== presetId) {
      const playResolution = project.system.playResolution;
      project.system = createNewProjectSeed(chosen.packId, project.meta.title).system;
      if (playResolution) project.system.playResolution = playResolution;
    }
    project.gameDesignBrief = { ...brief, generationPending: true };
  }, { scope: "project", label: "게임 기획 확정", origin: "human" });
  return "brief";
}
