// 조수 v2 음악 요청 길(2026-10-30 실조수 스토어 음악 e2e 5/8): 「X처럼」「엔딩곡」에도 음악 도구가 실리고, 엔딩곡 자리(set_game_audio ending)가 있다.
import { describe, expect, it } from "vitest";
import { MUSIC_TIER, v2ExtraToolNames, wantsGameTools, wantsMusicTools } from "@/ai/v2/game";
import { musicAsked } from "@/ai/v2/musicWords";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import { expandStoreMusicQuery } from "@/assetStore/storeMusicPick";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

const MUSIC_REQUESTS = [
  "테일즈런너처럼 신나는 거 마을에 깔아 줘",
  "투더문처럼 잔잔하게 엔딩곡",
  "크로노트리거 느낌으로 필드 음악 넣어 줘",
  "파판 전투곡 같은 걸로 전투 음악 바꿔 줘",
  "마그나카르타풍 애절한 브금 마을에",
  "드퀘 같은 승리 팡파르 넣어 줘",
  "보스곡 좀 웅장한 걸로 바꿔 줘",
  "카트라이더 같은 BGM 깔아줘",
];

describe("v2 music routing", () => {
  it.each(MUSIC_REQUESTS)("loads the music tools for 「%s」", (task) => {
    expect(wantsMusicTools(task)).toBe(true);
    expect(musicAsked(task)).toBe(true);
    const names = v2ExtraToolNames(task);
    for (const tool of ["store_find_music", "store_install", "set_game_audio", "recommend_bgm"]) expect(names).toContain(tool);
  });

  it("a game name in a build request loads music alongside, not instead of, the map verbs", () => {
    const task = "파판처럼 마을 만들어";
    expect(wantsMusicTools(task)).toBe(true);
    // 게임 요소 묶음은 싣지 않는다 — 덧붙는 것은 음악 묶음뿐이고, 맵 동사(make_place…)는 verbs.ts 가 늘 싣는다.
    expect(wantsGameTools(task)).toBe(false);
    expect(v2ExtraToolNames(task)).toEqual([...MUSIC_TIER.tools]);
    // 짓는 요청의 게임 이름은 화풍일 수 있다 — 끝맺음 검사가 곡을 요구하지 않는다.
    expect(musicAsked(task)).toBe(false);
  });

  it.each(["계곡 맵 만들어 줘", "곡괭이 아이템 추가해 줘", "굴곡진 길을 내 줘", "NPC가 노래를 부르는 장면", "포켓몬 마을 만들어"])("does not treat 「%s」 as a music request", (task) => {
    expect(wantsMusicTools(task)).toBe(false);
    expect(musicAsked(task)).toBe(false);
  });

  it("the music card says a music-only request must not rebuild maps or add events", () => {
    expect(MUSIC_TIER.card).toContain("'ending'");
    expect(MUSIC_TIER.card).toMatch(/must not rebuild maps or add events or endings/u);
  });
});

describe("new store music lines (game-name table only, old-line fallback)", () => {
  it.each([
    ["위쳐 느낌 주막 음악", "dark-folk-fantasy", "fantasy"],
    ["이브 느낌으로 미술관 브금", "gallery-mystery", "piano-story"],
    ["Ib 같은 오르골 곡 넣어 줘", "gallery-mystery", "piano-story"],
    ["아오오니처럼 쫓기는 음악", "chase-horror", "horror"],
    ["마녀의 집 같은 음악", "dark-fairytale", "horror"],
    ["유메닛키풍 배경음", "dream-ambient", "horror"],
    ["OFF 느낌 나는 차가운 곡 넣어 줘", "eerie-minimal", "scifi"],
    ["오프처럼 기묘한 음악", "eerie-minimal", "scifi"],
    ["콥스 파티 느낌 배경음", "school-horror", "horror"],
    ["언더테일처럼 8비트 음악", "chiptune-indie-rpg", "monster"],
  ] as const)("「%s」 → %s (falls back to %s)", (task, line, fallback) => {
    const lines = expandStoreMusicQuery(task).lines;
    expect(lines[0]).toBe(line);
    expect(lines).toContain(fallback);
    expect(wantsMusicTools(task)).toBe(true);
  });

  it.each(["이브닝 파티 장면 만들어 줘", "불 꺼(off) 스위치", "산 위처럼 높은 탑", "오프닝 연출", "오프라인 저장"])("guarded names do not hit in 「%s」", (task) => {
    expect(expandStoreMusicQuery(task).games).toEqual([]);
    expect(expandStoreMusicQuery(task).lines.filter((line) => line === "gallery-mystery" || line === "eerie-minimal" || line === "dark-folk-fantasy")).toEqual([]);
  });

  it("a bare guarded name is not a music request, the guarded name with a feel word is", () => {
    expect(wantsMusicTools("이브닝 파티 장면 만들어 줘")).toBe(false);
    expect(wantsMusicTools("불 꺼(off) 스위치")).toBe(false);
    expect(wantsMusicTools("OFF처럼")).toBe(true);
    expect(wantsMusicTools("이브처럼")).toBe(true);
  });
});

describe("set_game_audio ending", () => {
  function endingProject() {
    const ctx = { project: createEmptyToolProject() };
    ctx.project.assets.uploaded.end_song = { id: "end_song", name: "엔딩곡", kind: "music", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: {} };
    return ctx;
  }

  it("refuses when there is no ending to bind (it does not invent one)", () => {
    const ctx = endingProject();
    const r = runTool(ctx, "set_game_audio", { role: "ending", resourceId: "end_song" }, { dryRun: false });
    expect(r.ok).toBe(false);
    expect(ctx.project.endings ?? []).toEqual([]);
  });

  it("binds every defined ending and direct ending command, and the finish check sees it", () => {
    const ctx = endingProject();
    expect(runTool(ctx, "create_map", { id: "m1", name: "마을", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "define_ending", { id: "ending_good", name: "좋은 끝", priority: 0, conditions: [] }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "upsert_event", { mapId: "m1", event: { id: "ev_end", name: "끝", x: 1, y: 1, commands: [{ kind: "ending", title: "끝", message: "" }] } }, { dryRun: false }).ok).toBe(true);
    const before = structuredClone(ctx.project);
    const r = runTool(ctx, "set_game_audio", { role: "ending", resourceId: "end_song" }, { dryRun: false });
    expect(r.ok, r.summary).toBe(true);
    expect(ctx.project.endings?.[0]?.presentation?.musicResourceId).toBe("end_song");
    const ev = ctx.project.maps.m1!.events.find((e) => e.id === "ev_end")! as unknown as { commands?: { kind: string; presentation?: { musicResourceId?: string } }[]; pages?: { commands: { kind: string; presentation?: { musicResourceId?: string } }[] }[] };
    const cmd = (ev.pages?.[0]?.commands ?? ev.commands ?? []).find((c) => c.kind === "ending");
    expect(cmd?.presentation?.musicResourceId).toBe("end_song");
    const task = "투더문처럼 잔잔하게 엔딩곡";
    expect(gameContentProblems(before, before, task).some((p) => p.includes("[게임 검사 음악]"))).toBe(true);
    expect(gameContentProblems(before, ctx.project, task).some((p) => p.includes("[게임 검사 음악]"))).toBe(false);
  });

  it("endingIds picks endings and is rejected for other roles", () => {
    const ctx = endingProject();
    expect(runTool(ctx, "define_ending", { id: "ending_a", name: "A", priority: 0, conditions: [] }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "define_ending", { id: "ending_b", name: "B", priority: 0, conditions: [] }, { dryRun: false }).ok).toBe(true);
    expect(runTool(ctx, "set_game_audio", { role: "ending", resourceId: "end_song", endingIds: ["ending_b"] }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.endings?.map((e) => e.presentation?.musicResourceId ?? null)).toEqual([null, "end_song"]);
    expect(runTool(ctx, "set_game_audio", { role: "ending", resourceId: "end_song", endingIds: ["nope"] }, { dryRun: false }).ok).toBe(false);
    expect(runTool(ctx, "set_game_audio", { role: "victory", resourceId: "end_song", endingIds: ["ending_a"] }, { dryRun: false }).ok).toBe(false);
  });
});
