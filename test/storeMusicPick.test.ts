// 스토어 음악 팩 곡의 고르기 설명(meta.oprnMusic) → 오디오 목록 태그·설명 → recommend_bgm 장면·분위기 고르기.
import { describe, expect, it } from "vitest";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { readStoreMusicMeta } from "@/assets/storeMusicMeta";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import type { Project } from "@/project/types";

const OGG = "data:audio/ogg;base64,T2dnUwACAAAAAAAAAAA=";

function storeTrack(id: string, name: string, oprnMusic: Record<string, unknown>) {
  return { id, name, kind: "music" as const, dataUrl: OGG, meta: { oprnMusic } as Project["assets"]["uploaded"][string]["meta"] };
}

function projectWithPack(): Project {
  const project = createEmptyToolProject();
  const joseon = { genreLine: "joseon", genreLabel: "조선 전통", tempo: "fast", loopable: true, lengthSec: 72, bpm: 150, energy: 5 };
  project.assets.uploaded.jb = storeTrack("jb", "Tiger Pass Duel", { ...joseon, sceneRoles: ["boss"], mood: ["비장한", "격렬한"], summaryKo: "장구와 해금이 몰아치는 조선풍 보스전." });
  project.assets.uploaded.jt = storeTrack("jt", "Hanok Morning", { ...joseon, sceneRoles: ["town"], mood: ["평화로운", "그리운"], tempo: "medium", energy: 2, summaryKo: "대금이 이끄는 한가로운 조선 마을." });
  project.assets.uploaded.jv = storeTrack("jv", "Drum Roll Cheer", { ...joseon, sceneRoles: ["victory"], mood: ["승리의"], loopable: false, lengthSec: 6, summaryKo: "짧은 태평소 승리 팡파르." });
  project.assets.uploaded.fb = storeTrack("fb", "Crystal Tyrant", { genreLine: "fantasy", genreLabel: "판타지 JRPG", sceneRoles: ["boss"], mood: ["위협적인"], loopable: true, summaryKo: "16비트 오르간과 금관의 판타지 보스전." });
  return project;
}

type Candidate = { resourceId: string; descriptionSource: string; music?: { scenes: string[]; loopable: boolean; genre: string } };
const pick = (project: Project, args: Record<string, unknown>) => {
  const result = runTool({ project }, "recommend_bgm", args, { dryRun: false });
  expect(result.ok, result.summary).toBe(true);
  return result.data as { candidates: Candidate[]; sceneFallback?: true; guidance: string };
};

describe("store music pick", () => {
  it("reads only well-formed scene roles and ignores tracks without them", () => {
    expect(readStoreMusicMeta({ oprnMusic: { sceneRoles: ["boss", "nope"], mood: ["비장한", 3], loopable: true } })).toMatchObject({ scenes: ["boss"], mood: ["비장한"], loopable: true });
    expect(readStoreMusicMeta({ oprnMusic: { sceneRoles: ["nope"] } })).toBeNull();
    expect(readStoreMusicMeta({})).toBeNull();
  });

  it("lists store tracks with searchable genre, scene and mood tags and a listening description", () => {
    const boss = listAudioResources("music", projectWithPack()).find((entry) => entry.id === "jb")!;
    expect(boss.tags).toEqual(expect.arrayContaining(["조선 전통", "boss", "보스", "비장한", "루프"]));
    expect(boss.description).toContain("장구와 해금");
    expect(boss.description).toContain("150 BPM");
    expect(boss.descriptionSource).toBe("ai-listening");
  });

  it("scene + query ranks inside the scene: a Joseon boss request gets the Joseon boss track first", () => {
    const data = pick(projectWithPack(), { scene: "boss", query: "조선", limit: 5 });
    expect(data.candidates[0]?.resourceId).toBe("jb");
    expect(data.candidates.map((c) => c.resourceId)).not.toContain("jt");
    expect(data.candidates[0]?.music).toMatchObject({ scenes: ["boss"], loopable: true, genre: "조선 전통" });
  });

  it("scene alone matches store tracks by their scene roles, not their names", () => {
    const ids = pick(projectWithPack(), { scene: "village", limit: 20 }).candidates.map((c) => c.resourceId);
    expect(ids).toContain("jt");
    expect(ids).not.toContain("jb");
    expect(pick(projectWithPack(), { scene: "victory", limit: 20 }).candidates.map((c) => c.resourceId)).toContain("jv");
  });

  it("falls back to the query when nothing in the scene matches and says so", () => {
    const data = pick(projectWithPack(), { scene: "ending", query: "조선", limit: 5 });
    expect(data.sceneFallback).toBe(true);
    expect(data.candidates.length).toBeGreaterThan(0);
    expect(data.guidance).toContain("store_search");
  });
});
