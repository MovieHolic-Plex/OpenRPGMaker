// 상태바 "AI 연동" 칩 — DB 연동 칩(renderDbConnectionStatus)과 동일한 패턴.
// 영역 작업(runRegionTask)·AI 채팅은 LLM 호출을 하므로, OAuth/apiKey 가 미연동이면 401 로 실패한다.
// 사용자가 "영역 작업이 왜 안 되나?" 모르게 두지 않도록 상태바에 AI 연동 상태를 항상 노출한다.
//
// 평가 전략:
// - apiKey 모드: loadAiConfig() 기반 동기 판정. 단, 상대 baseUrl(/api/ai 등)은 동일 오리진
//   vite 프록시(proxyAuth) — 서버가 Authorization 을 주입하므로 클라이언트 키 불필요 → ready.
//   절대 URL(https://...)은 클라이언트 키가 있어야 ready.
// - chatgpt(OAuth) 모드: 동반 서비스(companion /auth/status) 조회가 필요하므로 비동기.
//   모듈 캐시(aiOAuthCachedStatus)에 마지막 조회 결과를 보관하고 동기 평가는 캐시를 쓴다.
//   캐시가 없으면 checking. companion 자체가 안 되면 offline. companion 이 응답했지만
//   내부 오류(4xx/5xx)면 offline + serverMessage — 툴팁은 "보조 프로그램 실행" 안내 대신
//   서버가 알려준 원인을 보여준다(같은 pi-ai 워커를 쓰므로 npm run ai:oauth 는 해결책이 아님).
import { fetchChatGptAuthStatus } from "@/ai/chatgptOAuthClient";
// 값 임포트는 피한다 — 테스트가 이 모듈을 vi.mock 으로 통째 교체하므로(값이 사라짐)
// 타입 가드는 타입 전용으로 가져와 이름 기반 판별에 쓴다.
import type { ChatGptCompanionResponseError } from "@/ai/chatgptOAuthClient";
import { getAiTransportHealth, loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { openAiSettingsModal, type AiSettingsFocus } from "./aiSettingsModal";
import { el } from "@/util/dom";

export type AiConnectionKind = "ready" | "disconnected" | "checking" | "offline";

export interface AiConnectionStatus {
  readonly kind: AiConnectionKind;
  readonly authMode: AiConfig["authMode"];
  /** 사용자에게 보일 짧은 라벨(아이콘 제외). */
  readonly label: string;
  /** 칩 hover/title 용 상세 문구. */
  readonly title: string;
}

interface CachedOAuthStatus {
  readonly connected: boolean;
  readonly planType?: string;
  /** companion 서비스 자체가 응답하지 않음(오프라인). */
  readonly offline?: boolean;
  /** offline 이면서 서버가 응답은 했지만 실패(4xx/5xx)한 경우 — 서버가 알려준 오류 본문. */
  readonly serverMessage?: string;
}

let aiOAuthCachedStatus: CachedOAuthStatus | null = null;
let refreshInFlight = false;

/**
 * 실제 요청이 실패하고 있으면(설정 모양과 무관하게) 그 사실을 우선 보고한다.
 * 404 = 엔드포인트 없음/프록시 미등록, 401·403 = 인증, 5xx·네트워크 = 게이트웨이 다운.
 * "AI 연결됨"인데 모든 턴이 404 나던 거짓말(2026-08-19 적대 평가 P0)의 수정.
 */
function transportFailureStatus(authMode: AiConfig["authMode"]): AiConnectionStatus | null {
  const health = getAiTransportHealth();
  if (!health || health.ok) return null;
  const s = health.status;
  const connectivity = s === undefined || s === 401 || s === 403 || s === 404 || s >= 500;
  if (!connectivity) return null;
  return {
    kind: "offline",
    authMode,
    label: `AI 응답 오류${s ? `(${s})` : ""}`,
    title: `마지막 AI 요청이 실패했습니다 — ${health.message ?? "원인 미상"}. 이 칩을 눌러 연결 설정(엔드포인트·키)을 확인하세요. 요청이 다시 성공하면 자동으로 "AI 연결됨"으로 돌아옵니다.`,
  };
}

/** apiKey 모드 동기 평가. config 가 주어지지 않으면 loadAiConfig(). */
export function getAiConnectionStatus(config: AiConfig = loadAiConfig()): AiConnectionStatus {
  if (config.authMode === "apiKey") {
    // 상대 baseUrl(/api/ai 등) = 동일 오리진 프록시: 서버가 Authorization 을 주입하므로
    // 클라이언트에 키가 없어도 ready 이다(proxyAuth). 보안: 키를 클라이언트 번들에 두지 않는다.
    const proxyAuth = config.baseUrl.trim().startsWith("/");
    if (!proxyAuth && (!config.apiKey || !config.apiKey.trim())) {
      return {
        kind: "disconnected",
        authMode: "apiKey",
        label: "AI 키 없음",
        title: "아직 API 키가 없어요. 이 칩을 눌러 API 키를 입력하거나 .env.local 에 APITOPIA_API_KEY (서버 전용) 를 추가하면 AI 기능(마을 만들기, NPC 배치, AI 채팅)을 쓸 수 있어요.",
      };
    }
    if (!config.baseUrl || !config.baseUrl.trim()) {
      return {
        kind: "disconnected",
        authMode: "apiKey",
        label: "AI 엔드포인트 없음",
        title: "AI 서버 주소(엔드포인트)가 없어요. 이 칩을 눌러 OpenAI 호환 주소를 입력하세요.",
      };
    }
    const failure = transportFailureStatus("apiKey");
    if (failure) return failure;
    return {
      kind: "ready",
      authMode: "apiKey",
      label: "AI 연결됨",
      title: proxyAuth
        ? `프록시로 연결됨 · ${config.baseUrl} (서버가 키를 주입)`
        : `API 키로 연결됨 · ${config.baseUrl}`,
    };
  }
  // chatgpt OAuth 모드 — 캐시된 companion 상태로 동기 평가.
  if (!aiOAuthCachedStatus) {
    return {
      kind: "checking",
      authMode: "chatgpt",
      label: "AI 확인 중…",
      title: "ChatGPT 로그인 상태를 확인하는 중입니다. 잠시만 기다려주세요.",
    };
  }
  if (aiOAuthCachedStatus.offline) {
    // (B) 보조 프로그램이 응답했지만 내부 오류 — "보조 프로그램이 켜져 있지 않아요" 안내는
    // 사실과 다르다. dev 서버(codexOAuthPlugin)와 단독 동반 서비스는 같은 spawnCodexSession() 을
    // 쓰므로 npm run ai:oauth 를 실행해도 같은 지점에서 똑같이 죽는다 — 원인 문자열을 대신 보여준다.
    if (aiOAuthCachedStatus.serverMessage) {
      return {
        kind: "offline",
        authMode: "chatgpt",
        label: "AI 로그인",
        title: `AI 로그인 보조 프로그램이 응답했지만 오류가 났어요. 개발 서버를 껐다 켜 보세요. 오류 내용: ${aiOAuthCachedStatus.serverMessage}`,
      };
    }
    // (A) 보조 프로그램에 아예 닿지 못함 — 켜져 있지 않다는 뜻.
    return {
      kind: "offline",
      authMode: "chatgpt",
      label: "AI 로그인",
      title: "AI 로그인을 도와줄 보조 프로그램이 켜져 있지 않아요. 명령어 창(터미널)에서 'npm run ai:oauth'를 한 번 실행한 뒤 다시 시도해 주세요. 이 칩을 누르면 설정이 열려요.",
    };
  }
  if (aiOAuthCachedStatus.connected) {
    const failure = transportFailureStatus("chatgpt");
    if (failure) return failure;
    return {
      kind: "ready",
      authMode: "chatgpt",
      label: `AI 연결됨${aiOAuthCachedStatus.planType ? ` · ${aiOAuthCachedStatus.planType.toUpperCase()}` : ""}`,
      title: "ChatGPT 구독으로 연결됨 · 로그인 정보는 안전한 보조 프로그램이 알아서 보관·갱신해요.",
    };
  }
  return {
    kind: "disconnected",
    authMode: "chatgpt",
    label: "AI 로그인",
    title: "AI 기능을 쓰려면 ChatGPT 로그인이 필요해요. 이 칩을 눌러 로그인하면 마을 만들기·NPC 배치·AI 채팅을 모두 쓸 수 있어요.",
  };
}

/**
 * chatgpt OAuth 모드일 때 동반 서비스에서 상태를 조회해 캐시를 갱신한다.
 * apiKey 모드는 동기 평가만으로 충분하므로 조회하지 않는다.
 * onChange 는 캐시가 바뀐 뒤(상태바 재렌더링 용) 호출된다.
 */
export async function refreshAiConnectionStatus(onChange?: () => void): Promise<void> {
  const config = loadAiConfig();
  if (config.authMode !== "chatgpt") {
    // apiKey 모드는 동기 평가만으로 충분 — 캐시를 비워두지 않아도 되지만,
    // 모드 전환 시 이전 OAuth 캐시가 남아 ready 로 오인되지 않도록 초기화.
    if (aiOAuthCachedStatus) {
      aiOAuthCachedStatus = null;
      onChange?.();
    }
    return;
  }
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const auth = await fetchChatGptAuthStatus(config.providerId);
    const next: CachedOAuthStatus = { connected: auth.connected, planType: auth.planType };
    const changed =
      !aiOAuthCachedStatus ||
      aiOAuthCachedStatus.connected !== next.connected ||
      aiOAuthCachedStatus.planType !== next.planType;
    aiOAuthCachedStatus = next;
    if (changed) onChange?.();
  } catch (error) {
    // (B) 서버가 응답했지만 실패(4xx/5xx) — 서버가 알려준 원인을 캐시에 담아 툴팁에 노출한다.
    // instanceof 대신 오류 이름으로 판별한다: 테스트가 이 모듈을 vi.mock 으로 통째 교체하면
    // 클래스 정체성이 달라질 수 있기 때문. 일반 Error(= 닿지 못함, (A))는 이 이름이 아니다.
    const serverMessage =
      error instanceof Error && error.name === "ChatGptCompanionResponseError"
        ? (error as ChatGptCompanionResponseError).serverMessage
        : undefined;
    const next: CachedOAuthStatus = { connected: false, offline: true, serverMessage };
    const changed =
      !aiOAuthCachedStatus ||
      aiOAuthCachedStatus.offline !== true ||
      aiOAuthCachedStatus.serverMessage !== serverMessage;
    aiOAuthCachedStatus = next;
    if (changed) onChange?.();
  } finally {
    refreshInFlight = false;
  }
}

/** 캐시를 초기화(로그아웃·설정 변경 직후 재평가 유도). */
export function resetAiConnectionStatusCache(): void {
  aiOAuthCachedStatus = null;
}

/** 상태바 AI 연동 칩. 클릭 시 AI 설정 모달을 연다(DB 연동 칩과 동일 패턴). */
export function renderAiConnectionStatus(onRefresh: () => void): HTMLElement {
  const status = getAiConnectionStatus();
  const icon = status.kind === "ready" ? "🤖" : status.kind === "checking" ? "🤖" : "🤖";
  const button = el("button", {
    class: `editor-statusbar-cell ai-connection-status ${status.kind} auth-${status.authMode}`,
    attrs: { type: "button", title: status.title },
    children: [el("span", { class: "ai-connection-label", text: `${icon} ${status.label}` })],
    dataset: { testid: "ai-connection-status" },
    on: {
      click: () => {
        const current = getAiConnectionStatus();
        const focusTarget: AiSettingsFocus | undefined =
          current.authMode === "apiKey" && current.kind === "disconnected" ? "apiKey" : undefined;
        openAiSettingsModal({ focusTarget });
      },
    },
  });
  // 칩 우클릭 = 강제 재조회(chatgpt 모드). 동기 평가(apiKey)는 즉시 ready 이므로 불필요.
  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    void refreshAiConnectionStatus(onRefresh);
  });
  return button;
}
