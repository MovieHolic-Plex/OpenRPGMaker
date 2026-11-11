// 이름표는 물건 이름의 끝 낱말로 맞춘다 · 그림이 없어 못 한 것은 적는다.
// 2026-11-11 단계×테마 표: 「책상 서랍의 쪽지」 밑에 설원 「목책」 말뚝이 깔렸고(책 ⊂ 책상, 책 ⊂ 목책), 「술통 받침대」가 은신처가 됐다(침대 ⊂ 받침대).
// 봉인 제단·굴 입구는 버들항 조각뿐이라 다른 칩셋에서는 단계가 말없이 지나갔다.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { hideRankForLabel } from "@/project/chaserHiding";
import { labelNames } from "@/project/labelWords";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { hostWords, itemTileWords, singleTileObject } from "@/ai/v2/judge/eventReach";
import { dressBareCaveGates } from "@/ai/v2/place/caveGates";
import { doorFloorTransfers } from "@/ai/v2/place/exitTransfers";
import { stage as chaserHiding } from "@/ai/v2/finish/lanes/stages/chaser-hiding";
import { recordArtGaps, type ArtGap } from "@/ai/v2/shared/artGap";
import type { FinishCtx } from "@/ai/v2/finish/types";
import type { BuildRun } from "@/ai/v2/shared/types";

type Ctx = { project: Project };
const runOf = (ctx: Ctx): BuildRun => ({ ctx, calls: [], call: (tool: string, args: Record<string, unknown>) => runTool(ctx, tool, args) }) as unknown as BuildRun;
const addEvents = (ctx: Ctx, mapId: string, ...events: GameEvent[]) => {
  const map = ctx.project.maps[mapId]!;
  ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, [mapId]: { ...map, events: [...map.events, ...events] } } };
};
const transferTo = (id: string, x: number, y: number, mapId: string): GameEvent => ({
  id, name: "", x, y, trigger: { kind: "playerTouch" }, commands: [],
  pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId, x: 2, y: 2, direction: "down" }] }],
}) as unknown as GameEvent;
/** 단계가 받는 것 가운데 이 시험이 쓰는 것만 — 턴 기록과 보고 줄이 어디에 남는지 본다. */
function stageCtx(ctx: Ctx) {
  const emitted: { name: string; data?: unknown }[] = [];
  const session = { missingArt: new Set<string>() };
  const finish = { env: { ctx, emit: (e: { name: string; data?: unknown }) => emitted.push(e) }, session, notes: [] as string[] } as unknown as FinishCtx;
  return { finish, emitted, session };
}

describe("a label is matched by the thing it names", () => {
  it("a label is the thing its name ends with — not a word inside a longer word, nor a word in its description", () => {
    expect(labelNames("목책(통나무 말뚝 울타리)", "책")).toBe(false);
    expect(labelNames("가게 장부 책상", "책")).toBe(false);
    expect(labelNames("술통 받침대", "침대")).toBe(false);
    expect(labelNames("bedside table", "bed")).toBe(false);
    // 괄호 속 설명·꾸미는 말에 든 낱말은 그 물건이 아니다.
    expect(labelNames("안돈(종이 등잔) 0,0", "종이")).toBe(false);
    expect(labelNames("낮은 서류 캐비닛 0,0", "서류")).toBe(false);
    expect(labelNames("헛간부엉이 편지 비행", "편지")).toBe(false);
    expect(labelNames("침대 옆 협탁", "침대")).toBe(false);
    expect(labelNames("책 더미(탁상)", "책 더미")).toBe(true);
    expect(labelNames("탁상 물건 · 책 더미", "책 더미")).toBe(true);
    expect(labelNames("침대(머리맡 왼쪽)", "침대")).toBe(true);
    expect(labelNames("나무 상자 (0,0)", "상자")).toBe(true);
    expect(labelNames("버들항 · 책장 A (0,0)", "책장")).toBe(true);
    expect(labelNames("책장 0,1", "책장")).toBe(true);
    expect(labelNames("가게 장부 책상", "책상")).toBe(true);
    expect(labelNames("wooden bed", "bed")).toBe(true);
    // 영어 이름표는 물건 뒤에 설명이 붙는다.
    expect(labelNames("wooden ship bunk bed with pillow at the north end and a fold", "bed")).toBe(true);
    expect(labelNames("captain's large wooden bed seen from above at 3/4: carved headboard", "bed")).toBe(true);
    expect(labelNames("bedside table with a lamp", "bed")).toBe(false);
    expect(labelNames("pile of books", "book")).toBe(false);
  });

  it("hiding furniture is furniture, not a word that contains one", () => {
    for (const label of ["술통 받침대", "선반 기계(공작)", "증기 기관", "커튼월 유리", "침대 옆 협탁"]) expect(hideRankForLabel(label), label).toBeNull();
    expect(hideRankForLabel("옷장")).toBe(0);
    expect(hideRankForLabel("철제 캐비닛")).toBe(0);
    expect(hideRankForLabel("병원 침대")).toBe(1);
    expect(hideRankForLabel("두꺼운 커튼")).toBe(2);
    expect(hideRankForLabel("wooden ship bunk bed with pillow at the north end and a fold")).toBe(1);
  });

  it("reads the thing an event name is about: the longest word wins, the last small thing is the thing", () => {
    // 「책상」 안의 「책」은 책이 아니다 — 이 이름은 쪽지다.
    expect(itemTileWords("책상 서랍의 쪽지")).toEqual(["서류", "종이", "편지", "책 더미"]);
    expect(hostWords("책상 서랍의 쪽지")[0]).toEqual(["책상", "desk"]);
    // 이름과 이름표가 같은 겹낱말을 쓰면 그대로 맞는다.
    expect(hostWords("낡은 보물상자")[0]?.[0]).toBe("보물상자");
    expect(itemTileWords("침대 밑 상자")[0]).toBe("상자");
    expect(itemTileWords("잠든 장치")).toEqual([]);
  });

  it("lays no palisade for a book on the snow chipset, no paper lantern for a note on the Edo one", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_s", name: "설원", width: 48, height: 36, tilesetId: "snow_north" }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_e", name: "에도", width: 48, height: 36, tilesetId: "sengoku_edo" }).ok).toBe(true);
    // 에도 칩셋에서는 같은 이름 밑에 「안돈(종이 등잔)」 이 깔렸다 — 종이는 그 등잔의 재료다.
    expect(singleTileObject(ctx.project, ctx.project.maps.map_e!, itemTileWords("책상 서랍의 쪽지"))?.label ?? "").not.toContain("안돈");
    const map = ctx.project.maps.map_s!;
    for (const name of ["책상 서랍의 쪽지", "낡은 기록", "목책 옆 쪽지"]) {
      const words = itemTileWords(name);
      const art = singleTileObject(ctx.project, map, words);
      // 없으면 깔지 않는다. 있으면 그 낱말이 이름표에 온전히 있어야 한다.
      if (art) expect(words.some((w) => labelNames(art.label, w)), `${name} → ${art.label}`).toBe(true);
      expect(art?.label ?? "").not.toContain("목책");
    }
  });
});

describe("a stage with no art for this chipset says so", () => {
  const gap: ArtGap = { tilesetId: "desert_east", want: "altar/seal", thing: "봉인·제단 그림", note: "「고대의 봉인」", mapId: "map_d", x: 7, y: 9 };

  it("writes one report line and one v2.art-gap record per spot, however often the stage runs", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_d", name: "사막", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
    const { finish, emitted, session } = stageCtx(ctx);
    recordArtGaps(finish, "seal-step-art", [gap]);
    recordArtGaps(finish, "seal-step-art", [gap]);
    // 줄은 그림 이름으로 시작한다(없는 그림 장부가 첫 괄호 앞을 그림 이름으로 읽는다) — 이벤트·맵 이름으로 시작하지 않는다.
    expect([...session.missingArt]).toEqual(["봉인·제단 그림 (altar/seal) — 칩셋 desert_east 에 없어 사막 7,9 를 그대로 둠: 「고대의 봉인」"]);
    expect([...session.missingArt][0]!.replace(/\s*\(.*$/u, "")).toBe("봉인·제단 그림");
    expect(emitted).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ name: "v2.art-gap", data: { stage: "seal-step-art", tilesetId: "desert_east", want: "altar/seal", mapId: "map_d", x: 7, y: 9 } });
  });

  it("chaser-hiding: a chaser's map with nothing to hide in", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_d", name: "사막 방", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
    addEvents(ctx, "map_d", { id: "ev_chaser", name: "쫓는 그림자", x: 5, y: 5, trigger: { kind: "eventTouch" }, commands: [], pages: [{ id: "ev_chaser_p0", conditions: [], trigger: { kind: "eventTouch" }, movement: { type: "chase", speed: 3, frequency: 3 }, commands: [{ kind: "gameOver" }] }] } as unknown as GameEvent);
    const { finish, emitted, session } = stageCtx(ctx);
    chaserHiding.run(finish, "");
    expect(ctx.project.maps.map_d!.events.some((e) => e.id.startsWith("ev_hide_"))).toBe(false);
    expect(emitted.filter((e) => e.name === "v2.art-gap")).toHaveLength(1);
    expect(emitted[0]).toMatchObject({ data: { stage: "chaser-hiding", tilesetId: "desert_east", want: "hiding furniture", thing: "숨을 가구", mapId: "map_d", x: 5, y: 5 } });
    expect(session.missingArt.size).toBe(1);
  });

  it("cave-gates: a bare dungeon entrance on a chipset the cave-mouth piece was not drawn for", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_d", name: "사막", width: 30, height: 24, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_c", name: "모래 굴", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
    ctx.project = { ...ctx.project, maps: { ...ctx.project.maps, map_c: { ...ctx.project.maps.map_c!, mapRole: "dungeon" } as GameMap } };
    addEvents(ctx, "map_d", transferTo("ev_cave", 12, 10, "map_c"));
    const before = JSON.stringify(ctx.project.maps.map_d);
    const gaps: ArtGap[] = [];
    expect(dressBareCaveGates(runOf(ctx), "map_d", gaps)).toEqual([]);
    expect(gaps).toMatchObject([{ tilesetId: "desert_east", want: "cave mouth", thing: "굴 입구 그림", mapId: "map_d", x: 12, y: 10 }]);
    expect(JSON.stringify(ctx.project.maps.map_d)).toBe(before);
  });

  it("door-floor-transfers: a room whose chipset declares no door to seat the transfer on", () => {
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "create_map", { id: "map_r", name: "찻집", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
    expect(runTool(ctx, "create_map", { id: "map_o", name: "거리", width: 20, height: 15, tilesetId: "desert_east" }).ok).toBe(true);
    addEvents(ctx, "map_r", transferTo("ev_out", 8, 7, "map_o"));
    const before = JSON.stringify(ctx.project.maps.map_r);
    const gaps: ArtGap[] = [];
    expect(doorFloorTransfers(runOf(ctx), "map_r", "room", gaps)).toEqual([]);
    expect(gaps).toMatchObject([{ tilesetId: "desert_east", want: "door piece", thing: "벽 문 그림", mapId: "map_r", x: 8, y: 7 }]);
    expect(JSON.stringify(ctx.project.maps.map_r)).toBe(before);
    // 바깥으로 깔린 맵은 방 단계의 일이 아니다 — 적지도 않는다.
    const outdoorGaps: ArtGap[] = [];
    expect(doorFloorTransfers(runOf(ctx), "map_r", "outdoor", outdoorGaps)).toEqual([]);
    expect(outdoorGaps).toEqual([]);
  });
});
