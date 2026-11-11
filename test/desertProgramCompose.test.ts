// 사막 구성기의 목적표 판 — 역할 건물과 채움 집만 놓이고, 맵 크기가 건물 수에서 나오며, 역할 건물이 맵 로케이션 꼬리표로 남는다. 목적표 없이 부르면 예전 그대로다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import type { ToolContext } from "@/editor/tools/types";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildingEntrances } from "@/ai/v2/place/entrances";
import { edgeRoadMouths } from "@/ai/v2/place/roadMouths";
import { DESERT_MIN_SIZE, DESERT_SETTLEMENT, desertProgramSize, type DesertKind } from "@/project/desertEastComposer";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { PROGRAM_ROLE_TAG, fillerOf, needTag, placeableRoles, roleTag, type SettlementProgram } from "@/project/settlementProgram";

type Built = { name: string; kit: string; need?: { id: string; role: string } };

function compose(kind: DesertKind, program: SettlementProgram | undefined, seed = 3, exits?: readonly string[]) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const size = program ? desertProgramSize(kind, program) : DESERT_MIN_SIZE[kind];
  const mapId = (run.call("create_map", { name: `${kind}`, width: size.w, height: size.h, tilesetId: "desert_east" }).data as { mapId: string }).mapId;
  const res = run.call("compose_desert_east_map", { mapId, kind, seed, ...(program ? { program } : {}), ...(exits ? { exits } : {}) });
  expect(res.ok, String(res.summary)).toBe(true);
  const data = res.data as { buildings: Built[]; unplaced?: { id: string }[] };
  return { run, mapId, size, buildings: data.buildings, unplaced: data.unplaced, map: () => run.ctx.project.maps[mapId]! };
}

const home = (who: string) => ({ id: `home:${who}`, role: "home", label: `${who}의 집` });
const PROGRAMS: readonly [DesertKind, SettlementProgram][] = [
  ["oasis", { roles: [{ id: "svc:inn", role: "inn" }, home("나지라")] }],
  ["bazaar", { roles: [{ id: "svc:shop", role: "shop" }, { id: "room:모래찻집", role: "teahouse", label: "모래찻집" }, home("파리드")] }],
  ["caravanserai", { roles: [{ id: "svc:inn", role: "inn" }] }],
  ["palace", { roles: [{ id: "landmark", role: "throne" }, home("자라")] }],
  ["pyramid", { roles: [{ id: "landmark", role: "tomb" }] }],
];

describe("사막 구성기 — 목적표로 짜기", () => {
  for (const [kind, program] of PROGRAMS) {
    it(`${kind}: 건물은 역할 + 채움뿐이고 맵은 고정 최소 크기보다 작다`, () => {
      const built = compose(kind, program, 3, ["east"]);
      const roles = placeableRoles(DESERT_SETTLEMENT, kind, program), filler = fillerOf(DESERT_SETTLEMENT, kind, program);
      expect(built.unplaced ?? []).toEqual([]);
      expect(built.buildings.filter((b) => b.need).map((b) => b.need!.id).sort()).toEqual(roles.map((need) => need.id).sort());
      expect(built.buildings.filter((b) => !b.need)).toHaveLength(filler);
      // 문이 선언된 건물(천막 포함)은 구성기가 돌려준 건물뿐이다 — 역할 없는 천막·방 줄이 따로 서지 않는다.
      const doors = buildingEntrances(built.run.ctx.project, built.map());
      const houses = new Set(doors.map((d) => built.map().locations?.find((l) => (l.tags ?? []).includes("desert-east-building") && d.x >= l.x && d.x < l.x + l.w && d.y >= l.y && d.y < l.y + l.h)?.id));
      expect(houses.has(undefined)).toBe(false);
      expect(houses.size).toBe(roles.length + filler);
      const min = DESERT_MIN_SIZE[kind];
      expect(built.size.w * built.size.h).toBeLessThan(min.w * min.h);
      // 역할 건물은 로케이션 꼬리표로 남는다(읽는 쪽이 키트 이름에서 짐작하지 않는다).
      for (const need of roles) {
        const loc = built.map().locations?.find((l) => (l.tags ?? []).includes(needTag(need.id)));
        expect(loc?.tags, need.id).toEqual(expect.arrayContaining([PROGRAM_ROLE_TAG, roleTag(need.role)]));
        if (need.label) expect(loc?.name).toBe(need.label);
      }
    }, 60_000);
  }

  it("작아진 맵에서도 주문받은 변까지 길이 나고, 그 길이 다른 변의 가장자리 줄에 붙지 않는다", () => {
    // 길이 가장자리 줄에 붙으면 길섶 칸이 그 변의 넓은 길 입구로 읽혀 출구가 그리로 간다(목적표 궁전 첫 판: 동쪽 길을 못 냈고, 냈을 때는 남쪽 입구가 12칸이었다).
    for (const [kind, program] of PROGRAMS) for (const side of ["east", "west", "north"] as const) {
      const built = compose(kind, program, 2, [side]);
      const mouths = edgeRoadMouths(built.run.ctx.project, built.map());
      expect(mouths.filter((m) => m.side === side).length, `${kind} ${side}`).toBeGreaterThanOrEqual(1);
      for (const m of mouths) expect(m.cells.length, `${kind} ${side}: ${m.side} 입구 폭`).toBeLessThanOrEqual(6);
    }
  }, 180_000);

  it("피라미드의 남쪽 탑문은 맵의 마지막 줄에 서서 문 구멍이 곧 나가는 칸이다(문 그림 밑 맨바닥에 출구가 놓이지 않는다)", () => {
    // 한 줄 띄워 세우면 남쪽 출구 네 칸이 문 그림 바로 밑 맨바닥에 놓여 출하 검사 entrance-off-art 가 걸렸다(명세 은행 fun-x1·jrpg-w3).
    for (const seed of [1, 2, 3]) {
      const built = compose("pyramid", { roles: [{ id: "landmark", role: "tomb" }] }, seed, ["south"]);
      const south = edgeRoadMouths(built.run.ctx.project, built.map()).filter((m) => m.side === "south");
      expect(south, `씨앗 ${seed}`).toHaveLength(1);
      expect(south[0]!.cells.every((c) => isDoorArtCell(built.run.ctx.project, built.map(), c.x, c.y)), `씨앗 ${seed} 남쪽 입구 칸`).toBe(true);
    }
  }, 60_000);

  it("건물이 늘면 맵이 커지고(둘째 줄), 줄어들면 작아진다", () => {
    const big: SettlementProgram = { roles: [...["가", "나", "다"].map(home), { id: "svc:inn", role: "inn" }, { id: "svc:shop", role: "shop" }, { id: "b", role: "bath" }] };
    const few = desertProgramSize("oasis", { roles: [home("가")] }), many = desertProgramSize("oasis", big);
    expect(many.w * many.h).toBeGreaterThan(few.w * few.h);
    const built = compose("oasis", big);
    expect(built.unplaced ?? []).toEqual([]);
    expect(built.buildings).toHaveLength(8);
  }, 60_000);

  it("가게처럼 생긴 집은 가게뿐이다 — 채움 집은 살림집 키트만 쓴다", () => {
    for (const seed of [1, 2, 3, 4]) {
      const built = compose("bazaar", { roles: [{ id: "svc:shop", role: "shop" }], filler: 4 }, seed);
      expect(built.buildings.filter((b) => b.kit === "de-house-shop").map((b) => b.need?.role)).toEqual(["shop"]);
      expect(built.buildings.filter((b) => !b.need).every((b) => DESERT_SETTLEMENT.roles.home!.kits.includes(b.kit))).toBe(true);
    }
  }, 60_000);

  it("목적표가 작은 맵을 받지 않으면 거절하고, 목적표 없이 부르면 예전 크기·예전 집 줄이다", () => {
    const project = createBlankProject();
    const run = createBuildRun({ project, currentMapId: project.startMapId, assistantRun: true } as ToolContext);
    const mapId = (run.call("create_map", { name: "작은 오아시스", width: 20, height: 16, tilesetId: "desert_east" }).data as { mapId: string }).mapId;
    const small = run.call("compose_desert_east_map", { mapId, kind: "oasis", program: { roles: [home("가")] } });
    expect(small.ok).toBe(false);
    expect(String(small.summary)).toContain("32×24");
    const old = compose("oasis", undefined);
    expect(old.buildings.length).toBeGreaterThan(8);
    expect(old.buildings.every((b) => !b.need)).toBe(true);
    expect((old.map().locations ?? []).some((l) => (l.tags ?? []).includes(PROGRAM_ROLE_TAG))).toBe(false);
  }, 60_000);
});
