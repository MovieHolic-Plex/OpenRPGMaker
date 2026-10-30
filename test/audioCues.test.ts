// 환경음(BGS)·새 효과음 자리·징글 채널(2026-10-31 audio-cues).
// 계약: oprnSound group ambient + loopable 은 자리 없이 읽고 store_find_sound{ambient} 로만 고른다. 맵 bgs 는 없으면 앞 환경음 유지.
// 새 자리(textBlip·emote-*·footstep-metal…·jump·land·questComplete·partyJoin·innRest·chapterStart)는 비어 있으면 무음 — 옛 게임 그대로.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readStoreSoundMeta, storeSoundTags } from "@/assets/storeSoundMeta";
import { planSoundStyle, rankStoreAmbience, rankStoreSounds, type StoreSoundTrack } from "@/assetStore/storeSoundPick";
import { footstepCueForTerrain, isKnownSeCue, projectSeCue, seCueChannel, seCueFallbacks } from "@/project/seCues";
import { resolveMapBgs } from "@/project/mapMusic";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

const played: { resourceId: string; channel?: string; loop: boolean; volume?: number }[] = [];
const stopped: string[] = [];
vi.mock("@/player/audio", () => ({
  playAudioCommand: (step: { resourceId: string; channel?: string; loop: boolean; volume?: number }) => { played.push(step); },
  stopAudioChannel: (channel: string) => { stopped.push(channel); },
}));

const ambientMeta = (tags: string[], extra: Record<string, unknown> = {}) => ({
  oprnSound: { version: 1, slots: [], group: "ambient", loopable: true, ambientTags: tags, mood: ["calm"], feelTags: [], summaryKo: tags.join(" "), durationSec: 40, ...extra },
});
const track = (assetId: string, meta: unknown): StoreSoundTrack => ({
  slug: "pack", version: 1, assetId, name: assetId, packTitle: "p", blob: "b", license: "OPRN-GAME", aiGenerated: false, credits: "", sound: readStoreSoundMeta(meta)!,
});

beforeEach(() => { played.length = 0; stopped.length = 0; });

describe("환경음 meta", () => {
  it("group ambient + loopable 은 자리 없이 읽고, 장소 낱말을 태그로 싣는다", () => {
    const meta = readStoreSoundMeta(ambientMeta(["비", "rain", "weather"]))!;
    expect(meta.ambient).toBe(true);
    expect(meta.slots).toEqual([]);
    expect(storeSoundTags(meta)).toEqual(expect.arrayContaining(["비", "rain", "bgs", "환경음"]));
  });

  it("loopable 이 아니거나 group 이 다르면 예전처럼 null", () => {
    expect(readStoreSoundMeta(ambientMeta(["rain"], { loopable: false }))).toBeNull();
    expect(readStoreSoundMeta({ oprnSound: { version: 1, slots: [], group: "field", loopable: true } })).toBeNull();
  });

  it("환경음은 자리 순위·화풍 통째 걸기에 끼지 않고, 환경음 순위는 장소 낱말을 따른다", () => {
    const rain = track("rain", ambientMeta(["비", "rain"]));
    const cave = track("cave", ambientMeta(["동굴", "cave", "drip"]));
    const hit = track("hit", { oprnSound: { version: 1, slots: ["damage"], group: "battle", style: "retro", variant: "a" } });
    expect(rankStoreSounds([rain, cave, hit], { cue: "damage" }).map((t) => t.assetId)).toEqual(["hit"]);
    expect(planSoundStyle([rain, cave, hit], "retro").rows.map((r) => r.assetId)).toEqual(["hit"]);
    expect(rankStoreAmbience([rain, cave, hit], { query: "동굴 물방울" }).map((t) => t.assetId)).toEqual(["cave"]);
    expect(rankStoreAmbience([rain, cave, hit], { query: "rain" })[0]!.assetId).toBe("rain");
  });
});

describe("이벤트 소리", () => {
  it("시스템 자리 없이 묶음과 자기 이름만 있는 소리는 이벤트 소리로 읽고, 자리 고르기·화풍 걸기에는 끼지 않는다", () => {
    const meta = readStoreSoundMeta({ oprnSound: { version: 1, slots: ["cry-small"], group: "field", style: "retro", variant: "a", mood: ["cute"], feelTags: ["creature"] } })!;
    expect(meta.event).toBe(true);
    expect(meta.slots).toEqual([]);
    expect(meta.extraSlots).toEqual(["cry-small"]);
    expect(readStoreSoundMeta({ oprnSound: { version: 1, slots: ["cry-small"] } })).toBeNull();
    const cry = track("cry", { oprnSound: { version: 1, slots: ["cry-small"], group: "field", style: "retro", variant: "a" } });
    const hit = track("hit", { oprnSound: { version: 1, slots: ["damage"], group: "battle", style: "retro", variant: "a" } });
    expect(rankStoreSounds([cry, hit], { cue: "damage" }).map((t) => t.assetId)).toEqual(["hit"]);
    expect(rankStoreSounds([cry, hit], { query: "cry-small" })[0]!.assetId).toBe("cry");
    expect(planSoundStyle([cry, hit], "retro").rows.map((r) => r.assetId)).toEqual(["hit"]);
  });
});

describe("새 자리", () => {
  it("대사·감정·몸 동작·징글 자리가 알려진 자리다", () => {
    for (const id of ["textBlip", "emote-exclamation", "emote-heart", "footstep-metal", "footstep-ice", "jump", "land", "explosion", "teleport", "notify", "questComplete", "partyJoin", "innRest", "chapterStart"]) {
      expect(isKnownSeCue(id)).toBe(true);
    }
  });

  it("징글 자리는 ME 채널, levelUp 과 나머지는 효과음 채널", () => {
    expect(seCueChannel("questComplete")).toBe("me");
    expect(seCueChannel("innRest")).toBe("me");
    expect(seCueChannel("levelUp")).toBe("se");
    expect(seCueChannel("textBlip")).toBe("se");
  });

  it("새 발소리 표면은 비어 있으면 옛 표면으로 물러선다 — 옛 얼음·늪 지형 소리 유지", () => {
    expect(footstepCueForTerrain("얼음 바닥")).toBe("footstep-ice");
    expect(footstepCueForTerrain("늪")).toBe("footstep-mud");
    expect(footstepCueForTerrain("철판 통로")).toBe("footstep-metal");
    expect(footstepCueForTerrain("눈 덮인 길")).toBe("footstep-snow");
    expect(seCueFallbacks("footstep-ice")).toEqual(["footstep-ice", "footstep-snow"]);
    const project = createBlankProject();
    project.system.seCues = { "footstep-snow": "snd_snow", "footstep-water": "snd_water" };
    expect(projectSeCue(project, "footstep-ice")).toBe("snd_snow");
    expect(projectSeCue(project, "footstep-mud")).toBe("snd_water");
  });
});

describe("맵 환경음", () => {
  it("설정 없음 = 유지, none = 끔, custom = 그 루프", () => {
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    expect(resolveMapBgs(project, mapId)).toEqual({ kind: "keep" });
    project.maps[mapId]!.bgs = { mode: "none" };
    expect(resolveMapBgs(project, mapId)).toEqual({ kind: "silence" });
    project.maps[mapId]!.bgs = { mode: "custom", resourceId: "snd_rain", volume: 140 };
    expect(resolveMapBgs(project, mapId)).toEqual({ kind: "play", resourceId: "snd_rain", volume: 100 });
  });

  it("startMapBgs: 유지 맵은 손대지 않고, 지정 맵은 bgs 채널 루프로 세션에 싣고, 끔 맵은 멈춘다", async () => {
    const { startMapBgs } = await import("@/player/mapBgm");
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    const session = { audio: { bgs: { resourceId: "snd_old", loop: true } } } as { audio: { bgs?: { resourceId: string; loop: boolean } } };
    startMapBgs(project, session, mapId);
    expect(session.audio.bgs?.resourceId).toBe("snd_old");
    expect(played).toEqual([]);
    project.maps[mapId]!.bgs = { mode: "custom", resourceId: "snd_rain" };
    startMapBgs(project, session, mapId);
    expect(session.audio.bgs).toEqual({ resourceId: "snd_rain", loop: true });
    expect(played).toEqual([{ resourceId: "snd_rain", loop: true, channel: "bgs" }]);
    project.maps[mapId]!.bgs = { mode: "none" };
    startMapBgs(project, session, mapId);
    expect(session.audio.bgs).toBeUndefined();
    expect(stopped).toEqual(["bgs"]);
  });
});

describe("대사 글자음", () => {
  it("textBlip 자리가 비면 플레이어가 없다(옛 게임 무음), 걸리면 소리 내는 글자 둘에 하나·간격 안 한 번", async () => {
    const { createTextBlipVoice, TEXT_BLIP_MIN_GAP_MS } = await import("@/player/textBlipVoice");
    const project = createBlankProject();
    expect(createTextBlipVoice(project)).toBeNull();
    project.system.seCues = { textBlip: "snd_blip" };
    let now = 0;
    const voice = createTextBlipVoice(project, () => now)!;
    voice.speak("안"); now += 1; voice.speak("녕"); now += TEXT_BLIP_MIN_GAP_MS; voice.speak(" "); voice.speak("하");
    now += 1; voice.speak("세"); now += TEXT_BLIP_MIN_GAP_MS; voice.speak("요");
    expect(played.map((p) => p.resourceId)).toEqual(["snd_blip", "snd_blip"]);
    expect(played.every((p) => p.channel === "se" && !p.loop)).toBe(true);
  });
});

describe("set_game_audio role:bgs", () => {
  it("mapIds 없이 시작 맵에 환경음을 걸고, resourceId 를 비우면 끈다 — BGM 은 그대로, 음악은 거절", () => {
    const ctx = { project: createEmptyToolProject() };
    ctx.project.assets.uploaded.snd_rain = { id: "snd_rain", name: "비 루프", kind: "sound", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: ambientMeta(["rain"]) };
    ctx.project.assets.uploaded.bgm_town = { id: "bgm_town", name: "마을", kind: "music", dataUrl: "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=", meta: {} };
    expect(runTool(ctx, "create_map", { id: "m1", name: "마을", width: 8, height: 8 }, { dryRun: false }).ok).toBe(true);
    ctx.project.startMapId = "m1";
    const bgmBefore = structuredClone(ctx.project.maps.m1!.bgm);
    const on = runTool(ctx, "set_game_audio", { role: "bgs", resourceId: "snd_rain" }, { dryRun: false });
    expect(on.ok, on.summary).toBe(true);
    expect(ctx.project.maps.m1!.bgs).toEqual({ mode: "custom", resourceId: "snd_rain" });
    expect(ctx.project.maps.m1!.bgm).toEqual(bgmBefore);
    expect(runTool(ctx, "set_game_audio", { role: "bgs", resourceId: "bgm_town", mapIds: ["m1"] }, { dryRun: false }).ok).toBe(false);
    expect(runTool(ctx, "set_game_audio", { role: "bgs", mapIds: ["m1"] }, { dryRun: false }).ok).toBe(true);
    expect(ctx.project.maps.m1!.bgs).toEqual({ mode: "none" });
  });
});
