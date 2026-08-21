// 상태바 "AI 연동" 칩 — DB 연동 칩(renderDbConnectionStatus)과 동일한 패턴.
// 영역 작업(runRegionTask)·AI 채팅은 LLM 호출을 하므로, OAuth/apiKey 가 미연동이면 401 로 실패한다.
// 사용자가 "영역 작업이 왜 안 되나?" 모르게 두지 않도록 상태바에 AI 연동 상태를 항상 노출한다.
//
// 평가 전략:
// - chatgpt(= 동반 서비스 전송, 에디터의 유일한 경로): companion `/auth/status` 조회가 필요하므로
//   비동기. 모듈 캐시(aiOAuthCachedStatus)에 마지막 결과를 보관하고 동기 평가는 캐시를 쓴다.
//   캐시가 없으면 checking. 닿지 못하면 offline(A), 응답했지만 4xx/5xx 면 error(B) — 두 경우의
//   해결책이 다르므로 라벨·이모지·색을 갈라 보여 준다(같은 pi-ai 워커를 쓰므로 (B) 에
//   npm run ai:oauth 는 해결책이 아니다).
// - apiKey 모드: **주입 설정 전용**이다(노드 스크립트·evals·벤치마크). 에디터 UI 는 이 모드를
//   만들지 않는다 — loadAiConfig() 기반 동기 판정만 남겨 둔다.
//
// env 자격은 연결로 세지 않는다(감독 결정 2026-08-21): 동반 서비스는 셸 환경 변수만 있어도
// connected:true 를 주지만, 에디터가 만들지도 지우지도 못하는 자격이라 "연결됨"이라 말하면
// 화면이 제어할 수 없는 상태를 진실처럼 보여 준다.
import { fetchChatGptAuthStatus } from "@/ai/chatgptOAuthClient";
// 값 임포트는 피한다 — 테스트가 이 모듈을 vi.mock 으로 통째 교체하므로(값이 사라짐)
// 타입 가드는 타입 전용으로 가져와 이름 기반 판별에 쓴다.
import type { ChatGptCompanionResponseError } from "@/ai/chatgptOAuthClient";
import { getAiTransportHealth, isProxyAuth, loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { openAiSettingsModal, type AiSettingsFocus } from "./aiSettingsModal";
import { el } from "@/util/dom";

/**
 * 칩이 말할 수 있는 상태. `offline`(도달 불가)과 `error`(응답했지만 실패)를 나눈다 —
 * 예전에는 "보조 프로그램이 죽음 / 안 켜짐 / 그냥 로그아웃" 세 가지가 **같은 라벨 "AI 로그인",
 * 같은 이모지, 같은 색**으로 보였고 차이는 hover 툴팁에만 있었다.
 */
export type AiConnectionKind = "ready" | "disconnected" | "checking" | "offline" | "error";

/** 상태별 이모지. 색 CSS 와 함께 "무엇이 문제인가"를 한눈에 가른다. */
const AI_CONNECTION_ICON: Record<AiConnectionKind, string> = {
  ready: "🤖",
  checking: "⏳",
  disconnected: "🔑",
  offline: "🔌",
  error: "⚠️",
};

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
  /** 자격의 출처가 셸 환경 변수인가 — 에디터가 만들지도 지우지도 못한다. */
  readonly env?: boolean;
  /** OAuth 토큰이 만료됐는가. */
  readonly expired?: boolean;
  /** (A) 동반 서비스에 아예 닿지 못함. */
  readonly unreachable?: boolean;
  /** (B) 응답했지만 실패(4xx/5xx) — 서버가 알려준 오류 본문. */
  readonly serverMessage?: string;
}

/**
 * 에디터가 "연결됨"으로 인정하는가 — 감독 결정(2026-08-21): env 자격은 무시한다.
 * 정본은 chatgptOAuthClient.hasStoredCompanionCredential 이지만, 이 파일은 그 모듈을
 * **값으로 import 하지 않는다**(테스트가 vi.mock 으로 통째 교체하면 값이 사라진다 — 위 주석 참고).
 * 한 줄 술어라 여기서 계산한다.
 */
function isStoredCredential(status: CachedOAuthStatus): boolean {
  return status.connected && status.env !== true && status.expired !== true;
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
    // 판정은 llmClient.isProxyAuth 로 통일한다(예전에는 여기서 인라인 재구현했다).
    const proxyAuth = isProxyAuth(config);
    // baseUrl 을 **먼저** 본다. 예전에는 키를 먼저 봐서, 둘 다 빈 신규 설정에 "AI 키 없음" 이
    // 뜨고 "AI 엔드포인트 없음" 은 사실상 도달 불가였다 — 더 흔한 원인이 가려졌다.
    if (!config.baseUrl || !config.baseUrl.trim()) {
      return {
        kind: "disconnected",
        authMode: "apiKey",
        label: "AI 엔드포인트 없음",
        title: "주입된 게이트웨이 설정에 서버 주소(baseUrl)가 없습니다. 이 경로는 노드 스크립트·벤치마크 전용이며 에디터 UI 에는 없습니다.",
      };
    }
    if (!proxyAuth && (!config.apiKey || !config.apiKey.trim())) {
      return {
        kind: "disconnected",
        authMode: "apiKey",
        label: "AI 키 없음",
        title: "주입된 게이트웨이 설정에 키가 없습니다. 이 경로는 노드 스크립트·벤치마크 전용입니다.",
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
  // (B) 응답했지만 내부 오류 — "보조 프로그램이 켜져 있지 않아요" 안내는 사실과 다르다.
  // dev 서버와 단독 동반 서비스는 같은 pi-ai 워커를 쓰므로 npm run ai:oauth 는 해결책이 아니다.
  if (aiOAuthCachedStatus.serverMessage) {
    return {
      kind: "error",
      authMode: "chatgpt",
      label: "AI 보조 오류",
      title: `AI 보조 프로그램이 응답했지만 오류가 났어요. 개발 서버를 껐다 켜 보세요. 오류 내용: ${aiOAuthCachedStatus.serverMessage}`,
    };
  }
  // (A) 아예 닿지 못함 — 켜져 있지 않거나 응답이 없다는 뜻.
  if (aiOAuthCachedStatus.unreachable) {
    return {
      kind: "offline",
      authMode: "chatgpt",
      label: "AI 보조 프로그램 꺼짐",
      title: "AI 로그인을 도와줄 보조 프로그램이 응답하지 않아요. 명령어 창(터미널)에서 'npm run ai:oauth'를 실행하거나 개발 서버를 껐다 켜 보세요. 이 칩을 누르면 설정이 열려요.",
    };
  }
  if (isStoredCredential(aiOAuthCachedStatus)) {
    const failure = transportFailureStatus("chatgpt");
    if (failure) return failure;
    return {
      kind: "ready",
      authMode: "chatgpt",
      label: `AI 연결됨${aiOAuthCachedStatus.planType ? ` · ${aiOAuthCachedStatus.planType.toUpperCase()}` : ""}`,
      title: "구독 로그인으로 연결됨 · 로그인 정보는 이 PC 의 보조 프로그램이 보관·갱신해요.",
    };
  }
  // env 자격만 있는 상태를 "연결됨"이라 말하지 않는다(감독 결정) — 에디터가 지울 수 없는
  // 자격이라, 연결로 세면 연결 해제 버튼이 거짓이 되고 감독은 제어 못 하는 상태를 보게 된다.
  if (aiOAuthCachedStatus.env === true) {
    return {
      kind: "disconnected",
      authMode: "chatgpt",
      label: "AI 로그인 필요",
      title: "환경 변수로 들어온 자격만 있어요. 에디터가 관리하는 로그인이 아니라서 연결로 세지 않습니다. 이 칩을 눌러 로그인하세요.",
    };
  }
  if (aiOAuthCachedStatus.expired === true) {
    return {
      kind: "disconnected",
      authMode: "chatgpt",
      label: "AI 로그인 필요",
      title: "로그인이 만료됐어요. 이 칩을 눌러 다시 로그인하세요.",
    };
  }
  return {
    kind: "disconnected",
    authMode: "chatgpt",
    label: "AI 로그인 필요",
    title: "AI 기능을 쓰려면 로그인이 필요해요. 이 칩을 눌러 로그인하면 마을 만들기·NPC 배치·AI 채팅을 모두 쓸 수 있어요.",
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
    const next: CachedOAuthStatus = {
      connected: auth.connected,
      planType: auth.planType,
      env: auth.env,
      expired: auth.expired,
    };
    const changed =
      !aiOAuthCachedStatus ||
      aiOAuthCachedStatus.connected !== next.connected ||
      aiOAuthCachedStatus.planType !== next.planType ||
      aiOAuthCachedStatus.env !== next.env ||
      aiOAuthCachedStatus.expired !== next.expired ||
      aiOAuthCachedStatus.unreachable === true ||
      aiOAuthCachedStatus.serverMessage !== undefined;
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
    const next: CachedOAuthStatus = {
      connected: false,
      // (B) 는 serverMessage 로, (A) 는 unreachable 로 구분한다 — 칩 라벨·이모지·색이 갈린다.
      unreachable: serverMessage === undefined,
      serverMessage,
    };
    const changed =
      !aiOAuthCachedStatus ||
      aiOAuthCachedStatus.unreachable !== next.unreachable ||
      aiOAuthCachedStatus.serverMessage !== serverMessage ||
      aiOAuthCachedStatus.connected !== false;
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
  // 상태마다 다른 이모지를 준다 — 예전에는 세 갈래 삼항이 전부 같은 로봇 이모지를 돌려주어
  // 아이콘이 아무 정보도 싣지 않았고, 상태별 색 CSS 도 없어서 네 상태가 똑같이 보였다.
  const icon = AI_CONNECTION_ICON[status.kind];
  const button = el("button", {
    // auth-${authMode} 클래스는 걷었다 — 소비하는 스타일시트가 없고, 자격 종류는 이제 2값이 아니다.
    class: `editor-statusbar-cell ai-connection-status ${status.kind}`,
    attrs: { type: "button", title: status.title },
    children: [el("span", { class: "ai-connection-label", text: `${icon} ${status.label}` })],
    dataset: { testid: "ai-connection-status" },
    on: {
      click: () => {
        const current = getAiConnectionStatus();
        // 미연결이면 "지금 키를 넣어야 하는가"를 인증 패널이 판단하게 넘긴다.
        const focusTarget: AiSettingsFocus | undefined =
          current.kind === "disconnected" ? "apiKey" : undefined;
        openAiSettingsModal({
          focusTarget,
          // 칩에서 로그인·키 저장을 마치면 칩 자신이 즉시 진실해져야 한다. 예전에는 onSaved 를
          // 넘기지 않아 로그인한 뒤에도 낡은 캐시를 계속 보여 줬다.
          // (실행 중 AssistantSession 의 낡은 config 갱신은 aiChatPanel 이 맡는다 — 그 파일은
          //  동시 작업 중이라 여기서 배선하지 않았다. 후속 부채.)
          onSaved: () => {
            resetAiConnectionStatusCache();
            onRefresh();
            void refreshAiConnectionStatus(onRefresh);
          },
        });
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
