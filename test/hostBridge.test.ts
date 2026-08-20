/** @vitest-environment happy-dom */
// 커뮤니티 호스팅 브릿지(__OPENRPG_BOOT__ returnUrl/hostFeatures) 파싱·검증과
// 전체화면 토글 버튼의 마운트/미마운트 조건을 검증한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hostExitReturnUrl,
  isSafeReturnUrl,
  mountHostFullscreenToggle,
  parseHostBridge,
  parseHostFeatures,
  type HostBridge,
} from "@/player/hostBridge";

describe("isSafeReturnUrl — same-origin 상대 경로만 허용", () => {
  it("'/'로 시작하는 상대 경로를 허용한다", () => {
    expect(isSafeReturnUrl("/ko/games/my-game")).toBe(true);
    expect(isSafeReturnUrl("/")).toBe(true);
    expect(isSafeReturnUrl("/en/games/slug?tab=info#top")).toBe(true);
  });

  it("스킴 포함 절대 URL을 거부한다", () => {
    expect(isSafeReturnUrl("https://evil.example/phish")).toBe(false);
    expect(isSafeReturnUrl("http://evil.example")).toBe(false);
    expect(isSafeReturnUrl("javascript:alert(1)")).toBe(false);
  });

  it("프로토콜 상대('//')와 백슬래시 변종('/\\\\')을 거부한다", () => {
    expect(isSafeReturnUrl("//evil.example/games")).toBe(false);
    expect(isSafeReturnUrl("/\\evil.example")).toBe(false);
  });

  it("미설정/오타입/빈 문자열을 거부한다", () => {
    expect(isSafeReturnUrl(undefined)).toBe(false);
    expect(isSafeReturnUrl(null)).toBe(false);
    expect(isSafeReturnUrl(123)).toBe(false);
    expect(isSafeReturnUrl("")).toBe(false);
    expect(isSafeReturnUrl("games/relative-without-slash")).toBe(false);
  });
});

describe("parseHostFeatures — 인식된 기능만, 오타입은 조용히 무시", () => {
  it("정상 배열에서 exit/fullscreen 을 파싱한다", () => {
    expect(parseHostFeatures(["exit", "fullscreen"])).toEqual(["exit", "fullscreen"]);
  });

  it("배열이 아니면 빈 배열", () => {
    expect(parseHostFeatures("exit")).toEqual([]);
    expect(parseHostFeatures({ exit: true })).toEqual([]);
    expect(parseHostFeatures(undefined)).toEqual([]);
    expect(parseHostFeatures(null)).toEqual([]);
  });

  it("부분 유효: 알 수 없는 항목/오타입/중복을 걸러낸다", () => {
    expect(parseHostFeatures(["exit", "unknown", 42, null, "fullscreen", "exit"]))
      .toEqual(["exit", "fullscreen"]);
    expect(parseHostFeatures(["EXIT", "Fullscreen"])).toEqual([]);
  });
});

describe("parseHostBridge — 부트 객체 방어 파싱(부트 실패 금지)", () => {
  it("returnUrl + hostFeatures 를 함께 파싱한다", () => {
    expect(parseHostBridge({
      projectUrl: "https://cdn.example/p.json",
      returnUrl: "/ko/games/slug",
      hostFeatures: ["exit", "fullscreen"],
    })).toEqual({ returnUrl: "/ko/games/slug", hostFeatures: ["exit", "fullscreen"] });
  });

  it("잘못된 returnUrl 은 null 로 강등된다", () => {
    expect(parseHostBridge({ returnUrl: "https://evil.example" }).returnUrl).toBeNull();
    expect(parseHostBridge({ returnUrl: 42 }).returnUrl).toBeNull();
    expect(parseHostBridge({}).returnUrl).toBeNull();
  });

  it("비객체 입력(undefined/null/문자열)도 빈 브릿지로 흡수한다", () => {
    for (const raw of [undefined, null, "boot", 7]) {
      expect(parseHostBridge(raw)).toEqual({ returnUrl: null, hostFeatures: [] });
    }
  });
});

describe("hostExitReturnUrl — exit 기능이 켜졌을 때만 복귀 URL", () => {
  const bridge = (returnUrl: string | null, hostFeatures: readonly ("exit" | "fullscreen")[]): HostBridge =>
    ({ returnUrl, hostFeatures });

  it("exit + 유효 returnUrl → 복귀 URL", () => {
    expect(hostExitReturnUrl(bridge("/en/games/a", ["exit"]))).toBe("/en/games/a");
  });

  it("exit 미포함이면 returnUrl 이 있어도 null(기존 안내 폴백 유지)", () => {
    expect(hostExitReturnUrl(bridge("/en/games/a", []))).toBeNull();
    expect(hostExitReturnUrl(bridge("/en/games/a", ["fullscreen"]))).toBeNull();
  });

  it("exit 이 있어도 returnUrl 이 없으면 null", () => {
    expect(hostExitReturnUrl(bridge(null, ["exit"]))).toBeNull();
  });

  it("브릿지 자체가 없으면(에디터 테스트플레이) null", () => {
    expect(hostExitReturnUrl(undefined)).toBeNull();
  });
});

describe("mountHostFullscreenToggle — 버튼 마운트/미마운트 조건", () => {
  const fullscreenBridge: HostBridge = { returnUrl: "/ko/games/a", hostFeatures: ["fullscreen"] };
  let restoreExitFullscreen: (() => void) | null = null;

  const makeHost = (): { viewport: HTMLElement; root: HTMLElement } => {
    const root = document.createElement("div");
    const viewport = document.createElement("div");
    root.append(viewport);
    return { viewport, root };
  };

  const stubFullscreenApi = (root: HTMLElement): void => {
    Object.defineProperty(root, "requestFullscreen", {
      configurable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    const doc = document as unknown as Record<string, unknown>;
    const hadOwn = Object.prototype.hasOwnProperty.call(doc, "exitFullscreen");
    const previous = doc["exitFullscreen"];
    doc["exitFullscreen"] = vi.fn(() => Promise.resolve());
    restoreExitFullscreen = () => {
      if (hadOwn) doc["exitFullscreen"] = previous;
      else delete doc["exitFullscreen"];
    };
  };

  afterEach(() => {
    restoreExitFullscreen?.();
    restoreExitFullscreen = null;
  });

  it("브릿지가 없으면(에디터 테스트플레이) 아무것도 렌더하지 않는다", () => {
    const { viewport, root } = makeHost();
    stubFullscreenApi(root);
    const cleanup = mountHostFullscreenToggle({ bridge: undefined, viewport, fullscreenRoot: root });
    expect(cleanup).toBeNull();
    expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
  });

  it("hostFeatures 에 fullscreen 이 없으면 마운트하지 않는다", () => {
    const { viewport, root } = makeHost();
    stubFullscreenApi(root);
    const exitOnly: HostBridge = { returnUrl: "/ko/games/a", hostFeatures: ["exit"] };
    expect(mountHostFullscreenToggle({ bridge: exitOnly, viewport, fullscreenRoot: root })).toBeNull();
    expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
  });

  it("Fullscreen API 부재(happy-dom 기본)에서는 안전하게 no-op", () => {
    const { viewport, root } = makeHost();
    Object.defineProperty(root, "requestFullscreen", { configurable: true, value: undefined });
    expect(mountHostFullscreenToggle({ bridge: fullscreenBridge, viewport, fullscreenRoot: root })).toBeNull();
    expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
  });

  it("fullscreen 기능 + API 존재 → 포인터 전용 버튼을 마운트하고 cleanup 으로 제거한다", () => {
    const { viewport, root } = makeHost();
    stubFullscreenApi(root);
    const cleanup = mountHostFullscreenToggle({ bridge: fullscreenBridge, viewport, fullscreenRoot: root });
    expect(cleanup).toBeTypeOf("function");
    const button = viewport.querySelector<HTMLButtonElement>("[data-testid='play-fullscreen-toggle']");
    expect(button).not.toBeNull();
    // 키보드 전용 게임 입력과 간섭 금지: Tab 순회 제외 + 포인터 소유권 표식.
    expect(button?.getAttribute("tabindex")).toBe("-1");
    expect(button?.dataset.playInputOwner).toBe("touch-controls");
    expect(button?.getAttribute("aria-pressed")).toBe("false");
    cleanup?.();
    expect(viewport.querySelector("[data-testid='play-fullscreen-toggle']")).toBeNull();
  });
});
