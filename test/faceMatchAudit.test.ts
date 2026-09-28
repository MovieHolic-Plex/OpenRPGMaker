// 얼굴 짝 전수 조사(2026-09-28) 회귀. 얼굴이 틀어지던 네 경로를 실제 도구·로더로 고정한다:
// 조수가 직접 넘긴 얼굴 · 기본값(파티·배우 기본 얼굴·시작 마을) · 억지 근사 칸 · 저장본 교정.
import { describe, expect, it } from "vitest";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { AUTHORABLE_FACESET_FACE_ASSETS } from "@/assets/facesetFaceAssets";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { reconcileFaceWithCharset, reviewedCharsetFaceRow, reviewedFaceIdForCharset } from "@/assets/reviewedCharsetFaces";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";
import { createBlankProject } from "@/project/defaults";
import { repairFaceMatches } from "@/project/faceMatchRepair";
import { deserialize, serialize } from "@/project/io";
import type { Command, GameEvent } from "@/project/types";

const OLD_MAN = { textureKey: "tex_easyrpg_charset_people1", characterIndex: 6 } as const; // 짝: people1-06
const SLIME_FACE = "easyrpg-faceset-monster-00";
const CUSTOM_FACE = "shared-brown-headband-expressions-01";

function faces(event: GameEvent | undefined): string[] {
  return (event?.pages ?? []).flatMap((page) => page.commands).filter((c): c is Extract<Command, { kind: "changeFace" }> => c.kind === "changeFace").map((c) => c.resourceId);
}
function run(ctx: ToolContext, tool: string, args: Record<string, unknown>) {
  const result = runTool(ctx, tool, args);
  expect(result.ok, result.summary).toBe(true);
  return result;
}
/** 쓰기 도구의 경고는 runner 가 diff.warnings 로 옮긴다. */
function warningsOf(result: ReturnType<typeof run>): string {
  return [...(result.warnings ?? []), ...(result.diff?.warnings ?? [])].join(" ");
}

describe("조수가 직접 넘긴 얼굴은 걷기 그림의 짝으로 교정된다", () => {
  it.each([
    ["place_npc face", "place_npc", { x: 2, y: 2, face: { resourceId: SLIME_FACE }, pages: [{ lines: ["안녕"] }] }],
    ["place_npc page.face", "place_npc", { x: 3, y: 2, pages: [{ lines: ["안녕"], face: { resourceId: SLIME_FACE } }] }],
    ["make_villager face", "make_villager", { home: { x: 4, y: 2 }, face: { resourceId: SLIME_FACE }, dialogue: [{ text: "안녕" }] }],
  ])("%s", (_label, tool, extra) => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = run(ctx, tool, { mapId: ctx.project.startMapId, name: "노인", graphic: OLD_MAN, ...extra });
    const event = ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId);
    expect(faces(event)).toEqual(["easyrpg-faceset-people1-06"]);
    expect(warningsOf(result)).toContain("짝 얼굴 easyrpg-faceset-people1-06");
  });

  it("얼굴 없음 그림에는 넘긴 번들 얼굴을 붙이지 않는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    // Object1 #6 보물 상자 — 얼굴이 없는 게 맞는 그림.
    const result = run(ctx, "place_npc", { mapId: ctx.project.startMapId, name: "말하는 상자", x: 2, y: 2,
      graphic: { textureKey: "tex_easyrpg_charset_object1", characterIndex: 6 }, face: { resourceId: "easyrpg-faceset-people2-06" }, pages: [{ lines: ["덜컹"] }] });
    const event = ctx.project.maps[ctx.project.startMapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId);
    expect(faces(event)).toEqual([]);
    expect(warningsOf(result)).toContain("맞는 얼굴이 없어");
  });

  it("업로드·생성 얼굴처럼 대응표 밖 얼굴은 작가 선택으로 둔다", () => {
    expect(reconcileFaceWithCharset(CUSTOM_FACE, OLD_MAN.textureKey, OLD_MAN.characterIndex)).toEqual({ faceResourceId: CUSTOM_FACE });
  });

  it("컷신 say.face 는 화자가 이 맵 NPC 면 그 걷기 그림의 짝으로 바뀐다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    run(ctx, "place_npc", { mapId, name: "노인", id: "ev_old", x: 2, y: 2, graphic: OLD_MAN, pages: [{ lines: ["안녕"] }] });
    const result = run(ctx, "script_cutscene", { mapId, x: 6, y: 2, beats: [
      { kind: "say", speaker: "노인", face: { resourceId: SLIME_FACE }, text: "옛날 이야기다." },
      { kind: "say", speaker: "나레이션", face: { resourceId: SLIME_FACE }, text: "맵 밖 화자는 건드리지 않는다." },
    ] });
    const event = ctx.project.maps[mapId]!.events.find((e) => e.id === (result.data as { eventId: string }).eventId);
    expect(faces(event)).toEqual(["easyrpg-faceset-people1-06", SLIME_FACE]);
  });

  it("upsert_actor 는 넘긴 얼굴과 그림만 바꾼 경우 모두 짝을 따른다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    run(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "easyrpg-charset-actor2", characterIndex: 0, faceResourceId: SLIME_FACE } });
    expect(ctx.project.database.actors.find((a) => a.id === "actor_hero")?.faceResourceId).toBe("easyrpg-faceset-actor1-08");
    run(ctx, "upsert_actor", { actor: { id: "actor_hero", characterResourceId: "easyrpg-charset-actor3", characterIndex: 1 } });
    expect(ctx.project.database.actors.find((a) => a.id === "actor_hero")?.faceResourceId).toBe("easyrpg-faceset-actor2-01");
  });

  it("list_resources 가 faceset 을 라벨과 짝 걷기 그림으로 찾는다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const result = run(ctx, "list_resources", { kind: "faceset", query: "흰 수염" });
    const matches = (result.data as { matches: { id: string; description?: string }[] }).matches;
    const oldMan = matches.find((m) => m.id === "easyrpg-faceset-people1-06");
    expect(oldMan?.description).toContain("tex_easyrpg_charset_people1#6");
    const npc = run(ctx, "list_npc_graphics", { query: "할머니" });
    const first = (npc.data as { matches: { textureKey: string; characterIndex: number; face: { resourceId: string } | null }[] }).matches[0]!;
    expect(first.face?.resourceId ?? null).toBe(reviewedFaceIdForCharset(first.textureKey, first.characterIndex) ?? null);
  });
});

describe("기본값은 걷기 그림의 짝이다", () => {
  it("새 프로젝트의 배우 전원과 시작 마을 NPC", () => {
    const project = createBlankProject();
    for (const actor of project.database.actors) {
      if (!actor.characterResourceId || !actor.faceResourceId) continue;
      expect(actor.faceResourceId, actor.id).toBe(reviewedFaceIdForCharset(actor.characterResourceId, actor.characterIndex ?? 0));
    }
    for (const event of Object.values(project.maps).flatMap((map) => map.events)) {
      const page = event.pages?.[0];
      const face = faces(event)[0];
      if (!face || !page?.graphic.sprite?.id) continue;
      const index = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => charsetFrameIndex({ characterIndex: i, direction: "down", pattern: 1 }) === page.graphic.pattern) ?? 0;
      expect(face, event.id).toBe(reviewedFaceIdForCharset(page.graphic.sprite.id, index));
    }
  });

  it("배우 기본 얼굴은 이름이 같은 시트가 아니라 짝을 쓴다", () => {
    expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-actor2" })).toBe("easyrpg-faceset-actor1-08");
    expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-actor4", characterIndex: 3 })).toBe("easyrpg-faceset-actor2-11");
    expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-people4", characterIndex: 5 })).toBe("generated-faceset-missing-people-05");
    expect(defaultActorFaceResourceId({ id: "x", characterResourceId: "easyrpg-charset-vehicles", characterIndex: 1 })).toBeUndefined();
  });
});

describe("원본에 얼굴이 없던 인물은 생성 짝 얼굴을 쓴다", () => {
  // 억지 근사 7칸 + 원래 얼굴 없음이던 사람·몬스터·Scarloxy 18칸. 생성 얼굴은 파일이 있어야 한다.
  it.each([
    ["tex_easyrpg_charset_people4", 1, "generated-faceset-missing-people-01"],
    ["tex_easyrpg_charset_people4", 5, "generated-faceset-missing-people-05"],
    ["tex_easyrpg_charset_people5", 3, "generated-faceset-missing-people-08"],
    ["tex_easyrpg_charset_actor3", 5, "generated-faceset-missing-people-10"],
    ["tex_easyrpg_charset_monster3", 2, "generated-faceset-missing-people-14"],
    ["tex_scarloxy_charset_people1", 0, "generated-faceset-missing-scarloxy-00"],
    ["tex_scarloxy_charset_people2", 1, "generated-faceset-missing-scarloxy-09"],
    ["tex_easyrpg_charset_animal", 1, "generated-faceset-missing-people-11"],
    ["tex_easyrpg_charset_monster3", 5, "generated-faceset-missing-monster-01"],
  ] as const)("%s #%i → %s", (textureKey, index, faceId) => {
    expect(reviewedCharsetFaceRow(textureKey, index)).toMatchObject({ status: "mapped", faceResourceId: faceId });
    expect(resolveAssetResourceUrl(faceId)).toMatch(/^\/assets\/generated\/faceset\/missing-(people|scarloxy|monster)\/\d{2}\.png$/);
  });
  it("사물·탈것·빈 칸은 계속 얼굴이 없고, 빈 생성 칸은 얼굴 목록에 없다", () => {
    for (const [textureKey, index] of [["tex_easyrpg_charset_object1", 6], ["tex_easyrpg_charset_vehicles", 1], ["tex_scarloxy_charset_people2", 2]] as const) {
      expect(reviewedCharsetFaceRow(textureKey, index)?.status).toBe("no-face");
    }
    const authorable = new Set(AUTHORABLE_FACESET_FACE_ASSETS.map((face) => face.id));
    expect(authorable.has("generated-faceset-missing-people-00")).toBe(true);
    expect(authorable.has("generated-faceset-missing-people-11")).toBe(true);
    expect(authorable.has("generated-faceset-missing-scarloxy-10")).toBe(false);
    expect(authorable.has("generated-faceset-missing-monster-03")).toBe(false);
  });
  it("place_npc 는 생성 짝 얼굴을 자동으로 붙이고, 틀린 번들 얼굴은 생성 짝으로 교정한다", () => {
    const ctx: ToolContext = { project: createBlankProject() };
    const mapId = ctx.project.startMapId;
    const auto = run(ctx, "place_npc", { mapId, name: "상인", x: 2, y: 2, graphic: { textureKey: "tex_easyrpg_charset_people4", characterIndex: 5 }, pages: [{ lines: ["어서 오세요"] }] });
    expect(faces(ctx.project.maps[mapId]!.events.find((e) => e.id === (auto.data as { eventId: string }).eventId))).toEqual(["generated-faceset-missing-people-05"]);
    const fixed = run(ctx, "place_npc", { mapId, name: "상인둘", x: 4, y: 2, graphic: { textureKey: "tex_easyrpg_charset_people4", characterIndex: 5 }, face: { resourceId: "easyrpg-faceset-people2-06" }, pages: [{ lines: ["어서 오세요"] }] });
    expect(faces(ctx.project.maps[mapId]!.events.find((e) => e.id === (fixed.data as { eventId: string }).eventId))).toEqual(["generated-faceset-missing-people-05"]);
  });
});

describe("저장본은 불러올 때 짝으로 교정된다", () => {
  it("옛 기본값 배우 얼굴과 NPC 첫 얼굴을 고치고, 다른 화자 얼굴과 업로드 얼굴은 둔다", () => {
    const project = createBlankProject();
    const guardian = project.database.actors.find((a) => a.id === "actor_guardian")!;
    guardian.faceResourceId = "easyrpg-faceset-actor2-00"; // 옛 "이름이 같은 시트" 기본값
    // 대응표 밖 얼굴(생성 표정 세트)은 작가 선택이라 그대로 둔다.
    const custom = project.database.actors.find((a) => a.id === "actor_hero")!;
    custom.faceResourceId = CUSTOM_FACE;
    const map = project.maps[project.startMapId]!;
    const pattern = charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 });
    map.events.push({ id: "ev_saved_npc", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "p0", name: "신사", conditions: [], trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people2" }, direction: "down", pattern },
      commands: [
        { kind: "changeFace", resourceId: "easyrpg-faceset-people1-00", position: "left", flipHorizontally: false },
        { kind: "text", speaker: "신사", body: "안녕" },
        { kind: "changeFace", resourceId: "easyrpg-faceset-actor1-00", position: "right", flipHorizontally: false },
        { kind: "text", speaker: "용사", body: "네" },
      ],
    }] });
    const result = repairFaceMatches(project);
    expect(result.actors).toBeGreaterThanOrEqual(1);
    expect(result.eventFaces).toBeGreaterThanOrEqual(1);
    expect(guardian.faceResourceId).toBe("easyrpg-faceset-actor1-08");
    expect(custom.faceResourceId).toBe(CUSTOM_FACE);
    const saved = map.events.find((e) => e.id === "ev_saved_npc");
    expect(faces(saved)).toEqual(["easyrpg-faceset-people2-06", "easyrpg-faceset-actor1-00"]);
    // 저장 → 다시 불러오기 → 두 번째 교정은 아무것도 바꾸지 않는다(멱등).
    const reloaded = deserialize(serialize(project));
    expect(repairFaceMatches(reloaded)).toEqual({ actors: 0, eventFaces: 0 });
    expect(faces(reloaded.maps[project.startMapId]!.events.find((e) => e.id === "ev_saved_npc"))[0]).toBe("easyrpg-faceset-people2-06");
  });

  it("얼굴 없음 그림의 첫 얼굴은 뺀다", () => {
    const project = createBlankProject();
    const pattern = charsetFrameIndex({ characterIndex: 6, direction: "down", pattern: 1 });
    project.maps[project.startMapId]!.events.push({ id: "ev_no_face", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "p0", name: "보물 상자", conditions: [], trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, direction: "down", pattern },
      commands: [
        { kind: "changeFace", resourceId: "easyrpg-faceset-people2-09", position: "left", flipHorizontally: false },
        { kind: "text", speaker: "보물 상자", body: "덜컹" },
      ],
    }] });
    expect(repairFaceMatches(project).eventFaces).toBe(1);
    expect(faces(project.maps[project.startMapId]!.events.find((e) => e.id === "ev_no_face"))).toEqual([]);
  });
});

