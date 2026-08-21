/** @vitest-environment happy-dom */
/**
 * 농사 실패 안내 채널 회귀 테스트.
 *
 * 두 개의 함정을 못으로 박는다:
 *  1) session.m2Runtime.ui 는 surface+message 로 세션 전체를 중복 제거하고 세이브에 직렬화된다.
 *     같은 실패 사유를 몇 번이든 다시 띄울 수 있어야 하고, 세션은 건드려지지 않아야 한다.
 *  2) handleAction 은 한 번의 A 입력에 정면·발밑 두 타일을 시도한다. 안내는 최대 한 번.
 */
import { describe, expect, it, vi } from "vitest";
import * as zoneFeedback from "@/player/playSceneZoneFeedback";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { setEquippedTool } from "@/project/toolActions";
import { farmIgnoreMessage, farmIntentForHand, interactWithFarmPlot } from "@/player/farming";
import { ensureM2Runtime } from "@/player/interpreter/m2RuntimeState";
import { handleAction } from "@/player/playSceneMovement";

const showSpy = vi.hoisted(() => vi.fn());

// playSceneMovement 가 실제로 채널을 몇 번 호출하는지 세려면 모듈 경계에서 가로채야 한다.
// 통과(passthrough) 라 실제 채널 동작도 그대로 검증된다.
vi.mock("@/player/playSceneZoneFeedback", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof zoneFeedback;
  return {
    ...actual,
    showFarmFeedbackMessage: (scene: object, message: string): void => {
      showSpy(message);
      actual.showFarmFeedbackMessage(scene, message);
    },
  };
});

type ActionScene = Parameters<typeof handleAction>[0];

// 밭은 map.farmableArea = [{ x: 4, y: 5, w: 6, h: 4 }] — 발밑과 정면 모두 밭 안이다.
const UNDERFOOT = { x: 5, y: 6 } as const;
const FACING = { x: 5, y: 5 } as const;

function farmScene() {
  const project = createFarmingDemoProject();
  store.replaceProject(project);
  const session = startSession(project);
  const map = project.maps[project.startMapId]!;
  session.currentMapId = map.id;
  // 씨앗을 손에 들면 경작 시도가 도구 불일치로 거부된다 — 반복 가능한 실패 사유.
  setEquippedTool(session, "item_potato_seed");
  const scene: ActionScene = {
    autonomousNPCs: new Map(),
    eventPositions: {},
    eventSprites: new Map(),
    facing: "up",
    lastActionTargetKey: "",
    map,
    runEvent: async () => undefined,
    session,
    tileX: UNDERFOOT.x,
    tileY: UNDERFOOT.y,
  };
  return { map, project, scene, session };
}

describe("farm failure feedback channel", () => {
  it("surfaces the same ignore reason on every press and never writes to the session", () => {
    const { project, scene, session } = farmScene();
    showSpy.mockClear();
    const probe = interactWithFarmPlot(
      project,
      session,
      scene.map,
      FACING.x,
      FACING.y,
      farmIntentForHand(project, session),
    );
    expect(probe.kind).toBe("ignored");
    const expected = farmIgnoreMessage(probe.reason);
    expect(expected).toBeTruthy();

    handleAction(scene);
    handleAction(scene);

    // m2Runtime 경로였다면 두 번째는 중복 제거로 사라졌을 것이다.
    expect(showSpy.mock.calls).toEqual([[expected], [expected]]);
    expect(zoneFeedback.peekFarmFeedbackMessage(scene)).toBe(expected);
    expect(session.m2Runtime?.ui ?? []).toHaveLength(0);
  });

  it("emits at most one message per action press even though two tiles are tried", () => {
    const { project, scene, session } = farmScene();
    showSpy.mockClear();
    // 정면과 발밑이 모두 밭이라 두 번 시도되고 두 번 거부된다.
    for (const tile of [FACING, UNDERFOOT]) {
      expect(
        interactWithFarmPlot(project, session, scene.map, tile.x, tile.y, farmIntentForHand(project, session)).kind,
      ).toBe("ignored");
    }

    const handled = handleAction(scene);

    expect(handled).toBe(false);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("stays silent when the hand is empty on a non-farmable tile", () => {
    const { scene, session } = farmScene();
    setEquippedTool(session, undefined);
    scene.tileX = 0;
    scene.tileY = 0;
    showSpy.mockClear();

    handleAction(scene);

    // "not-farmable" 은 필드에서 A 를 누를 때마다 발생하므로 반드시 조용해야 한다.
    expect(showSpy).not.toHaveBeenCalled();
  });

  it("never lets a farm message steal a live checkpoint toast", () => {
    const { scene, session } = farmScene();
    const host = document.createElement("div");
    const sceneWithHost = {
      ...scene,
      activeRuntimeEvents: () => [],
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
    };
    const feedback = zoneFeedback.createPlaySceneZoneFeedback(session);
    const runtime = ensureM2Runtime(session);
    runtime.ui = [{ surface: "checkpoint", message: "체크포인트에 기록되었습니다", durationMs: 3000 }];

    // 체크포인트 안내가 떠 있는 동안 농사 안내가 뒤덮는다.
    zoneFeedback.syncPlaySceneZoneFeedback(sceneWithHost, feedback, 16);
    zoneFeedback.showFarmFeedbackMessage(sceneWithHost, "괭이가 필요합니다");
    zoneFeedback.syncPlaySceneZoneFeedback(sceneWithHost, feedback, 16);

    // 체크포인트는 한 번뿐이라 가려지면 영영 사라진다 — 반복 가능한 농사 안내가 기다린다.
    expect(host.querySelector("[data-testid='zone-feedback-toast']")?.textContent).toBe(
      "체크포인트에 기록되었습니다",
    );

    // 체크포인트(3000ms)가 만료되면 농사 안내가 그제서야 줄을 차지한다.
    zoneFeedback.syncPlaySceneZoneFeedback(sceneWithHost, feedback, 3000);
    zoneFeedback.showFarmFeedbackMessage(sceneWithHost, "괭이가 필요합니다");
    zoneFeedback.syncPlaySceneZoneFeedback(sceneWithHost, feedback, 16);
    expect(host.querySelector("[data-testid='zone-feedback-toast']")?.textContent).toBe("괭이가 필요합니다");
  });

  it("renders the transient message on the zone-feedback toast line and expires it", () => {
    const { scene, session } = farmScene();
    const host = document.createElement("div");
    const sceneWithHost = {
      ...scene,
      activeRuntimeEvents: () => [],
      game: { registry: { get: (key: string) => (key === "dialogueHost" ? host : undefined) } },
    };
    const feedback = zoneFeedback.createPlaySceneZoneFeedback(session);

    zoneFeedback.showFarmFeedbackMessage(sceneWithHost, "괭이가 필요합니다");
    zoneFeedback.syncPlaySceneZoneFeedback(sceneWithHost, feedback, 16);

    expect(host.querySelector("[data-testid='zone-feedback-toast']")?.textContent).toBe("괭이가 필요합니다");
    expect(session.m2Runtime?.ui ?? []).toHaveLength(0);

    zoneFeedback.syncPlaySceneZoneFeedback(sceneWithHost, feedback, 5000);
    expect(zoneFeedback.peekFarmFeedbackMessage(sceneWithHost)).toBeNull();
  });
});
