// 손 도트 실내 v5 부품 찾기(list_hand_interior_parts) — 사양의 설명·태그·놓는 곳·짝 소품, 여러 낱말 검색, 방 종류 묶음.
import { describe, expect, it } from "vitest";
import { HAND_INTERIOR_SPEC as S } from "@/editor/handInterior/builder";
import { resolveRoom, roomParts, searchParts } from "@/editor/handInterior/parts";
import { LIST_HAND_INTERIOR_PARTS_TOOL } from "@/editor/tools/handInteriorTools";
import { createBlankProject } from "@/project/defaults";

const run = (args: Record<string, unknown>) => LIST_HAND_INTERIOR_PARTS_TOOL.run(createBlankProject() as never, args as never) as { summary: string; data: any };

describe("handInteriorSpec 소품 메모", () => {
  it("381종 모두 desc·tags 가 있고, desc 는 60자 이하·서로 다르다", () => {
    const objs = Object.entries(S.objects);
    expect(objs.length).toBe(381);
    for (const [id, o] of objs) {
      expect(o.desc, id).toBeTruthy();
      expect(o.desc!.length, id).toBeLessThanOrEqual(60);
      expect(o.tags?.length, id).toBeGreaterThan(0);
    }
    const descs = objs.map(([, o]) => `${o.desc} ${o.place}`);
    expect(new Set(descs).size).toBe(descs.length);
  });
  it("짝 소품은 있는 id(가구·탁상 물건·탁자 스타일·줄)만 가리킨다", () => {
    for (const [id, o] of Object.entries(S.objects)) for (const p of o.pair ?? [])
      expect(Boolean(S.objects[p] || p.startsWith("goods:") || S.tables[p.split(" ")[0]!] || S.lines[p]), `${id} → ${p}`).toBe(true);
  });
  it("방 표: 예제 26맵의 방마다 방 종류가 있고 그 종류가 kinds 에 있다", () => {
    const t = S.rooms!;
    expect(new Set(t.examples.map((e) => e[0])).size).toBe(26);
    for (const [, , room] of t.examples) expect(t.kinds[room], room).toBeTruthy();
  });
});

describe("list_hand_interior_parts", () => {
  it("여러 낱말은 모든 낱말이 맞는 것만 준다 — 「여관 벽」에 다트판·술통 선반", () => {
    const r = searchParts("여관 벽");
    expect(r.allMatch).toBeGreaterThan(0);
    expect(r.ids.length).toBe(r.allMatch);
    expect(r.ids).toEqual(expect.arrayContaining(["dart board", "keg rack"]));
    for (const id of r.ids) expect(r.hits.get(id)).toBe(2);
  });
  it("태그·설명으로도 찾는다(이름에 없는 낱말) — 「부엌」에 조리 화덕", () => {
    expect(searchParts("부엌").ids).toContain("kitchen range");
  });
  it("결과가 12종 이하면 행에 desc·tags·place·pair, 많으면 짧은 행", () => {
    const few = run({ query: "bed" });
    expect(few.data.objects.length).toBeLessThanOrEqual(12);
    expect(few.data.objects[0]).toEqual(expect.objectContaining({ desc: expect.any(String), tags: expect.any(Array), place: expect.any(String) }));
    const many = run({ query: "부엌" });
    expect(many.data.objects.length).toBeGreaterThan(12);
    expect(many.data.objects[0].place).toBeUndefined();
    expect(many.data.objects[0].desc).toBeTruthy();
  });
  it("room: 건물 id·이름, 방 종류 이름을 알아듣고 종류별로 묶는다", () => {
    expect(resolveRoom("bakery")).toEqual({ mode: "building", key: "bakery" });
    expect(resolveRoom("빵집")).toEqual({ mode: "building", key: "bakery" });
    expect(resolveRoom("여관 객실")).toEqual({ mode: "room", key: "inn_room" });
    expect(resolveRoom("부엌")).toEqual({ mode: "room", key: "kitchen" });
    const bakery = roomParts("bakery")!;
    expect(bakery.exampleDocs).toEqual(["hand-interior-v5-map-bakery"]);
    expect(bakery.groups.wall!.map((p) => p.id)).toEqual(expect.arrayContaining(["bread oven", "bread shelf"]));
    expect(bakery.rooms!.map((r) => r.room)).toEqual(expect.arrayContaining(["bakery_oven", "bakery_shop"]));
    const inn = run({ room: "여관 객실" });
    expect(inn.data.groups.floor.map((p: { id: string }) => p.id)).toContain("nightstand");
    expect(() => run({ room: "화성 기지" })).toThrow(/모른다/);
  });
});
