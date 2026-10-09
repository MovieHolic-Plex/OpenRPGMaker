// test/aiAudioPromptBias.test.ts
// AI 이벤트 명령 프롬프트가 음악·효과음을 카탈로그 머리 40개로 자르는 편향을 지킨다.
// 검증 집합은 프롬프트 절단과 달리 카탈로그 전 id 를 받아야 한다.
import { describe, expect, it } from "vitest";
import { buildEventAssistPrompt, parseAndValidate } from "@/ai/eventCommandAssist";
import {
  eventResourceIdSet,
} from "@/ai/eventResourceCatalog";
import { BGM_CATALOG, findBgmTrack } from "@/assets/bgmCatalog";
import { SE_CATALOG } from "@/assets/seCatalog";
import { createBlankProject } from "@/project/defaults";
import { parseAudioPrompt } from "./support/audioPrompt";

const MAX_REF_ENTRIES = 40;

const FUNCTIONAL_SE_IDS = [
  "cc0-se-osx-wooded-box-open",
  "cc0-se-orp-inventory-coin",
  "cc0-se-kjg-8-bit-jingles-jingles-nes09",
  "cc0-se-kra-dooropen-1",
  "cc0-se-kra-doorclose-1",
  "cc0-se-kis-footstep-wood-000",
] as const;

const BGM_PROMPT_SCENES = ["village", "field", "forest", "dungeon", "night", "battle", "title"] as const;
type BgmPromptScene = (typeof BGM_PROMPT_SCENES)[number];

/** Phase 1 THEME_RULES.categoryNeedles. cave → dungeon. title 은 프롬프트 전용. */
const BGM_PROMPT_SCENE_RULES: readonly { scene: BgmPromptScene; needles: readonly string[] }[] = [
  { scene: "title", needles: ["타이틀", "메뉴"] },
  { scene: "battle", needles: ["전투", "보스"] },
  { scene: "night", needles: ["야간 · 휴식", "밤"] },
  { scene: "dungeon", needles: ["던전", "유적", "동굴", "광산", "광물"] },
  {
    scene: "village",
    needles: ["마을", "광장", "길드", "회관", "시장 · 아침 생활", "축제", "과수원", "어촌", "찻집", "공원", "양봉"],
  },
  { scene: "forest", needles: ["숲 · 탐험", "잎다리", "소나무", "양치식물", "사과꽃"] },
  { scene: "field", needles: ["필드", "초원", "장거리"] },
];

function bgmPromptScene(category: string): BgmPromptScene | null {
  for (const rule of BGM_PROMPT_SCENE_RULES) {
    if (rule.needles.some((needle) => category.includes(needle))) return rule.scene;
  }
  return null;
}

function maxCategoryShare(ids: readonly string[], categoryOf: (id: string) => string | undefined): number {
  const counts = new Map<string, number>();
  for (const id of ids) {
    const category = categoryOf(id);
    if (!category) continue;
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values()) / ids.length;
}

function refSectionIds(prompt: string, slot: "music" | "sound"): string[] {
  return parseAudioPrompt(prompt, slot).entries.map(entry => entry.id);
}

describe("AI 프롬프트 오디오 절단 편향", () => {
  it("블랭크 프로젝트의 음악 40개는 7개 장면 축을 덮고, 효과음 40개는 상자/동전/문/징글/발소리를 포함하며 한 분류가 과반이 아니다", () => {
    const project = createBlankProject();
    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
    const musicIds = refSectionIds(prompt, "music");
    const soundIds = refSectionIds(prompt, "sound");

    expect(musicIds).toHaveLength(MAX_REF_ENTRIES);
    expect(soundIds).toHaveLength(MAX_REF_ENTRIES);

    const musicScenes = new Set(
      musicIds.flatMap((id) => {
        const category = findBgmTrack(id)?.category;
        const scene = category ? bgmPromptScene(category) : null;
        return scene ? [scene] : [];
      }),
    );
    expect([...musicScenes].sort()).toEqual([...BGM_PROMPT_SCENES].sort());
    for (const scene of ["village", "forest", "dungeon", "night", "battle"] as const) {
      expect(musicScenes.has(scene), scene).toBe(true);
    }
    expect(
      musicIds.some((id) => findBgmTrack(id)?.category.includes("소나무") === true),
      "pine-road(소나무) 가 숲 축으로 머리에 있어야 한다",
    ).toBe(true);
    expect(musicIds).not.toEqual(BGM_CATALOG.slice(0, MAX_REF_ENTRIES).map((track) => track.id));
    expect(maxCategoryShare(musicIds, (id) => findBgmTrack(id)?.category)).toBeLessThanOrEqual(0.5);

    const soundSet = new Set(soundIds);
    for (const id of FUNCTIONAL_SE_IDS) {
      expect(soundSet.has(id), id).toBe(true);
    }
    const uiOnly = soundIds.every((id) => {
      const entry = SE_CATALOG.find((item) => item.id === id);
      return entry?.category.startsWith("UI") === true;
    });
    expect(uiOnly).toBe(false);
    expect(maxCategoryShare(soundIds, (id) => SE_CATALOG.find((item) => item.id === id)?.category)).toBeLessThanOrEqual(
      0.5,
    );
  });

  it("검증 집합은 카탈로그 전 id 를 그대로 받는다", () => {
    const project = createBlankProject();
    const musicSet = eventResourceIdSet("music", project);
    const soundSet = eventResourceIdSet("sound", project);

    for (const track of BGM_CATALOG) {
      expect(musicSet.has(track.id), track.id).toBe(true);
    }
    for (const entry of SE_CATALOG) {
      expect(soundSet.has(entry.id), entry.id).toBe(true);
    }

    const prompt = buildEventAssistPrompt({ project, mapId: project.startMapId });
    const shownMusic = new Set(refSectionIds(prompt, "music"));
    const shownSound = new Set(refSectionIds(prompt, "sound"));
    const hiddenMusic = BGM_CATALOG.find((track) => !shownMusic.has(track.id));
    const hiddenSound = SE_CATALOG.find((entry) => !shownSound.has(entry.id));
    expect(hiddenMusic, "프롬프트에 안 실린 BGM 이 있어야 절단이 살아 있다").toBeDefined();
    expect(hiddenSound, "프롬프트에 안 실린 SE 가 있어야 절단이 살아 있다").toBeDefined();

    const musicResult = parseAndValidate(
      project,
      JSON.stringify([{ kind: "playAudio", resourceId: hiddenMusic!.id, loop: true }]),
    );
    const soundResult = parseAndValidate(
      project,
      JSON.stringify([{ kind: "playAudio", resourceId: hiddenSound!.id, loop: false }]),
    );
    if (!musicResult.ok) throw new Error(musicResult.errors.join(" / "));
    if (!soundResult.ok) throw new Error(soundResult.errors.join(" / "));
  });
});
