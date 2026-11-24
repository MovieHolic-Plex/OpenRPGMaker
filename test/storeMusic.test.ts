import { describe, expect, it, afterEach } from "vitest";
import { readStoreMusicMeta } from "@/assets/storeMusicMeta";
import { briefStoreMusic, expandStoreMusicQuery, projectHintLines, rankStoreMusic, scoreStoreMusic, storeMusicTracks } from "@/assetStore/storeMusicPick";
import type { StorePackManifest, StoreCatalogPage } from "@/assetStore/format";
import { setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { clearStoreMusicCache, listAllStoreMusicPacks, type StoreMusicChoice } from "@/editor/tools/storeTools";
import { mapIdsError } from "@/editor/tools/musicAuthoringTools";
import { isolateTimers } from "./mergedTeardown";

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
