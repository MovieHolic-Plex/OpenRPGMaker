import { afterEach, describe, expect, it } from "vitest";
import { SUPPORTED_LOCALES } from "@/i18n/locale";
import {
  RUNTIME_UI_KEYS,
  RUNTIME_UI_STRINGS,
  resetRuntimeUiLocaleOverride,
  runtimeUiLocale,
  runtimeUiText,
  setRuntimeUiLocaleOverride,
} from "@/player/runtimeUiStrings";
import {
  statusMenuCommandGroupLabel,
  statusMenuCommandLabel,
  statusMenuGroupEntryLabel,
} from "@/player/playerStatusMenuModel";
import {
  defaultTermsForLocale,
  formatBattleCommandPrompt,
  resolveTerms,
} from "@/project/terms";
import { defaultTerms, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import {
  applyLocalizationBundle,
  exportLocalizationCsv,
  extractProjectStrings,
  lookupLocalizedText,
  parseLocalizationCsv,
  translateProjectContent,
} from "@/project/localization";
import type { Project } from "@/project/types";

function extractPlaceholders(template: string): string[] {
  return [...new Set(template.match(/\{\d+\}/g) ?? [])].sort();
}

describe("runtimeUiStrings catalog completeness", () => {
  afterEach(() => {
    resetRuntimeUiLocaleOverride();
  });

  it("fills all 4 locales with matching placeholders for every key", () => {
    for (const key of RUNTIME_UI_KEYS) {
      const row = RUNTIME_UI_STRINGS[key];
      const koPlaceholders = extractPlaceholders(row.ko);
      for (const locale of SUPPORTED_LOCALES) {
        expect(row[locale].trim().length, `${key}.${locale} empty`).toBeGreaterThan(0);
        expect(extractPlaceholders(row[locale]), `${key}.${locale} placeholders`).toEqual(koPlaceholders);
      }
    }
  });

  it("resolves locale priority: override > meta.language > dialogueSystem.language > ko", () => {
    const koFallback = { meta: { title: "t", author: "", terms: {} } };
    expect(runtimeUiLocale(koFallback)).toBe("ko");

    const fromDialogue = { meta: { title: "t", author: "", terms: {}, oprnDialogueSystem: { language: "ja" as const } } };
    expect(runtimeUiLocale(fromDialogue)).toBe("ja");

    const fromMeta = { meta: { title: "t", author: "", terms: {}, language: "en" as const, oprnDialogueSystem: { language: "ja" as const } } };
    expect(runtimeUiLocale(fromMeta)).toBe("en");

    setRuntimeUiLocaleOverride("zh");
    expect(runtimeUiLocale(fromMeta)).toBe("zh");
    expect(runtimeUiText(fromMeta, "title.newGame")).toBe("新游戏");
  });
});

describe("terms & status menu i18n", () => {
  it("provides localized default terms and avoids attaching Korean josa outside ko", () => {
    expect(defaultTermsForLocale("en").attack).toBe("Attack");
    expect(defaultTermsForLocale("ja").battleVictory).toBe("勝利！");
    expect(defaultTermsForLocale("zh").shopBuy).toBe("购买");

    // Non-Korean project with factory Korean defaults inherits localized defaults
    const enProject = { meta: { title: "Quest", author: "", language: "en" as const, terms: defaultTerms() } };
    const resolved = resolveTerms(enProject);
    expect(resolved.attack).toBe("Attack");
    expect(resolved.battleVictory).toBe("Victory!");
    expect(resolved.battleCommandPrompt).toBe("What will {name} do?");

    // Explicit author override is preserved
    const customEnProject = {
      meta: { title: "Quest", author: "", language: "en" as const, terms: { ...defaultTerms(), battleVictory: "TRIUMPH!" } },
    };
    expect(resolveTerms(customEnProject).battleVictory).toBe("TRIUMPH!");

    // Josa handling
    expect(formatBattleCommandPrompt("{name은} 무엇을 할까?", "카엘", false, "ko")).toBe("카엘은 무엇을 할까?");
    expect(formatBattleCommandPrompt("{name은} attacks!", "Kael", false, "en")).toBe("Kael attacks!");
    expect(formatBattleCommandPrompt("What will {name} do?", "Kael", false, "en")).toBe("What will Kael do?");
  });

  it("localizes status menu group/collapsed/command labels by project language", () => {
    const enProject = { meta: { title: "RPG", author: "", language: "en" as const, terms: {} }, system: {} } as unknown as Project;
    expect(statusMenuCommandGroupLabel("action", enProject)).toBe("Actions");
    expect(statusMenuGroupEntryLabel("party-menu", enProject)).toBe("Party ▸");
    expect(statusMenuCommandLabel("items", true, enProject)).toBe("Items");
    expect(statusMenuCommandLabel("wait", true, enProject)).toBe("Wait ON");
    expect(statusMenuCommandLabel("to-title", true, enProject)).toBe("Title");
  });
});

describe("game content localization pipeline", () => {
  const sampleProject = {
    version: 4,
    meta: { title: "별빛의 기사", author: "Author", terms: {} },
    assets: { sprites: {}, uploaded: {} },
    resourceProfiles: [],
    tilesets: {},
    switches: [],
    variables: [],
    commonEvents: [
      {
        id: "ce_1",
        name: "Intro",
        commands: [{ kind: "text", speaker: "내레이터", body: "먼 옛날,\n\"별\"이 떨어졌다." }],
      },
    ],
    database: {
      actors: [{ id: "a1", name: "카엘", nickname: "기사", classId: "c1", initialLevel: 1, maxLevel: 99 }],
      classes: [{ id: "c1", name: "검사" }],
      skills: [{ id: "s1", name: "불꽃 베기", description: "강력한 화염, 일격" }],
      items: [{ id: "i1", name: "회복약", description: "HP를 회복한다." }],
      equipment: [{ id: "e1", name: "철검", description: "단단한 검" }],
      enemies: [{ id: "en1", name: "슬라임" }],
      troops: [],
      states: [{ id: "st1", name: "독" }],
      battleAnimations: [],
    },
    quests: [
      {
        key: "q_star",
        title: "떨어진 별 찾기",
        summary: "숲에서 별 조각을 찾자",
        giver: { mapId: "m1", eventId: "ev1" },
        steps: [{ kind: "reach", mapId: "m1", x: 1, y: 1, label: "숲 입구 도착" }],
        dialogue: { offer: "부탁이 있어." },
      },
    ],
    system: {
      startActorIds: ["a1"],
      titleScreen: { ...defaultTitleScreenSettings(), title: "별빛의 기사", logoSubtitle: "운명의 서막" },
    },
    session: { switches: {}, variables: {}, inventory: {}, partyActorIds: ["a1"] },
    maps: {
      m1: {
        id: "m1",
        name: "시작 마을",
        width: 10,
        height: 10,
        tilesetId: "ts1",
        tileSize: 16,
        lowerTiles: [],
        upperTiles: [],
        events: [
          {
            id: "ev1",
            name: "촌장",
            x: 3,
            y: 3,
            pages: [
              {
                commands: [
                  { kind: "text", speaker: "촌장", body: "어서 오게, 용사여!\n\"여행\"을 떠날 준비가 되었나?" },
                  {
                    kind: "choices",
                    prompt: "어떻게 할까?",
                    options: [
                      { text: "출발한다", branch: [{ kind: "text", body: "잘 다녀오게!" }] },
                      { text: "잠깐 기다린다", branch: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    mapTree: { mapId: "m1", children: [] },
    startMapId: "m1",
    startPos: { x: 1, y: 1 },
    flags: {},
  } as unknown as Project;

  it("extracts deterministic keys, round-trips RFC 4180 CSV with multiline/quotes/commas, and translates without mutating source", () => {
    const entries = extractProjectStrings(sampleProject);
    const keys = entries.map((e) => e.key);
    expect(keys).toContain("meta.title");
    expect(keys).toContain("map.m1.name");
    expect(keys).toContain("db.actor.a1.name");
    expect(keys).toContain("db.skill.s1.description");
    expect(keys).toContain("quest.q_star.title");
    expect(keys).toContain("map.m1.ev.ev1.p0.c0.speaker");
    expect(keys).toContain("map.m1.ev.ev1.p0.c0.body");
    expect(keys).toContain("map.m1.ev.ev1.p0.c1.opt.0");
    expect(keys).toContain("map.m1.ev.ev1.p0.c1.opt0.c0.body");
    expect(keys).toContain("common.ce_1.c0.body");

    const enTranslations: Record<string, string> = {
      "meta.title": "Knight of Starlight",
      "map.m1.name": "Starter Village",
      "db.actor.a1.name": "Kael",
      "db.skill.s1.description": "Fierce flame, single strike",
      "quest.q_star.title": "Find the Fallen Star",
      "map.m1.ev.ev1.p0.c0.speaker": "Elder",
      "map.m1.ev.ev1.p0.c0.body": "Welcome, hero!\nReady for your \"journey\"?",
      "map.m1.ev.ev1.p0.c1.opt.0": "Set out",
      "map.m1.ev.ev1.p0.c1.opt0.c0.body": "Safe travels!",
    };

    const csv = exportLocalizationCsv(entries, enTranslations, "en");
    const parsed = parseLocalizationCsv(csv);
    expect(parsed).toEqual(enTranslations);

    const withBundle = applyLocalizationBundle(sampleProject, "en", parsed);
    expect(lookupLocalizedText(withBundle, "en", "meta.title", "fallback")).toBe("Knight of Starlight");
    expect(lookupLocalizedText(withBundle, "en", "missing.key", "fallback")).toBe("fallback");

    const translated = translateProjectContent(withBundle, "en");
    expect(translated.meta.title).toBe("Knight of Starlight");
    expect(translated.maps["m1"]!.name).toBe("Starter Village");
    expect(translated.database.actors[0]!.name).toBe("Kael");
    expect(translated.database.skills[0]!.description).toBe("Fierce flame, single strike");
    expect(translated.quests![0]!.title).toBe("Find the Fallen Star");
    const cmd0 = translated.maps["m1"]!.events[0]!.pages![0]!.commands[0]!;
    expect(cmd0.kind === "text" && cmd0.speaker).toBe("Elder");
    expect(cmd0.kind === "text" && cmd0.body).toBe("Welcome, hero!\nReady for your \"journey\"?");
    const cmd1 = translated.maps["m1"]!.events[0]!.pages![0]!.commands[1]!;
    expect(cmd1.kind === "choices" && cmd1.options[0]!.text).toBe("Set out");
    expect(cmd1.kind === "choices" && cmd1.options[0]!.branch[0]!.kind === "text" && cmd1.options[0]!.branch[0]!.body).toBe("Safe travels!");

    // Original project was not mutated
    expect(sampleProject.meta.title).toBe("별빛의 기사");
    expect(sampleProject.maps["m1"]!.name).toBe("시작 마을");
  });
});
