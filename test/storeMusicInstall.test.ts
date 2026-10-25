// 조수가 스토어 음악을 곡 단위로 찾고(store_find_music), 그 곡만 받아 넣고(store_install assetIds), 자리에 거는(set_game_audio boss) 길.
// 워커 안의 스토어는 가짜 읽기 길(setWorkerStoreAccess)로 바꾼다 — 실제 스테이징 시험은 openwiki/asset-store.md 「조수가 스토어 음악을 넣는다」.
import { afterEach, describe, expect, it } from "vitest";
import { mentionsStore, setWorkerStoreAccess, type StoreReadAccess } from "@/assetStore/storeAccess";
import { rankStoreMusic, storeMusicTracks, subsetMusicManifest } from "@/assetStore/storeMusicPick";
import { storeProjectId, type StorePackManifest } from "@/assetStore/format";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { isStoreCardRequest } from "@/editor/tools/storeTools";
import { gameContentProblems } from "@/ai/v2/gameChecks";
import type { Project } from "@/project/types";

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
    expect(refused.summary).toMatch(/묻지 않고/);
    const asked = await runToolAsync({ project: createEmptyToolProject() }, "store_install", { slug: SLUG, assetIds: ["boss"], userAsked: true }, { dryRun: true });
    expect(asked.ok, asked.summary).toBe(true);
  });

  it("does not let the model claim userAsked when the user's request never mentioned the store", async () => {
    expect(mentionsStore("조선풍 게임 음악 전부 맞춰줘")).toBe(false);
    expect(mentionsStore("스토어에서 보스곡 받아 넣어줘")).toBe(true);
    setWorkerStoreAccess(fakeStore(false, [], false));
    const claimed = await runToolAsync({ project: createEmptyToolProject() }, "store_install", { slug: SLUG, assetIds: ["boss"], userAsked: true }, { dryRun: true });
    expect(claimed.ok).toBe(false);
    expect(claimed.summary).toMatch(/묻지 않고/);
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
});

describe("v2 finish check", () => {
  it("does not ask for a playAudio event when the request was met by binding map/system music", () => {
    const before = createEmptyToolProject();
    const after = structuredClone(before);
    after.system.battleBgmResourceId = "store_x__boss";
    expect(gameContentProblems(before, after, "보스전 음악 바꿔줘").join("\n")).not.toMatch(/게임 검사 음악/);
    expect(gameContentProblems(before, structuredClone(before), "보스전 음악 바꿔줘").join("\n")).toMatch(/게임 검사 음악/);
  });
});
