import { describe, expect, it } from "vitest";
import {
  HORROR_MYSTERY_ENDING_IDS,
  HORROR_MYSTERY_ITEM_ID,
  HORROR_MYSTERY_MAP_IDS,
  HORROR_MYSTERY_SWITCH_IDS,
  createHorrorMysteryPrototypeProject,
} from "@/project/examples/horrorMysteryPrototype";
import type { Command, GameEvent } from "@/project/types";
import { projectLint } from "@/project/lint/projectLint";
import { runSceneTest } from "@/testing/sceneTestRunner";

function commandsOf(event: GameEvent): Command[] {
  return (event.pages ?? []).flatMap((page) => page.commands ?? []);
}

describe("horror mystery playable prototype", () => {
  it("빈 프로젝트로 퇴행하면 세 개의 Interior 칩셋 장면 계약이 깨진다", () => {
    const { project } = createHorrorMysteryPrototypeProject();
    const expectedMapIds = Object.values(HORROR_MYSTERY_MAP_IDS);

    expect(Object.keys(project.maps).sort()).toEqual([...expectedMapIds].sort());
    expect(project.startMapId).toBe(HORROR_MYSTERY_MAP_IDS.gallery);
    expect(project.system.titleScreen).toEqual(expect.objectContaining({
      title: "푸른 액자의 밤",
      musicResourceId: "cc0-bgm-dungeon",
      backgroundResourceId: "horror-mystery-blue-gallery",
    }));
    expect(project.maps[HORROR_MYSTERY_MAP_IDS.gallery]?.bgm).toEqual({
      mode: "custom",
      resourceId: "cc0-bgm-dungeon",
      fadeInMs: 800,
    });
    expect(project.maps[HORROR_MYSTERY_MAP_IDS.chase]?.bgm).toEqual({
      mode: "custom",
      resourceId: "cc0-bgm-battle",
      fadeInMs: 250,
    });
    expect(project.maps[HORROR_MYSTERY_MAP_IDS.finale]?.bgm).toEqual({
      mode: "custom",
      resourceId: "cc0-bgm-dungeon",
      fadeInMs: 1000,
    });
    for (const mapId of expectedMapIds) {
      const map = project.maps[mapId];
      expect(map, mapId).toBeDefined();
      expect(map?.tilesetId, mapId).toBe("easyrpg_chipset_interior");
      expect(new Set(map?.lowerTiles).size, `${mapId} lower layer`).toBeGreaterThan(4);
      expect(map?.upperTiles.some((tile) => tile >= 0), `${mapId} upper layer`).toBe(true);
    }
  });

  it("조사·복합 퍼즐·추격/재시도·선택 엔딩이 실제 이벤트 문법으로 연결된다", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const gallery = project.maps[HORROR_MYSTERY_MAP_IDS.gallery]!;
    const chase = project.maps[HORROR_MYSTERY_MAP_IDS.chase]!;
    const finale = project.maps[HORROR_MYSTERY_MAP_IDS.finale]!;

    expect(project.database.items).toContainEqual(expect.objectContaining({
      id: "item_blue_restoration_key",
      name: "푸른 복원 열쇠",
    }));
    expect(gallery.events.length).toBeGreaterThanOrEqual(10);
    expect(gallery.events.flatMap(commandsOf).map((command) => command.kind)).toEqual(
      expect.arrayContaining(["changeItem", "setSwitch", "transfer"]),
    );
    const keyEvent = gallery.events.find((event) => event.id === manifest.gallery.keyEventId)!;
    const keyText = commandsOf(keyEvent)
      .filter((command) => command.kind === "text")
      .map((command) => command.body);
    expect(keyText).toContain("푸른 복원 열쇠를 얻었다.");
    expect(keyText.join(" ")).not.toContain("을(를)");

    const galleryExit = gallery.events.find((event) => commandsOf(event).some((command) => command.kind === "transfer"));
    expect(galleryExit?.pages?.[0]?.conditions).toEqual([
      {
        kind: "all",
        conditions: [
          { kind: "switch", switchId: "sw_blue_key_used", value: true },
          { kind: "switch", switchId: "sw_gallery_sequence", value: true },
        ],
      },
    ]);

    expect(chase.events.filter((event) => commandsOf(event).some((command) => command.kind === "killPlayer"))).toHaveLength(4);
    for (const lethalEvent of chase.events.filter((event) =>
      commandsOf(event).some((command) => command.kind === "killPlayer")
    )) {
      expect(commandsOf(lethalEvent).slice(0, 2).map((command) => command.kind)).toEqual([
        "playAudio",
        "killPlayer",
      ]);
      expect(commandsOf(lethalEvent)[0]).toEqual(expect.objectContaining({ loop: false }));
    }
    expect(chase.events.some((event) => commandsOf(event).some((command) => command.kind === "checkpointSave"))).toBe(true);
    expect(chase.safeZones?.length).toBeGreaterThanOrEqual(1);

    expect(project.endings).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "ending_restore_truth", name: "진실을 복원한 밤" }),
      expect.objectContaining({ id: "ending_leave_it_blue", name: "푸른 채로 남긴 밤" }),
    ]));
    const endingIds = finale.events.flatMap(commandsOf).flatMap((command) =>
      command.kind === "triggerEnding" && command.endingId ? [command.endingId] : [],
    );
    expect(endingIds).toEqual(expect.arrayContaining(["ending_restore_truth", "ending_leave_it_blue"]));
  });

  it("열쇠 획득과 종 순서 해결 뒤에만 서비스 복도로 이동한다", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const exit = project.maps[HORROR_MYSTERY_MAP_IDS.gallery]!.events.find(
      (event) => event.id === manifest.gallery.exitEventId,
    )!;
    const [left, center, right] = manifest.gallery.sequenceAt;
    const result = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.gallery,
      start: manifest.gallery.keyAt,
      steps: [
        { kind: "interact" },
        { kind: "expect", inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 1 } },
        { kind: "set", x: manifest.gallery.itemGateAt.x, y: manifest.gallery.itemGateAt.y },
        { kind: "interact" },
        { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.keyUsed, inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 0 } },
        { kind: "set", x: center!.x, y: center!.y },
        { kind: "interact" },
        { kind: "set", x: left!.x, y: left!.y },
        { kind: "interact" },
        { kind: "set", x: right!.x, y: right!.y },
        { kind: "interact" },
        { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.sequenceSolved },
        { kind: "set", x: exit.x, y: exit.y - 1 },
        { kind: "move", dir: "down" },
        { kind: "expect", mapId: HORROR_MYSTERY_MAP_IDS.chase },
      ],
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
    expect(result.finalState.mapId).toBe(HORROR_MYSTERY_MAP_IDS.chase);
  });

  // NAME THE BREAK: removing checkpoint state (switch/inventory) restore must fail this.
  // checkpointSave captures the whole session, retryCheckpoint restores it; a change
  // made AFTER the map-entry checkpoint must be rolled back to the snapshot, not kept.
  it("체크포인트 재시도로 위치만이 아니라 전환·인벤토리 상태가 복원된다", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const trap = manifest.chase.trapAt[1] ?? manifest.chase.trapAt[0];
    const start = { x: trap.x - 1, y: trap.y };
    const result = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.chase,
      start,
      steps: [
        { kind: "set", switches: { [HORROR_MYSTERY_SWITCH_IDS.keyFound]: true }, inventory: { [HORROR_MYSTERY_ITEM_ID]: 1 } },
        { kind: "move", dir: "right" },
        { kind: "expect", gameOver: true },
        { kind: "retryCheckpoint" },
        { kind: "expect", gameOver: false, playerAt: { ...start, mapId: HORROR_MYSTERY_MAP_IDS.chase } },
        { kind: "expect", switchOff: HORROR_MYSTERY_SWITCH_IDS.keyFound },
        { kind: "expect", inventoryCount: { itemId: HORROR_MYSTERY_ITEM_ID, count: 0 } },
      ],
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
    expect(result.finalState.switchesOn).not.toContain(HORROR_MYSTERY_SWITCH_IDS.keyFound);
  });

  it("추격자에게 붙잡힌 뒤 체크포인트 재시도로 같은 위치에서 회복한다", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const start = { x: manifest.chase.chaserAt.x - 2, y: manifest.chase.chaserAt.y };
    const result = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.chase,
      start,
      steps: [
        { kind: "wait", ticks: 140 },
        { kind: "expect", gameOver: true },
        { kind: "retryCheckpoint" },
        { kind: "expect", gameOver: false, playerAt: { ...start, mapId: HORROR_MYSTERY_MAP_IDS.chase } },
      ],
    });

    expect(result.ok, result.failureReason ?? result.log.join("\n")).toBe(true);
  });

  it("복원사의 증언을 들은 선택과 즉시 탈출 선택이 서로 다른 엔딩에 도달한다", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();
    const truth = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.finale,
      start: manifest.finale.truthAt,
      steps: [
        { kind: "interact" },
        { kind: "expect", switchOn: HORROR_MYSTERY_SWITCH_IDS.truthHeard },
        { kind: "set", x: manifest.finale.truthEndingAt.x, y: manifest.finale.truthEndingAt.y },
        { kind: "interact" },
        { kind: "expect", endingReached: HORROR_MYSTERY_ENDING_IDS.truth },
      ],
    });
    const escape = runSceneTest(project, {
      mapId: HORROR_MYSTERY_MAP_IDS.finale,
      start: manifest.finale.escapeEndingAt,
      steps: [
        { kind: "interact" },
        { kind: "expect", endingReached: HORROR_MYSTERY_ENDING_IDS.escape },
      ],
    });

    expect(truth.ok, truth.failureReason ?? truth.log.join("\n")).toBe(true);
    expect(escape.ok, escape.failureReason ?? escape.log.join("\n")).toBe(true);
  });

  it("새 무결성 경고 없이 조사 밀도·퍼즐 다양성·압박·회복·결말 선택의 플레이테스트 준비 신호를 갖춘다", () => {
    const { project, manifest } = createHorrorMysteryPrototypeProject();

    expect(projectLint(project).filter((issue) => issue.severity === "error")).toEqual([]);
    expect(manifest.gallery.clueEventIds).toHaveLength(6);
    expect(manifest.gallery.sequenceEventIds).toHaveLength(3);
    expect(manifest.chase.trapEventIds).toHaveLength(3);
    expect(project.maps[HORROR_MYSTERY_MAP_IDS.chase]!.safeZones).toHaveLength(1);
    expect(project.endings).toHaveLength(2);
    expect(new Set(project.endings!.map((ending) => ending.id))).toEqual(new Set(Object.values(HORROR_MYSTERY_ENDING_IDS)));
  });
});
