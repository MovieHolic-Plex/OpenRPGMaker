// 맵 삭제 무결성 가드(도그푸딩 결함 ①·⑦ 회귀 테스트).
// 핵심 계약: 어떤 삭제 경로든 결과 프로젝트가 serialize→deserialize(shape 검증)를 통과해야 한다.
// 특히 시작 맵/mapTree 루트 삭제 시 재배선 후 재로드가 성공해야 한다(벽돌 방지).
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { createScarloxyDemoProject } from "@/project/defaults/defaultProject";
import { deserialize, serialize } from "@/project/io";
import {
  applyMapDeletion,
  collectMapDeletionImpact,
  planMapDeletion,
  stripMapCommands,
} from "@/project/mapDeletion";
import { mapDeletionConfirmMessage } from "@/editor/mapDeleteConfirm";
import type { Command, Project } from "@/project/types";

function projectWithMaps(count: number): Project {
  const context: ToolContext = { project: createBlankProject() };
  const firstId = Object.keys(context.project.maps)[0];
  for (let index = 1; index < count; index += 1) {
    const created = runTool(context, "create_map", { name: `맵${index}`, width: 10, height: 10, id: `map_${index}` });
    expect(created.ok, created.summary).toBe(true);
  }
  const project = context.project;
  expect(Object.keys(project.maps).length).toBe(count);
  expect(project.mapTree.mapId).toBe(firstId);
  return project;
}

function roundtrip(project: Project): Project {
  return deserialize(serialize(project));
}

describe("applyMapDeletion — 재배선 후 shape 검증 통과", () => {
  it("시작 맵 삭제: startMapId가 재배선되고 재로드(shape 검증)를 통과한다", () => {
    const project = projectWithMaps(3);
    const startId = project.startMapId;
    const plan = planMapDeletion(project, startId);
    expect(plan.ok).toBe(true);
    applyMapDeletion(project, startId);
    expect(project.maps[startId]).toBeUndefined();
    expect(project.maps[project.startMapId]).toBeTruthy();
    // 벽돌 재현 조건: 재로드가 성공해야 한다.
    const reloaded = roundtrip(project);
    expect(reloaded.startMapId).toBe(project.startMapId);
  });

  it("mapTree 루트 맵 삭제: 첫 자식이 루트로 승격되고 재로드를 통과한다(기존 벽돌 시나리오)", () => {
    const project = projectWithMaps(3);
    const rootId = project.mapTree.mapId;
    const childIds = project.mapTree.children.map((child) => child.mapId);
    applyMapDeletion(project, rootId);
    expect(project.mapTree.mapId).toBe(childIds[0]);
    expect(project.mapTree.children.map((child) => child.mapId)).toEqual(childIds.slice(1));
    const reloaded = roundtrip(project);
    expect(reloaded.mapTree.mapId).toBe(childIds[0]);
  });

  it("중간 노드 삭제: 자식 맵이 트리에서 상위로 승격되어 보존된다", () => {
    const context: ToolContext = { project: projectWithMaps(2) };
    const created = runTool(context, "create_map", { name: "자식", width: 8, height: 8, id: "map_child" });
    expect(created.ok).toBe(true);
    const project = context.project;
    const rootId = project.mapTree.mapId;
    const midId = project.mapTree.children[0].mapId;
    // midId 아래로 map_child 노드를 옮긴다(트리 직접 편집).
    project.mapTree.children[0].children.push(
      ...project.mapTree.children.splice(1).filter((node) => node.mapId === "map_child")
    );
    expect(project.mapTree.children[0].children.map((node) => node.mapId)).toEqual(["map_child"]);
    applyMapDeletion(project, midId);
    // 자식이 루트 바로 아래로 승격.
    expect(project.mapTree.mapId).toBe(rootId);
    expect(project.mapTree.children.map((node) => node.mapId)).toContain("map_child");
    roundtrip(project);
  });

  it("transfer/연결/생활 이동이 참조하는 맵 삭제: 참조가 정리되고 재로드를 통과한다", () => {
    const project = createScarloxyDemoProject();
    // 예제 어드벤처는 마을→다른 맵 transfer/connection이 실제로 존재한다.
    const startId = project.startMapId;
    const otherId = Object.keys(project.maps).find((id) => id !== startId);
    expect(otherId).toBeTruthy();
    applyMapDeletion(project, otherId as string);
    const reloaded = roundtrip(project);
    expect(reloaded.maps[otherId as string]).toBeUndefined();
    // 연결에서 삭제 맵 참조가 남아 있으면 roundtrip이 이미 던졌다.
    for (const connection of reloaded.mapConnections ?? []) {
      expect(connection.from.mapId).not.toBe(otherId);
      expect(connection.to.mapId).not.toBe(otherId);
    }
  });

  it("예제 어드벤처의 시작 맵(트리 루트)을 삭제해도 재로드를 통과한다 — P2~P3 벽돌 재현 방지", () => {
    const project = createScarloxyDemoProject();
    const startId = project.startMapId;
    expect(project.mapTree.mapId).toBe(startId); // 벽돌 조건: 루트=시작 맵.
    const plan = planMapDeletion(project, startId);
    expect(plan.ok, plan.ok ? "" : plan.block.message).toBe(true);
    applyMapDeletion(project, startId);
    const reloaded = roundtrip(project);
    expect(reloaded.startMapId).not.toBe(startId);
    expect(reloaded.maps[reloaded.startMapId]).toBeTruthy();
  });
});

describe("planMapDeletion — 차단 조건", () => {
  it("마지막 맵 삭제를 차단한다", () => {
    const project = createBlankProject();
    const onlyId = Object.keys(project.maps)[0];
    const plan = planMapDeletion(project, onlyId);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.block.code).toBe("last-map");
  });

  it("존재하지 않는 맵 삭제를 차단한다", () => {
    const project = projectWithMaps(2);
    const plan = planMapDeletion(project, "ghost_map");
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.block.code).toBe("missing-map");
  });
});

describe("stripMapCommands — 중첩 분기 정리", () => {
  it("choices/fork 내부의 transfer도 제거한다", () => {
    const commands: Command[] = [
      { kind: "text", body: "안녕" },
      { kind: "transfer", mapId: "map_gone", x: 1, y: 1 },
      {
        kind: "choices",
        options: [
          { text: "이동", branch: [{ kind: "transfer", mapId: "map_gone", x: 2, y: 2 }] },
          { text: "유지", branch: [{ kind: "transfer", mapId: "map_keep", x: 3, y: 3 }] },
        ],
        cancelBranch: [{ kind: "transfer", mapId: "map_gone", x: 4, y: 4 }],
      },
      {
        kind: "fork",
        condition: { kind: "selfSwitch", switch: "A", value: true },
        then: [{ kind: "transfer", mapId: "map_gone", x: 5, y: 5 }],
        else: [{ kind: "changeTile", mapId: "map_gone", x: 6, y: 6, layer: "lower", tile: 1 }],
      },
    ] as Command[];
    const stripped = stripMapCommands(commands, "map_gone");
    const json = JSON.stringify(stripped);
    expect(json).not.toContain("map_gone");
    expect(json).toContain("map_keep");
    expect(stripped[0]).toEqual({ kind: "text", body: "안녕" });
  });
});

describe("remove_map 툴 — 무결성 가드 공유", () => {
  it("트리 루트(비시작) 맵 삭제 후에도 mapTree가 유효하다", () => {
    const project = projectWithMaps(3);
    // 시작 맵을 두 번째 맵으로 옮겨 루트(첫 맵)를 비시작 맵으로 만든다.
    const rootId = project.mapTree.mapId;
    const secondId = project.mapTree.children[0].mapId;
    project.startMapId = secondId;
    project.startPos = { x: 2, y: 2 };
    const context: ToolContext = { project };
    const result = runTool(context, "remove_map", { mapId: rootId });
    expect(result.ok, result.summary).toBe(true);
    expect(context.project.mapTree.mapId).not.toBe(rootId);
    roundtrip(context.project);
  });

  it("시작 맵 삭제는 여전히 차단한다(에이전트 경로 정책 유지)", () => {
    const project = projectWithMaps(2);
    const context: ToolContext = { project };
    const result = runTool(context, "remove_map", { mapId: project.startMapId });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain("시작 맵");
  });
});

describe("mapDeletionConfirmMessage — 임팩트 요약(⑦)", () => {
  it("이벤트 수/시작 맵/참조 정리를 요약에 담는다", () => {
    const project = createScarloxyDemoProject();
    const impact = collectMapDeletionImpact(project, project.startMapId);
    expect(impact).toBeTruthy();
    const message = mapDeletionConfirmMessage(impact!);
    expect(message).toContain("맵을 삭제할까요?");
    expect(message).toContain(`이벤트 ${impact!.eventCount}개`);
    expect(message).toContain("시작 맵");
  });
});
