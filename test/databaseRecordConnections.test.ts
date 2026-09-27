import { describe, expect, it } from "vitest";
import { recordConnections } from "@/editor/databaseRecordConnections";
import { createBlankProject } from "@/project/defaults";

describe("자료집 연결 칸 — 쓰는 곳·확인할 것", () => {
  it("직업을 쓰는 주인공을 전부 목록으로 낸다(삭제 메시지처럼 첫 건만이 아니다)", () => {
    const project = createBlankProject();
    const classId = project.database.classes[0]!.id;
    const users = project.database.actors.filter((actor) => actor.classId === classId);
    const { uses } = recordConnections(project, "classes", classId);
    const actorUses = uses.filter((use) => use.kind === "주인공");
    expect(actorUses.map((use) => use.target?.id)).toEqual(users.map((actor) => actor.id));
    for (const use of actorUses) expect(use.target?.collection).toBe("actors");
  });

  it("시작 파티 주인공은 시스템이 쓰는 곳으로 잡힌다", () => {
    const project = createBlankProject();
    const actorId = project.system.startActorIds[0]!;
    const { uses, checks } = recordConnections(project, "actors", actorId);
    expect(uses).toContainEqual({ kind: "시스템", name: "시작 파티" });
    expect(checks).not.toContain("아직 아무 데서도 쓰지 않아요");
  });

  it("아무도 안 쓰는 몬스터는 확인할 것에 오른다", () => {
    const project = createBlankProject();
    const enemy = project.database.enemies[0]!;
    project.database.troops = project.database.troops.filter((troop) =>
      !troop.enemyIds.includes(enemy.id) && !troop.members?.some((member) => member.enemyId === enemy.id));
    const { uses, checks } = recordConnections(project, "enemies", enemy.id);
    expect(uses).toEqual([]);
    expect(checks).toContain("아직 아무 데서도 쓰지 않아요");
  });

  it("목록이 못 잡는 참조도 삭제 차단 검사가 찾으면 한 줄로 보인다", () => {
    const project = createBlankProject();
    const item = project.database.items[0]!;
    project.system.sellPrices = [{ itemId: item.id, price: 1 } as never];
    const { uses, checks } = recordConnections(project, "items", item.id);
    expect(uses.some((use) => use.kind === "다른 곳" && use.name.includes("판매 가격"))).toBe(true);
    expect(checks).not.toContain("아직 아무 데서도 쓰지 않아요");
  });

  it("연결 칸 밖의 컬렉션은 빈 결과다", () => {
    const project = createBlankProject();
    expect(recordConnections(project, "battleAnimations", "anything")).toEqual({ uses: [], checks: [] });
  });
});
