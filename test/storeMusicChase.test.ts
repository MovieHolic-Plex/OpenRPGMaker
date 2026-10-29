// 추격 음악(scene chase · set_game_audio role chase)과 store_find_music 장면 다른 말.
// 2026-10-30 실조수 e2e(/tmp/mfe2): 「아오오니 느낌으로 추격 음악」이 모든 전투에 걸렸고, scene 에 village·maps·미술관을 넣거나 빼서 한 번씩 헛돌았다.
import { afterEach, describe, expect, it } from "vitest";
import { setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { inferStoreMusicScene, normalizeStoreMusicScene, rankStoreMusic, scoreStoreMusic, storeMusicTracks } from "@/assetStore/storeMusicPick";
import { readStoreMusicMeta, STORE_MUSIC_SCENES } from "@/assets/storeMusicMeta";
import type { StorePackManifest } from "@/assetStore/format";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import { createBlankProject } from "@/project/defaults";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import type { Project } from "@/project/types";

const sha = (n: number): string => n.toString(16).padStart(64, "0");
const SLUG = "oprn-bgm-chase-horror-vol-1-abcd1234";
const track = (n: number, id: string, sceneRoles: string[]) => ({
  id, name: id, kind: "music" as const, blob: sha(n), mime: "audio/ogg" as const,
  meta: { oprnMusic: { genre: "chase-horror", genreKo: "추격 호러", sceneRoles, mood: ["긴박한"], loopable: true, lengthSec: 60, summaryKo: id } },
});
const MANIFEST = {
  schema: "oprn-store-pack/1", title: "OPRN BGM — Chase Horror", summary: "s", description: "d", tags: ["bgm"], kind: "music",
  license: "OPRN-GAME", aiGenerated: true, credits: "Music: OPRN BGM (AI-generated)", previews: [],
  content: { tilesets: {}, assets: {
    battle: track(1, "battle", ["battle"]), tense: track(2, "tense", ["tense"]), chase: track(3, "chase", ["chase"]),
    hall: track(4, "hall", ["town"]), cave: track(5, "cave", ["dungeon"]), field: track(6, "field", ["field"]),
  } },
  blobs: [1, 2, 3, 4, 5, 6].map((n) => ({ sha256: sha(n), mime: "audio/ogg", bytes: 10 })),
} as unknown as StorePackManifest;
const TRACKS = storeMusicTracks({ slug: SLUG, latestVersion: 1, title: MANIFEST.title }, MANIFEST);

function fakeStore(): StoreReadAccess {
  const item = { slug: SLUG, title: MANIFEST.title, summary: "", kind: "music", grade: "single", license: "OPRN-GAME", aiGenerated: true, author: "OPRN 운영", tags: [], latestVersion: 1, cover: null, downloads: 0, updatedAt: "" };
  return {
    url: "http://store.test", autoInstall: true, userMentionedStore: true,
    catalog: async () => ({ items: [item] as never, total: 1, page: 1, pageSize: 24 }),
    item: async () => ({ ...item }) as never,
    manifest: async () => MANIFEST,
    blob: async () => new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
  };
}
afterEach(() => setWorkerStoreAccess(null));

describe("store music scene words", () => {
  it("keeps the scene id exactly `chase` and reads it from pack meta", () => {
    expect(STORE_MUSIC_SCENES).toContain("chase");
    expect(readStoreMusicMeta({ oprnMusic: { sceneRoles: ["chase"] } })?.scenes).toEqual(["chase"]);
  });

  it("normalises the words the model actually sent", () => {
    expect(normalizeStoreMusicScene("village")).toBe("town");
    expect(normalizeStoreMusicScene("City")).toBe("town");
    expect(normalizeStoreMusicScene("마을")).toBe("town");
    expect(normalizeStoreMusicScene("미술관")).toBe("town");
    expect(normalizeStoreMusicScene("maps")).toBe("field");
    expect(normalizeStoreMusicScene("필드")).toBe("field");
    expect(normalizeStoreMusicScene("던전")).toBe("dungeon");
    expect(normalizeStoreMusicScene("동굴")).toBe("dungeon");
    expect(normalizeStoreMusicScene("추격")).toBe("chase");
    expect(normalizeStoreMusicScene("보스")).toBe("boss");
    expect(normalizeStoreMusicScene("credits")).toBe("ending");
    expect(normalizeStoreMusicScene("tense")).toBe("tense");
    expect(normalizeStoreMusicScene("nonsense")).toBeNull();
    expect(normalizeStoreMusicScene(undefined)).toBeNull();
  });

  it("reads a missing scene from the request words (chase before tense, boss before battle)", () => {
    expect(inferStoreMusicScene(undefined, "아오오니 느낌으로 추격 음악")).toBe("chase");
    expect(inferStoreMusicScene(undefined, "쫓아올 때 무서운 곡")).toBe("chase");
    expect(inferStoreMusicScene(undefined, "보스 전투곡")).toBe("boss");
    expect(inferStoreMusicScene(undefined, "옛날 슈패 RPG 같은 16비트 필드")).toBe("field");
    expect(inferStoreMusicScene(undefined, "테일즈런너처럼 신나는 거 마을에 깔아 줘")).toBe("town");
    expect(inferStoreMusicScene(undefined, "좋은 곡")).toBeNull();
  });
});

describe("chase scoring", () => {
  it("puts chase tracks first, tense tracks next, and never battle tracks", () => {
    expect(rankStoreMusic(TRACKS, { scene: "chase", query: "아오오니 느낌" }).map((t) => t.assetId)).toEqual(["chase", "tense"]);
    expect(scoreStoreMusic(TRACKS.find((t) => t.assetId === "battle")!, { scene: "chase" })).toBe(-1);
    expect(rankStoreMusic(TRACKS, { scene: "tense" })[0]?.assetId).toBe("tense");
  });
});

describe("store_find_music scene arguments", () => {
  const find = async (args: Record<string, unknown>) => {
    setWorkerStoreAccess(fakeStore());
    const result = await runToolAsync({ project: createEmptyToolProject() }, "store_find_music", args, { dryRun: true });
    expect(result.ok, result.summary).toBe(true);
    return result as { summary: string; data: { scene: string | null; tracks: { assetId: string }[] } };
  };

  it("accepts synonyms instead of rejecting them", async () => {
    expect((await find({ scene: "village", query: "추격 호러" })).data).toMatchObject({ scene: "town", tracks: [{ assetId: "hall" }] });
    expect((await find({ scene: "maps", query: "추격 호러" })).data.scene).toBe("field");
    expect((await find({ scene: "미술관", query: "추격 호러" })).data.scene).toBe("town");
  });

  it("reads a missing scene from the query and says so", async () => {
    const result = await find({ query: "아오오니 느낌으로 추격 음악" });
    expect(result.data.scene).toBe("chase");
    expect(result.data.tracks[0]?.assetId).toBe("chase");
    expect(result.summary).toMatch(/→ chase/u);
  });
});

describe("set_game_audio role chase", () => {
  const music = (project: Project) => listAudioResources("music", project)[0]!.id;
  const chaseProject = () => {
    const ctx = { project: createBlankProject() };
    const must = (name: string, args: Record<string, unknown>) => {
      const result = runTool(ctx, name, args, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      return result;
    };
    must("create_map", { id: "map_cellar", name: "지하실", width: 20, height: 15 });
    must("upsert_event", { mapId: "map_cellar", event: { id: "ev_safe", name: "금고", x: 15, y: 10, commands: [{ kind: "setSwitch", switchId: "sw_chase_on", value: true }] } });
    must("upsert_event", { mapId: "map_cellar", event: { id: "ev_calm", name: "진정", x: 16, y: 10, commands: [{ kind: "setSwitch", switchId: "sw_chase_on", value: false }] } });
    must("make_chase_scene", { mapId: "map_cellar", id: "ev_chaser", chaser: { at: { x: 3, y: 3 }, speed: 4 }, activateSwitch: "sw_chase_on", killOnTouch: true, hidingSpots: [], patrol: { mode: "auto" } });
    return { ctx, must };
  };
  const commandsOf = (project: Project, eventId: string) => project.maps.map_cellar!.events.find((e) => e.id === eventId)!.pages!.flatMap((page) => page.commands);

  it("refuses when there is no chaser instead of creating one", () => {
    const project = createBlankProject();
    const result = runTool({ project }, "set_game_audio", { role: "chase", resourceId: music(project) }, { dryRun: false });
    expect(result.ok).toBe(false);
    expect(result.summary).toMatch(/추격자가 없습니다/u);
  });

  it("switches the music where the chase switch turns on, restores it where it turns off, and leaves battle music alone", () => {
    const { ctx, must } = chaseProject();
    const id = music(ctx.project);
    const battle = ctx.project.system.battleBgmResourceId;
    // bgmResourceId 는 resourceId 의 다른 이름으로 받는다.
    must("set_game_audio", { role: "chase", bgmResourceId: id, mapIds: ["map_cellar"] });
    must("set_game_audio", { role: "chase", resourceId: id }); // 두 번 걸어도 겹치지 않는다
    expect(commandsOf(ctx.project, "ev_safe")).toEqual([
      { kind: "m2Command", commandId: "m2-063-memorize-current-bgm", fields: {} },
      { kind: "playAudio", resourceId: id, loop: true, channel: "bgm" },
      { kind: "setSwitch", switchId: "sw_chase_on", value: true },
    ]);
    expect(commandsOf(ctx.project, "ev_calm")).toEqual([
      { kind: "setSwitch", switchId: "sw_chase_on", value: false },
      { kind: "m2Command", commandId: "m2-064-play-memorized-bgm", fields: {} },
    ]);
    expect(ctx.project.system.battleBgmResourceId).toBe(battle);
    // 추격자의 순찰 경로(이동 명령)에는 곡 명령이 들어가지 않는다.
    expect(JSON.stringify(ctx.project.maps.map_cellar!.events.find((e) => e.id === "ev_chaser")!.pages![0]!.movement)).not.toMatch(/playAudio|m2-06/u);
  });

  it("makes an always-present chaser's map music the chase track", () => {
    const { ctx, must } = chaseProject();
    must("make_chase_scene", { mapId: "map_cellar", id: "ev_ghost", chaser: { at: { x: 6, y: 6 }, speed: 4 }, killOnTouch: true, hidingSpots: [] });
    const id = music(ctx.project);
    const result = must("set_game_audio", { role: "chase", resourceId: id });
    expect((result.data as { chasers: { eventId: string; via: string }[] }).chasers).toEqual(expect.arrayContaining([
      { mapId: "map_cellar", eventId: "ev_chaser", via: "switch" }, { mapId: "map_cellar", eventId: "ev_ghost", via: "map-bgm" },
    ]));
    expect(ctx.project.maps.map_cellar!.bgm).toEqual({ mode: "custom", resourceId: id });
  });

  it("flags chase music wired to every battle", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    after.system.battleBgmResourceId = "store_chase";
    expect(gameContentProblems(before, after, "아오오니 느낌으로 추격 음악 넣어줘").join("\n")).toMatch(/role:'chase'/u);
  });
});
