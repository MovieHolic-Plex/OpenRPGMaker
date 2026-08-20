// player/hostBridge.ts
// 커뮤니티 호스팅 셸(__OPENRPG_BOOT__)의 returnUrl/hostFeatures 브릿지.
// 순수 파싱/검증 로직과 얇은 DOM 어댑터(전체화면 토글 마운트)를 분리해 테스트 가능하게 유지한다.
// 잘못된 타입은 조용히 무시한다 — 호스트 주입값 때문에 부트가 실패해서는 안 된다.
import { el } from "@/util/dom";

export type HostFeature = "exit" | "fullscreen";

export interface HostBridge {
  /** 검증을 통과한 same-origin 상대 경로 복귀 URL. 없거나 불신이면 null. */
  readonly returnUrl: string | null;
  /** 인식된 호스트 기능만("exit"/"fullscreen"), 중복 제거·순서 보존. */
  readonly hostFeatures: readonly HostFeature[];
}

const KNOWN_HOST_FEATURES: readonly HostFeature[] = ["exit", "fullscreen"];

function isHostFeature(value: unknown): value is HostFeature {
  return typeof value === "string" && (KNOWN_HOST_FEATURES as readonly string[]).includes(value);
}

/**
 * returnUrl 안전성 검증: same-origin 상대 경로만 허용.
 * - "/"로 시작해야 한다(스킴 포함 URL·"javascript:" 등은 여기서 걸러진다).
 * - "//host"(프로토콜 상대)와 "/\\host"(일부 브라우저가 \\를 /로 정규화) 는 거부.
 */
export function isSafeReturnUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!value.startsWith("/")) return false;
  const second = value.charAt(1);
  if (second === "/" || second === "\\") return false;
  return true;
}

/** hostFeatures 파싱: 배열이 아니면 빈 배열, 인식 불가/오타입 항목은 무시, 중복 제거. */
export function parseHostFeatures(value: unknown): HostFeature[] {
  if (!Array.isArray(value)) return [];
  const features: HostFeature[] = [];
  for (const entry of value) {
    if (isHostFeature(entry) && !features.includes(entry)) features.push(entry);
  }
  return features;
}

/** __OPENRPG_BOOT__ 원시 객체에서 호스트 브릿지 설정을 방어적으로 파싱한다. */
export function parseHostBridge(raw: unknown): HostBridge {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  return {
    returnUrl: isSafeReturnUrl(source.returnUrl) ? source.returnUrl : null,
    hostFeatures: parseHostFeatures(source.hostFeatures),
  };
}

/** "exit" 기능이 켜져 있고 유효한 returnUrl이 있을 때만 복귀 URL을 돌려준다. 아니면 null(기존 폴백 유지). */
export function hostExitReturnUrl(bridge: HostBridge | undefined): string | null {
  if (!bridge || !bridge.hostFeatures.includes("exit")) return null;
  return bridge.returnUrl;
}

export type FullscreenToggleOptions = {
  readonly bridge: HostBridge | undefined;
  /** 버튼을 붙일 플레이 뷰포트(.play-viewport) — --play-scale 변수를 가진 요소. */
  readonly viewport: HTMLElement;
  /** requestFullscreen 대상 — 플레이어 루트 컨테이너. */
  readonly fullscreenRoot: HTMLElement;
};

/**
 * hostFeatures에 "fullscreen"이 있을 때만 스테이지 우상단에 포인터 전용 토글 버튼을 마운트한다.
 * Fullscreen API가 없는 환경(happy-dom 등)이나 에디터 테스트플레이(bridge 없음)에서는 아무것도 하지 않는다.
 * 게임플레이는 키보드 전용이므로 tabIndex=-1 + pointerdown preventDefault 로 포커스/키 입력과 절대 간섭하지 않는다.
 * @returns 마운트 시 정리 함수, 미마운트 시 null.
 */
export function mountHostFullscreenToggle(options: FullscreenToggleOptions): (() => void) | null {
  const { bridge, viewport, fullscreenRoot } = options;
  if (!bridge || !bridge.hostFeatures.includes("fullscreen")) return null;
  const doc = viewport.ownerDocument;
  if (
    typeof (fullscreenRoot as { requestFullscreen?: unknown }).requestFullscreen !== "function"
    || typeof (doc as { exitFullscreen?: unknown }).exitFullscreen !== "function"
  ) {
    return null;
  }

  const button = el("button", {
    class: "play-fullscreen-toggle",
    text: "⛶",
    dataset: {
      testid: "play-fullscreen-toggle",
      // playInputBlocker 는 실사용자 포인터를 막지만 touch-controls 소유 표식은 통과시킨다.
      // 이 버튼은 포인터 전용 셸 컨트롤이므로 같은 소유권 경로를 재사용한다(블로커 파일 수정 금지).
      playInputOwner: "touch-controls",
    },
    attrs: {
      type: "button",
      tabindex: "-1",
      "aria-pressed": "false",
      "aria-label": "전체화면 전환",
      title: "전체화면 전환",
    },
  });

  const syncState = (): void => {
    button.setAttribute("aria-pressed", String(Boolean(doc.fullscreenElement)));
  };

  const onPointerDown = (event: Event): void => {
    // 클릭으로 버튼이 포커스를 가져가면 이후 Enter/Space 가 게임 확인키와 겹친다 — 포커스 획득 자체를 차단.
    event.preventDefault();
  };

  const onClick = (): void => {
    try {
      const request = doc.fullscreenElement
        ? doc.exitFullscreen()
        : fullscreenRoot.requestFullscreen();
      void Promise.resolve(request).catch(() => {
        /* 제스처 요건/권한 실패는 조용히 무시 — 게임 진행에 영향 금지 */
      });
    } catch {
      /* 동기 예외(비표준 구현)도 부트/플레이를 깨지 않는다 */
    }
  };

  button.addEventListener("pointerdown", onPointerDown);
  button.addEventListener("click", onClick);
  doc.addEventListener("fullscreenchange", syncState);
  syncState();
  viewport.append(button);

  return () => {
    doc.removeEventListener("fullscreenchange", syncState);
    button.remove();
  };
}
