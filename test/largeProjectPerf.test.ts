import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { createLargeProjectFixture } from "./fixtures/largeProject";

describe("large project performance fixture", () => {
  it("50맵 40x40 프로젝트의 로드, 직렬화 크기, 100틱 scene test 시간을 느슨한 예산으로 실측한다", () => {
    const project = createLargeProjectFixture();
    const raw = serialize(project);

    const loadStart = performance.now();
    const reloaded = deserialize(raw);
    const loadMs = performance.now() - loadStart;

    const serializedSize = new TextEncoder().encode(serialize(reloaded)).length;

    const sceneStart = performance.now();
    const scene = runSceneTest(reloaded, {
      mapId: reloaded.startMapId,
      start: reloaded.startPos,
      steps: [
        { kind: "wait", ticks: 100 },
        { kind: "expect", playerAt: { ...reloaded.startPos, mapId: reloaded.startMapId } },
      ],
    });
    const sceneMs = performance.now() - sceneStart;

    expect(Object.keys(reloaded.maps)).toHaveLength(50);
    expect(scene.ok, scene.failureReason).toBe(true);
    expect(loadMs).toBeLessThan(6_000);
    expect(serializedSize).toBeLessThan(12 * 1024 * 1024);
    expect(sceneMs).toBeLessThan(4_500);
  });
});
