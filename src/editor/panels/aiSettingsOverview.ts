// editor/panels/aiSettingsOverview.ts
// AI 설정 첫 화면 — 「지금 쓰는 모델(자동)」과 「연결된 계정」 두 덩이. 계정 추가·고급은 모달이 이 아래에 접어 둔다.
//
// 왜 (2026-11-23 ai-setup-adaptive c, 오너: 「ai 설정부분 너무 지저분하니까 많이 심플화」): 첫 화면에 빠른 연결 폼·ChatGPT 로그인·
// 품질 두 칸·직접 입력·다른 방법이 한꺼번에 나와 조작 12~14개였고, 지금 어느 모델이 도는지는 보이지 않았다.
import { autoPickNote, providerQuotaState, type ProviderRouteState } from "@/ai/autoProviderPick";
import { AI_CONFIG_CHANGED_EVENT, loadAiConfig } from "@/ai/llmClient";
import { modelDisplayName } from "@/ai/modelDisplayName";
import { modelForRole } from "@/ai/modelRoles";
import { getOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { loadProviderPin, saveProviderPin } from "@/ai/providerPin";
import { lowestRemaining } from "@/ai/providerQuota";
import { activeModelId } from "@/ai/quickModelSwitch";
import { AI_AUTO_PICK_EVENT, currentProviderId, lastAutoPick, lastAutoRoutes, runAutoProviderPick } from "@/editor/panels/aiAutoProvider";
import { ASSISTANT_ENGINE_CHANGED_EVENT } from "@/start/settings/localAgents";
import { el } from "@/util/dom";

const EFFORT_LABELS: Readonly<Record<string, string>> = { low: "낮음", medium: "보통", high: "높음", xhigh: "매우 높음", max: "최대" };

/** 「가 · 나 · 다」를 조각마다 span 으로 — 빈 조각은 뺀다. */
function joinParts(parts: ReadonlyArray<string | undefined>): HTMLElement[] {
  return parts.filter((part): part is string => !!part).flatMap((part, index) => [
    ...(index ? [el("span", { class: "ai-settings-sep", text: " · ", attrs: { "aria-hidden": "true" } })] : []),
    el("span", { text: part }),
  ]);
}

const labelOf = (id: string): string => getOhMyPiProvider(id)?.label ?? id;
const clockTime = (ms: number): string => {
  const at = new Date(ms);
  return `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`;
};

/** 한 계정 줄의 한도 표시. 모르면 「한도 모름」 — 숫자를 지어내지 않는다. */
export function routeQuotaText(route: ProviderRouteState, now: number = Date.now()): { readonly text: string; readonly tone: "ok" | "warn" | "muted" } {
  const state = providerQuotaState(route, now);
  if (state === "exhausted") {
    const at = route.limitedUntil && route.limitedUntil > now ? route.limitedUntil
      : route.usage?.windows.find((window) => (window.exhausted || window.remainingFraction === 0) && window.resetsAt && window.resetsAt > now)?.resetsAt;
    return { text: at ? `한도 초과 · ${clockTime(at)} 풀림` : "한도 초과", tone: "warn" };
  }
  if (state === "unknown") return { text: "한도 모름", tone: "muted" };
  const lowest = lowestRemaining(route.usage) ?? 0;
  return { text: `남음 ${Math.round(lowest * 100)}%`, tone: state === "low" ? "warn" : "ok" };
}

export function renderAiSettingsOverview(): { readonly element: HTMLElement; readonly current: HTMLElement; readonly accounts: HTMLElement; readonly dispose: () => void } {
  const modelName = el("span", { class: "ai-settings-overview-model", dataset: { testid: "ai-settings-current-model" } });
  const modelNote = el("small", { class: "ai-settings-overview-note", dataset: { testid: "ai-settings-current-note" } });
  const autoSwitch = el("button", {
    class: "ai-settings-row ai-settings-row-button ai-settings-switch-row",
    attrs: { type: "button", role: "switch", "aria-label": "자동으로 고르기" },
    dataset: { testid: "ai-settings-auto" },
    children: [
      el("span", { class: "ai-settings-row-copy", children: [el("span", { text: "자동으로 고르기" }), el("small", { text: "연결된 계정과 남은 한도를 보고 고르고, 한도에 걸리면 다음 계정으로 바꿔요." })] }),
      el("span", { class: "ai-settings-switch", attrs: { "aria-hidden": "true" } }),
    ],
  });
  const accounts = el("ul", { class: "ai-settings-accounts", dataset: { testid: "ai-settings-accounts" } });

  const paint = (): void => {
    const config = loadAiConfig();
    const model = activeModelId(config).trim();
    const effort = EFFORT_LABELS[modelForRole(config, "deep").thinkingLevel ?? ""];
    const current = currentProviderId();
    // 조각마다 따로 둔다 — 번역 계층은 글자 노드 하나를 통째로 맞추므로 「이름 · 강도」를 한 노드에 두면 강도가 번역되지 않는다.
    modelName.replaceChildren(...joinParts(model ? [modelDisplayName(model), effort] : ["고른 모델 없음"]));
    const pinned = loadProviderPin();
    autoSwitch.setAttribute("aria-checked", String(!pinned));
    const pick = lastAutoPick();
    const note = pick?.providerId === current ? autoPickNote(pick, labelOf, clockTime) : undefined;
    modelNote.replaceChildren(...joinParts([labelOf(current), pinned ? "직접 고정" : "자동", note]));

    const connected = lastAutoRoutes().filter((route) => route.connected);
    if (!connected.length) {
      accounts.replaceChildren(el("li", { class: "ai-settings-accounts-empty", text: "연결된 계정이 없어요. 로그인이 끝났다면 아래에서 다시 로그인하세요." }));
      return;
    }
    accounts.replaceChildren(...connected.map((route) => {
      const quota = routeQuotaText(route);
      return el("li", {
        class: "ai-settings-account",
        dataset: { testid: `ai-settings-account-${route.providerId}`, current: String(route.providerId === current) },
        children: [
          el("span", { class: "ai-settings-account-name", text: labelOf(route.providerId) }),
          ...(route.providerId === current ? [el("span", { class: "ai-settings-pill", dataset: { tone: "accent" }, text: "사용 중" })] : []),
          el("span", { class: "ai-settings-pill", dataset: { tone: quota.tone }, text: quota.text }),
        ],
      });
    }));
  };

  autoSwitch.addEventListener("click", () => {
    const turnOn = autoSwitch.getAttribute("aria-checked") !== "true";
    saveProviderPin(turnOn ? null : currentProviderId());
    paint();
    if (turnOn) void runAutoProviderPick();
  });

  // 두 덩이는 설정 창의 다른 메뉴에 들어간다 — 「지금 쓰는 모델」은 모델 메뉴, 「연결된 계정」은 계정 메뉴(2026-11-23 오너: 사이드바로 분배).
  const current = el("section", { class: "ai-settings-section", dataset: { testid: "ai-settings-section-current" }, children: [
    el("header", { class: "ai-settings-section-header", children: [el("h3", { text: "지금 쓰는 모델" })] }),
    el("div", { class: "ai-settings-section-body", children: [
      el("div", { class: "ai-settings-row ai-settings-overview-current", children: [el("span", { class: "ai-settings-row-copy", children: [modelName, modelNote] })] }),
      autoSwitch,
    ] }),
  ] });
  const accountsSection = el("section", { class: "ai-settings-section", dataset: { testid: "ai-settings-section-accounts" }, children: [
    el("header", { class: "ai-settings-section-header", children: [el("h3", { text: "연결된 계정" })] }),
    el("div", { class: "ai-settings-section-body", children: [accounts] }),
  ] });
  const element = el("div", { class: "ai-settings-overview", dataset: { testid: "ai-settings-overview" }, children: [current, accountsSection] });

  const win = typeof window === "undefined" ? undefined : window;
  const events = [AI_AUTO_PICK_EVENT, AI_CONFIG_CHANGED_EVENT, ASSISTANT_ENGINE_CHANGED_EVENT];
  for (const name of events) win?.addEventListener?.(name, paint);
  paint();
  // 설정을 열 때 한 번 새로 모은다 — 부팅 뒤 계정을 붙였을 수 있다. 결과는 AI_AUTO_PICK_EVENT 로 다시 칠한다.
  void runAutoProviderPick();
  return {
    element,
    current,
    accounts: accountsSection,
    dispose: () => { for (const name of events) win?.removeEventListener?.(name, paint); },
  };
}
