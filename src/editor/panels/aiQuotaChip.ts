// editor/panels/aiQuotaChip.ts
// 조수 레일의 한도 칩 — 지금 쓰는 AI 연결과 남은 한도(읽을 수 있을 때) 또는 「알 수 없음」.
//
// 왜 (2026-11-10 ai-quota-aware): 톱바 연결 칩은 #4206 개편 뒤 화면에서 빠져, 조수가 한도로 멈춰도 연결 상태를
// 볼 자리가 없었다. 연결 상태 계산(aiConnectionStatus)은 그대로 쓰고, 조수 레일에 짧은 칩 하나로 다시 보인다.
// 남은 한도는 동반 서비스 `GET /auth/usage` 가 제공자 공식 사용량 조회로 읽은 값이며, 못 읽으면 숫자를 지어내지 않는다.
import { companionAuthUrl } from "@/ai/chatgptOAuthClient";
import { fetchCompanion } from "@/ai/companionConnection";
import { AI_CONFIG_CHANGED_EVENT, AI_TRANSPORT_HEALTH_EVENT, loadAiConfig } from "@/ai/llmClient";
import { parseOhMyPiProvider } from "@/ai/ohMyPiProviders";
import { usageChipSuffix, usageDetail, type ProviderUsageSnapshot } from "@/ai/providerQuota";
import { AI_CONNECTION_STATUS_CHANGED_EVENT, getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { el } from "@/util/dom";

const USAGE_REFRESH_MS = 60_000;

export async function fetchProviderUsage(providerId: string): Promise<ProviderUsageSnapshot | null> {
  try {
    const response = await fetchCompanion(companionAuthUrl("/auth/usage", providerId));
    if (!response.ok) return null;
    const body = await response.json() as ProviderUsageSnapshot;
    return body && typeof body.readable === "boolean" ? body : null;
  } catch {
    return null;
  }
}

export function renderAiQuotaChip(openSettings: () => void): { readonly element: HTMLElement; readonly dispose: () => void } {
  const label = el("span", { class: "ai-quota-chip-label", dataset: { testid: "ai-quota-chip-label" } });
  const button = el("button", {
    class: "ai-quota-chip",
    attrs: { type: "button" },
    dataset: { testid: "ai-quota-chip" },
    children: [el("span", { class: "ai-quota-chip-dot", attrs: { "aria-hidden": "true" } }), label],
    on: { click: () => openSettings() },
  }) as HTMLButtonElement;
  let usage: ProviderUsageSnapshot | null = null;
  let usageFor = "";
  let fetchedAt = 0;
  let inflight = false;

  const paint = (): void => {
    const status = getAiConnectionStatus();
    const kind = status.limited ? "limited" : status.kind;
    button.dataset.kind = kind;
    const current = usage && usageFor === status.providerId ? usage : null;
    const tail = status.limited ? "사용 한도 초과" : status.kind === "ready" ? usageChipSuffix(current) : status.label.replace(status.providerLabel, "").trim();
    label.textContent = `${status.providerLabel} · ${tail}`;
    const detail = status.kind === "ready" || status.limited ? usageDetail(current) : status.title;
    button.title = `${status.limited ? status.title : status.providerLabel} — ${detail} — 누르면 AI 설정에서 다른 연결을 고를 수 있어요.`;
    button.setAttribute("aria-label", `${label.textContent} — AI 설정 열기`);
  };

  const refreshUsage = (force: boolean): void => {
    const providerId = parseOhMyPiProvider(loadAiConfig().providerId);
    const status = getAiConnectionStatus();
    if (status.kind !== "ready" || inflight) { paint(); return; }
    if (!force && usageFor === providerId && Date.now() - fetchedAt < USAGE_REFRESH_MS) { paint(); return; }
    inflight = true;
    void fetchProviderUsage(providerId).then((snapshot) => {
      usage = snapshot;
      usageFor = providerId;
      fetchedAt = Date.now();
    }).finally(() => { inflight = false; paint(); });
  };

  const win = typeof window === "undefined" ? undefined : window;
  const onStatus = (): void => refreshUsage(false);
  const onConfig = (): void => refreshUsage(true);
  win?.addEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, onStatus);
  win?.addEventListener?.(AI_TRANSPORT_HEALTH_EVENT, onConfig);
  win?.addEventListener?.(AI_CONFIG_CHANGED_EVENT, onConfig);
  const timer = win ? win.setInterval(() => refreshUsage(false), USAGE_REFRESH_MS) : undefined;
  paint();
  refreshUsage(true);
  return {
    element: button,
    dispose: () => {
      win?.removeEventListener?.(AI_CONNECTION_STATUS_CHANGED_EVENT, onStatus);
      win?.removeEventListener?.(AI_TRANSPORT_HEALTH_EVENT, onConfig);
      win?.removeEventListener?.(AI_CONFIG_CHANGED_EVENT, onConfig);
      if (timer !== undefined) win?.clearInterval(timer);
    },
  };
}
