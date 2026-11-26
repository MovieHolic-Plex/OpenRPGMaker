import { describe, expect, it } from "vitest";
import { editorIntlLocale, matchSupportedLocale, resolveLocale } from "@/i18n/locale";
import { createTranslator } from "@/i18n/translator";
import en from "@/i18n/catalogs/en.json";
import ja from "@/i18n/catalogs/ja.json";
import zh from "@/i18n/catalogs/zh.json";

describe("resolveLocale", () => {
  it("picks the first supported browser language", () => {
    expect(resolveLocale({ languages: ["ja-JP", "en-US"] })).toBe("ja");
    expect(resolveLocale({ languages: ["fr-FR", "zh-CN"] })).toBe("zh");
    expect(resolveLocale({ languages: ["ko-KR"] })).toBe("ko");
  });

  it("falls back to English for unsupported languages", () => {
    expect(resolveLocale({ languages: ["fr-FR", "de"] })).toBe("en");
    expect(resolveLocale({ languages: [] })).toBe("en");
  });

  it("maps traditional Chinese tags to the Chinese catalog", () => {
    expect(matchSupportedLocale("zh-TW")).toBe("zh");
    expect(matchSupportedLocale("zh_Hant_HK")).toBe("zh");
  });

  it("prefers query over saved choice over browser, and ignores malformed values", () => {
    expect(resolveLocale({ queryLang: "ja", saved: "zh", languages: ["en"] })).toBe("ja");
    expect(resolveLocale({ saved: "zh", languages: ["en"] })).toBe("zh");
    expect(resolveLocale({ saved: "xx", languages: ["ja"] })).toBe("ja");
    expect(resolveLocale({ queryLang: "", saved: "", languages: ["ko"] })).toBe("ko");
  });

  it("keeps automation browsers on Korean unless detection is forced", () => {
    expect(resolveLocale({ languages: ["en-US"], automation: true })).toBe("ko");
    expect(resolveLocale({ languages: ["en-US"], automation: true, forceDetect: true })).toBe("en");
    expect(resolveLocale({ saved: "ja", languages: ["en-US"], automation: true })).toBe("ja");
  });
});

describe("editorIntlLocale", () => {
  const day = new Date(2026, 6, 11, 10, 0, 0);
  const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric", weekday: "short" };

  it("keeps Korean dates on ko-KR and uses the chosen language otherwise", () => {
    expect(editorIntlLocale("ko")).toBe("ko-KR");
    expect(editorIntlLocale("en")).toBe("en");
    expect(editorIntlLocale("ja")).toBe("ja");
    expect(editorIntlLocale("zh")).toBe("zh-CN");
    const ko = day.toLocaleDateString(editorIntlLocale("ko"), options);
    const en = day.toLocaleDateString(editorIntlLocale("en"), options);
    const ja = day.toLocaleDateString(editorIntlLocale("ja"), options);
    const zh = day.toLocaleDateString(editorIntlLocale("zh"), options);
    expect(ko).toBe(day.toLocaleDateString("ko-KR", options));
    expect(ko).toMatch(/2026년/);
    expect(en).toMatch(/July/);
    expect(en).toMatch(/2026/);
    expect(ja).toMatch(/2026年7月11日/);
    expect(zh).toMatch(/2026年7月11日/);
    for (const label of [en, ja, zh]) expect(label).not.toMatch(/[가-힣]/);
  });
});

describe("createTranslator", () => {
  const translator = createTranslator({
    "보기": "View",
    "맵 {0}개": "{0} maps",
    "{0}개": "{0} items",
    "\"{0}\" 와 일치하는 {1} 레코드가 없습니다.": "No {1} records match \"{0}\".",
    "아이템": "Item",
  });

  it("translates exact strings with whitespace folded", () => {
    expect(translator.translate("보기")).toBe("View");
    expect(translator.translate("  보기 \n")).toBe("View");
  });

  it("fills templates, preferring the most specific one and reordering slots", () => {
    expect(translator.translate("맵 12개")).toBe("12 maps");
    expect(translator.translate("7개")).toBe("7 items");
    expect(translator.translate("\"숲\" 와 일치하는 아이템 레코드가 없습니다.")).toBe("No Item records match \"숲\".");
  });

  it("rejects a short template that would leave a mostly-Korean sentence half translated", () => {
    const partial = createTranslator({ "{0} 용어": "{0} terms" });
    expect(partial.translate("타일 팔레트와 맵 트리 · 쉬운 용어")).toBeNull();
    expect(partial.translate("17 용어")).toBe("17 terms");
  });

  it("translates middle-dot joined labels piece by piece and keeps unknown pieces", () => {
    const pieces = createTranslator({ "칠하기": "Paint", "바닥": "Ground" });
    expect(pieces.translate("칠하기 · 바닥")).toBe("Paint · Ground");
    expect(pieces.translate("바닥 · 흙길 중앙")).toBe("Ground · 흙길 중앙");
    expect(pieces.translate("흙길 · 중앙")).toBeNull();
    // 빈 탭 이름처럼 공백 없이 붙인 나열도 조각마다 찾는다.
    expect(pieces.translate("칠하기·바닥")).toBe("Paint·Ground");
    const tooltip = createTranslator({ "칠하기": "Paint", "고른 타일로 칠합니다": "Paints with the chosen tile" });
    expect(tooltip.translate("칠하기 (B) — 고른 타일로 칠합니다")).toBe("Paint (B) — Paints with the chosen tile");
  });

  it("leaves unknown or non-Korean text alone", () => {
    expect(translator.translate("주인공이 마을에 도착했다")).toBeNull();
    expect(translator.translate("Ctrl+K")).toBeNull();
  });
});

describe("shipped catalogs", () => {
  const placeholders = (text: string): string[] => (text.match(/\{\d+\}/g) ?? []).sort();

  it("keep every placeholder of the Korean source", () => {
    for (const catalog of [en, ja, zh] as Record<string, string>[]) {
      const broken = Object.entries(catalog).filter(([source, target]) => placeholders(source).join() !== placeholders(target).join());
      expect(broken).toEqual([]);
    }
  });

  it("never wrap a translation in quotes the Korean source does not have", () => {
    // 2026-09-28: 일괄 생성 한 묶음(「모습 미선택」…「목장 울타리」 등 43개)이 "List" 처럼 따옴표째 들어가 화면에 그대로 보였다.
    for (const catalog of [en, ja, zh] as Record<string, string>[]) {
      const quoted = Object.entries(catalog).filter(([source, target]) => /^".*"$/.test(target) && !/^".*"$/.test(source));
      expect(quoted).toEqual([]);
    }
  });

  it("keeps item and actor picker empty copy translated after the batchim particle", () => {
    const english = createTranslator(en);
    expect(english.translate("아이템이 아직 없습니다.")).toBe("Item not yet available.");
    expect(english.translate("주인공이 아직 없습니다.")).toBe("Actor not yet available.");
    expect(english.translate("스위치가 아직 없습니다.")).toBe("Switch not yet available.");
    expect(english.translate('"없는물건" 과 일치하는 아이템이 없습니다.')).toBe('No Item matches "없는물건".');
    expect(english.translate('"가나" 와 일치하는 스위치가 없습니다.')).toBe('No Switch matches "가나".');
    expect(createTranslator(ja).translate("아이템이 아직 없습니다.")).toBe("アイテム がまだありません。");
    expect(createTranslator(zh).translate("주인공이 아직 없습니다.")).toBe("还没有 角色。");
  });
});
