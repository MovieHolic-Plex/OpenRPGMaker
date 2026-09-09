/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import {
  PRODUCT_TERMINOLOGY,
  checkProductTerminology,
  generatedProductTerminologyMarkdown,
  terminologyByArea,
  terminologyByAssistantTool,
  terminologyByEnglish,
  terminologyByKey,
  terminologyByKorean,
  terminologyKoreanCollisions,
  terminologyReservedEnglishWords,
} from "@/project/terminology";
import type { ProductTerminology, TerminologyArea, TerminologyEntry } from "@/project/terminology";
import { DEVELOPMENT_ONTOLOGY } from "@/project/ontology";
import { uiLabel } from "@/editor/uiCopy";

const REPO_FILE_PATHS = new Set(
  Object.keys(import.meta.glob(["../src/**/*", "../docs/**/*", "../index.html"], { query: "?raw", import: "default" })).map(
    (path) => path.replace(/^\.\.\//, "")
  )
);

function withEntries(entries: readonly TerminologyEntry[]): ProductTerminology {
  return { ...PRODUCT_TERMINOLOGY, entries };
}

function entry(overrides: Partial<TerminologyEntry> = {}): TerminologyEntry {
  return {
    key: "sample.term",
    ko: "표본",
    en: "sample",
    area: "EditorShell",
    partOfSpeech: "noun",
    surface: "editor",
    sources: ["src/editor/uiCopy.ts"],
    ...overrides,
  };
}

describe("product terminology", () => {
  it("passes its own well-formedness check", () => {
    expect(checkProductTerminology(PRODUCT_TERMINOLOGY)).toEqual([]);
  });

  it("cites only source paths that exist in the repository", () => {
    const cited = [
      ...PRODUCT_TERMINOLOGY.entries.flatMap((term) => term.sources),
      ...PRODUCT_TERMINOLOGY.localeSensitiveSurfaces.flatMap((surface) => surface.sources),
    ];

    expect(cited.filter((path) => !REPO_FILE_PATHS.has(path))).toEqual([]);
  });

  it("agrees with the uiCopy Korean label registry", () => {
    const published = PRODUCT_TERMINOLOGY.entries.flatMap((term) =>
      term.uiCopyKey ? [{ key: term.key, ko: term.ko, labels: [uiLabel(term.uiCopyKey, "plain"), uiLabel(term.uiCopyKey, "technical")] }] : []
    );

    expect(published.filter((term) => !term.labels.includes(term.ko)).map((term) => term.key)).toEqual([]);
    expect(published.length).toBeGreaterThanOrEqual(10);
  });

  it("files shared areas under the same names as the development ontology", () => {
    const capabilityIds = DEVELOPMENT_ONTOLOGY.capabilities.map((capability) => capability.id);
    const terminologyOnly: readonly TerminologyArea[] = ["AssistantStudio", "EditorShell"];
    const areas = [...new Set(PRODUCT_TERMINOLOGY.entries.map((term) => term.area))];

    expect(areas.filter((area) => !capabilityIds.includes(area) && !terminologyOnly.includes(area))).toEqual([]);
    for (const capabilityId of capabilityIds) {
      expect(areas).toContain(capabilityId);
      expect(terminologyByArea(PRODUCT_TERMINOLOGY, capabilityId as TerminologyArea).length).toBeGreaterThan(0);
    }
  });

  it("keeps the concepts that collide in English apart", () => {
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.map")?.rejectedEnAliases).toContain("scene");
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.toolPlaceEvent")?.en).toBe("place event");
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.layerEvent")?.en).toBe("event layer");
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "event.event")?.en).toBe("event");
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "tile.tileset")?.rejectedEnAliases).toEqual(
      expect.arrayContaining(["chipset", "tile palette"])
    );
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "db.element")?.rejectedEnAliases).toContain("property");
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "db.troop")?.rejectedEnAliases).toContain("party");
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "battle.party")?.rejectedEnAliases).toContain("troop");
  });

  it("records who owns a refused English word", () => {
    const reserved = terminologyReservedEnglishWords(PRODUCT_TERMINOLOGY);

    expect(reserved.find((word) => word.word === "party")).toEqual({
      word: "party",
      refusedBy: ["db.troop"],
      ownedBy: "battle.party",
    });
    expect(reserved.find((word) => word.word === "troop")).toEqual({
      word: "troop",
      refusedBy: ["battle.party"],
      ownedBy: "db.troop",
    });
  });

  it("reports the Korean words that carry two concepts", () => {
    const collisions = terminologyKoreanCollisions(PRODUCT_TERMINOLOGY).map((bucket) => bucket.map((term) => term.key));

    expect(collisions).toEqual(expect.arrayContaining([["map.layerEvent", "event.event"], ["battle.turn", "assistant.turn"]]));
  });

  it("resolves a concept from a key, a Korean string, or an English string", () => {
    expect(terminologyByKey(PRODUCT_TERMINOLOGY, "map.layerGround")?.ko).toBe("바닥");
    expect(terminologyByKorean(PRODUCT_TERMINOLOGY, "하위").map((term) => term.key)).toEqual(["map.layerGround"]);
    expect(terminologyByKorean(PRODUCT_TERMINOLOGY, "펜").map((term) => term.key)).toEqual(["map.toolPaint"]);
    expect(terminologyByEnglish(PRODUCT_TERMINOLOGY, "Tileset").map((term) => term.key)).toEqual(["tile.tileset"]);
    expect(terminologyByAssistantTool(PRODUCT_TERMINOLOGY, "place_concept").map((term) => term.key)).toEqual([
      "assistant.taskPlaceFacility",
    ]);
    expect(terminologyByAssistantTool(PRODUCT_TERMINOLOGY, "author_village").map((term) => term.key)).toEqual([
      "assistant.taskBuildVillage",
    ]);
  });

  it("separates locale-sensitive formatting from translatable labels", () => {
    const kinds = PRODUCT_TERMINOLOGY.localeSensitiveSurfaces.map((surface) => surface.kind);

    expect(kinds).toEqual(expect.arrayContaining(["currency", "date", "documentLanguage", "number", "time"]));
    expect(PRODUCT_TERMINOLOGY.localeSensitiveSurfaces.find((surface) => surface.id === "document-language")).toEqual(
      expect.objectContaining({ locale: "ko", sources: ["index.html"] })
    );
    expect(PRODUCT_TERMINOLOGY.entries.map((term) => term.key)).not.toContain("document-language");
  });

  it("protects user-authored project content from a future translation pass", () => {
    const boundary = PRODUCT_TERMINOLOGY.translationBoundary;
    const untranslated = boundary.filter((rule) => !rule.translated).map((rule) => rule.id);

    expect(boundary.filter((rule) => rule.translated).map((rule) => rule.id)).toContain("product-chrome");
    expect(untranslated).toEqual(
      expect.arrayContaining(["authored-in-game-terms", "authored-map-and-event-text", "authored-record-names", "stable-identifiers"])
    );
    expect(boundary.filter((rule) => rule.owner === "author").every((rule) => !rule.translated)).toBe(true);
    // Identifiers are product-owned yet untranslated — the two axes must stay separate.
    expect(boundary.find((rule) => rule.id === "stable-identifiers")).toEqual(
      expect.objectContaining({ owner: "product", translated: false })
    );
  });

  it("refuses a boundary rule that would let a translation pass rewrite authored content", () => {
    const broken: ProductTerminology = {
      ...PRODUCT_TERMINOLOGY,
      translationBoundary: [
        { id: "product-chrome", owner: "product", translated: true, description: "chrome", examples: ["보기"] },
        { id: "authored-names", owner: "author", translated: true, description: "record names", examples: ["스킬 이름"] },
      ],
    };

    expect(checkProductTerminology(broken)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "author-content-marked-translatable" })])
    );
  });

  it("rejects a duplicate key", () => {
    const issues = checkProductTerminology(withEntries([entry(), entry({ ko: "다른", en: "other" })]));

    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: "duplicate-key" })]));
  });

  it("rejects an empty term and a missing source", () => {
    const issues = checkProductTerminology(withEntries([entry({ ko: "  ", sources: [] })]));

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(["empty-term", "missing-source"]));
  });

  it("rejects a shared English term when either side lacks a note", () => {
    const shared = [
      entry({ key: "a.one", ko: "하나", en: "duplicate", note: "explained" }),
      entry({ key: "a.two", ko: "둘", en: "Duplicate" }),
    ];

    const issues = checkProductTerminology(withEntries(shared));

    expect(issues).toEqual([
      expect.objectContaining({ code: "duplicate-english-without-note", message: expect.stringContaining("a.two") }),
    ]);
  });

  it("accepts a shared English term when both sides explain themselves", () => {
    const shared = [
      entry({ key: "a.one", ko: "하나", en: "duplicate", note: "the first one" }),
      entry({ key: "a.two", ko: "둘", en: "duplicate", note: "the second one" }),
    ];

    expect(checkProductTerminology(withEntries(shared))).toEqual([]);
  });

  it("rejects a shared Korean term when either side lacks a note", () => {
    const shared = [entry({ key: "a.one", ko: "같음", en: "first" }), entry({ key: "a.two", ko: "같음", en: "second" })];

    expect(checkProductTerminology(withEntries(shared))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duplicate-korean-without-note" })])
    );
  });

  it("rejects an alias that is another concept's canonical Korean term", () => {
    const shared = [
      entry({ key: "a.one", ko: "장식", en: "decoration" }),
      entry({ key: "a.two", ko: "덧그림", en: "overlay", deprecatedKoAliases: ["장식"] }),
    ];

    expect(checkProductTerminology(withEntries(shared))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "alias-shadows-canonical" })])
    );
  });

  it("rejects a Korean term that disagrees with uiCopy", () => {
    const issues = checkProductTerminology(withEntries([entry({ ko: "데이터 창고", en: "database", uiCopyKey: "database" })]));

    expect(issues).toEqual([
      expect.objectContaining({ code: "ui-copy-disagreement", message: expect.stringContaining("자료집") }),
    ]);
  });

  it("rejects two entries claiming the same uiCopy key", () => {
    const shared = [
      entry({ key: "a.one", ko: "자료집", en: "database", uiCopyKey: "database", note: "first" }),
      entry({ key: "a.two", ko: "데이터베이스", en: "record editor", uiCopyKey: "database" }),
    ];

    expect(checkProductTerminology(withEntries(shared))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "duplicate-ui-copy-key" })])
    );
  });

  it("rejects a malformed key", () => {
    expect(checkProductTerminology(withEntries([entry({ key: "MapEditing/Layer" })]))).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "malformed-key" })])
    );
  });

  it("generates a readable terminology document", () => {
    const markdown = generatedProductTerminologyMarkdown(PRODUCT_TERMINOLOGY);

    expect(markdown).toContain("# Korean-English Product Terminology");
    expect(markdown).toContain("| key | 한국어 | English | role | surface | note |");
    expect(markdown).toContain("`map.layerGround`");
    expect(markdown).toContain("## Korean collisions");
    expect(markdown).toContain("## Reserved and refused English words");
    expect(markdown).toContain("## Locale-sensitive surfaces");
    expect(markdown).toContain("## Translation boundary");
    expect(markdown).toContain("authored-in-game-terms");
  });
});
