// editor/panels/aiAgentPlate.ts
// 에이전트 감독 플레이트 + 접힌 복귀 얼굴. 채팅 헤더 크롬만 소유한다.

import { renderFacesetCrop } from "@/editor/panels/eventEditor/facesetPreview";
import { el } from "@/util/dom";

export const AGENT_DISPLAY_NAME = "감독";
export const AGENT_FACE_RESOURCE_ID = "easyrpg-faceset-actor1";
export const AGENT_FACE_INDEX = 0;

export const AGENT_PRESENCE = {
  watching: "watching",
  working: "working",
  awaiting: "awaiting",
  error: "error",
} as const;

export type AgentPresence = (typeof AGENT_PRESENCE)[keyof typeof AGENT_PRESENCE];

const PRESENCE_LABEL: { readonly [K in AgentPresence]: string } = {
  watching: "보고 있음",
  working: "작업 중",
  awaiting: "수락 대기",
  error: "오류",
};

export function agentPresenceFromStatus(status: string): AgentPresence {
  const text = status.trim();
  if (/오류|실패|인증|키 없음/u.test(text)) return AGENT_PRESENCE.error;
  if (/제안|검토|수락 대기|승인 대기/u.test(text)) return AGENT_PRESENCE.awaiting;
  if (/중|실행|계획|검수|자율/u.test(text)) return AGENT_PRESENCE.working;
  return AGENT_PRESENCE.watching;
}

export function agentPresenceLabel(presence: AgentPresence): string {
  return PRESENCE_LABEL[presence];
}

export function renderAgentFace(displaySize: number): HTMLElement {
  const crop = renderFacesetCrop({
    resourceId: AGENT_FACE_RESOURCE_ID,
    faceIndex: AGENT_FACE_INDEX,
    displaySize,
  });
  return el("div", {
    class: "ai-agent-face",
    dataset: { testid: "ai-agent-face" },
    children: [crop],
  });
}

export type AgentPlateHandle = {
  readonly element: HTMLElement;
  readonly titleEl: HTMLElement;
  readonly face: HTMLElement;
  readonly setStatus: (statusText: string) => void;
  readonly setBrief: (line: string) => void;
};

export function renderAgentPlate(options: { readonly statusText: string; readonly briefText?: string }): AgentPlateHandle {
  const face = renderAgentFace(48);
  const titleEl = el("h2", {
    class: "ai-agent-name",
    text: AGENT_DISPLAY_NAME,
    dataset: { testid: "ai-agent-name" },
  });
  const statusEl = el("span", {
    class: "ai-agent-status",
    dataset: { testid: "ai-agent-status" },
    text: agentPresenceLabel(agentPresenceFromStatus(options.statusText)),
  });
  const briefEl = el("span", {
    class: "ai-agent-brief",
    dataset: { testid: "ai-agent-brief" },
    text: options.briefText ?? "",
  });
  const element = el("div", {
    class: "ai-agent-plate",
    dataset: { testid: "ai-agent-plate" },
    children: [
      face,
      el("div", {
        class: "ai-agent-copy",
        children: [titleEl, statusEl, briefEl],
      }),
    ],
  });
  const setStatus = (statusText: string): void => {
    const presence = agentPresenceFromStatus(statusText);
    statusEl.textContent = agentPresenceLabel(presence);
    statusEl.dataset.presence = presence;
    element.dataset.presence = presence;
  };
  const setBrief = (line: string): void => {
    briefEl.textContent = line;
    briefEl.hidden = line.trim().length === 0;
  };
  setStatus(options.statusText);
  setBrief(options.briefText ?? "");
  return { element, titleEl, face, setStatus, setBrief };
}

export function renderAgentCollapsedRestore(): HTMLButtonElement {
  return el("button", {
    class: "ai-collapsed-restore",
    attrs: { type: "button", title: "AI 어시스턴트", "aria-label": "AI 어시스턴트" },
    dataset: { testid: "ai-collapsed-restore" },
    children: [
      el("span", { class: "ai-collapsed-restore-dot", attrs: { "aria-hidden": "true" } }),
      el("span", { class: "ai-collapsed-restore-face-slot", children: [renderAgentFace(32)] }),
    ],
  }) as HTMLButtonElement;
}
