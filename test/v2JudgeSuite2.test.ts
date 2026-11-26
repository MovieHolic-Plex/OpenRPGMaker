import { describe, expect, it, afterEach } from "vitest";
import { readStoreMusicMeta } from "@/assets/storeMusicMeta";
import { briefStoreMusic, expandStoreMusicQuery, projectHintLines, rankStoreMusic, scoreStoreMusic, storeMusicTracks, projectMusicLines, subsetMusicManifest } from "@/assetStore/storeMusicPick";
import { type StorePackManifest, storeProjectId, type StoreCatalogPage } from "@/assetStore/format";
import { mentionsStore, setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankProject } from "@/project/defaults";
import { isStoreCardRequest, type StoreMusicChoice, clearStoreMusicCache, listAllStoreMusicPacks } from "@/editor/tools/storeTools";
import { gameContentProblems } from "@/ai/v2/judge/gameChecks";
import { PiGameSystemProduction } from "@/ai/piAgent/gameSystemProduction";
import type { Project, GameEvent } from "@/project/types";
import { installedMusicSwaps, isAutoMusicChoice, storeCardFromEvent } from "@/editor/panels/aiStoreCard";
import { storeAutoInstallEnabled } from "@/editor/assetStore/storeHint";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import { findingLine } from "@/ai/v2/judge/finding";
import { mapIdsError } from "@/editor/tools/musicAuthoringTools";
import { isolateTimers } from "./mergedTeardown";
import { runTodoCheck } from "@/ai/v2/judge/todoChecks";
import { adviseTurn, compactToolLog, parseAdvisorReply, summarizeProjectDiff } from "@/ai/v2/judge/advisor";
import { thinGameSign, unbuiltGameSigns, wholeGameRekickPrompt, widenGamePrompt } from "@/ai/v2/judge/wholeGameRekick";
import { wantsWholeGame } from "@/ai/v2/request/readers";
import { INTENT_NOTE_BOUNDARY } from "@/ai/piAgent/monsterGameRequest";

describe("storeMusic", () => {
  isolateTimers();
  // 새 음악 팩의 결(meta.oprnMusic.feelTags)과 게임 이름 요청(「크로노트리거 느낌」) → 들리는 결로 곡 고르기.
  // 곡 메타에는 게임 이름이 없다 — 이름은 조수 쪽 표(GAME_FEELS)에서만 결 낱말로 바뀐다.
  describe("storeMusicFeel", () => {
    isolateTimers();
    const sha = (n: number): string => n.toString(16).padStart(64, "0");
    let n = 0;
    const track = (id: string, oprnMusic: Record<string, unknown>) => ({ id, name: id, kind: "music" as const, blob: sha(++n), mime: "audio/ogg" as const, meta: { oprnMusic } });
    function pack(slug: string, assets: ReturnType<typeof track>[]) {
      const manifest = {
        schema: "oprn-store-pack/1", title: slug, summary: "", description: "", tags: [], kind: "music", license: "OPRN-GAME", aiGenerated: true, credits: "", previews: [],
        content: { tilesets: {}, characters: [], objects: [], assets: Object.fromEntries(assets.map((a) => [a.id, a])) },
        blobs: assets.map((a) => ({ sha256: a.blob, mime: "audio/ogg", bytes: 10 })),
      } as unknown as StorePackManifest;
      return storeMusicTracks({ slug, latestVersion: 1, title: slug }, manifest);
    }
    const loop = { loopable: true, lengthSec: 60 };
    // 새 팩 다섯 줄(genre 칸) + 옛 팩(genreLine, feelTags 없음).
    const POOL = [
      ...pack("snes", [
        track("snes-battle", { ...loop, genre: "snes-jrpg", genreKo: "16비트 JRPG", sceneRoles: ["battle"], mood: ["긴박한"], feelTags: ["16비트 SNES 음색", "16-bit SNES", "칩 신스 리드"], summaryKo: "몰아치는 레트로 전투곡." }),
        track("snes-field", { ...loop, genre: "snes-jrpg", genreKo: "16비트 JRPG", sceneRoles: ["field"], mood: ["모험의"], feelTags: ["16비트 SNES 음색", "16-bit SNES"], summaryKo: "넓은 들판의 모험곡." }),
      ]),
      ...pack("sym", [
        track("sym-battle", { ...loop, genre: "symphonic-jrpg", genreKo: "심포닉 JRPG", sceneRoles: ["battle", "boss"], mood: ["웅장한"], feelTags: ["풀 오케스트라", "full orchestra", "금관 팡파르"], summaryKo: "금관이 터지는 전투곡." }),
        track("sym-title", { ...loop, genre: "symphonic-jrpg", genreKo: "심포닉 JRPG", sceneRoles: ["title"], mood: ["웅장한"], feelTags: ["풀 오케스트라"], summaryKo: "웅장한 서곡." }),
      ]),
      ...pack("melo", [
        track("melo-title", { ...loop, genre: "orchestral-melodrama", genreKo: "오케스트라 멜로드라마", sceneRoles: ["title", "sad"], mood: ["애절한"], feelTags: ["애절한 현악", "드라마틱한 오케스트라", "melodramatic strings"], summaryKo: "현악이 우는 서사적 테마." }),
      ]),
      ...pack("race", [
        track("race-town", { ...loop, genre: "casual-race", genreKo: "캐주얼 레이싱", sceneRoles: ["town", "battle"], mood: ["신나는"], feelTags: ["통통 튀는 캐주얼", "bouncy casual", "빠른 신스 베이스"], summaryKo: "달리고 싶어지는 경쾌한 곡." }),
      ]),
      ...pack("piano", [
        track("piano-town", { ...loop, genre: "piano-story", genreKo: "피아노 스토리", sceneRoles: ["town", "sad"], mood: ["잔잔한", "그리운"], feelTags: ["잔잔한 솔로 피아노", "solo piano"], summaryKo: "혼자 치는 피아노 회상." }),
      ]),
      ...pack("old-fantasy", [
        track("fan-battle", { ...loop, genreLine: "fantasy", genreKo: "판타지 JRPG", sceneRoles: ["battle"], mood: ["긴박한"], summaryKo: "16비트 오르간과 금관의 전투." }),
        track("fan-town", { ...loop, genreLine: "fantasy", genreKo: "판타지 JRPG", sceneRoles: ["town"], mood: ["평화로운"], summaryKo: "평화로운 마을." }),
      ]),
      ...pack("old-monster", [
        track("mon-battle", { ...loop, genreLine: "monster", genreKo: "몬스터 배틀", sceneRoles: ["battle"], mood: ["신나는"], summaryKo: "트레이너 배틀." }),
      ]),
    ];
    const first = (want: Parameters<typeof rankStoreMusic>[1]) => rankStoreMusic(POOL, want)[0]?.assetId;
    describe("store music feelTags", () => {
      it("reads feelTags and the new genre field, and old packs without them still parse", () => {
        const m = readStoreMusicMeta({ oprnMusic: { genre: "snes-jrpg", sceneRoles: ["battle"], feelTags: ["16비트 SNES 음색", 3, "16-bit SNES"] } });
        expect(m).toMatchObject({ genre: "snes-jrpg", feelTags: ["16비트 SNES 음색", "16-bit SNES"] });
        expect(readStoreMusicMeta({ oprnMusic: { genreLine: "joseon", sceneRoles: ["town"] } })).toMatchObject({ genre: "joseon", feelTags: [] });
      });

      it("scores a heard trait and shows it to the model", () => {
        const snes = POOL.find((t) => t.assetId === "snes-battle")!;
        const fan = POOL.find((t) => t.assetId === "fan-battle")!;
        expect(scoreStoreMusic(snes, { scene: "battle", query: "16-bit" })).toBeGreaterThan(scoreStoreMusic(fan, { scene: "battle", query: "16-bit" }));
        expect(first({ scene: "town", query: "솔로 피아노" })).toBe("piano-town");
        expect(first({ scene: "town", query: "캐주얼" })).toBe("race-town");
        expect(briefStoreMusic(snes)).toMatchObject({ feel: ["16비트 SNES 음색", "16-bit SNES", "칩 신스 리드"] });
        expect(briefStoreMusic(fan)).not.toHaveProperty("feel");
      });

      it("old packs without feelTags rank exactly as before", () => {
        const old = POOL.filter((t) => t.music.genre === "fantasy" || t.music.genre === "monster");
        expect(rankStoreMusic(old, { scene: "battle", query: "판타지" })[0]?.assetId).toBe("fan-battle");
        expect(rankStoreMusic(old, { scene: "battle", query: "몬스터" })[0]?.assetId).toBe("mon-battle");
        expect(rankStoreMusic(old, { scene: "town", mood: "평화로운" })[0]?.assetId).toBe("fan-town");
        // 이 곡들에는 결이 없어 같은 요청에 결 점수가 붙지 않는다.
        const fan = old[0]!;
        expect(scoreStoreMusic(fan, { scene: "battle", query: "판타지" })).toBe(12 + 6 + 6 + 2);
      });
    });
    describe("game-name music requests", () => {
      it("turns a game name into heard traits and the line it points to, without keeping the name", () => {
        const e = expandStoreMusicQuery("크로노트리거 느낌으로");
        expect(e.lines[0]).toBe("snes-jrpg");
        expect(e.games).toEqual(["크로노트리거"]);
        expect(e.query).not.toContain("크로노");
        expect(e.query).toContain("16비트");
        expect(expandStoreMusicQuery("투 더 문 같은 잔잔한 피아노").lines).toEqual(["piano-story"]);
        expect(expandStoreMusicQuery("To the Moon vibes").lines).toEqual(["piano-story"]);
        expect(expandStoreMusicQuery("FF6 battle").lines[0]).toBe("symphonic-jrpg");
        expect(expandStoreMusicQuery("stuff").lines).toEqual([]);
        expect(expandStoreMusicQuery("조선풍 마을").query).toBe("조선풍 마을");
      });

      it.each([
        ["크로노트리거 느낌으로 음악 넣어 줘", "field", "snes-field"],
        ["크로노트리거 느낌 전투곡", "battle", "snes-battle"],
        ["투더문 같은 잔잔한 피아노", "town", "piano-town"],
        ["테일즈런너처럼 신나는 거", "town", "race-town"],
        ["파판 전투곡 느낌", "battle", "sym-battle"],
        ["마그나카르타풍 OST", "title", "melo-title"],
        ["포켓몬 배틀 느낌", "battle", "mon-battle"],
      ] as const)("%s → %s", (query, scene, want) => {
        expect(first({ scene, query })).toBe(want);
      });

      it("game names in the project title hint the line when no store music is installed yet", () => {
        expect(projectHintLines(["파판풍 모험", "시작 마을"])).toEqual({ "symphonic-jrpg": 0.5 });
        expect(projectHintLines(["Grace of the Forest"])).toEqual({});
      });
    });
    describe("horror-word music requests", () => {
      // 2026-10-30 실데이터 재현: 「공포 게임」+town 에 캐주얼 레이스 로비 곡이 1위였다(「게임」이 결 「레트로 게임 감성」·설명 「게임의 로비」에 맞았다).
      const HORROR_POOL = [
        ...pack("race2", [track("race-lobby", { ...loop, genre: "casual-race", genreKo: "밝은 캐주얼 레이스", sceneRoles: ["town"], mood: ["경쾌한", "발랄한"], feelTags: ["칩튠 사운드", "경쾌한 리듬", "레트로 게임 감성"], summaryKo: "경쾌하고 반복적인 칩튠 선율이 돋보이는 곡으로 게임의 로비나 광장에 잘 어울립니다." })]),
        ...pack("snes2", [track("snes-plaza", { ...loop, genre: "snes-jrpg", genreKo: "16비트 JRPG", sceneRoles: ["town", "dungeon"], mood: ["무서운 듯 신비로운"], feelTags: ["16비트 SNES 음색"], summaryKo: "광장의 축제 곡." })]),
        ...pack("horror", [track("horror-town", { ...loop, genre: "horror", genreKo: "호러 앰비언트", sceneRoles: ["town", "tense"], mood: ["으스스한"], feelTags: ["낮은 드론"], summaryKo: "안개 낀 폐허 마을." })]),
        ...pack("chase", [track("chase-cellar", { ...loop, genre: "chase-horror", genreKo: "추격 호러", sceneRoles: ["dungeon"], mood: ["불안한"], feelTags: ["긴장된 현악"], summaryKo: "어두운 지하실." })]),
        ...pack("fairy", [track("fairy-rest", { ...loop, genre: "dark-fairytale", genreKo: "잔혹 동화", sceneRoles: ["town"], mood: ["기묘한"], feelTags: ["오르골"], summaryKo: "벽난로 곁의 짧은 쉼." })]),
        ...pack("piano2", [track("piano-rain", { ...loop, genre: "piano-story", genreKo: "피아노 스토리", sceneRoles: ["town"], mood: ["잔잔한"], feelTags: ["솔로 피아노"], summaryKo: "창가의 빗소리." })]),
      ];
      const top = (want: Parameters<typeof rankStoreMusic>[1]) => rankStoreMusic(HORROR_POOL, want).map((t) => t.music.genre);
      const HORROR = ["horror", "chase-horror", "school-horror", "dark-fairytale", "eerie-minimal"];

      it.each(["공포 게임", "호러", "무서운", "괴담", "scary"])("「%s」 puts horror-family lines first in town and dungeon", (query) => {
        for (const scene of ["town", "dungeon"] as const) {
          const genres = top({ scene, query });
          expect(HORROR, `${scene} ${query}: ${genres.join(",")}`).toContain(genres[0]);
          const firstOther = genres.findIndex((g) => !HORROR.includes(g));
          const lastHorror = genres.map((g) => HORROR.includes(g)).lastIndexOf(true);
          if (firstOther >= 0) expect(lastHorror).toBeLessThan(firstOther);
        }
      });

      it("「게임」 alone is not a genre word — the lobby track is not boosted by it", () => {
        const lobby = HORROR_POOL.find((t) => t.assetId === "race-lobby")!;
        expect(scoreStoreMusic(lobby, { scene: "town", query: "게임" })).toBe(scoreStoreMusic(lobby, { scene: "town" }));
      });

      it("a horror word does not demote a line the user named too (공포 피아노)", () => {
        const piano = HORROR_POOL.find((t) => t.assetId === "piano-rain")!;
        expect(scoreStoreMusic(piano, { scene: "town", query: "공포 피아노" })).toBeGreaterThan(scoreStoreMusic(piano, { scene: "town", query: "공포" }));
        expect(top({ scene: "town", query: "공포 피아노" })).toContain("piano-story");
      });
    });
  });
  // 조수가 스토어 음악을 곡 단위로 찾고(store_find_music), 그 곡만 받아 넣고(store_install assetIds), 자리에 거는(set_game_audio boss) 길.
  // 워커 안의 스토어는 가짜 읽기 길(setWorkerStoreAccess)로 바꾼다 — 실제 스테이징 시험은 openwiki/asset-store.md 「조수가 스토어 음악을 넣는다」.
  describe("storeMusicInstall", () => {
    isolateTimers();
    // 판정은 Finding 을 낸다 — 이 시험은 보고에 실리는 줄 글을 본다.
    const gameLines = (...args: Parameters<typeof gameContentProblems>): string[] => gameContentProblems(...args).map(findingLine);
    const ogg = (n: number): Uint8Array => new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2, n, 0, 0, 0]);
    const sha = (n: number): string => n.toString(16).padStart(64, "0");
    const SLUG = "oprn-bgm-joseon-vol-1-abcd1234";
    function track(n: number, id: string, oprnMusic: Record<string, unknown>) {
      return { id, name: `${id} name`, kind: "music" as const, blob: sha(n), mime: "audio/ogg" as const, meta: { oprnMusic } };
    }
    const MANIFEST = {
      schema: "oprn-store-pack/1", title: "OPRN BGM — Joseon Vol.1", summary: "s", description: "d", tags: ["bgm"], kind: "music",
      license: "OPRN-GAME", aiGenerated: true, credits: "Music: OPRN BGM (AI-generated)", previews: [],
      content: {
        tilesets: {},
        assets: {
          town: track(1, "town", { genreLine: "joseon", genreKo: "조선 전통", cultureHeard: "yes", sceneRoles: ["town", "field"], mood: ["평화로운"], loopable: true, lengthSec: 50, title: { ko: "기와지붕 바람" }, summaryKo: "대금이 이끄는 마을." }),
          boss: track(2, "boss", { genreLine: "joseon", genreKo: "중국풍 판타지", cultureHeard: "no", sceneRoles: ["boss", "battle"], mood: ["긴박한", "비장한"], loopable: true, lengthSec: 78, summaryKo: "몰아치는 보스전." }),
          win: track(3, "win", { genreLine: "joseon", genreKo: "조선풍 퓨전", cultureHeard: "partly", sceneRoles: ["victory"], mood: ["승리의"], loopable: false, lengthSec: 7, summaryKo: "짧은 승전 가락." }),
        },
      },
      blobs: [1, 2, 3].map((n) => ({ sha256: sha(n), mime: "audio/ogg", bytes: 10 })),
    } as unknown as StorePackManifest;
    function fakeStore(autoInstall: boolean, fetched: string[] = [], userMentionedStore = true): StoreReadAccess {
      const item = { slug: SLUG, title: MANIFEST.title, summary: "", kind: "music", grade: "single", license: "OPRN-GAME", aiGenerated: true, author: "OPRN 운영", tags: [], latestVersion: 2, cover: null, downloads: 0, updatedAt: "" };
      return {
        url: "http://store.test", autoInstall, userMentionedStore,
        catalog: async () => ({ items: [item] as never, total: 1, page: 1, pageSize: 24 }),
        item: async () => ({ ...item, description: "", credits: "", previews: [], status: "visible", versions: [], counts: { tilesets: 0, assets: 3, referenceDocuments: 0 } }) as never,
        manifest: async () => MANIFEST,
        blob: async (hash) => { fetched.push(hash); return ogg(parseInt(hash.slice(-2), 16)); },
      };
    }
    afterEach(() => setWorkerStoreAccess(null));
    describe("store music pick by scene", () => {
      const tracks = storeMusicTracks({ slug: SLUG, latestVersion: 2, title: MANIFEST.title }, MANIFEST);
      it("ranks the scene first and the genre actually heard over the pack line", () => {
        expect(rankStoreMusic(tracks, { scene: "town", query: "조선풍" })[0]?.assetId).toBe("town");
        expect(rankStoreMusic(tracks, { scene: "boss", query: "조선" }).map((t) => t.assetId)).toEqual(["boss"]);
        expect(rankStoreMusic(tracks, { scene: "victory" })[0]?.assetId).toBe("win");
      });
      it("follows the genre line of store music already in the project when the request names no genre", () => {
        const other = { ...MANIFEST, content: { ...MANIFEST.content, assets: { win2: track(4, "win2", { genreLine: "wuxia", genreKo: "무협 퓨전", sceneRoles: ["victory"], mood: ["승리의"], loopable: false, lengthSec: 8, summaryKo: "무협 팡파르." }) } } } as unknown as StorePackManifest;
        const pool = [...storeMusicTracks({ slug: "wuxia-pack", latestVersion: 1, title: "W" }, other), ...tracks];
        expect(rankStoreMusic(pool, { scene: "victory" })[0]?.assetId).toBe("win2");
        const lines = projectMusicLines({ a: { kind: "music", meta: MANIFEST.content.assets.town!.meta }, b: { kind: "image", meta: {} } });
        expect(lines).toEqual({ joseon: 1 });
        expect(rankStoreMusic(pool, { scene: "victory", projectLines: lines })[0]?.assetId).toBe("win");
        // 다른 줄 곡이 분위기 낱말을 더 맞혀도, 그 장르를 말하지 않았으면 게임의 줄이 앞선다. 장르를 말하면 그 장르.
        expect(rankStoreMusic(pool, { scene: "victory", mood: "승리의", query: "팡파르", projectLines: lines })[0]?.assetId).toBe("win");
        expect(rankStoreMusic(pool, { scene: "victory", query: "무협", projectLines: lines })[0]?.assetId).toBe("win2");
      });
      it("a named genre picks that pack line even when another pack's genre text shares the word, and beats a better mood match", () => {
        const pack = (slug: string, assets: Record<string, unknown>) => storeMusicTracks({ slug, latestVersion: 1, title: slug }, { ...MANIFEST, content: { ...MANIFEST.content, assets } } as unknown as StorePackManifest);
        const pool = [
          ...pack("joseon", { cn: track(5, "cn", { genreLine: "joseon", genreKo: "중국풍 판타지", cultureHeard: "no", sceneRoles: ["title"], mood: ["웅장한"], loopable: true, lengthSec: 60, summaryKo: "웅장한 곡." }) }),
          ...pack("fantasy", { ft: track(6, "ft", { genreLine: "fantasy", genreKo: "판타지 JRPG", sceneRoles: ["title"], mood: ["모험의"], loopable: true, lengthSec: 60, summaryKo: "모험 곡." }) }),
          ...pack("scifi", { sf: track(7, "sf", { genreLine: "scifi", genreKo: "SF", sceneRoles: ["title"], mood: ["웅장한"], loopable: true, lengthSec: 60, summaryKo: "웅장한 신스." }) }),
          ...pack("monster", { mt: track(8, "mt", { genreLine: "monster", genreKo: "몬스터 수집", sceneRoles: ["title"], mood: ["희망찬"], loopable: true, lengthSec: 60, summaryKo: "모험 시작." }) }),
        ];
        expect(rankStoreMusic(pool, { scene: "title", query: "판타지" })[0]?.assetId).toBe("ft");
        expect(rankStoreMusic(pool, { scene: "title", query: "몬스터 웅장한", mood: "웅장한" })[0]?.assetId).toBe("mt");
      });
      it("a new game with no store music yet follows the genre its title and map names name", () => {
        const pack = (slug: string, assets: Record<string, unknown>) => storeMusicTracks({ slug, latestVersion: 1, title: slug }, { ...MANIFEST, content: { ...MANIFEST.content, assets } } as unknown as StorePackManifest);
        const pool = [
          ...pack("fantasy", { ft: track(6, "ft", { genreLine: "fantasy", genreKo: "판타지 오케스트라", sceneRoles: ["title"], mood: ["웅장한"], loopable: true, lengthSec: 60, summaryKo: "웅장한 곡." }) }),
          ...pack("monster", { mt: track(8, "mt", { genreLine: "monster", genreKo: "몬스터 수집", sceneRoles: ["title"], mood: ["희망찬"], loopable: true, lengthSec: 60, summaryKo: "모험 시작." }) }),
        ];
        expect(rankStoreMusic(pool, { scene: "title", mood: "웅장한" })[0]?.assetId).toBe("ft");
        const lines = projectHintLines(["몬스터 콜렉터", "새싹 마을", "바위 체육관"]);
        expect(lines).toEqual({ monster: 0.5 });
        expect(rankStoreMusic(pool, { scene: "title", mood: "웅장한", projectLines: lines })[0]?.assetId).toBe("mt");
        expect(projectHintLines(["새 게임", "마을"])).toEqual({});
      });
      it("keeps only the chosen track in a subset manifest", () => {
        const subset = subsetMusicManifest(MANIFEST, ["win"]);
        expect(Object.keys(subset.content.assets)).toEqual(["win"]);
        expect(subset.blobs.map((b) => b.sha256)).toEqual([sha(3)]);
        expect(() => subsetMusicManifest(MANIFEST, ["nope"])).toThrow(/없는 곡/);
      });
    });
    describe("store_find_music + store_install in the worker", () => {
      it("finds tracks; the card shows only when auto-install is off", async () => {
        setWorkerStoreAccess(fakeStore(false));
        const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "town", query: "조선", need: "버들 마을 배경음악" }, { dryRun: true });
        expect(result.ok, result.summary).toBe(true);
        const data = result.data as { kind: string; autoInstall: boolean; tracks: { assetId: string; slug: string; genre: string }[] };
        expect(data.tracks[0]).toMatchObject({ assetId: "town", slug: SLUG, genre: "조선 전통" });
        expect(isStoreCardRequest(data)).toBe(true);
        expect(isStoreCardRequest({ ...data, autoInstall: true })).toBe(false);
      });

      it("installs only the chosen track with its store origin, license and AI label", async () => {
        const fetched: string[] = [];
        setWorkerStoreAccess(fakeStore(true, fetched));
        const ctx = { project: createEmptyToolProject() };
        const result = await runToolAsync(ctx, "store_install", { slug: SLUG, assetIds: ["boss"] }, { dryRun: false });
        expect(result.ok, result.summary).toBe(true);
        const id = storeProjectId(SLUG, "boss");
        expect((result.data as { resourceIds: string[] }).resourceIds).toEqual([id]);
        const asset = ctx.project.assets.uploaded[id]!;
        expect(asset.kind).toBe("music");
        expect(asset.dataUrl?.startsWith("data:audio/ogg;base64,")).toBe(true);
        expect(asset.origin).toMatchObject({ itemSlug: SLUG, version: 2, license: "OPRN-GAME", aiGenerated: true, credits: "Music: OPRN BGM (AI-generated)" });
        expect(Object.keys(ctx.project.assets.uploaded).filter((key) => key.startsWith("store_"))).toEqual([id]);
        expect(fetched).toEqual([sha(2)]);
      });

      it("refuses a music install while auto-install is off unless the user asked for the store", async () => {
        setWorkerStoreAccess(fakeStore(false));
        const refused = await runToolAsync({ project: createEmptyToolProject() }, "store_install", { slug: SLUG, assetIds: ["boss"] }, { dryRun: true });
        expect(refused.ok).toBe(false);
        expect(refused.summary).toMatch(/먼저 묻기/);
        const asked = await runToolAsync({ project: createEmptyToolProject() }, "store_install", { slug: SLUG, assetIds: ["boss"], userAsked: true }, { dryRun: true });
        expect(asked.ok, asked.summary).toBe(true);
      });

      it("does not let the model claim userAsked when the user's request never mentioned the store", async () => {
        expect(mentionsStore("조선풍 게임 음악 전부 맞춰줘")).toBe(false);
        expect(mentionsStore("스토어에서 보스곡 받아 넣어줘")).toBe(true);
        setWorkerStoreAccess(fakeStore(false, [], false));
        const claimed = await runToolAsync({ project: createEmptyToolProject() }, "store_install", { slug: SLUG, assetIds: ["boss"], userAsked: true }, { dryRun: true });
        expect(claimed.ok).toBe(false);
        expect(claimed.summary).toMatch(/먼저 묻기/);
      });
    });
    describe("set_game_audio boss", () => {
      function bossProject(): { project: Project; mapId: string } {
        const ctx = { project: createEmptyToolProject() };
        const mapId = "m_cave";
        expect(runTool(ctx, "create_map", { id: mapId, name: "동굴", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
        ctx.project.database.troops = [{ id: "troop_dragon", name: "붉은 드래곤", members: [] } as never, { id: "troop_slime", name: "슬라임", members: [] } as never];
        const boss = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_boss", name: "보스", x: 1, y: 1, commands: [
          { kind: "text", body: "덤벼라!" }, { kind: "battleProcessing", troopId: "troop_dragon", canEscape: false, canLose: false }, { kind: "text", body: "끝" },
        ] } }, { dryRun: false });
        expect(boss.ok, boss.summary).toBe(true);
        const slime = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_slime", name: "슬라임", x: 2, y: 1, commands: [{ kind: "battleProcessing", troopId: "troop_slime" }] } }, { dryRun: false });
        expect(slime.ok, slime.summary).toBe(true);
        const project = ctx.project;
        project.assets.uploaded.boss_song = { id: "boss_song", name: "보스곡", kind: "music", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: {} };
        return { project, mapId };
      }
      it("wraps only the boss battle with set/reset and is idempotent", () => {
        const { project, mapId } = bossProject();
        const battleBefore = project.system.battleBgmResourceId;
        const ctx = { project };
        const first = runTool(ctx, "set_game_audio", { role: "boss", resourceId: "boss_song" }, { dryRun: false });
        expect(first.ok, first.summary).toBe(true);
        const again = runTool(ctx, "set_game_audio", { role: "boss", resourceId: "boss_song" }, { dryRun: false });
        expect(again.ok, again.summary).toBe(true);
        type C = { kind: string; commandId?: string; fields?: Record<string, unknown> };
        const events = ctx.project.maps[mapId]!.events as unknown as { id: string; commands?: C[]; pages?: { commands: C[] }[] }[];
        const listOf = (id: string): C[] => { const e = events.find((x) => x.id === id)!; return e.pages?.[0]?.commands ?? e.commands ?? []; };
        const boss = listOf("ev_boss");
        expect(boss.map((c) => c.commandId ?? c.kind)).toEqual(["text", "m2-027-change-system-bgm", "battleProcessing", "m2-027-change-system-bgm", "text"]);
        expect(boss[1]!.fields).toMatchObject({ cue: "battle", operation: "set", resourceId: "boss_song" });
        expect(boss[3]!.fields).toMatchObject({ cue: "battle", operation: "reset" });
        expect(listOf("ev_slime").map((c) => c.kind)).toEqual(["battleProcessing"]);
        expect(ctx.project.system.battleBgmResourceId).toBe(battleBefore);
      });
      it("auto-detects only boss troops that are actually fought (an unused dragon does not hide the gumiho boss)", () => {
        const { project, mapId } = bossProject();
        const ctx = { project };
        ctx.project.database.troops.push({ id: "troop_gumiho", name: "구미호 우두머리", members: [] } as never);
        const map = ctx.project.maps[mapId]! as unknown as { events: { id: string; commands?: { kind: string; troopId?: string }[]; pages?: { commands: { kind: string; troopId?: string }[] }[] }[] };
        const boss = map.events.find((e) => e.id === "ev_boss")!;
        for (const c of boss.pages?.[0]?.commands ?? boss.commands ?? []) if (c.kind === "battleProcessing") c.troopId = "troop_gumiho";
        const r = runTool(ctx, "set_game_audio", { role: "boss", resourceId: "boss_song" }, { dryRun: false });
        expect(r.ok, r.summary).toBe(true);
        expect((r.data as { troopIds: string[] }).troopIds).toEqual(["troop_gumiho"]);
      });
    });
    describe("set_game_audio with a file-backed store track", () => {
      it("accepts a track stored as an assets/ file reference (card install) even where no URL resolver exists", () => {
        const ctx = { project: createEmptyToolProject() };
        expect(runTool(ctx, "create_map", { id: "m_town", name: "마을", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
        ctx.project.assets.uploaded.store_x__town = { id: "store_x__town", name: "마을곡", kind: "music", ref: { sha256: sha(9), mime: "audio/ogg", extension: "ogg", bytes: 10 }, meta: {} } as never;
        const r = runTool(ctx, "set_game_audio", { role: "maps", resourceId: "store_x__town", mapIds: ["m_town"] }, { dryRun: false });
        expect(r.ok, r.summary).toBe(true);
        expect((ctx.project.maps.m_town!.bgm as { resourceId?: string } | undefined)?.resourceId).toBe("store_x__town");
      });
    });
    describe("v2 finish check", () => {
      it("v2 does not report the v1 game-system review as unfinished after set_game_audio (it has no review tool)", () => {
        const project = createEmptyToolProject();
        const v1 = new PiGameSystemProduction(), v2 = new PiGameSystemProduction(false);
        for (const p of [v1, v2]) p.record("set_game_audio", { ok: true, summary: "ok" } as never, project);
        expect(v1.inspect(project).length).toBeGreaterThan(0);
        expect(v2.inspect(project)).toEqual([]);
      });
      it("does not re-balance a boss that was already there when only its music changed", () => {
        const ctx = { project: createBlankProject() };
        expect(runTool(ctx, "create_map", { id: "m_cave", name: "동굴", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
        const made = runTool(ctx, "upsert_event", { mapId: "m_cave", event: { id: "ev_boss", name: "드래곤", x: 1, y: 1, commands: [{ kind: "battleProcessing", troopId: "troop_dragon", canEscape: false, canLose: false }] } }, { dryRun: false });
        expect(made.ok, made.summary).toBe(true);
        ctx.project.assets.uploaded.boss_song = { id: "boss_song", name: "보스곡", kind: "music", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: {} };
        const before = structuredClone(ctx.project);
        expect(runTool(ctx, "set_game_audio", { role: "boss", resourceId: "boss_song" }, { dryRun: false }).ok).toBe(true);
        expect(gameLines(before, ctx.project, "보스전 음악 긴장감 있게 바꿔줘").join("\n")).not.toMatch(/게임 검사 전투/);
        // 새로 저작한 전투는 여전히 본다.
        const fresh = structuredClone(before);
        fresh.maps.m_cave!.events = [];
        expect(gameLines(fresh, ctx.project, "드래곤 보스전 만들어 줘").join("\n")).toMatch(/게임 검사 전투/);
      });

      it("does not ask for a playAudio event when the request was met by binding map/system music", () => {
        const before = createEmptyToolProject();
        const after = structuredClone(before);
        after.system.battleBgmResourceId = "store_x__boss";
        expect(gameLines(before, after, "보스전 음악 바꿔줘").join("\n")).not.toMatch(/게임 검사 음악/);
        expect(gameLines(before, structuredClone(before), "보스전 음악 바꿔줘").join("\n")).toMatch(/게임 검사 음악/);
      });
    });
    describe("auto-install is the default; the note offers a swap", () => {
      it("auto-installs unless the user turned on ask-first", () => {
        const held = new Map<string, string>();
        const original = globalThis.localStorage;
        Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => held.get(k) ?? null, setItem: (k: string, v: string) => held.set(k, v) } });
        try {
          expect(storeAutoInstallEnabled()).toBe(true);
          held.set("oprn:store-auto-install", "0");
          expect(storeAutoInstallEnabled()).toBe(false);
          held.set("oprn:store-auto-install", "1");
          expect(storeAutoInstallEnabled()).toBe(true);
        } finally {
          Object.defineProperty(globalThis, "localStorage", { configurable: true, value: original });
        }
      });

      it("passes an auto-installed music result to the panel as a note, not as a question", async () => {
        setWorkerStoreAccess(fakeStore(true));
        const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "town", query: "조선", need: "마을 배경음악" }, { dryRun: true });
        const found = result.data as StoreMusicChoice;
        const data: StoreMusicChoice = { ...found, tracks: [...found.tracks, { ...found.tracks[0]!, assetId: "town2", title: "둘째 마을 곡" }] };
        expect(isStoreCardRequest(data)).toBe(false);
        expect(isAutoMusicChoice(data)).toBe(true);
        const event = { type: "tool_end", name: "store_find_music", ok: true, result: { data } } as unknown as PiAgentEvent;
        expect(storeCardFromEvent(event)).toBe(data);
        // 어느 후보가 들어갔는지 찾고 나머지를 바꿀 곡으로 준다. 아무 후보도 안 들어갔으면 쪽지가 없다.
        const installed = data.tracks[1]!;
        const swaps = installedMusicSwaps([data, data], { [storeProjectId(installed.slug, installed.assetId)]: {} });
        expect(swaps).toHaveLength(1);
        expect(swaps[0]!.installed.assetId).toBe(installed.assetId);
        expect(swaps[0]!.others.map((t) => t.assetId)).not.toContain(installed.assetId);
        expect(installedMusicSwaps([data], {})).toEqual([]);
      });
    });
  });
  // store_find_music 이 음악 팩을 쪽을 넘겨 전부 보는가(16개 상한 없음), 1위에 recommended·이유를 붙이는가,
  // 미술관 요청을 던전으로 읽지 않는가, set_game_audio 가 틀린 mapIds 에 실제 맵을 알려 주는가(2026-10-30 실조수 e2e 14/16).
  describe("storeMusicPaging", () => {
    isolateTimers();
    const sha = (n: number): string => n.toString(16).padStart(64, "0");
    function manifest(n: number, music: Record<string, unknown>): StorePackManifest {
      return {
        schema: "oprn-store-pack/1", title: `Pack ${n}`, summary: "s", description: "d", tags: ["bgm"], kind: "music",
        license: "OPRN-GAME", aiGenerated: true, credits: "Music", previews: [],
        content: { tilesets: {}, assets: { [`t${n}`]: { id: `t${n}`, name: `track ${n}`, kind: "music", blob: sha(n), mime: "audio/ogg", meta: { oprnMusic: music } } } },
        blobs: [{ sha256: sha(n), mime: "audio/ogg", bytes: 10 }],
      } as unknown as StorePackManifest;
    }
    const filler = (n: number) => manifest(n, { genreLine: "joseon", genreKo: "조선 전통", sceneRoles: ["town"], mood: ["평화로운"], loopable: true, lengthSec: 60, summaryKo: "마을." });
    function fakeStore(manifests: StorePackManifest[], pageSize: number, calls: { catalog: number; manifest: number }): StoreReadAccess {
      const items = manifests.map((_, n) => ({ slug: `pack-${n}`, title: `Pack ${n}`, summary: "", kind: "music", grade: "single", license: "OPRN-GAME", aiGenerated: true, author: "OPRN", tags: [], latestVersion: 1, cover: null, downloads: 0, updatedAt: "" }));
      return {
        url: `http://paging.test/${manifests.length}/${pageSize}`, autoInstall: true, userMentionedStore: true,
        catalog: async (input): Promise<StoreCatalogPage> => {
          calls.catalog += 1;
          const page = input.page ?? 1;
          return { items: items.slice((page - 1) * pageSize, page * pageSize) as never, total: items.length, page, pageSize };
        },
        item: async () => { throw new Error("not used"); },
        manifest: async (slug) => { calls.manifest += 1; return manifests[Number(slug.slice(5))]!; },
        blob: async () => new Uint8Array(),
      };
    }
    afterEach(() => { setWorkerStoreAccess(null); clearStoreMusicCache(); });
    describe("store music paging", () => {
      it("lists every music pack across pages (not just 16) and caches the list and manifests for the session", async () => {
        const calls = { catalog: 0, manifest: 0 };
        const packs = Array.from({ length: 30 }, (_, n) => (n === 29
          ? manifest(n, { genreLine: "horror", genreKo: "호러 앰비언트", sceneRoles: ["tense"], mood: ["으스스한"], loopable: true, lengthSec: 60, summaryKo: "공포." })
          : filler(n)));
        const access = fakeStore(packs, 12, calls);
        expect((await listAllStoreMusicPacks(access)).items).toHaveLength(30);
        expect(calls.catalog).toBe(3);
        setWorkerStoreAccess(access);
        const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "tense", query: "호러" }, { dryRun: true });
        expect(result.ok, result.summary).toBe(true);
        expect((result.data as StoreMusicChoice).tracks[0]).toMatchObject({ slug: "pack-29", recommended: true, rank: 1 });
        expect(calls.catalog).toBe(3);
        expect(calls.manifest).toBe(30);
        await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "town", query: "조선" }, { dryRun: true });
        expect(calls).toEqual({ catalog: 3, manifest: 30 });
      });
    });
    describe("store music recommendation", () => {
      const packs = [
        manifest(0, { genreLine: "snes-jrpg", genreKo: "16비트 레트로 JRPG", sceneRoles: ["battle"], mood: ["긴박한"], loopable: true, lengthSec: 60, summaryKo: "레트로 전투." }),
        manifest(1, { genreLine: "symphonic-jrpg", genreKo: "심포닉 JRPG", sceneRoles: ["battle"], mood: ["웅장한"], loopable: true, lengthSec: 60, summaryKo: "오케스트라 전투." }),
      ];

      it("marks only the top candidate recommended, with a reason, and marks other-line candidates of a game name as fallback", async () => {
        setWorkerStoreAccess(fakeStore(packs, 24, { catalog: 0, manifest: 0 }));
        const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "battle", query: "파판 전투곡 느낌으로 일반 전투" }, { dryRun: true });
        expect(result.ok, result.summary).toBe(true);
        const tracks = (result.data as StoreMusicChoice).tracks;
        expect(tracks.map((t) => [t.slug, t.recommended === true, t.fallback === true])).toEqual([["pack-1", true, false], ["pack-0", false, true]]);
        expect(tracks[0]!.why).toMatch(/symphonic-jrpg/u);
        expect(result.summary).toMatch(/recommended/u);
        expect(result.summary).toContain("pack-1");
      });

      it("reads a gallery/mansion request passed as scene:dungeon as town", async () => {
        const town = [manifest(0, { genreLine: "piano-story", genreKo: "클래식 피아노", sceneRoles: ["town"], mood: ["잔잔한"], loopable: true, lengthSec: 60, summaryKo: "미술관." }),
          manifest(1, { genreLine: "horror", genreKo: "호러", sceneRoles: ["dungeon"], mood: ["어두운"], loopable: true, lengthSec: 60, summaryKo: "동굴." })];
        setWorkerStoreAccess(fakeStore(town, 24, { catalog: 0, manifest: 0 }));
        const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "dungeon", query: "이브 같은 미술관 BGM" }, { dryRun: true });
        expect(result.ok, result.summary).toBe(true);
        expect((result.data as StoreMusicChoice).scene).toBe("town");
        expect((result.data as StoreMusicChoice).tracks[0]!.slug).toBe("pack-0");
        const cave = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", { scene: "dungeon", query: "미술관 지하 동굴" }, { dryRun: true });
        expect((cave.data as StoreMusicChoice).scene).toBe("dungeon");
      });
    });
    describe("set_game_audio map ids", () => {
      it("rejects a tileset id in mapIds with the real map ids and the start map", () => {
        const ctx = { project: createEmptyToolProject() };
        expect(runTool(ctx, "create_map", { id: "m_gallery", name: "미술관", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
        ctx.project.tilesets.beodeul_city ??= { id: "beodeul_city" } as never;
        const message = mapIdsError(ctx.project, ["beodeul_city"]);
        expect(message).toMatch(/beodeul_city 는 타일셋 id/u);
        expect(message).toContain("m_gallery(미술관");
        expect(message).toMatch(/시작 맵/u);
      });
    });
  });
});

describe("todoEndingReachSolvedDoor", () => {
  isolateTimers();
  // r7 R1 · pf4-live c3(2026-11-16): 할 일 «ending reached» 가 «시작 맵에서 옛 지하 묘지로 가는 길이 없다» 고 거절했는데, 자동 플레이·정직한 플레이어·브라우저는 엔딩에 닿았다.
  // 대성당 계단실 모양을 줄였다: 번호 쪽지(지나감) → 지하 문(처음엔 막음, 번호를 풀면 마지막 페이지가 «below» 로 지나감) → 계단(묘지로 이동) → 묘지의 엔딩.
  const page = (commands: unknown[], conditions: unknown[] = [], priority = "same", trigger = "action") => ({ id: `p${Math.random().toString(36).slice(2, 7)}`, trigger: { kind: trigger }, priority, graphic: {}, movement: { type: "fixed", speed: 3, frequency: 3 }, conditions, commands });
  const sw = (id: string) => ({ kind: "switch", switchId: id, value: true });
  function corridorGame(doorOpensAfterSolve: boolean): Project {
    const project = createBlankProject();
    const hall = project.maps[project.startMapId]!;
    const floor = hall.lowerTiles[0]!;
    const corridor = (id: string, name: string, width: number) => ({ ...structuredClone(hall), id, name, width, height: 1, lowerTiles: Array(width).fill(floor), upperTiles: Array(width).fill(0), events: [] as never[] });
    const cathedral = Object.assign(hall, corridor(hall.id, "대성당", 8));
    const crypt = corridor("map_crypt", "옛 지하 묘지", 4);
    project.maps[crypt.id] = crypt as never;
    project.startPos = { x: 0, y: 0 } as never;
    const db = project.database as unknown as { switches?: { id: string; name: string }[] };
    db.switches = [...(db.switches ?? []), { id: "sw_note", name: "쪽지" }, { id: "sw_solved", name: "풀림" }];
    cathedral.events.push(
      { id: "ev_note", name: "번호 쪽지", x: 1, y: 0, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "setSwitch", switchId: "sw_note", value: true }], [], "below")] } as never,
      { id: "ev_door", name: "지하 문", x: 3, y: 0, trigger: { kind: "action" }, commands: [], pages: [
        page([{ kind: "text", body: "굳게 잠긴 철문." }]),
        page([{ kind: "setSwitch", switchId: "sw_solved", value: true }], [sw("sw_note")]),
        ...(doorOpensAfterSolve ? [page([], [sw("sw_solved")], "below")] : []),
      ] } as never,
      { id: "ev_stairs", name: "계단", x: 6, y: 0, trigger: { kind: "playerTouch" }, commands: [], pages: [page([{ kind: "transfer", mapId: crypt.id, x: 0, y: 0 }], [], "below", "playerTouch")] } as never,
    );
    crypt.events.push({ id: "ev_end", name: "망자 군주", x: 2, y: 0, trigger: { kind: "action" }, commands: [], pages: [page([{ kind: "triggerEnding", endingId: "ending_sea" }])] } as never);
    project.endings = [{ id: "ending_sea", name: "다시 열린 바다", conditions: [], priority: 0 }] as never;
    return project;
  }
  describe("할 일 «엔딩에 닿는다» 는 풀린 문을 지나 걷는다", () => {
    it("번호를 풀면 지나가게 되는 문 너머의 계단으로 묘지에 닿는다", () => {
      const result = runTodoCheck(corridorGame(true), { kind: "ending" }, {});
      expect(result.detail).not.toContain("가는 길이 없다");
      expect(result.pass).toBe(true);
    });

    it("풀어도 계속 막는 문이면 여전히 못 닿는다고 말한다", () => {
      const result = runTodoCheck(corridorGame(false), { kind: "ending" }, {});
      expect(result.pass).toBe(false);
    });
  });
});

// 조수 v2 독립 검토자(src/ai/v2/judge/advisor.ts)의 결정적 부분 — 변경 요약·도구 기록 압축·응답 해석(등급은 코드가 정한다)·후속 지시문.
describe("v2Advisor", () => {
  isolateTimers();
  const page = (id: string, conditions: unknown[], commands: unknown[], sprite = true) => ({
    id, name: id, conditions, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed" }, commands,
    graphic: sprite ? { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 } : { transparent: true },
  });
  const ev = (id: string, name: string, pages: unknown[]): GameEvent => ({ id, name, x: 3, y: 4, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent);
  function withEvents(project: Project, events: GameEvent[]): Project {
    const next = structuredClone(project);
    next.maps[next.startMapId]!.events = events;
    return next;
  }
  describe("summarizeProjectDiff", () => {
    const base = createBlankProject();
    const cutscene = ev("ev_cut", "오프닝 컷신", [page("p0", [], [{ kind: "text", speaker: "제페토", body: "어서 오게." }])]);
    const cafe = ev("ev_cafe", "서연", [
      page("p0", [], [{ kind: "text", speaker: "서연", body: "어서 오세요." }]),
      page("p1", [{ kind: "variable", variableId: "var_aff", op: ">=", value: 4 }], [{ kind: "text", speaker: "서연", body: "같이 걸어갈래요?" }, { kind: "setSwitch", switchId: "sw_walk", value: true }]),
    ]);
    const walk = ev("ev_walk", "산책 장면", [page("p0", [{ kind: "switch", switchId: "sw_walk", value: true }], [{ kind: "text", body: "둘이 걷는다." }])]);

    it("삭제된 이벤트와 공장 기본 오프닝을 그대로 적는다", () => {
      const before = withEvents(base, [cutscene]);
      const after = withEvents(base, []);
      const text = summarizeProjectDiff(before, after);
      expect(text).toContain("삭제: «오프닝 컷신» ev_cut");
      expect(text).toContain("## 오프닝 (이번에 바뀌지 않음)");
      expect(text).toContain("공장 기본");
    });

    it("다시 쓰기에서 사라진 페이지와 끊긴 스위치 고리를 짚는다", () => {
      const before = withEvents(base, [cafe, walk]);
      const rewritten = ev("ev_cafe", "서연", [1, 2, 3].map((d) => page(`d${d}`, [{ kind: "variable", variableId: "var_day", op: "==", value: d }], [{ kind: "text", speaker: "서연", body: `${d}일차 인사` }])));
      const after = withEvents(base, [rewritten, walk]);
      const text = summarizeProjectDiff(before, after);
      expect(text).toContain("⚠ 사라진 페이지 p1 [var_aff>=4]");
      expect(text).toContain("「서연: 같이 걸어갈래요?」");
      expect(text).toMatch(/끊김\(이번 실행\): sw_walk/u);
    });

    it("바뀐 것이 없으면 짧게 끝나고 상한을 지킨다", () => {
      const text = summarizeProjectDiff(base, structuredClone(base), 400);
      expect(text).toContain("바뀐 맵 없음");
      expect(text).toContain("이벤트 (추가 0 · 삭제 0 · 바뀜 0");
      expect(text.length).toBeLessThanOrEqual(400);
    });
  });
  describe("compactToolLog", () => {
    it("읽기는 이름별 횟수로 묶고 쓰기·실패는 한 줄씩 남긴다", () => {
      const text = compactToolLog([
        { name: "get_event", ok: true, summary: "읽음" }, { name: "get_event", ok: true, summary: "읽음" },
        { name: "remove_event", ok: true, args: { eventId: "ev_cut" }, summary: "이벤트 'ev_cut' 제거" },
        { name: "upsert_event", ok: false, args: { x: 1 }, summary: "형식 오류" },
      ]);
      expect(text).toContain("(읽기 get_event×2)");
      expect(text).toMatch(/remove_event .*ev_cut.*제거/u);
      expect(text).toContain("upsert_event ✗실패");
    });
  });
  describe("parseAdvisorReply — 등급은 코드가 정한다", () => {
    it("반대되는 주장·알리지 않은 삭제·「다 됐다」면서 빠진 것은 막음, 보이지 않는 주장은 우려", () => {
      const { notes } = parseAdvisorReply(JSON.stringify({
        claims: [
          { claim: "오프닝을 새로 만들었다", status: "contradicted", evidence: "## 오프닝 (이번에 바뀌지 않음)" },
          { claim: "이름을 바꿨다", status: "not_shown", evidence: "이름 바뀜 줄 없음" },
          { claim: "시계를 놓았다", status: "shown", evidence: "추가: «시계»" },
        ],
        removals: [{ what: "오프닝 컷신", mentioned: false, evidence: "삭제: «오프닝 컷신»" }, { what: "옛 표지판", mentioned: true, evidence: "삭제: «표지판»" }],
        unreachable: [{ what: "산책 장면", report_says_works: true, evidence: "끊김: sw_walk" }],
        missing: [{ part: "엔딩", report_says_done: false, evidence: "엔딩 없음" }],
      }));
      expect(notes.map((n) => n.level)).toEqual(["blocker", "concern", "blocker", "aside", "blocker", "concern"]);
    });

    it("읽지 못한 응답은 막지 않고 사유만 남긴다", () => {
      expect(parseAdvisorReply("모르겠어요").problem).toBeTruthy();
      expect(parseAdvisorReply(JSON.stringify({ claims: [] })).notes).toEqual([]);
    });
  });
  describe("adviseTurn", () => {
    it("알리지 않은 삭제는 막음으로 판정한다", async () => {
      const chat = async () => JSON.stringify({ removals: [{ what: "오프닝 컷신", mentioned: false, evidence: "삭제: «오프닝 컷신»" }] });
      const verdict = await adviseTurn({ task: "회상을 넣어 줘", toolLog: "", diff: "삭제: «오프닝 컷신»", report: "다 됐습니다" }, chat);
      expect(verdict.notes[0]?.level).toBe("blocker");
    });

    it("호출이 실패해도 던지지 않고 판정 불가로 남긴다", async () => {
      const verdict = await adviseTurn({ task: "t", toolLog: "", diff: "", report: "" }, async () => { throw new Error("429"); });
      expect(verdict.notes).toEqual([]);
      expect(verdict.problem).toMatch(/검토자 호출 실패/u);
    });
  });
});

describe("wholeGameRekick", () => {
  isolateTimers();
  /** A game that already has its own title and no opening, so only the signs under test fire. */
  function finishFirstScreen(p: Project): void {
    p.meta.title = "바닷가 카페";
    (p.system as { titleScreen?: { title?: string } }).titleScreen = { ...(p.system as { titleScreen?: object }).titleScreen, title: "바닷가 카페" };
    p.system.opening = { ...p.system.opening!, enabled: false };
  }
  // 2026-10-25 Salad S3: 9/58 builds stopped with only the skeleton 「기억의 조각 → 첫 구간 끝」.
  describe("whole-game rekick signs", () => {
    it("skeleton-only endings and events count as unbuilt; a real ending clears it", () => {
      const p = createBlankProject() as Project;
      p.endings = [{ id: "ending_segment", name: "첫 구간 끝", conditions: [], priority: 0 }];
      p.maps[p.startMapId!]!.events.push({ id: "ev_seg", name: "기억의 조각", x: 2, y: 2, pages: [] } as never);
      finishFirstScreen(p);
      const signs = unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.");
      expect(signs.length).toBe(2);
      expect(wholeGameRekickPrompt(signs)).toContain("이어 짓기");
      p.endings.push({ id: "ending_stay", name: "항구에 남는 두 사람", conditions: [], priority: 10 });
      // 엔딩을 부르는 이벤트가 있어야 끝낼 수 있는 게임이다(615f5a3e60) — 뼈대 이벤트의 한 줄을 실제 엔딩 호출로 바꾼다.
      const seg = p.maps[p.startMapId!]!.events.find((ev) => ev.id === "ev_seg")!;
      seg.name = "항구의 이별"; seg.pages = [{ commands: [{ kind: "triggerEnding", endingId: "ending_stay" }] }] as never;
      expect(unbuiltGameSigns(p, "바닷가 카페 연애 게임 만들어 줘. 엔딩까지.")).toHaveLength(0);
    });
    // 2026-11-05 gpt-only-game (Terra alone): 「좀비 생존 게임 만들어줘」 ended with an opening only — no ending, only the blank start map.
    it("a whole-game build with no ending or only the blank start map is unbuilt, ending word or not", () => {
      const p = createBlankProject() as Project;
      finishFirstScreen(p);
      const noMap = "플레이할 맵이 없다 — 손대지 않은 빈 시작 맵뿐이다";
      expect(unbuiltGameSigns(p, "짧은 모험 게임 만들어 줘. 엔딩까지.")).toEqual(["엔딩이 하나도 없다", noMap]);
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual(["엔딩이 하나도 없다", noMap]);
      p.maps[p.startMapId!]!.events.push({ id: "ev_gate", name: "대피소 문", x: 2, y: 2, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] }] } as never);
      p.endings = [{ id: "ending_escape", name: "대피 성공", conditions: [], priority: 0 }];
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
    });
    // 2026-11-05 gpt-only-game r9 zombie: the last stretch (chests, battles, gate, escape ending) sat on the untouched blank start map.
    it("events on a bare blank canvas count as unbuilt once another map is built", () => {
      const p = createBlankProject() as Project;
      finishFirstScreen(p);
      p.endings = [{ id: "ending_escape", name: "탈출", conditions: [], priority: 0 }];
      const start = p.maps[p.startMapId!]!;
      start.events.push({ id: "ev_gate", name: "봉쇄문", x: 2, y: 2, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_escape" }] }] } as never);
      // Only the blank map: the one-map game is thinGameSign's job, not this sign.
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
      const built = { ...structuredClone(start), id: "map_camp", name: "야영지", events: [] };
      built.lowerTiles = built.lowerTiles.map((t, i) => (i === 0 ? t + 1 : t));
      p.maps.map_camp = built;
      const signs = unbuiltGameSigns(p, "좀비 생존 게임 만들어줘");
      expect(signs).toHaveLength(1);
      expect(signs[0]).toContain(p.startMapId!);
      start.lowerTiles = start.lowerTiles.map((t, i) => (i === 1 ? t + 1 : t));
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
    });
    // 2026-11-05 gpt-only-game: 「마을부터」 had an ending but no healing (game over in the 2nd forest battle);
    // fantasy and cat kept the factory opening, the village kept the 「새 프로젝트」 title.
    it("combat with no healing and a factory title or opening count as unbuilt", () => {
      const p = createBlankProject() as Project;
      p.endings = [{ id: "ending_home", name: "집으로", conditions: [], priority: 0 }];
      const map = p.maps[p.startMapId!]!;
      map.events.push({ id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_home" }] }] } as never);
      const signs = unbuiltGameSigns(p, "마을 모험 게임 만들어줘");
      expect(signs.some((s) => s.includes("편집기 기본") && s.includes("제목"))).toBe(true);
      expect(signs.some((s) => s.includes("오프닝"))).toBe(true);
      finishFirstScreen(p);
      expect(unbuiltGameSigns(p, "마을 모험 게임 만들어줘")).toEqual([]);
      (map as { encounterTable?: unknown; encounterRate?: number }).encounterTable = [{ troopId: p.database.troops[0]!.id, weight: 1 }];
      (map as { encounterRate?: number }).encounterRate = 20;
      const heal = unbuiltGameSigns(p, "마을 모험 게임 만들어줘");
      expect(heal).toHaveLength(1);
      expect(heal[0]).toContain("회복 수단이 하나도 없다");
    });
    // 2026-11-05 round 4: zombie survival lost its exit event to a dungeon rebuild (ending left, nothing triggers it);
    // the village had endless forest encounters and one chest potion as its only heal.
    it("an ending nobody triggers and one-shot healing against random encounters count as unbuilt", () => {
      const p = createBlankProject() as Project;
      finishFirstScreen(p);
      p.endings = [{ id: "ending_rescue", name: "새벽의 구조", conditions: [], priority: 0 }];
      const map = p.maps[p.startMapId!]!;
      map.events.push({ id: "ev_sign", name: "표지판", x: 2, y: 2, pages: [] } as never);
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘").some((s) => s.includes("어떤 이벤트도 부르지 않는다"))).toBe(true);
      map.events.push({ id: "ev_exit", name: "출구", x: 3, y: 3, pages: [{ commands: [{ kind: "triggerEnding", endingId: "ending_rescue" }] }] } as never);
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
      (map as { encounterTable?: unknown; encounterRate?: number }).encounterTable = [{ troopId: p.database.troops[0]!.id, weight: 1 }];
      (map as { encounterRate?: number }).encounterRate = 18;
      p.session.inventory = { ...p.session.inventory, item_potion: 1 };
      const signs = unbuiltGameSigns(p, "좀비 생존 게임 만들어줘");
      expect(signs).toHaveLength(1);
      expect(signs[0]).toContain("회복은 한 번 주는 것뿐");
      map.events.push({ id: "ev_rest", name: "쉬터", x: 4, y: 4, pages: [{ commands: [{ kind: "recoverAll" }] }] } as never);
      expect(unbuiltGameSigns(p, "좀비 생존 게임 만들어줘")).toEqual([]);
    });
    // 2026-11-05 rounds 1-7: 「학교 연애」 and 「좀비 생존」 kept ending on one map with 1-4 events.
    it("a finished but one-map, one-character game is thin; two maps, two talkers and five events are not", () => {
      const p = createBlankProject() as Project;
      const talker = (id: string, x: number) => ({ id, name: id, x, y: 2, pages: [{ graphic: { sprite: { type: "bundled", id: "tex" } }, commands: [{ kind: "text", body: "안녕" }] }] });
      const start = p.maps[p.startMapId!]!;
      start.events.push(talker("ev_seoa", 2) as never);
      expect(thinGameSign(p)).toContain("맵이 1장");
      expect(widenGamePrompt(thinGameSign(p)!)).toContain("다시 묻지 않는다");
      const second = { ...structuredClone(start), id: "map_hall", name: "복도", events: [] as unknown[] };
      p.maps.map_hall = second as never;
      second.events.push(talker("ev_friend", 3), { id: "ev_note", name: "쪽지", x: 4, y: 4, pages: [] }, { id: "ev_door", name: "문", x: 5, y: 5, pages: [] }, { id: "ev_box", name: "상자", x: 6, y: 6, pages: [] });
      expect(thinGameSign(p)).toBeUndefined();
    });
    it("a one-room escape request only needs enough to do, and a busy one-talker game is not thin", () => {
      const p = createBlankProject() as Project;
      const start = p.maps[p.startMapId!]!;
      for (let i = 0; i < 5; i++) start.events.push({ id: `ev_clue${i}`, name: `단서${i}`, x: 2 + i, y: 2, pages: [] } as never);
      expect(thinGameSign(p, "방 하나만 있는 방탈출 게임 만들어줘")).toBeUndefined();
      expect(thinGameSign(p, "좀비 생존 게임 만들어줘")).toContain("맵이 1장");
      const hall = { ...structuredClone(start), id: "map_hall", name: "복도", events: [] as unknown[] };
      p.maps.map_hall = hall as never;
      for (let i = 0; i < 3; i++) hall.events.push({ id: `ev_box${i}`, name: `상자${i}`, x: 2 + i, y: 3, pages: [] });
      expect(thinGameSign(p, "좀비 생존 게임 만들어줘")).toBeUndefined();
    });
    it("a request ending in …게임으로 is a whole game; an edit that mentions 게임 is not", () => {
      expect(wantsWholeGame("마을 하나 만들어줘. 거기서 시작하는 모험 게임으로")).toBe(true);
      expect(wantsWholeGame(`마을 하나 만들어줘. 거기서 시작하는 모험 게임으로${INTENT_NOTE_BOUNDARY}[새로하기 오프닝·타이틀] …`)).toBe(true);
      expect(wantsWholeGame("마을 이름을 게임으로 바꿔")).toBe(false);
      expect(wantsWholeGame("이 상점을 미니게임으로")).toBe(false);
      expect(wantsWholeGame("대사를 게임으로")).toBe(false);
    });
  });
});
