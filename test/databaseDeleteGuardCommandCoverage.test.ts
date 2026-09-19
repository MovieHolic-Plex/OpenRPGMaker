import { beforeEach, describe, expect, it } from "vitest";
import { addDatabaseRecord, databaseReferenceMessage } from "@/editor/databaseActions";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createDatabaseModalDirtySession } from "@/editor/panels/databaseModalDirtySession";
import { createBlankProject } from "@/project/defaults";
import { collectProjectReferenceIssues } from "@/project/io/references";
import { store } from "@/project/store";

/**
 * 2026-09-19 리뷰 P0-6: 삭제 가드(databaseReferences)와 로드 검증기
 * (commandReferenceValidation)의 커버리지가 어긋나 있었다. 가드가 놓친 참조를 지우면
 * **경고 0건으로 저장**되고, 다음 로드에서 validateProjectReferences 가 하드 실패해
 * 프로젝트 전체가 열리지 않는다.
 *
 * 이 파일의 계약: "로드 검증기가 하드 실패로 다루는 참조는 삭제 가드도 반드시 막는다."
 * 검증기에 assert 를 추가할 때 이 테스트가 같이 깨져야 커버리지가 다시 갈라지지 않는다.
 */
describe("삭제 가드는 로드 검증기와 같은 명령 참조를 본다", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  function addCommonEvent(commands: unknown[]): void {
    store.update((project) => {
      project.commonEvents.push({
        id: "ce_guard_probe",
        name: "가드 프로브",
        trigger: "none",
        commands: commands as never,
      } as never);
    });
  }

  /** 새 레코드는 기본 프로젝트의 다른 참조(시작 파티·기본 애니메이션 등)에 안 걸린다. */
  function freshRecordId(collection: Parameters<typeof addDatabaseRecord>[0]): string {
    const id = addDatabaseRecord(collection);
    expect(databaseReferenceMessage(collection, id)).toBeNull();
    return id;
  }

  it("showAnimation 만 참조하는 전투 애니메이션의 삭제를 막는다", () => {
    const animationId = freshRecordId("battleAnimations");

    addCommonEvent([{ kind: "showAnimation", target: "player", animationId, wait: true }]);

    expect(databaseReferenceMessage("battleAnimations", animationId)).toContain("가드 프로브");
  });

  it("enterHeroName 만 참조하는 주인공의 삭제를 막는다", () => {
    const actorId = freshRecordId("actors");

    addCommonEvent([{ kind: "enterHeroName", actorId, maxLength: 8, showInitialName: true, currentName: "" }]);

    expect(databaseReferenceMessage("actors", actorId)).toContain("가드 프로브");
  });

  it("addFollower 만 참조하는 주인공의 삭제를 막는다", () => {
    const actorId = freshRecordId("actors");

    addCommonEvent([{ kind: "addFollower", actorId }]);

    expect(databaseReferenceMessage("actors", actorId)).toContain("가드 프로브");
  });

  it("promoteActor 의 toClassId 만 참조하는 직업의 삭제를 막는다", () => {
    const classId = freshRecordId("classes");
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";

    addCommonEvent([{ kind: "promoteActor", actorId, toClassId: classId }]);

    expect(databaseReferenceMessage("classes", classId)).toContain("가드 프로브");
  });

  it("equipTool 만 참조하는 아이템의 삭제를 막는다", () => {
    const itemId = freshRecordId("items");

    addCommonEvent([{ kind: "equipTool", itemId }]);

    expect(databaseReferenceMessage("items", itemId)).toContain("가드 프로브");
  });

  it("stateRates 로만 참조되는 상태의 삭제를 막는다", () => {
    const stateId = freshRecordId("states");

    store.update((project) => {
      project.database.actors[0]!.stateRates[stateId] = "weak" as never;
    });

    expect(databaseReferenceMessage("states", stateId)).toContain("주인공");
  });

  // 가드가 막아 준 덕분에 저장본이 로드 가능한 상태로 남는다는 반대편 증거.
  it("가드가 막은 참조를 무시하고 지우면 로드 검증기가 실패한다(가드가 필요한 이유)", () => {
    const animationId = freshRecordId("battleAnimations");
    addCommonEvent([{ kind: "showAnimation", target: "player", animationId, wait: true }]);

    store.update((project) => {
      project.database.battleAnimations = project.database.battleAnimations.filter((record) => record.id !== animationId);
    });

    const issues = collectProjectReferenceIssues(store.getCurrent());
    expect(issues.join("\n")).toContain(animationId);
  });
});

/**
 * 2026-09-19 리뷰 P0-7: 되돌리기 범위가 프로젝트 전체여서, 도크 모드로 맵을 칠한 뒤 DB 를
 * 되돌리면 맵 편집까지 사라졌다. 프롬프트 문구가 약속하는 범위(=DB)로 좁혔다.
 */
describe("DB 되돌리기는 맵을 건드리지 않는다", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
    resetMapEditHistory();
  });

  function firstMapId(): string {
    return Object.keys(store.getCurrent().maps)[0] ?? "";
  }

  it("맵만 바뀐 경우 dirty 로 보지 않는다", () => {
    const mapId = firstMapId();
    const dirtySession = createDatabaseModalDirtySession();

    store.update((project) => {
      project.maps[mapId]!.name = "도크로 고친 맵 이름";
    });

    expect(dirtySession.isDirty()).toBe(false);
  });

  it("되돌리기가 세션 중의 맵 편집을 살려 둔다", () => {
    const mapId = firstMapId();
    const actorId = store.getCurrent().database.actors[0]?.id ?? "";
    const originalActorName = store.getCurrent().database.actors[0]?.name ?? "";
    const dirtySession = createDatabaseModalDirtySession();

    // 도크 모드의 정상 흐름: DB 를 고치면서 맵도 함께 칠한다.
    store.update((project) => {
      project.database.actors.find((record) => record.id === actorId)!.name = "버릴 이름";
      project.maps[mapId]!.name = "지켜야 할 맵 이름";
    });
    expect(dirtySession.isDirty()).toBe(true);

    dirtySession.discard();

    expect(store.getCurrent().database.actors[0]?.name).toBe(originalActorName);
    expect(store.getCurrent().maps[mapId]?.name).toBe("지켜야 할 맵 이름");
  });
});
