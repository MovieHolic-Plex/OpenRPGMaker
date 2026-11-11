// 「이 장소를 깔아 줘」 한 요청이 거절 고리에 갇히던 일 — 2026-11-11 map-vqa 깔기 24판(Terra high): 장소는 23곳 깔렸는데 «완료» 는 8곳.
// edit_place 거절 26번(빈 껍데기 layoutPatch 를 진짜 고침으로 읽음) · 다음 호출 줄의 `mapId:""` · «pending action» 에 막힌 맞는 호출 17번.
// 거절은 값이 다 찬 다음 호출 하나를 이르거나, 가장 가까운 맞는 일을 스스로 한다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { nextAfterFailure } from "@/ai/v2/loop/nextCall";
import { applyLayoutPatch, layoutPatchIsEmpty, type InteriorLayout, type LayoutPatch } from "@/ai/v2/place/interiorLayout";
import { dropPatchFill } from "@/ai/v2/tools/support";
import { V2Session } from "@/ai/v2/turn/session";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { PlacePatch, PlaceSpec } from "@/ai/v2/shared/types";

const SLOW = 120_000;
const one = { count: 1, dx: 0, dy: 0 };
/** 그 판에서 한 번에 깔린 배치(선술집 12×10) — 엄격 스키마가 채운 빈 칸까지 보낸 그대로. */
const TAVERN = {
  map: { w: 12, h: 10 }, landmark: { id: "counter 4x1", x: 3, y: 5, repeat: one, purpose: "바 카운터", wall: "" },
  outer_wall: { material: "log", path: [[0, 0], [11, 0], [11, 9], [0, 9], [0, 0]] }, walls: [], doors: [],
  rooms: [{ id: "hall", at: [5, 7], floor: "boards", purpose: "모험가들이 모여 술을 마시는 작은 선술집", role: "main", landmark: "counter 4x1", stairs: "none", repeat: false, jo: 0 }],
  wall_items: [{ id: "keg rack", x: 1, y: 3, repeat: one, purpose: "술통 보관대", wall: "outer" }, { id: "window", x: 4, y: 1, repeat: one, purpose: "창", wall: "outer" },
    { id: "quest board", x: 7, y: 1, repeat: one, purpose: "의뢰 게시판", wall: "outer" }, { id: "cabinet:bottle+bottler+bottley", x: 8, y: 3, repeat: one, purpose: "술병 보관장", wall: "outer" }],
  rails: [], regions: [], openings: [], entrance: { x: 5, y: 9 }, carpets: [], daises: [], floor_zones: [],
  objects: [{ id: "roundtable", x: 2, y: 7, repeat: one, purpose: "둥근 탁자" }, { id: "chair E", x: 1, y: 7, repeat: one, purpose: "탁자 의자" }, { id: "chair W", x: 3, y: 7, repeat: one, purpose: "탁자 의자" },
    { id: "barrel", x: 9, y: 5, repeat: one, purpose: "술통" }, { id: "bar stool", x: 6, y: 7, repeat: one, purpose: "바 의자" }, { id: "barrel", x: 9, y: 7, repeat: one, purpose: "술통" },
    { id: "crate", x: 10, y: 7, repeat: one, purpose: "물품 상자" }, { id: "armchair", x: 1, y: 5, repeat: one, purpose: "손님 자리" }, { id: "potted fern", x: 10, y: 3, repeat: one, purpose: "화분" }],
  required: [{ ask: "바 카운터", ids: ["counter 4x1"], missing: "" }, { ask: "술통", ids: ["barrel", "keg rack"], missing: "" }, { ask: "둥근 탁자", ids: ["roundtable"], missing: "" }],
};
/** 엄격 스키마 모델이 «고칠 것 없음» 자리에 채워 보내는 껍데기. */
const SHELL: LayoutPatch = { remove_objects: [], add_objects: [], remove_wall_items: [], add_wall_items: [],
  replace: { map: { w: 0, h: 0 }, landmark: { id: "", x: 0, y: 0 }, outer_wall: { material: "", path: [] }, walls: [], doors: [], entrance: { x: 0, y: 0 }, rooms: [], objects: [] } } as unknown as LayoutPatch;

function turn(task: string) {
  const project = createBlankProject();
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const forced: string[] = [];
  const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => JSON.stringify({ score: 7, majors: [] }), checkpoint: async () => {},
    preferToolNextTurn: (name: string) => { forced.push(name); }, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
  const session = new V2Session();
  const tools = withTodoLoop(env, session.todo, session.loop, createV2Tools(env, session), session.hooks);
  const call = async (name: string, args: unknown): Promise<{ ok: boolean; body: string }> => {
    const body = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
      .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => JSON.stringify({ ok: false, summary: e.message }));
    let ok = !/^Rejected:/u.test(body);
    try { const j = JSON.parse(body.split("\n")[0]!) as { ok?: boolean; notFailure?: boolean }; ok = j.ok !== false || j.notFailure === true; } catch { /* 거절 글은 JSON 이 아니다 */ }
    return { ok, body };
  };
  const todo = (name: string, placeKind: string) => call("todo", { op: "init", list: [{ phase: "p", items: [{ content: `${name} 만들기`, id: "place", check: { kind: "place", name, placeKind, fresh: true } }] }] });
  return { ctx, call, todo, forced };
}

describe("칸 배치 고침 — 빈 껍데기는 고침이 아니다", () => {
  it("엄격 스키마가 채운 layoutPatch 는 빈 고침으로 읽고, 진짜 고침만 고침이다", () => {
    expect(layoutPatchIsEmpty(SHELL)).toBe(true);
    expect(layoutPatchIsEmpty({ add_objects: [{ id: "barrel", x: 5, y: 5 }] } as LayoutPatch)).toBe(false);
    expect(layoutPatchIsEmpty({ replace: { doors: [{ wall: "outer", x: 5, y: 9 }] } } as unknown as LayoutPatch)).toBe(false);
  });

  it("껍데기 replace 는 벽·문을 지우지 않고, 이미 있는 물건을 또 더하지 않는다", () => {
    const base = { ...TAVERN, walls: [{ id: "mid", material: "log", path: [[0, 4], [11, 4]] }], doors: [{ wall: "mid", x: 5, y: 4 }] } as unknown as InteriorLayout;
    const kept = applyLayoutPatch(base, SHELL).layout as unknown as typeof TAVERN;
    expect(kept.walls).toHaveLength(1);
    expect(kept.doors).toHaveLength(1);
    expect(kept.map).toEqual({ w: 12, h: 10 });
    const twice = applyLayoutPatch(TAVERN as unknown as InteriorLayout, { add_objects: [{ id: "crate", x: 10, y: 7 }, { id: "crate", x: 7, y: 5 }] } as LayoutPatch).layout as unknown as typeof TAVERN;
    expect(twice.objects.filter((o) => o.id === "crate")).toHaveLength(2);
  });

  it("edit_place 패치의 빈 칸·0·지금과 같은 값은 «안 보냈다» 다 — 이름·크기·배치가 덮이지 않는다", () => {
    const spec = { type: "village", name: "새벽 마을", size: "medium", hints: { width: 48 } } as unknown as PlaceSpec;
    const patch = { mapId: "map_a", set: { name: "", style: "", layout: SHELL.replace, size: "medium", hints: { width: 0, height: 0, walls: false, landmark: "", layout: { gather: { x: 0, y: 0, plaza: false }, houses: [] } } },
      zones: [], addAnchors: [], removeFeatures: [], variant: 0, dressing: 0, design: { shape: "", areas: [] } } as unknown as PlacePatch;
    expect(dropPatchFill(patch, spec)).toEqual({ mapId: "map_a" });
    // 지금 켜진 값을 끄는 false 는 진짜 고침이다.
    const walled = { ...spec, hints: { width: 48, walls: true } } as unknown as PlaceSpec;
    expect(dropPatchFill({ mapId: "map_a", set: { hints: { walls: false, width: 0 } } } as unknown as PlacePatch, walled)).toEqual({ mapId: "map_a", set: { hints: { walls: false } } });
  });
});

describe("거절 뒤 다음 호출 — 값이 찬 호출만, 없는 맵 id 는 싣지 않는다", () => {
  const project = createBlankProject();
  const verbs = new Set(["make_place", "edit_place", "create_transfer_pair", "inspect", "find_pieces", "create_map", "move_event"]);

  it("아직 서지 않은 장소의 칸 배치 거절은 같은 이름의 make_place 를 이른다(따옴표가 \\\" 로 와도)", () => {
    for (const text of ['Rejected: the interior layout for "무기 가게" cannot be laid as written (1 problem). - unknown catalog id', '{"ok":false,"summary":"Rejected: the interior layout for \\"무기 가게\\" cannot be laid as written']) {
      const next = nextAfterFailure("make_place", { name: "무기 가게", mapId: "" }, text, project, verbs)!;
      expect(next.verb).toBe("make_place");
      expect(next.args.name).toBe("무기 가게");
      expect(JSON.stringify(next.args)).not.toContain('"mapId":""');
      expect(next.exact).toBeFalsy();
    }
  });

  it("거절 글이 동사 이름만 짚으면 빈 mapId 대신 자리표시를 쓰고 강제하지 않는다", () => {
    const next = nextAfterFailure("edit_place", { patch: { mapId: "" } }, "nothing was changed — a door to another map: create_transfer_pair", project, verbs)!;
    expect(next.verb).toBe("create_transfer_pair");
    expect((next.args.a as { mapId: string }).mapId).toBe("<mapId>");
    expect(next.exact).toBeFalsy();
  });

  it("거절 글이 값을 채운 다음 호출을 이미 적었으면 빈 뼈대를 덧붙이지 않는다", () => {
    expect(nextAfterFailure("edit_place", { patch: { mapId: "map_blank_start" } }, 'nothing was changed.\nNext call: inspect({"mapId":"map_blank_start"}) — then use create_transfer_pair or move_event.', project, verbs)).toBeUndefined();
  });

  it("칩셋 계열 거절 뒤에는 빈 맵(create_map)이 아니라 그 이름의 make_place 를 이른다", () => {
    const refusal = "프로젝트에서 칠한 맵 map_a 의 칩셋은 「사막·동양풍」인데 author_forest_route 이 맵 map_field_east_1 에 「버들항 v6」을 쓰려 해 거부했다 — 사용자 승인 없이 타일 그림체를 바꾸지 않는다. create_map(tilesetId=후보) 로 빈 맵을 만든 뒤 칠하기 도구로 직접 깔아라";
    const next = nextAfterFailure("author_forest_route", { fromMapId: "map_a", names: ["동쪽 들판"] }, refusal, project, verbs)!;
    expect(next.verb).toBe("make_place");
    expect(next.args.name).toBe("동쪽 들판");
  });
});

describe("깔기 요청의 도구 층 — 거절이 다음 길을 막지 않는다", () => {
  it("없는 기물 하나로 거절된 배치는 무엇을 다시 보낼지 먼저 말하고, 빈 mapId 의 edit_place 로 고쳐 보내면 깔린다", async () => {
    const t = turn("모험가의 선술집 실내 맵을 만들어 줘.");
    await t.todo("모험가의 선술집", "interior");
    const wrong = { type: "interior", name: "모험가의 선술집", mapId: "", layout: { ...TAVERN, objects: [...TAVERN.objects, { id: "golden unicorn", x: 6, y: 5 }] } };
    const refused = await t.call("make_place", wrong);
    expect(refused.ok).toBe(false);
    expect(refused.body).toContain("Send make_place again with the same name");
    expect(refused.body).toContain("golden unicorn");
    expect(refused.body).not.toContain('"mapId":""');
    expect(refused.body).not.toContain("another type or style");
    expect(refused.body).not.toMatch(/\[Next call\] (?!make_place)/u);
    expect(t.forced).toEqual([]);
    const fixed = await t.call("edit_place", { patch: { mapId: "", layoutPatch: { remove_objects: [{ id: "golden unicorn", x: 6, y: 5 }] } } });
    expect(fixed.ok, fixed.body.slice(0, 600)).toBe(true);
    expect(t.ctx.project.maps[t.ctx.project.startMapId]!.name).toBe("모험가의 선술집");
    // 같은 방을 빈 mapId 로 다시 보내면 그 맵에서 다시 짓는다 — 맵이 늘지 않는다.
    const again = await t.call("make_place", { type: "interior", name: "모험가의 선술집", mapId: "", layout: TAVERN });
    expect(again.ok, again.body.slice(0, 600)).toBe(true);
    expect(Object.keys(t.ctx.project.maps)).toHaveLength(1);
  }, SLOW);

  it("빈 시작 맵에 온 edit_place 는 이름·맵 id 가 찬 make_place 를 이르고, 배치 전체가 오면 그대로 깐다", async () => {
    const t = turn("여관 실내를 만들어 줘.");
    await t.todo("여관", "interior");
    const refused = await t.call("edit_place", { patch: { mapId: "", addAnchors: [{ what: "침대" }] } });
    expect(refused.ok).toBe(false);
    expect(refused.body).toContain('make_place({"type":"interior","name":"여관","mapId":"map_blank_start"})');
    expect(refused.body).not.toContain('"mapId":""');
    expect(t.forced).toEqual([]);
    const laid = await t.call("edit_place", { patch: { mapId: "", set: { name: "여관", layout: TAVERN } } });
    expect(laid.ok, laid.body.slice(0, 600)).toBe(true);
    expect(t.ctx.project.maps.map_blank_start?.name).toBe("여관");
  }, SLOW);

  it("선 마을에 물건 하나를 더하려는 edit_place 는 그 물건을 놓는 호출을 맵 id·칸과 함께 이르고, draw_object 는 칩셋에 있는 물건의 place_object 를 이른다", async () => {
    const t = turn("시장 마을을 만들어 줘.");
    await t.call("todo", { op: "init", list: [{ phase: "p", items: [{ content: "마을 만들기", id: "v", check: { kind: "place", name: "시장 마을", placeKind: "village", fresh: true } }, { content: "광장에 노점 놓기", id: "stalls" }] }] });
    const spec = { type: "village", name: "시장 마을", style: "fantasy", size: "medium", features: ["plaza", "market stalls"], floors: 1 };
    // 버들항 마을은 첫 호출에 땅 그림을 돌려주고(실패 아님) 둘째 호출에 짓는다.
    let made = await t.call("make_place", spec);
    if (made.body.includes('"notFailure":true')) made = await t.call("make_place", spec);
    expect(made.ok, made.body.slice(0, 600)).toBe(true);
    const mapId = t.ctx.project.startMapId;
    const same = { name: "", size: "medium", floors: 1, features: ["plaza", "market stalls"] };
    const refused = await t.call("edit_place", { patch: { mapId, set: same, addAnchors: [{ zone: "광장", what: "시장 노점", near: { x: 21, y: 25 } }], variant: 0, dressing: 0 } });
    expect(refused.ok).toBe(false);
    expect(refused.body).toContain(`draw_object({"object":{"what":"시장 노점","mapId":"${mapId}","at":{"x":21,"y":25}}})`);
    expect(refused.body).not.toContain("[Next call]");
    // draw_object 는 이름이 맞는 칩셋 물건이 있으면 그것을 놓는 place_object 를 실제 id·칸으로 이른다.
    const drawn = await t.call("draw_object", { object: { what: "시장 노점", mapId, at: { x: 21, y: 25 } } });
    const next = /Next call: place_object\((\{.*?\})\) —/u.exec(drawn.body.replace(/\\"/gu, '"'))?.[1];
    expect(next, drawn.body.slice(0, 600)).toBeTruthy();
    expect(next).toContain(`"mapId":"${mapId}"`);
    expect(next).toContain('"at":{"x":');
    // 이른 objectId 는 이 맵 칩셋에 실제로 있는 킷이다(놓이는 칸은 마을 배치마다 달라 여기서 재지 않는다).
    const objectId = (JSON.parse(next!) as { objectId: string }).objectId;
    const map = t.ctx.project.maps[mapId]!;
    expect((t.ctx.project.tilesets[map.tilesetId]?.structureKits ?? []).some((kit) => kit.id === objectId)).toBe(true);
    // 바뀌는 것이 없는 고침은 그렇게 말하고 그 맵을 보는 호출을 이른다.
    const nothing = await t.call("edit_place", { patch: { mapId, set: same, variant: 0, dressing: 0, addAnchors: [] } });
    expect(nothing.ok).toBe(false);
    expect(nothing.body).toContain("changes nothing");
    expect(nothing.body).toContain(`inspect({"mapId":"${mapId}"})`);
    expect(t.forced).toEqual([]);
  }, SLOW);
});
