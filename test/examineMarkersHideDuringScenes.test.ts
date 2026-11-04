import { describe, expect, it, vi } from "vitest";

// 조사 ▼ 가 장면(scene.running) 동안 숨는지 — #4002 가 넣은 숨김을 #4001 이 옛 기준에서 머지하며 지웠다(첫사랑 r7 재회 장면).
// 실제 syncExamineMarkers 를 부르고, 맵 이벤트 뷰 하나(가까이 반짝임이 있는 사람)만 흉내 낸다.
vi.mock("@/project/runtimeEventState", () => ({
  runtimeEventViewById: () => undefined,
  runtimeEventViewsForMap: () => [{
    event: { id: "ev_lead", pages: [] },
    page: { nearSparkle: { radius: 3 } },
    sprite: { key: "lead" },
    trigger: { kind: "action" },
    bodyRect: { left: 6, right: 6, top: 4, bottom: 4 },
  }],
}));
vi.mock("@/project/store", () => ({ store: { getCurrent: () => ({ system: {}, maps: {} }) } }));

const { syncExamineMarkers } = await import("@/player/playSceneFieldStaging");

class Marker {
  visible = true;
  setVisible(v: boolean) { this.visible = v; return this; }
  setDepth() { return this; }
  setPosition() { return this; }
  setDisplaySize() { return this; }
  setAlpha() { return this; }
  destroy() {}
}

function fakeScene() {
  const made: Marker[] = [];
  const scene = {
    map: { id: "m1", width: 20, height: 15, tileSize: 16 },
    session: { currentMapId: "m1" },
    tileX: 4, tileY: 6,
    running: false,
    eventPositions: new Map(),
    autonomousNPCs: new Map(),
    textures: { exists: () => true },
    add: { image: () => { const m = new Marker(); made.push(m); return m; } },
  };
  return { scene, made };
}

describe("조사 표식은 장면이 도는 동안 숨는다", () => {
  it("장면 밖 → 보임, 장면 중 → 숨김, 장면 끝 → 다시 보임", () => {
    const { scene, made } = fakeScene();
    const run = (now: number) => syncExamineMarkers(scene as never, now);

    run(1000);
    expect(made).toHaveLength(1);
    expect(made[0]!.visible).toBe(true);

    scene.running = true;
    run(1300);
    expect(made.every((m) => !m.visible)).toBe(true);

    scene.running = false;
    run(1600);
    expect(made.some((m) => m.visible)).toBe(true);
  });
});
