import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
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
import { scheduler } from "node:timers/promises";
import { allTools } from "@/editor/tools/toolRegistry";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import type { JsonSchema, ToolResult } from "@/editor/tools/types";
import { completedHouseProject, houseMap, HOUSE_RECT, mutateProject } from "./fixtures/completedHouse";
import { loadTilesetImage, clearTilesetImageCache, GRAFT_EVIDENCE_WAIT_MS } from "@/ai/toolImageCanvas";
import { clearTileGraftImageCache, awaitGraftedTilesetImageUrl } from "@/assets/tileGraftImageCache";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import { installToolImageRasterDom, installToolImageUrlHoldGate } from "./toolImageRasterDom";

describe("toolGroups", () => {
  isolateTimers();
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
});

// 적대적 인자 스윕: 모든 쓰기 툴에 모델이 실제로 보내는 종류의 잘못된 인자를 먹인다.
//
// 계약은 "성공"이 아니라 **읽을 수 있는 실패**다. 툴은 거부해도 되지만,
// - 내부 TypeError 를 그대로 흘려서 "후처리 실패: Cannot read properties of undefined" 처럼
//   모델이 고칠 수 없는 메시지를 남기면 안 되고(2026-08-23 실측: upsert_event 3회 재전송),
// - 던진 예외로 런타임을 깨서도 안 된다.
//
// 이 스윕이 없던 동안 page.trigger 누락 하나가 projectLint 크래시로 이어져 커밋 경로가 죽었다.
describe("toolHostileArgs", () => {
  isolateTimers();
  type Variant = "empty" | "nulls" | "wrongTypes" | "deepHoles";
  // 변형마다 빈 프로젝트를 한 번 만들어 모든 쓰기 도구가 같은 입력을 받는다. 전에는 도구마다 새로 만들었고, 그 createBlankProject 가 변형 하나의 시간 거의 전부였다
  // (쓰기 도구 360개: 러너에서 변형당 211~225초 가운데 도구 실행은 약 10초, 나머지는 빈 프로젝트 360번 — ci-vitest-files 43720360814 · 한 장비 실측 448초 중 437.6초).
  // 도구는 입력 프로젝트를 제자리에서 고치지 않고 사본(draft)에 쓴다 — 그 약속이 깨지면 뒤 도구가 더럽혀진 입력을 받으므로, 변형 끝에 입력이 그대로인지 직렬화로 확인한다.
  const HOSTILE_ARGS_TIMEOUT_MS = 120_000;
  /** 스키마에서 "그럴듯하지만 틀린" 인자를 만든다 — 필수 누락·null 원소·타입 뒤집기·중첩 구멍. */
  function hostileArgs(schema: JsonSchema, variant: Variant): Record<string, unknown> {
    if (variant === "empty") return {};
    const args: Record<string, unknown> = {};
    for (const [key, prop] of Object.entries(schema.properties ?? {})) {
      if (variant === "nulls") {
        args[key] = prop.type === "array" ? [null] : null;
        continue;
      }
      if (variant === "deepHoles") {
        // 배열 원소를 `{}` 로, 중첩 객체를 `{}` 로 채운다 — 실측에서 실제로 도착했던 shape.
        // 필수 필드가 통째로 빈 페이지/에셋/조건이 여기서 재현된다.
        if (prop.type === "array") args[key] = [{}];
        else if (prop.type === "object") args[key] = {};
        else if (prop.type === "string") args[key] = "x";
        else if (prop.type === "integer" || prop.type === "number") args[key] = 0;
        else if (prop.type === "boolean") args[key] = true;
        continue;
      }
      // wrongTypes: 문자열 자리에 숫자, 숫자 자리에 문자열, 객체 자리에 빈 객체, 배열 자리에 단수 객체.
      if (prop.type === "string") args[key] = 123;
      else if (prop.type === "integer" || prop.type === "number") args[key] = "not-a-number";
      else if (prop.type === "boolean") args[key] = "yes";
      else if (prop.type === "array") args[key] = {};
      else if (prop.type === "object") args[key] = {};
    }
    return args;
  }
  function isUnreadableFailure(result: ToolResult): boolean {
    const text = [result.summary, ...(result.issues ?? []).map((issue) => issue.message)].join(" ");
    return /Cannot read propert|undefined is not|is not a function|후처리 실패/.test(text);
  }
  describe("쓰기 툴 적대적 인자 스윕", () => {
    const writeTools = allTools().filter((tool) => tool.mode === "write");

    it("쓰기 툴이 충분히 등록되어 있다", () => {
      expect(writeTools.length).toBeGreaterThan(50);
    });

    for (const variant of ["empty", "nulls", "wrongTypes", "deepHoles"] as const) {
      it(`${variant} 인자에 어떤 툴도 크래시하거나 읽을 수 없는 실패를 남기지 않는다`, async () => {
        const offenders: string[] = [];
        const blank = createBlankProject();
        const pristine = serialize(blank);
        for (const tool of writeTools) {
          // Let worker RPC responses drain between synchronous tool calls; no timed wait.
          await scheduler.yield();
          const ctx = { project: blank };
          let result: ToolResult;
          try {
            result = runTool(ctx, tool.name, hostileArgs(tool.parameters, variant));
          } catch (error) {
            offenders.push(`${tool.name}: THREW ${error instanceof Error ? error.message.slice(0, 120) : String(error)}`);
            continue;
          }
          // 관대하게 받아들이는 것(ok)도 정책상 허용된다 — 문제는 "읽을 수 없는 실패"뿐이다.
          if (!result.ok && isUnreadableFailure(result)) {
            offenders.push(`${tool.name}: ${result.summary.slice(0, 140)}`);
          }
        }
        expect(offenders).toEqual([]);
        // 어떤 도구도(성공했든 거절했든) 받은 프로젝트 객체를 제자리에서 고치지 않았다 — 모든 도구가 같은 빈 프로젝트에서 출발했다.
        expect(serialize(blank) === pristine, "a write tool mutated its input project in place").toBe(true);
      }, HOSTILE_ARGS_TIMEOUT_MS);
    }
  });
  describe("postprocessing error boundary", () => {
    for (const code of ["protected-house-write", "house-overlap"] as const) {
      it.each([false, true])(`returns a readable ${code} rejection with empty args (dryRun=%s)`, (dryRun) => {
        const ctx = { project: completedHouseProject() };
        const original = ctx.project;
        const before = structuredClone(original);
        const result = mutateProject(ctx, (draft) => {
          const map = houseMap(draft);
          if (code === "protected-house-write") map.upperTiles[3 * map.width + 3] = -1;
          else map.layoutPlan?.regions.push({ id: "overlap", role: "house", label: "Overlap", ...HOUSE_RECT });
        }, dryRun);
        expect(result.ok).toBe(false);
        expect(result.issues).toEqual([expect.objectContaining({ severity: "error", code, mapId: original.startMapId })]);
        expect(isUnreadableFailure(result), JSON.stringify(result)).toBe(false);
        expect(ctx.project).toBe(original);
        expect(ctx.project).toEqual(before);
      });
    }

    it("retains unexpected postprocessing exceptions and rolls back", () => {
      const ctx = { project: completedHouseProject() };
      const original = ctx.project;
      const before = structuredClone(original);
      const error = new Error("postprocessing fixture failure");
      // 후처리(집 보호 검사)만 읽는 자리에 던지는 접근자를 둔다 — 집 맵의 배치 계획 구역 목록.
      // 전에는 draft.maps 에 던지는 맵을 끼웠는데, 실행기가 후처리보다 먼저 모든 맵을 훑어(compactTouchedMapLayers, 공개 기준선부터)
      // 예외가 실행 단계 경계에서 잡혔다(tool-exception · «실행 실패») — 이 시험이 보려는 후처리 경계(tool-postprocess · «후처리 실패»)에 닿지 못했다.
      const result = mutateProject(ctx, (draft) => {
        Object.defineProperty(houseMap(draft).layoutPlan!, "regions", { enumerable: true, get() { throw error; } });
      });
      expect(result.ok).toBe(false);
      expect(result.issues).toEqual([{ severity: "error", code: "tool-postprocess", message: error.message }]);
      expect(isUnreadableFailure(result)).toBe(true);
      expect(ctx.project).toBe(original);
      expect(ctx.project).toEqual(before);
    });
  });
});

describe("toolImageGraftWait", () => {
  isolateTimers();
  let restore: () => void;
  beforeEach(() => {
    restore = installToolImageRasterDom();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  });
  afterEach(() => {
    restore();
    vi.useRealTimers();
    clearTilesetImageCache();
    clearTileGraftImageCache();
  });
  function graftedTileset() {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const tileset = project.tilesets[map.tilesetId]!;
    // The EasyRPG interior sheet that used to be the graft source was deleted on 2026-10-07 (no bundled path, so the bake
    // failed instead of waiting on I/O and the hold gate never fired). Graft from a surviving bundled sheet instead.
    tileset.tileGrafts = [{
      targetTile: 0, sourceChipset: "tex_beodeul_ground", sourceTile: 100,
    }];
    return tileset;
  }
  // Heavy under CI load (15s default is too tight): bakes graft images over a blank project.
  describe("cold graft evidence", { timeout: 120_000 }, () => {
    it("waits for source loading and returns the composite on the first request", async () => {
      const tileset = graftedTileset();
      const gate = installToolImageUrlHoldGate("beodeul-ground/chipset.png");
      let settled = false;
      const pending = loadTilesetImage(tileset).then(image => {
        settled = true;
        return image;
      });
      await gate.sourceHeld;
      expect(settled).toBe(false);
      gate.release();
      const image = await pending;
      const exact = await awaitGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset));
      expect(image.src).toBe(exact);
      expect(image.src).not.toBe(tilesetBaseImageUrl(tileset));
      expect(vi.getTimerCount()).toBe(0);
    });

    it("reports failure for a missing source without delivering the base image", async () => {
      const tileset = graftedTileset();
      tileset.tileGrafts![0]!.sourceChipset = "missing-chipset";
      await expect(loadTilesetImage(tileset)).rejects.toThrow("bake failed or incomplete");
      expect(vi.getTimerCount()).toBe(0);
    });

    it("times out held I/O but reuses the completed bake on retry", async () => {
      const tileset = graftedTileset();
      const gate = installToolImageUrlHoldGate("beodeul-ground/chipset.png");
      const rejected = expect(loadTilesetImage(tileset)).rejects.toThrow("bake timed out");
      await gate.sourceHeld;
      await vi.advanceTimersByTimeAsync(GRAFT_EVIDENCE_WAIT_MS);
      await rejected;
      expect(vi.getTimerCount()).toBe(0);
      gate.release();
      const exact = await awaitGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset));
      expect((await loadTilesetImage(tileset)).src).toBe(exact);
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
