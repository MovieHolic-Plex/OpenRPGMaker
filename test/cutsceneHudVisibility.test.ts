// 컷신 중 필드 HUD 억제. hideHud 는 Modern `Cutscene Control` 의 드롭다운 옵션으로만 존재하고
// 런타임 소비처가 없는 죽은 값이었다 — 미니맵·손 슬롯을 숨기는 유일한 경로가 대화창 `:has()`
// CSS 라, 대사가 없는 비트(카메라 팬·픽처)에서는 HUD 가 그대로 떠 있었다.
//
// 단정은 **프로덕션 경로**(syncRuntimeState)를 지난다. 리더 함수를 직접 부르면 호출 지점이
// syncRuntimeState 에서 사라져도 초록으로 남는다 — 그 구멍이 이 회귀의 원인이었다.
// 플래그·클래스 이름은 리터럴로 고정한다: 구현 상수를 import 해 비교하면 이름이 바뀌어도
// 통과하는 항등 단정이 된다(CSS 는 상수를 볼 수 없으므로 계약은 문자열 그 자체다).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { executeModernCommand } from "@/player/interpreter/m2ModernRuntime";
import { syncRuntimeState } from "@/player/playSceneMapRuntime";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

const HIDE_HUD_FLAG = "cutscene:hideHud";
const LOCK_FLAG = "cutscene:inputLocked";
const HUD_HIDDEN_CLASS = "cutscene-hud-hidden";

/** 스테이지가 붙은 최소 씬. 보이는 HUD 갱신 경로(비계측)만 지나간다. */
function sceneWithStage(stage: FakeElement) {
  const session = startSession(store.getCurrent());
  const scene = {
    game: { registry: { get: (key: string) => (key === "dialogueHost" ? stage : undefined) } },
    runtimeDom: {
      instrumented: false,
      syncPictureLayer: vi.fn(),
      syncVisibleHud: vi.fn(),
    },
    runtimeTimers: new Map(),
    session,
  };
  return { scene, session };
}

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  restoreDom = installFakeDom();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
});

describe("컷신 HUD 억제", () => {
  it("hideHud 플래그가 켜지면 스테이지에 억제 클래스가 붙는다", () => {
    // Given: 스테이지가 마운트된 씬과 HUD 숨김을 요청한 컷신.
    const stage = new FakeElement("div");
    stage.className = "play-stage";
    const { scene, session } = sceneWithStage(stage);
    session.flags[HIDE_HUD_FLAG] = true;

    // When: 런타임이 보이는 표면을 동기화한다.
    syncRuntimeState(scene as never);

    // Then: HUD 억제 클래스가 붙는다.
    expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
  });

  it("입력 잠금 중에도 억제된다 — 대사 없는 비트(카메라 팬·픽처)를 포함한다", () => {
    // Given: 대화 오버레이가 비어 있는(자식이 없는) 스테이지와 입력 잠금.
    const stage = new FakeElement("div");
    stage.className = "play-stage";
    const { scene, session } = sceneWithStage(stage);
    session.flags[LOCK_FLAG] = true;
    expect(stage.childNodes.length).toBe(0);

    // When: 런타임이 보이는 표면을 동기화한다.
    syncRuntimeState(scene as never);

    // Then: 대화창 `:has()` 규칙에 의존하지 않고 억제된다.
    expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
  });

  it("컷신이 끝나면 억제 클래스를 걷어낸다", () => {
    // Given: 이전 컷신의 억제 클래스가 남은 스테이지, 플래그는 모두 꺼져 있다.
    const stage = new FakeElement("div");
    stage.className = `play-stage ${HUD_HIDDEN_CLASS}`;
    const { scene } = sceneWithStage(stage);

    // When: 런타임이 보이는 표면을 동기화한다.
    syncRuntimeState(scene as never);

    // Then: 남은 억제 클래스가 사라진다(HUD 가 영구히 숨는 것을 막는다).
    expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(false);
  });

  it("Modern `Cutscene Control` 의 HUD 숨김 액션이 억제까지 이어진다", () => {
    // Given: 스테이지가 마운트된 씬(잠금은 걸지 않는다 — hideHud 단독 경로를 본다).
    const stage = new FakeElement("div");
    stage.className = "play-stage";
    const { scene, session } = sceneWithStage(stage);

    // When: 작가가 실제로 배치하는 Modern 커맨드를 그대로 실행하고 표면을 동기화한다.
    executeModernCommand(session, ensureM2Runtime(session), "Cutscene Control", {
      action: "hideHud",
      enabled: true,
    });
    syncRuntimeState(scene as never);

    // Then: 커맨드가 심은 플래그가 리더가 읽는 키와 같아서 HUD 가 숨는다.
    expect(session.flags[HIDE_HUD_FLAG]).toBe(true);
    expect(stage.classList.contains(HUD_HIDDEN_CLASS)).toBe(true);
  });

  it("억제 클래스가 미니맵과 손 슬롯을 실제로 숨긴다", async () => {
    // Given: 런타임 플레이 서페이스 시트.
    const css = await readFile(
      fileURLToPath(new URL("../src/styles/runtime/playSurface.css", import.meta.url)),
      "utf8",
    );

    // When: display:none 을 선언한 규칙의 선택자만 모은다.
    const suppressionSelectors = Array.from(
      css.matchAll(/([^{}]+)\{([^{}]*)\}/gu),
      ([, selectors, declarations]) => ({ declarations, selectors }),
    )
      .filter(({ declarations }) => /display:\s*none/u.test(declarations))
      .map(({ selectors }) => selectors)
      .join("\n");

    // Then: 두 필드 HUD 표면이 모두 억제 대상이다.
    expect(suppressionSelectors).toContain(`.play-stage.${HUD_HIDDEN_CLASS} .minimap-root`);
    expect(suppressionSelectors).toContain(`.play-stage.${HUD_HIDDEN_CLASS} .hand-slot`);
  });
});
