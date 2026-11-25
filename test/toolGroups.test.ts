import { describe, expect, it, afterEach } from "vitest";
import { readRequest } from "@/ai/v2/request/intent";
import { v2ExtraToolNames, wantsGameTools, wantsMusicTools, musicAsked, audioOnly, soundOnly, wantsMusic, wantsSound } from "@/ai/v2/request/readers";
import { fallenCard, MUSIC_TIER, SOUND_TIER } from "@/ai/v2/request/toolGroups";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { expandStoreMusicQuery } from "@/assetStore/storeMusicPick";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { findingLine } from "@/ai/v2/judge/finding";
import retroManifest from "./fixtures/oprn-sfx-retro-battle.manifest.json";
import modernManifest from "./fixtures/oprn-sfx-modern-battle.manifest.json";
import { readStoreSoundMeta, storeSoundDescription, storeSoundTags } from "@/assets/storeSoundMeta";
import { normalizeStoreSoundCue, planSoundStyle, rankStoreSounds, storeSoundTracks, subsetAudioManifest } from "@/assetStore/storeSoundPick";
import { setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { storeProjectId, type StorePackManifest } from "@/assetStore/format";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { clearStoreMusicCache, isStoreCardRequest } from "@/editor/tools/storeTools";
import { projectSeCue } from "@/project/seCues";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2QuestExposure", () => {
  isolateTimers();
  const EXPLORE = "귀여운 고양이가 주인공인 탐험 게임 만들어줘";
  describe("v2 whole-game quest exposure (fs-use-tools G1)", () => {
    it("offers create_quest for a game request that names no quest words, but not for a small edit", () => {
      expect(v2ExtraToolNames(EXPLORE)).toContain("create_quest");
      expect(v2ExtraToolNames("촌장 대사를 바꿔 줘")).not.toContain("create_quest");
    });

    it("tells the model to reuse an existing person and give new people a graphicQuery", () => {
      const card = fallenCard(readRequest(EXPLORE).tools);
      expect(card).toContain("create_quest");
      expect(card).toContain("graphicQuery");
      expect(card).toContain("EXISTING");
    });
  });
});

// 조수 v2 음악 요청 길(2026-10-30 실조수 스토어 음악 e2e 5/8): 「X처럼」「엔딩곡」에도 음악 도구가 실리고, 엔딩곡 자리(set_game_audio ending)가 있다.
describe("assistantMusicRouting", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
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
      expect(gameLines(before, before, task).some((p) => p.includes("[게임 검사 음악]"))).toBe(true);
      expect(gameLines(before, ctx.project, task).some((p) => p.includes("[게임 검사 음악]"))).toBe(false);
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
});

// 스토어 효과음 팩(kind sound, meta.oprnSound 판 1) — 읽기·고르기·화풍 통째 걸기·조수 길(효과음 낱말·set_game_audio se·maps 기본 맵).
// 매니페스트는 실제 효과음 팩(oprn-tools/sfx1)에서 소리 6개만 남긴 사본이다(소리 파일은 없다 — 가짜 blob 을 준다).
describe("storeSoundPick", () => {
  isolateTimers();
  // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
  const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
  const RETRO = retroManifest as unknown as StorePackManifest;
  const MODERN = modernManifest as unknown as StorePackManifest;
  const RETRO_SLUG = "oprn-sfx-retro-battle-1";
  const MODERN_SLUG = "oprn-sfx-modern-battle-1";
  const tracks = [
    ...storeSoundTracks({ slug: RETRO_SLUG, latestVersion: 1, title: RETRO.title }, RETRO),
    ...storeSoundTracks({ slug: MODERN_SLUG, latestVersion: 1, title: MODERN.title }, MODERN),
  ];
  function fakeStore(autoInstall = true, fetched: string[] = []): StoreReadAccess {
    const summary = (slug: string, m: StorePackManifest) => ({ slug, title: m.title, summary: "", kind: "sound", grade: "single", license: m.license, aiGenerated: m.aiGenerated, author: "OPRN 운영", tags: [], latestVersion: 1, cover: null, downloads: 0, updatedAt: "" });
    const items = [summary(RETRO_SLUG, RETRO), summary(MODERN_SLUG, MODERN)];
    return {
      url: "http://store.sound.test", autoInstall, userMentionedStore: true,
      catalog: async (input) => ({ items: (input.kind === "sound" ? items : []) as never, total: input.kind === "sound" ? items.length : 0, page: 1, pageSize: 24 }),
      item: async (slug) => ({ ...items.find((i) => i.slug === slug)!, description: "", credits: "", previews: [], status: "visible", versions: [], counts: { tilesets: 0, assets: 6, referenceDocuments: 0 } }) as never,
      manifest: async (slug) => (slug === RETRO_SLUG ? RETRO : MODERN),
      blob: async (hash) => { fetched.push(hash); return new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, 0, 0, 0, 0]); },
    };
  }
  afterEach(() => { setWorkerStoreAccess(null); clearStoreMusicCache(); });
  describe("meta.oprnSound 읽기", () => {
    it("별칭을 풀고(collapse → faint, evasion → miss) 모르는 새 자리는 태그로 넘긴다", () => {
      const faint = readStoreSoundMeta(RETRO.content.assets["oprn-sfx-retro-faint-a"]!.meta)!;
      expect(faint.slots).toEqual(["faint"]);
      const meta = readStoreSoundMeta({ oprnSound: { version: 1, slots: ["evasion", "footstep-lava", "Bad Id"], style: "retro", variant: "b", mood: ["light"], qa: { clapFit: 8, tech: 10, ear: null } } })!;
      expect(meta.slots).toEqual(["miss"]);
      expect(meta.extraSlots).toEqual(["footstep-lava"]);
      expect(meta.qaScore).toBe(9);
      expect(storeSoundTags(meta)).toEqual(expect.arrayContaining(["miss", "footstep-lava", "retro", "light"]));
      expect(storeSoundDescription(meta)).toMatch(/자리 miss/u);
    });

    it("아는 자리가 하나도 없으면 고르기에 쓰지 않는다(null)", () => {
      expect(readStoreSoundMeta({ oprnSound: { version: 1, slots: ["footstep-lava"] } })).toBeNull();
      expect(readStoreSoundMeta({})).toBeNull();
      expect(readStoreSoundMeta({ oprnSound: { slots: "damage" } })).toBeNull();
    });

    it("합성 팩은 AI 표시가 없다(aiGenerated false 를 그대로)", () => {
      expect(tracks.length).toBe(12);
      expect(tracks.every((t) => t.aiGenerated === false && t.license === "OPRN-GAME")).toBe(true);
    });
  });
  describe("효과음 고르기", () => {
    it("자리 낱말을 자리 id 로 읽는다", () => {
      expect(normalizeStoreSoundCue("collapse")).toBe("faint");
      expect(normalizeStoreSoundCue("타격음")).toBe("damage");
      expect(normalizeStoreSoundCue("보스 쓰러지는 소리")).toBe("bossCollapse");
      expect(normalizeStoreSoundCue("풀밭 발소리")).toBe("footstep-grass");
      expect(normalizeStoreSoundCue("magic-fire")).toBe("magic-fire");
      expect(normalizeStoreSoundCue("아무 말")).toBeNull();
    });

    it("자리·화풍이 먼저, 같으면 A안이 앞선다", () => {
      const top = rankStoreSounds(tracks, { cue: "damage", style: "modern" });
      expect(top[0]!.assetId).toBe("oprn-sfx-modern-damage-a");
      expect(top.every((t) => t.sound.slots.includes("damage"))).toBe(true);
      expect(rankStoreSounds(tracks, { cue: "damage", style: "retro" })[0]!.assetId).toBe("oprn-sfx-retro-damage-a");
      // 속성 마법 소리가 없으면 가족 기본 자리(cast)로 물러선다.
      expect(rankStoreSounds(tracks, { cue: "magic-fire", style: "retro" })[0]!.assetId).toBe("oprn-sfx-retro-cast-a");
    });

    it("화풍 하나로 자리마다 한 소리(기본 A안), 없는 자리는 missing", () => {
      const plan = planSoundStyle(tracks, "retro", { cues: ["damage", "faint", "levelUp"] });
      expect(plan.rows).toEqual([
        { cue: "damage", slug: RETRO_SLUG, assetId: "oprn-sfx-retro-damage-a" },
        { cue: "faint", slug: RETRO_SLUG, assetId: "oprn-sfx-retro-faint-a" },
      ]);
      expect(plan.missing).toEqual(["levelUp"]);
      expect(planSoundStyle(tracks, "retro", { variant: "b", cues: ["damage"] }).rows[0]!.assetId).toBe("oprn-sfx-retro-damage-b");
      expect(planSoundStyle(tracks, "modern").rows.map((r) => r.cue).sort()).toEqual(["actorDamage", "cast", "damage", "faint", "miss"]);
    });

    it("고른 소리만 남긴 매니페스트", () => {
      const subset = subsetAudioManifest(RETRO, ["oprn-sfx-retro-miss-a"]);
      expect(Object.keys(subset.content.assets)).toEqual(["oprn-sfx-retro-miss-a"]);
      expect(subset.blobs).toHaveLength(1);
      expect(() => subsetAudioManifest(RETRO, ["nope"])).toThrow(/없는/u);
    });
  });
  describe("store_find_sound · set_game_audio sfx-style (워커 안 가짜 스토어)", () => {
    it("1위에 recommended, 「먼저 묻기」면 카드", async () => {
      setWorkerStoreAccess(fakeStore(false));
      const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_sound", { cue: "타격음", style: "retro", need: "타격음" }, { dryRun: true });
      expect(result.ok, result.summary).toBe(true);
      const data = result.data as { kind: string; cue: string; sounds: { assetId: string; recommended?: boolean; aiGenerated: boolean }[] };
      expect(data.kind).toBe("store-sound-choice");
      expect(data.cue).toBe("damage");
      expect(data.sounds[0]).toMatchObject({ assetId: "oprn-sfx-retro-damage-a", recommended: true, aiGenerated: false });
      expect(isStoreCardRequest(data)).toBe(true);
      expect(isStoreCardRequest({ ...data, autoInstall: true })).toBe(false);
    });

    it("sfx-style 한 번으로 고른 소리만 받아 자리 표에 건다", async () => {
      const fetched: string[] = [];
      setWorkerStoreAccess(fakeStore(true, fetched));
      const ctx = { project: createEmptyToolProject() };
      const result = await runToolAsync(ctx, "set_game_audio", { role: "sfx-style", style: "retro", cues: ["damage", "collapse"] }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const damage = storeProjectId(RETRO_SLUG, "oprn-sfx-retro-damage-a");
      expect(ctx.project.system.seCues).toEqual({ damage, faint: storeProjectId(RETRO_SLUG, "oprn-sfx-retro-faint-a") });
      expect(projectSeCue(ctx.project, "damage")).toBe(damage);
      expect(ctx.project.assets.uploaded[damage]?.kind).toBe("sound");
      expect(ctx.project.assets.uploaded[damage]?.origin).toMatchObject({ itemSlug: RETRO_SLUG, aiGenerated: false, license: "OPRN-GAME" });
      expect(fetched).toHaveLength(2);
    });

    it("「먼저 묻기」면 sfx-style 은 넣지 않는다", async () => {
      setWorkerStoreAccess(fakeStore(false));
      const ctx = { project: createEmptyToolProject() };
      const result = await runToolAsync(ctx, "set_game_audio", { role: "sfx-style", style: "modern" }, { dryRun: false });
      expect(result.ok).toBe(false);
      expect(ctx.project.system.seCues).toBeUndefined();
    });
  });
  describe("set_game_audio se · maps 기본 맵", () => {
    function audioProject() {
      const ctx = { project: createEmptyToolProject() };
      ctx.project.assets.uploaded.snd_hit = { id: "snd_hit", name: "타격", kind: "sound", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: {} };
      ctx.project.assets.uploaded.bgm_town = { id: "bgm_town", name: "마을", kind: "music", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: {} };
      return ctx;
    }

    it("role se 는 자리 낱말을 풀어 프로젝트 표에 걸고, mapIds 는 받지 않는다", () => {
      const ctx = audioProject();
      expect(runTool(ctx, "set_game_audio", { role: "se", cue: "collapse", resourceId: "snd_hit" }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.seCues).toEqual({ faint: "snd_hit" });
      expect(runTool(ctx, "set_game_audio", { role: "se", cue: "damage", resourceId: "snd_hit", mapIds: ["m1"] }, { dryRun: false }).ok).toBe(false);
      expect(runTool(ctx, "set_game_audio", { role: "se", resourceId: "snd_hit" }, { dryRun: false }).ok).toBe(false);
      expect(runTool(ctx, "set_game_audio", { role: "se", cue: "damage", resourceId: "bgm_town" }, { dryRun: false }).ok).toBe(false);
      // 메뉴 자리(confirm)도 자리 표에 같이 들어간다.
      expect(runTool(ctx, "set_game_audio", { role: "confirm", resourceId: "snd_hit" }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.system.seCues?.confirm).toBe("snd_hit");
    });

    it("maps 에 mapIds 가 없으면 지금 보는 맵, 없으면 시작 맵에 걸고 그렇다고 말한다", () => {
      const ctx = audioProject();
      expect(runTool(ctx, "create_map", { id: "m1", name: "마을", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "m2", name: "동굴", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
      ctx.project.startMapId = "m1";
      const viewingCtx = { project: ctx.project, currentMapId: "m2" };
      const viewing = runTool(viewingCtx, "set_game_audio", { role: "maps", resourceId: "bgm_town" }, { dryRun: false });
      expect(viewing.ok, viewing.summary).toBe(true);
      expect(viewing.summary).toMatch(/mapIds 를 주지 않아 .*「동굴」\(m2\)/u);
      expect(viewingCtx.project.maps.m2!.bgm).toEqual({ mode: "custom", resourceId: "bgm_town" });
      const startCtx = { project: viewingCtx.project };
      const start = runTool(startCtx, "set_game_audio", { role: "maps", resourceId: "bgm_town" }, { dryRun: false });
      expect(start.ok, start.summary).toBe(true);
      expect(start.summary).toMatch(/「마을」\(m1\)/u);
      expect(startCtx.project.maps.m1!.bgm).toEqual({ mode: "custom", resourceId: "bgm_town" });
      expect(runTool(startCtx, "set_game_audio", { role: "maps", resourceId: "bgm_town", mapIds: ["nope"] }, { dryRun: false }).ok).toBe(false);
    });
  });
  describe("효과음 낱말 길", () => {
    it.each(["효과음 전부 레트로로 바꿔 줘", "타격음 더 묵직하게", "발소리 넣어 줘", "SE 를 8비트 느낌으로", "사운드 이펙트 현대적으로"])("「%s」 는 효과음 묶음만 싣는다", (task) => {
      expect(wantsSound(task)).toBe(true);
      expect(soundOnly(task)).toBe(true);
      expect(audioOnly(task)).toBe(true);
      const names = v2ExtraToolNames(task);
      for (const tool of SOUND_TIER.tools) expect(names).toContain(tool);
      expect(names).not.toContain("stamp_object");
    });

    it("「사운드 이펙트」는 음악 요청이 아니다, 「사운드트랙」은 음악", () => {
      expect(wantsMusic("사운드 이펙트 현대적으로")).toBe(false);
      expect(musicAsked("사운드 이펙트 현대적으로")).toBe(false);
      expect(wantsMusic("사운드트랙 넣어 줘")).toBe(true);
      expect(wantsSound("사운드트랙 넣어 줘")).toBe(false);
    });

    it("다른 일이 섞이면 효과음만이 아니다", () => {
      expect(soundOnly("보스 만들고 쓰러지는 소리 넣어 줘")).toBe(false);
      expect(wantsSound("보스 만들고 쓰러지는 소리 넣어 줘")).toBe(true);
      expect(wantsSound("마을 만들어 줘")).toBe(false);
    });

    it("끝맺음 검사: 효과음 요청에 자리 표가 그대로면 짚는다", () => {
      const before = createEmptyToolProject();
      const after = structuredClone(before);
      expect(gameLines(before, after, "타격음 더 묵직하게").some((p) => p.startsWith("[게임 검사 효과음]"))).toBe(true);
      after.system.seCues = { damage: "snd_hit" };
      expect(gameLines(before, after, "타격음 더 묵직하게").some((p) => p.startsWith("[게임 검사 효과음]"))).toBe(false);
      expect(gameLines(before, after, "사운드 이펙트 현대적으로").some((p) => p.startsWith("[게임 검사 음악]"))).toBe(false);
    });
  });
});
