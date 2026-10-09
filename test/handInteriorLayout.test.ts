// 방 구성 → 배치 후보(layout.ts) → 예제 방 가구 심기(furnish.ts) 와 build_hand_interior_room 의 layout 입력.
// 위키: openwiki/atlas-biome-interior.md 「방 구성표·배치 후보·견본 가구」.
import { describe, expect, it } from "vitest";
import { HAND_INTERIOR_SPEC, JP_INTERIOR_SPEC } from "@/editor/handInterior/builder";
import { layoutCandidates } from "@/editor/handInterior/layout";
import { composeHandInteriorRooms } from "@/editor/handInterior/rooms";
import { clusterShifts, placeTemplateItems, programKinds, roomTemplates, shiftItems, templateClusters } from "@/editor/handInterior/templates";
import { piLayoutRepairPrompt } from "@/ai/piAgent/layoutQuality";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

describe("방 견본", () => {
  it("손 도트 v5·일본 집 예제가 방 단위로 잘려 있다", () => {
    expect(roomTemplates("atlas_biome_interior").length).toBeGreaterThan(80);
    expect(roomTemplates("jp_city").some((t) => t.kind === "washitsu" && t.items.length > 5)).toBe(true);
    expect(programKinds("jp_city", "house-1f")?.kinds).toEqual(expect.arrayContaining(["genkan", "hall", "ldk", "toilet", "bath", "washitsu"]));
  });

  it("같은 크기 방에 심으면 견본 좌표 그대로다", () => {
    const t = roomTemplates("jp_city").find((x) => x.kind === "washitsu")!;
    const placed = placeTemplateItems(t, { x0: 10, y0: 20, w: t.w, h: t.h }, JP_INTERIOR_SPEC);
    expect(placed.filter((i) => i.t !== "l").map((i) => [i.x - 10, i.y - 20])).toEqual(t.items.filter((i) => i.t !== "l").map((i) => [i.x, i.y]));
  });
});

describe("배치 후보", () => {
  for (const [tid, S, program] of [["jp_city", JP_INTERIOR_SPEC, "house-1f"], ["atlas_biome_interior", HAND_INTERIOR_SPEC, "inn"]] as const) {
    it(`${program}: 방이 겹치지 않고 출구 방이 맨 아래에 닿고 모든 방이 문으로 이어진다`, () => {
      const [c] = layoutCandidates(tid, { program }, S, 1);
      const kinds = programKinds(tid, program)!.kinds;
      expect(c!.rooms.map((r) => r.kind).sort()).toEqual([...kinds].sort());
      const exit = c!.rooms.find((r) => r.id === c!.exit.room)!;
      expect(exit.y1).toBe(c!.height - 2);
      const composed = composeHandInteriorRooms(c!.rooms, c!.connect, c!.exit, S);
      expect(composed.plan).toHaveLength(c!.height);
      // 문 나무: 방 수 - 1 개 이상의 연결
      expect(c!.connect.length).toBeGreaterThanOrEqual(c!.rooms.length - 1);
    });
  }

  it("방이 견본보다 작아지지 않는다(아래에서 위로 짜기)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const [c] = layoutCandidates("jp_city", { program: "house-1f", seed }, JP_INTERIOR_SPEC, 1);
      for (const rm of c!.rooms) {
        const t = roomTemplates("jp_city").find((x) => x.id === rm.template);
        if (!t || t.h <= 2) continue;
        expect(rm.x1 - rm.x0 + 1, `${seed} ${rm.id}`).toBeGreaterThanOrEqual(t.w);
        expect(rm.y1 - rm.y0 + 1, `${seed} ${rm.id}`).toBeGreaterThanOrEqual(t.h);
      }
    }
  });

  it("seed 가 다르면 다른 배치가 나온다", () => {
    const a = layoutCandidates("jp_city", { program: "house-1f", seed: 1 }, JP_INTERIOR_SPEC, 1)[0]!;
    const b = layoutCandidates("jp_city", { program: "house-1f", seed: 2 }, JP_INTERIOR_SPEC, 1)[0]!;
    expect(JSON.stringify(a.rooms)).not.toBe(JSON.stringify(b.rooms));
  });
});

describe("build_hand_interior_room layout", () => {
  const blank = (): { project: Project } => ({ project: createBlankProject() });

  it("일본 집 방 구성만 주면 칸막이·문·가구까지 오류 없이 짓고, rebuild 로 다시 지을 수 있다", () => {
    const ctx = blank();
    const r = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", name: "일본 집 1층", floor: "flooring", wall: "cloth",
      layout: { rooms: [{ kind: "genkan" }, { kind: "hall" }, { kind: "ldk" }, { kind: "kitchen" }, { kind: "toilet" }, { kind: "bath" }, { kind: "washitsu" }] } });
    expect(r.ok, r.summary).toBe(true);
    const d = r.data as { mapId: string; unreachedFloor: unknown[]; layout: { picture: string[]; rooms: { furniture?: { placed: number } }[] }; rebuild: Record<string, unknown> };
    expect(d.unreachedFloor).toEqual([]);
    expect(d.layout.picture.length).toBeGreaterThan(8);
    expect(d.layout.rooms.reduce((a, x) => a + (x.furniture?.placed ?? 0), 0)).toBeGreaterThan(25);
    const again = runTool(ctx, "build_hand_interior_room", { tileset: "jp_city", mapId: d.mapId, replace: true, floor: "flooring", wall: "cloth", ...d.rebuild });
    expect(again.ok, again.summary).toBe(true);
  });

  it("견본 가구가 거의 다 들어간다", () => {
    for (const seed of [2, 3, 4]) {
      const r = runTool(blank(), "build_hand_interior_room", { tileset: "jp_city", name: "집", floor: "flooring", wall: "cloth", layout: { program: "house-1f", seed } });
      expect(r.ok, r.summary).toBe(true);
      const d = r.data as { layout: { rooms: { furniture?: { placed: number; dropped: number } }[] } };
      const placed = d.layout.rooms.reduce((a, x) => a + (x.furniture?.placed ?? 0), 0), dropped = d.layout.rooms.reduce((a, x) => a + (x.furniture?.dropped ?? 0), 0);
      expect(dropped / (placed + dropped)).toBeLessThan(0.1);
    }
  });

  it("넓힌 방에서도 붙은 가구 덩이(식탁+의자)는 서로의 자리를 지킨다", () => {
    const S = JP_INTERIOR_SPEC;
    const t = roomTemplates("jp_city").find((x) => x.kind === "ldk")!;
    const room = { x0: 1, y0: 1, w: t.w + 3, h: t.h + 2 };
    for (const c of templateClusters(t, S)) {
      const [sx, sy] = clusterShifts(t, c, room.w, room.h)[0]!;
      const moved = shiftItems(t, c, sx, sy, room);
      c.members.forEach((k, i) => {
        if (t.items[k]!.t === "l") return;
        expect([moved[i]!.x - t.items[k]!.x, moved[i]!.y - t.items[k]!.y]).toEqual([sx + 1, sy + 1]);
      });
    }
  });

  it("layout 과 plan 을 같이 주면 거부한다", () => {
    const r = runTool(blank(), "build_hand_interior_room", { tileset: "jp_city", floor: "flooring", wall: "cloth", plan: ["#####", "#...#", "#...#", "#...#", "##.##"], layout: { program: "house-1f" } });
    expect(r.ok).toBe(false);
  });
});

describe("실내 빈 바닥 피드백", () => {
  it("실내 맵이면 채우지 말고 줄이라고 한다", () => {
    const text = piLayoutRepairPrompt([{ mapId: "m", interior: true, problems: ["빈 바닥 60%"], stats: { emptiestWindows: [] } as never }]);
    expect(text).toMatch(/흩뿌려 메우지 마라/);
    expect(text).toMatch(/layout/);
  });
});
