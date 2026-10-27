import { runTool } from "@/editor/tools";
import { describe, expect, it } from "vitest";
import { checkRomance, isRomanceCheckTarget, isRomanceGameRequest, romanceCompletionGaps } from "@/qa/gameCheck/romance";
import { createBlankProject } from "@/project/defaults";
import { installDeadlineEnding } from "@/project/deadlineEnding";
import { romanceTitleArtForText, ROMANCE_TITLE_BACKGROUNDS } from "@/project/romanceTitleArt";
import type { GameEvent, Project } from "@/project/types";

function romanceProject(): Project {
  const project = createBlankProject();
  project.system.fieldHud = { theme: "hearts", widgets: [] } as never;
  return project;
}
const npc = (id: string, patch: Partial<GameEvent> & { chip?: string } = {}): GameEvent => ({
  id, name: id, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
  characterId: `char_${id}`, talkFriendship: true,
  pages: [{ id: `${id}_p0`, name: "p", conditions: [], trigger: { kind: "action" }, commands: [], movement: { type: "fixed" },
    graphic: patch.chip ? { sprite: { type: "bundled", id: patch.chip }, pattern: 1 } : { transparent: true } }],
  ...patch,
} as unknown as GameEvent);
const codes = (project: Project) => checkRomance(project).map((finding) => finding.code);

describe("checkRomance — 연애 게임 부합 경고", () => {
  it("연애 프로젝트가 아니면 아무것도 말하지 않는다", () => {
    const project = createBlankProject();
    expect(isRomanceCheckTarget(project, "")).toBe(false);
    expect(checkRomance(project, "")).toEqual([]);
  });

  it("뼈대 자리표시(기억의 길·첫 구간 끝)가 남으면 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    project.maps.map_segment_route = { ...structuredClone(map), id: "map_segment_route", name: "기억의 길" };
    project.endings = [{ id: "ending_first_segment", name: "첫 구간 끝", conditions: [], priority: 0 } as never];
    const found = checkRomance(project).find((finding) => finding.code === "romance-skeleton-leftover");
    expect(found?.message).toContain("기억의 길");
    expect(found?.message).toContain("첫 구간 끝");
  });

  it("엔딩이 뼈대 하나뿐이면 짚고, 인물 엔딩이 더 있으면 조용하다", () => {
    const project = romanceProject();
    project.endings = [{ id: "ending_first_segment", name: "끝", conditions: [], priority: 0 } as never];
    expect(codes(project)).toContain("romance-only-skeleton-ending");
    project.endings.push({ id: "ending_a", name: "해피", conditions: [], priority: 1 } as never);
    expect(codes(project)).not.toContain("romance-only-skeleton-ending");
  });

  it("호감 인물이 하나도 없으면 짚는다", () => {
    expect(codes(romanceProject())).toContain("romance-no-relationship");
    const project = romanceProject();
    Object.values(project.maps)[0]!.events.push(npc("han", { chip: "sheetA" }));
    expect(codes(project)).not.toContain("romance-no-relationship");
  });

  it("투명한 인물·같은 칩을 나눠 쓰는 서로 다른 인물을 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    map.events.push(npc("a"), npc("b", { chip: "sheetA" }), npc("c", { chip: "sheetA" }));
    const got = checkRomance(project);
    expect(got.find((finding) => finding.code === "romance-npc-invisible")?.message).toContain("1/3");
    expect(got.some((finding) => finding.code === "romance-npc-duplicate-chip")).toBe(true);
  });

  it("대사 본문 앞의 「[이름]」 이중 표기를 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    const person = npc("han", { chip: "sheetA" });
    (person.pages[0] as { commands: unknown[] }).commands = [{ kind: "text", speaker: "한", body: "\"[한]\n안녕\"" }];
    map.events.push(person);
    expect(codes(project)).toContain("romance-speaker-in-body");
  });
  it("기한 엔딩의 마지막 기본 결말이 조건 달린 엔딩이면 짚고, 조건 없는 엔딩이면 조용하다", () => {
    const project = romanceProject();
    project.system.timeSystem = { enabled: true, onDayEnd: "ce_deadline" } as never;
    project.endings = [
      { id: "ending_han", name: "한", conditions: [{ kind: "friendshipAtLeast", npcKey: "han", value: 10 }], priority: 1 },
      { id: "ending_normal", name: "평범", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 5 }], priority: 0 },
    ] as never;
    const chain = (fallback: string) => [{
      kind: "fork", condition: { kind: "variable", variableId: "var_days", op: ">=", value: 14 },
      then: [{ kind: "fork", condition: { kind: "friendshipAtLeast", npcKey: "han", value: 10 },
        then: [{ kind: "triggerEnding", endingId: "ending_han" }], else: [{ kind: "triggerEnding", endingId: fallback }] }],
    }];
    project.commonEvents = [{ id: "ce_deadline", name: "기한", trigger: "none", commands: chain("ending_normal") }] as never;
    expect(codes(project)).toContain("romance-deadline-no-fallback");
    (project.endings![1] as { conditions: unknown[] }).conditions = [];
    expect(codes(project)).not.toContain("romance-deadline-no-fallback");
  });

  it("동사 없이 소재만 적은 한 줄도 제작 요청이고, 고치기·삭제 요청은 아니다", () => {
    expect(isRomanceGameRequest("고등학교 학원물 연애 게임, 여러 명 중 한 명과 이어지는 엔딩")).toBe(true);
    expect(isRomanceGameRequest("카페 아르바이트 로맨스 게임 만들어 줘")).toBe(true);
    expect(isRomanceGameRequest("연애 게임 맵 좀 고쳐줘")).toBe(false);
    expect(isRomanceGameRequest("던전 RPG 만들어 줘")).toBe(false);
  });
  it("소재별 연애 타이틀: 기획 문장이 카페·학원·회사·마을이면 그 키아트를 권하고, 캠퍼스·무소재면 기본 그림이 맞다", () => {
    expect(romanceTitleArtForText("카페 아르바이트 로맨스 게임 만들어 줘")?.setting).toBe("cafe");
    expect(romanceTitleArtForText("고등학교 학원물 연애 게임, 여러 명 중 한 명과 이어지는 엔딩")?.setting).toBe("school");
    expect(romanceTitleArtForText("회사 동기와의 사내 연애, 야근 뒤 옥상")?.setting).toBe("office");
    expect(romanceTitleArtForText("바닷가 마을 이웃과의 연애")?.setting).toBe("town");
    expect(romanceTitleArtForText("대학교 캠퍼스에서 시작하는 연애 시뮬레이션 만들어 줘")).toBeUndefined();
    expect(romanceTitleArtForText("연애 게임")).toBeUndefined();
    expect(romanceTitleArtForText("대학 동아리 카페 알바")?.setting).toBeUndefined(); // 캠퍼스 2점 vs 카페 1점
    for (const setting of ["cafe", "school", "office", "town"]) expect(ROMANCE_TITLE_BACKGROUNDS).toContain(`oprn-title-romance-${setting}`);
  });

  it("타이틀이 기본 캠퍼스 그림인데 기획이 다른 소재면 완료 조건 경고, 다른 그림이면 조용하다", () => {
    const project = romanceProject();
    project.system.titleScreen = { ...(project.system.titleScreen ?? {}), backgroundResourceId: "oprn-title-romance-campus" } as never;
    const got = checkRomance(project, "카페 아르바이트 로맨스 게임 만들어 줘").find((finding) => finding.code === "romance-title-art-setting");
    expect(got?.message).toContain("oprn-title-romance-cafe");
    expect(checkRomance(project, "대학교 캠퍼스 연애 시뮬레이션").some((finding) => finding.code === "romance-title-art-setting")).toBe(false);
    (project.system.titleScreen as { backgroundResourceId: string }).backgroundResourceId = "oprn-title-romance-cafe";
    expect(checkRomance(project, "카페 아르바이트 로맨스 게임 만들어 줘").some((finding) => finding.code === "romance-title-art-setting")).toBe(false);
  });

  it("다른 소재의 키아트가 걸려 있어도(카페 기획에 마을 그림) 완료 조건 경고를 준다", () => {
    const project = romanceProject();
    project.system.titleScreen = { ...(project.system.titleScreen ?? {}), backgroundResourceId: "oprn-title-romance-town" } as never;
    const got = checkRomance(project, "카페 아르바이트 로맨스 게임 만들어 줘").find((finding) => finding.code === "romance-title-art-setting");
    expect(got?.message).toContain("oprn-title-romance-cafe");
    expect(checkRomance(project, "바닷가 이웃마을 썸 연애 게임").some((finding) => finding.code === "romance-title-art-setting")).toBe(false);
  });


  it("엔딩이 보는 인물의 호감이 어디서도 오르지 않으면 짚는다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    map.events.push(npc("a"), npc("b", { talkFriendship: false }));
    project.endings = [
      { id: "ending_a", name: "A와", conditions: [{ kind: "friendshipAtLeast", npcKey: "char_a", value: 10 }], priority: 30 },
      { id: "ending_b", name: "B와", conditions: [{ kind: "friendshipAtLeast", npcKey: "char_b", value: 10 }], priority: 30 },
    ] as never;
    const got = checkRomance(project).find((finding) => finding.code === "romance-ending-npc-unreachable");
    expect(got?.message).toContain("char_b");
    expect(got?.message).not.toContain("char_a");
    map.events.find((event) => event.id === "b")!.talkFriendship = true;
    expect(codes(project)).not.toContain("romance-ending-npc-unreachable");
  });



  it("set_deadline_ending 은 tiers 를 생략하고 인물이 둘 이상이면 인물 엔딩을 만들어 맨 위에 얹는다", () => {
    const ctx = { project: romanceProject() };
    ctx.project.system.timeSystem = { enabled: true } as never;
    const map = Object.values(ctx.project.maps)[0]!;
    // 투명 이벤트는 사람이 아니라 인물 엔딩에서 빠진다(canonicalizeRomanceHeroines, #2894) — 두 인물에게 칩을 단다.
    map.events.push(npc("a", { chip: "tex_oprn_charset_modern2" }), npc("b", { chip: "tex_oprn_charset_modern2" }));
    ctx.project.endings = [
      { id: "ending_first_segment", name: "혼자", conditions: [], priority: 0 },
      { id: "ending_romance_happy", name: "해피", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 60 }], priority: 20 },
      { id: "ending_romance_normal", name: "평범", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 25 }], priority: 10 },
    ] as never;
    const result = runTool(ctx, "set_deadline_ending", { days: 14 });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    const ids = (ctx.project.endings ?? []).map((ending) => ending.id);
    expect(ids).toContain("ending_with_char_a");
    expect(ids).toContain("ending_with_char_b");
    expect(JSON.stringify(ctx.project.commonEvents)).toContain("ending_with_char_a");
    expect(checkRomance(ctx.project).some((finding) => finding.code === "romance-endings-not-per-heroine")).toBe(false);
  });

  it("place_npc 로 호감 대화 인물이 둘이 되면 프리셋 기한 판정에 인물 엔딩이 얹힌다", () => {
    const project = romanceProject();
    project.system.timeSystem = { enabled: true } as never;
    project.endings = [
      { id: "ending_first_segment", name: "혼자", conditions: [], priority: 0 },
      { id: "ending_romance_happy", name: "해피", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 60 }], priority: 20 },
      { id: "ending_romance_normal", name: "평범", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 25 }], priority: 10 },
    ] as never;
    installDeadlineEnding(project, 14, [
      { endingId: "ending_romance_happy", threshold: 60, characterId: "*" }, { endingId: "ending_romance_normal", threshold: 25, characterId: "*" }, { endingId: "ending_first_segment" }]);
    const ctx = { project };
    const place = (id: string, x: number) => runTool(ctx, "place_npc", { mapId: project.startMapId, x, y: 8, name: id, characterId: `char_${id}`, talkFriendship: true, pages: [{ lines: ["안녕"] }] });
    expect(place("a", 3).ok).toBe(true);
    expect((ctx.project.endings ?? []).some((ending) => ending.id.startsWith("ending_with_"))).toBe(false);
    expect(place("b", 5).ok).toBe(true);
    expect((ctx.project.endings ?? []).map((ending) => ending.id)).toEqual(expect.arrayContaining(["ending_with_char_a", "ending_with_char_b"]));
    expect(JSON.stringify(ctx.project.commonEvents)).toContain("ending_with_char_b");
  });

  it("인물 엔딩이 있어도 기한 판정이 하나도 안 부르면 짚고, 얹으면 조용하다", () => {
    const project = romanceProject();
    project.system.timeSystem = { enabled: true } as never;
    project.endings = [
      { id: "ending_first_segment", name: "혼자", conditions: [], priority: 0 },
      { id: "ending_romance_happy", name: "해피", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 60 }], priority: 20 },
      { id: "ending_with_a", name: "A와", conditions: [{ kind: "friendshipAtLeast", npcKey: "char_a", value: 60 }], priority: 36 },
      { id: "ending_with_b", name: "B와", conditions: [{ kind: "friendshipAtLeast", npcKey: "char_b", value: 60 }], priority: 36 },
    ] as never;
    installDeadlineEnding(project, 14, [{ endingId: "ending_romance_happy", threshold: 60, characterId: "*" }, { endingId: "ending_first_segment" }]);
    expect(codes(project)).toContain("romance-heroine-endings-uncalled");
    installDeadlineEnding(project, 14, [
      { endingId: "ending_with_a", threshold: 60, characterId: "char_a" }, { endingId: "ending_with_b", threshold: 60, characterId: "char_b" },
      { endingId: "ending_romance_happy", threshold: 60, characterId: "*" }, { endingId: "ending_first_segment" }]);
    expect(codes(project)).not.toContain("romance-heroine-endings-uncalled");
  });

  it("같은 이름의 호감 인물이 맵마다 다른 characterId 면 짚는다", () => {
    const project = romanceProject();
    const maps = Object.values(project.maps);
    const second = { ...structuredClone(maps[0]!), id: "map_two", name: "둘째" } as never as (typeof maps)[number];
    second.events = [npc("x", { name: "하은", characterId: "haeun_2" })];
    maps[0]!.events.push(npc("y", { name: "하은", characterId: "haeun" }));
    project.maps.map_two = second;
    expect(codes(project)).toContain("romance-heroine-id-split");
    second.events[0]!.characterId = "haeun";
    expect(codes(project)).not.toContain("romance-heroine-id-split");
  });


  it("한글 characterId 인물도 서로 다른 엔딩 id 를 받고 기한 판정은 일반 해피를 뺀다", () => {
    const project = romanceProject();
    project.system.timeSystem = { enabled: true } as never;
    project.endings = [
      { id: "ending_first_segment", name: "혼자", conditions: [], priority: 0 },
      { id: "ending_romance_happy", name: "해피", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 60 }], priority: 20 },
      { id: "ending_romance_normal", name: "평범", conditions: [{ kind: "friendshipAtLeast", npcKey: "*", value: 25 }], priority: 10 },
    ] as never;
    installDeadlineEnding(project, 14, [
      { endingId: "ending_romance_happy", threshold: 60, characterId: "*" }, { endingId: "ending_romance_normal", threshold: 25, characterId: "*" }, { endingId: "ending_first_segment" }]);
    const ctx = { project };
    const place = (name: string, x: number) => runTool(ctx, "place_npc", { mapId: project.startMapId, x, y: 8, name, characterId: name, talkFriendship: true, pages: [{ lines: ["안녕"] }] });
    expect(place("한서윤", 3).ok).toBe(true);
    expect(place("윤하늘", 5).ok).toBe(true);
    expect(place("강나래", 7).ok).toBe(true);
    const made = (ctx.project.endings ?? []).filter((ending) => ending.id.startsWith("ending_with_"));
    expect(new Set(made.map((ending) => ending.id)).size).toBe(3);
    expect(made.every((ending) => ending.id.length > "ending_with_".length + 1)).toBe(true);
    const chain = JSON.stringify(ctx.project.commonEvents);
    for (const ending of made) expect(chain).toContain(ending.id);
    // #2826: 인물 엔딩이 들어서면 같은 문턱의 일반 해피는 닿을 수 없어 기한 판정에서 뺀다(retireGenericHappy).
    expect(chain).not.toContain("ending_romance_happy");
    expect(codes(ctx.project)).not.toContain("romance-heroine-endings-uncalled");
  });

  it("사물 이름 NPC 가 사람 칩과 changeFace 를 달면 romance-object-npc-bust 완료 조건 경고를 내고, 인물 직함이나 투명 이벤트는 조용하다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    const objectNpc = npc("npc_sign", { name: "설렘 포인트 · 고백 전 심호흡", chip: "tex_oprn_charset_modern2" });
    const page = objectNpc.pages?.[0];
    if (!page) throw new Error("missing page");
    page.commands = [
      { kind: "changeFace", faceGraphic: "face_modern2" },
      { kind: "text", speaker: "설렘 포인트 · 고백 전 심호흡", body: "심호흡을 했다." },
    ];
    map.events.push(objectNpc);
    const finding = checkRomance(project).find((entry) => entry.code === "romance-object-npc-bust");
    expect(finding?.message).toContain("설렘 포인트 · 고백 전 심호흡");
    expect(finding?.message).toContain("place_props/오브젝트 이벤트");
    expect(romanceCompletionGaps(project, { task: "캠퍼스 연애 게임 만들어 줘" }).some((msg) => msg.includes("설렘 포인트 · 고백 전 심호흡"))).toBe(true);

    objectNpc.name = "방송부 안내 학생";
    expect(codes(project)).not.toContain("romance-object-npc-bust");

    objectNpc.name = "설렘 포인트 · 고백 전 심호흡";
    page.graphic = { transparent: true };
    expect(codes(project)).not.toContain("romance-object-npc-bust");
  });

  it("오프닝이 비었거나 「— 새 게임 —」 같은 제목 카드뿐이면 romance-opening-title-card 완료 조건 경고를 낸다", () => {
    const project = romanceProject();
    const task = { task: "캠퍼스 연애 게임 만들어 줘" };
    const card = (narration: string) => ({ id: "s", kind: "text" as const, narration, durationMs: 4200 });
    // #2848: 손대지 않은 오프닝(정의 없음)도 빈 오프닝으로 짚는다 — 끈 것(enabled:false)만 조용하다.
    expect(codes(project)).toContain("romance-opening-title-card");
    project.system.opening = { enabled: true, skippable: true, scenes: [card("— 새 게임 —")] };
    expect(codes(project)).toContain("romance-opening-title-card");
    expect(romanceCompletionGaps(project, task).some((msg) => msg.includes("plan_opening/set_opening"))).toBe(true);
    project.system.opening.scenes = [card("새 게임")];
    expect(codes(project)).toContain("romance-opening-title-card");
    project.system.opening.scenes = [card("- 옛 제목 -")];
    expect(codes(project)).toContain("romance-opening-title-card");
    project.system.opening.scenes = [];
    expect(codes(project)).toContain("romance-opening-title-card");
    project.system.opening.enabled = false;
    expect(codes(project)).not.toContain("romance-opening-title-card");
    project.system.opening = { enabled: true, skippable: true, scenes: [card("봄비가 그친 오후, 전학 첫날."), card("— 봄비 —")] };
    expect(codes(project)).not.toContain("romance-opening-title-card");
  });

  it("대사에 타일 좌표 (x,y) 가 그대로 박히면 romance-dialogue-raw-coords 완료 조건 경고를 낸다", () => {
    const project = romanceProject();
    const map = Object.values(project.maps)[0]!;
    const talker = npc("han", { chip: "sheetA" });
    const page = talker.pages?.[0];
    if (!page) throw new Error("missing page");
    page.commands = [{ kind: "text", speaker: "한", body: "분수대 옆 벤치에서 기다릴게. 3시(오후)에 봐." }];
    map.events.push(talker);
    expect(codes(project)).not.toContain("romance-dialogue-raw-coords");
    page.commands = [{ kind: "text", speaker: "한", body: "(40,13) 쪽 벤치에서 기다릴게." }, { kind: "text", speaker: "한", body: "도서관은 ( 16, 6 ) 이야." }];
    const finding = checkRomance(project).find((entry) => entry.code === "romance-dialogue-raw-coords");
    expect(finding?.message).toContain("2줄");
    expect(romanceCompletionGaps(project, { task: "캠퍼스 연애 게임 만들어 줘" }).some((msg) => msg.includes("(40,13)"))).toBe(true);
  });

  it("물가 이름(강변·호숫가…)의 바깥 맵에 물이 10% 미만이거나 한 줄 띠뿐이면 romance-waterfront-no-water 완료 조건 경고를 낸다", () => {
    const project = romanceProject();
    const map = project.maps[project.startMapId]!;
    const water = project.tilesets[map.tilesetId]!.tileMeta!.findIndex((meta) => meta?.tags?.includes("water"));
    const message = () => checkRomance(project).find((finding) => finding.code === "romance-waterfront-no-water")?.message;
    expect(message()).toBeUndefined();
    map.name = "퇴근길 강변 야경 길";
    expect(message()).toContain("물 0%");
    for (let x = 0; x < map.width; x += 1) map.lowerTiles[x] = water;
    expect(message()).toContain("y=0 한 줄에만");
    expect(romanceCompletionGaps(project, { task: "직장인 연애 게임 만들어 줘" }).some((msg) => msg.includes("퇴근길 강변 야경 길"))).toBe(true);
    for (let y = 0; y < Math.ceil(map.height * 0.15); y += 1) for (let x = 0; x < map.width; x += 1) map.lowerTiles[y * map.width + x] = water;
    expect(message()).toBeUndefined();
    map.name = "강변 카페";
    map.lowerTiles.fill(map.lowerTiles[map.lowerTiles.length - 1]!);
    expect(message()).toBeUndefined();
  });

  it("제목을 정하면 씨앗이 남긴 제목 카드 한 장짜리 오프닝도 새 제목을 쓰고, 저작된 오프닝은 그대로 둔다", () => {
    const project = romanceProject();
    project.meta.title = "새 게임";
    project.system.opening = { enabled: true, skippable: true, scenes: [{ id: "s", kind: "text", narration: "— 새 게임 —", durationMs: 4200 }] };
    const ctx = { project };
    expect(runTool(ctx, "set_title_screen", { title: "봄비 오는 교정" }).ok).toBe(true);
    expect(ctx.project.system.opening?.scenes.map((scene) => scene.narration)).toEqual(["— 봄비 오는 교정 —"]);
    expect(runTool(ctx, "set_project_settings", { title: "봄비" }).ok).toBe(true);
    expect(ctx.project.system.opening?.scenes.map((scene) => scene.narration)).toEqual(["— 봄비 —"]);
    ctx.project.system.opening = { enabled: true, skippable: true, scenes: [{ id: "s", kind: "text", narration: "— 우리 둘의 계절 —", durationMs: 4200 }] };
    expect(runTool(ctx, "set_title_screen", { title: "다른 제목" }).ok).toBe(true);
    expect(ctx.project.system.opening?.scenes.map((scene) => scene.narration)).toEqual(["— 우리 둘의 계절 —"]);
  });
});
