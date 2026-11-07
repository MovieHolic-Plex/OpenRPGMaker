import { AI_CONFIG_CHANGED_EVENT } from "@/ai/llmClient";
import { AI_CONNECTION_STATUS_CHANGED_EVENT } from "./aiConnectionStatus";
import { AI_SETTINGS_CLOSED_EVENT } from "./aiSettingsModal";
import { IMAGE_GENERATION_UNAVAILABLE_CODE, IMAGE_GENERATION_UNAVAILABLE_NOTICE, imageUnavailableGateNotice, probeImageGenerationAvailability } from "@/editor/imageGenerationNotice";
import type { AiGateNotice } from "@/ai/aiGateNotice";
import { el } from "@/util/dom";

export const IMAGE_GENERATION_NOTICE_TESTIDS = {
  host: "image-generation-notice",
  action: "image-generation-notice-action",
} as const;

export type ImageGenerationNotice = {
  readonly element: HTMLElement;
  readonly sync: () => Promise<boolean>;
  readonly dispose: () => void;
};

/**
 * 캔버스 위 상시 띠 — 잠금 막(ai-lock-scrim)과 같은 판단이되, 조수 패널을 접어 둔 사용자도 보게 한다.
 * 메뉴를 열지 않아도 보이는 자리이고, 판정과 문장은 imageGenerationNotice 한 곳에서만 온다.
 */
export function createImageGenerationNotice(options: { readonly onOpenSettings: () => void }): ImageGenerationNotice {
  const element = el("div", {
    class: "image-generation-notice",
    attrs: { role: "status", "aria-live": "polite", hidden: "" },
    dataset: { testid: IMAGE_GENERATION_NOTICE_TESTIDS.host },
    children: [
      el("span", { class: "image-generation-notice-text", text: IMAGE_GENERATION_UNAVAILABLE_NOTICE }),
      el("button", {
        class: "image-generation-notice-action",
        attrs: { type: "button" },
        dataset: { testid: IMAGE_GENERATION_NOTICE_TESTIDS.action },
        text: "AI 설정 열기",
        on: { click: () => options.onOpenSettings() },
      }),
    ],
  });

  let disposed = false;
  const sync = async (): Promise<boolean> => {
    let unavailable = false;
    try {
      unavailable = !(await probeImageGenerationAvailability()).available;
    } catch {
      unavailable = false;
    }
    if (!disposed) element.hidden = !unavailable;
    return unavailable;
  };

  const remeasure = (): void => { void sync(); };
  const win = typeof window === "undefined" ? null : window;
  win?.addEventListener(AI_CONFIG_CHANGED_EVENT, remeasure);
  win?.addEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, remeasure);
  win?.addEventListener(AI_SETTINGS_CLOSED_EVENT, remeasure);

  return {
    element,
    sync,
    dispose: () => {
      disposed = true;
      win?.removeEventListener(AI_CONFIG_CHANGED_EVENT, remeasure);
      win?.removeEventListener(AI_CONNECTION_STATUS_CHANGED_EVENT, remeasure);
      win?.removeEventListener(AI_SETTINGS_CLOSED_EVENT, remeasure);
      element.remove();
    },
  };
}

/** 조수·헤드리스 도구 결과가 「그림 생성 연결 없음」인지 — 상태 코드와 직렬화된 본문을 함께 본다. */
export function isImageGenerationUnavailableResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const issues = (result as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (issue && typeof issue === "object" && isImageUnavailableCode((issue as { code?: unknown }).code)) return true;
    }
  }
  try {
    return JSON.stringify(result).includes(IMAGE_GENERATION_UNAVAILABLE_CODE);
  } catch {
    return false;
  }
}

function isImageUnavailableCode(code: unknown): boolean {
  return code === IMAGE_GENERATION_UNAVAILABLE_CODE;
}

/**
 * 그림 도구가 「연결 없음」으로 끝난 순간 차단 모달을 한 번 띄운다. 조수가 대체 그림으로
 * 계속 가도 사용자가 그 사실을 모르는 경로가 없어야 한다(오너: 조용한 계속 금지).
 */
export function reportImageGenerationUnavailable(result: unknown, show: (notice: AiGateNotice) => void): boolean {
  if (!isImageGenerationUnavailableResult(result)) return false;
  show(imageUnavailableGateNotice());
  return true;
}
