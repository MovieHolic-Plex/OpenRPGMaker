// 일본 2층 단독주택 예제(tiledata/jp-city/interior/examples/house-1f.json·house-2f.json)를 청사진(src/editor/handInterior/jpHouseBlueprint.ts) 씨앗 1 로 다시 쓴다.
//   npx --no-install tsx --import ./tiledata/jp-city/refs/css-stub.mjs scripts/content/jp-city/interior/gen_house_examples.mts
// 예제는 조수 도구 인자 그대로(plan·zones·objects·tables·goods) + rooms 사각형(방 견본 종류) + start·links(계단 이동).
// 청사진을 고치면 이 스크립트 → maps/interior.mjs --only house-1f,house-2f → interior-templates/extract.mts 순서로 다시 굽는다.
import fs from "node:fs";
import { composeJpHouse1F, composeJpHouse2F } from "@/editor/handInterior/jpHouseBlueprint";
import { composeHandInteriorRooms } from "@/editor/handInterior/rooms";
import { JP_INTERIOR_SPEC as S } from "@/editor/handInterior/builder";

const EX = "tiledata/jp-city/interior/examples";
const SEED = 1;
const f1 = composeJpHouse1F(S, SEED), f2 = composeJpHouse2F(S, SEED);
const c1 = composeHandInteriorRooms(f1.rooms!, f1.connect!, f1.exit!, S);
const KIND: Record<string, string> = { "hall-north": "hall", "hall-2f": "hall" };
/** 방 사각형(왼쪽·위 벽 포함) — extract.mts·interior-fixture.mts 가 방 종류와 걷는 길을 여기서 읽는다. 1층 가운데 복도는 현관(타타키 띠)과 나눈다. */
const rectsOf = (rooms: readonly { id: string; x0: number; y0: number; x1: number; y1: number }[], genkanY?: number) => rooms.flatMap((r) => {
  const base = { room: KIND[r.id] ?? r.id, x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1, y1: r.y1 };
  if (r.id === "hall" && genkanY !== undefined) return [{ ...base, y1: genkanY - 1 }, { room: "genkan", x0: r.x0 - 1, y0: genkanY, x1: r.x1, y1: r.y1 + 1 }];
  return [base];
});
const order = <T extends Record<string, unknown>>(o: T) => o;
const stair1 = f1.stairs.from[0]!;
const ex1 = order({
  plan: c1.plan,
  floor: f1.floor, wall: f1.wall,
  name: "2층 단독주택 1층",
  zones: [...c1.zones, ...f1.zones],
  objects: [...c1.doors, ...f1.objects],
  tables: f1.tables, goods: f1.goods,
  rooms: rectsOf(f1.layoutRooms, 17),
  start: [c1.exit.x, c1.exit.y - 1],
  links: [{ x: stair1.x, y: stair1.y, toMapId: "jp-city-house-2f", toX: f2.stairs.to.x, toY: f2.stairs.to.y, direction: "up" }],
});
const ex2 = order({
  plan: f2.plan,
  floor: f2.floor, wall: f2.wall,
  name: "2층 단독주택 2층",
  zones: f2.zones, objects: f2.objects, tables: f2.tables, goods: f2.goods,
  rooms: rectsOf(f2.layoutRooms),
  start: [f2.start![0]!.x, f2.start![0]!.y],
  inner: true,
  links: f2.stairs.from.map((p) => ({ x: p.x, y: p.y, toMapId: "jp-city-house-1f", toX: f1.stairs.to.x, toY: f1.stairs.to.y, direction: "down" })),
});
fs.writeFileSync(`${EX}/house-1f.json`, JSON.stringify(ex1, null, 1) + "\n");
fs.writeFileSync(`${EX}/house-2f.json`, JSON.stringify(ex2, null, 1) + "\n");
console.log(`house-1f ${c1.plan[0]!.length}x${c1.plan.length} · house-2f ${f2.plan![0]!.length}x${f2.plan!.length}`);
