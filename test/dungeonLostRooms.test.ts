// 2026-11-15 여러 씨앗 훑기(Mirage VM)에서 main 도 멈추던 판: 조수의 던전 도구가 «시공기 내부 오류: 입구에서 걸어 닿지 않는 방 …» 을 던졌다.
// 뿌리 둘: ① 굴 문법에서 두께 고르기가 좁은 목을 메워 방 하나가 통째로 끊기면 «못 잇는 조각 제거» 가 그 방의 바닥을 모두 지웠다
//          → 통째로 끊긴 방은 굴을 뚫어 잇는다(dungeonKit/grid.ts tunnelLostRooms).
//        ② 바닥 구멍 계단의 도착 칸이 뒤에 놓인 물건(해골·밸브) 사이에 갇혔다 → 물건을 놓을 때 도착 칸 곁 한 칸은 길에 이어져 있어야 한다(compose.ts arrivals).
// 씨앗을 피하지 않는다 — 그때 멈춘 종류·씨앗을 그대로 짓고, 지은 층에 린트 오류가 없어야 한다.
import { describe, expect, it } from "vitest";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { createBlankProject } from "@/project/defaults";
import { projectLint } from "@/project/lint/projectLint";

const CASES: readonly (readonly [string, Record<string, unknown>])[] = [
  ["소굴 7", { type: "cave", lair: true, seed: 7 }], ["소굴 19", { type: "cave", lair: true, seed: 19 }],
  ["화산 7", { type: "volcano", seed: 7 }], ["화산 10", { type: "volcano", seed: 10 }], ["화산 20", { type: "volcano", seed: 20 }],
  ["숲 7", { type: "forest", seed: 7 }], ["숲 20", { type: "forest", seed: 20 }],
  ["큰 2층 하수도 3", { type: "sewer", seed: 3, size: "large", floors: 2 }],
];

describe("던전 도구는 닿지 않는 방으로 멈추지 않는다", () => {
  it.each(CASES)("%s: 지어지고, 모든 방이 입구에서 닿으며, 린트 오류가 없다", (name, args) => {
    const project = createBlankProject();
    const res = AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, name, ...args });
    const ids = (res.data as { floors: string[] }).floors;
    expect(ids.length).toBeGreaterThan(0);
    const issues = projectLint(project).filter((i) => i.severity === "error" && (!i.mapId || ids.includes(i.mapId)));
    expect(issues.map((i) => `${i.code}: ${String(i.message).slice(0, 80)}`)).toEqual([]);
  }, 60_000);
});
