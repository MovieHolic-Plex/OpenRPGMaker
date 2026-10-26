import { describe, expect, it } from "vitest";
import { MAP_SHIFT_NOTE } from "@/editor/panels/mapShiftCopy";
import { matchSupportedLocale, resolveLocale } from "@/i18n/locale";
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

  it("translate the View menu and its language group", () => {
    expect(createTranslator(en).translate("보기")).toBe("View");
    expect(createTranslator(ja).translate("언어")).toBeTruthy();
    expect(createTranslator(zh).translate("언어")).toBeTruthy();
  });

  it("translates map-content shift separately from view pan and map scroll", () => {
    // 「맵 밀기」는 타일·이벤트·시작 위치를 칸 단위로 옮긴다. 화면 밀기(pan)나 맵 스크롤 명령이 아니다.
    const note = MAP_SHIFT_NOTE;
    expect(en["맵 밀기"]).toBe("Shift map contents");
    expect(ja["맵 밀기"]).toBe("マップ内容をずらす");
    expect(zh["맵 밀기"]).toBe("移动地图内容");
    expect(en["맵 밀기"]).not.toBe(en["맵 화면 이동"]);
    expect(ja["맵 밀기"]).not.toBe(ja["맵 스크롤"]);
    expect(zh["맵 밀기"]).not.toBe(zh["맵 화면 이동"]);
    expect(en["맵 밀기"].toLowerCase()).not.toMatch(/pan|scroll/);
    expect(ja["맵 밀기"]).not.toContain("スクロール");
    expect(createTranslator(en).translate(note)).toBe(en[note]);
    expect(createTranslator(ja).translate(note)).toBe(ja[note]);
    expect(createTranslator(zh).translate(note)).toBe(zh[note]);
    expect(en[note]).toMatch(/tiles/i);
    expect(ja[note]).toContain("マス");
    expect(zh[note]).toContain("图块");
  });

  it("calls the ground layer 地上 in Japanese, not battle or a garbled reading", () => {
    // 바닥과 배틀은 글자가 비슷해 명령 팔레트·레이어 필터·타일 변경 안내가 バトル / バーゾリアル 로 나갔다.
    // 짧은 라벨 「바닥」과 같은 낱말(地上)을 쓴다.
    expect(ja["바닥"]).toBe("地上");
    expect(ja["레이어: 바닥"]).toBe("レイヤー: 地上");
    expect(ja["레이어 필터: 바닥(하위) 타일만"]).toBe("レイヤーフィルター: 地上(下位)タイルのみ");
    expect(ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다."]).toBe("マップ1マスの地上または上部タイルを変更します。");
    expect(ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다. 비우기를 누르면 그 칸을 지웁니다."]).toBe(
      "マップ1マスの地上または上部タイルを変更します。クリアを押すとそのマスを消します。",
    );
    for (const value of [
      ja["레이어: 바닥"],
      ja["레이어 필터: 바닥(하위) 타일만"],
      ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다."],
      ja["맵 한 칸의 바닥이나 상위 타일을 바꿉니다. 비우기를 누르면 그 칸을 지웁니다."],
    ]) {
      expect(value).not.toMatch(/バトル|バーゾリアル/);
    }
    expect(createTranslator(ja).translate("레이어: 바닥")).toBe("レイヤー: 地上");
    expect(createTranslator(ja).translate("맵 한 칸의 바닥이나 상위 타일을 바꿉니다.")).toBe(
      "マップ1マスの地上または上部タイルを変更します。",
    );
  });

  it("calls the lower map layer the ground layer, not a child or subordinate", () => {
    // 타일셋 필터·홈 레이어의 「하위」는 바닥 레이어다. 하위 맵·하위 조건의 자식 뜻과 갈라진다.
    expect(en["하위"]).toBe("Ground");
    expect(ja["하위"]).toBe("地上");
    expect(zh["하위"]).toBe("地面");
    expect(en["하위"]).toBe(en["바닥"]);
    expect(ja["하위"]).toBe(ja["바닥"]);
    expect(zh["하위"]).toBe(zh["바닥"]);

    const layerKeys = [
      "하위 + 받침",
      "하위 = 초록 테두리",
      "하위 고정",
      "하위 레이어",
      "하위 레이어 타일 — 하위 레이어 편집으로 전환",
      "하위 레이어 타일만 강조",
      "하위 레이어에서 자유롭게 칠하면 가장자리와 중앙이 자동으로 이어지는 물 지형입니다.",
      "하위 레이어에서 자유롭게 칠하면 모서리, 변, 중앙이 자동으로 이어지는 길 지형입니다.",
      "하위·상위 전부 표시",
      "투명 하위 유지",
      "투명 하위(받침 없음)",
      "이 타일의 홈 레이어를 하위로 확정",
      "받침 있는 하위",
      "하위만",
    ] as const;
    for (const key of layerKeys) {
      expect(en[key], key).not.toMatch(/\bsub\b/i);
      expect(en[key], key).toMatch(/ground/i);
      expect(ja[key], key).not.toMatch(/下位|子/);
      expect(ja[key], key).toContain("地上");
      expect(zh[key], key).not.toMatch(/子级|子图/);
      expect(zh[key], key).toContain("地面");
    }

    expect(createTranslator(en).translate("하위 레이어 타일만 강조")).toBe("Highlight ground-layer tiles only");
    expect(createTranslator(ja).translate("하위·상위 전부 표시")).toBe("地上・上位をともに表示");
    expect(createTranslator(zh).translate("하위 고정")).toBe("固定地面");

    // 같은 낱말이 자식·하위를 뜻하는 곳은 그대로다.
    expect(en["하위 {0}"]).toBe("{0} sub");
    expect(ja["하위 {0}"]).toBe("下位 {0}");
    expect(zh["하위 {0}"]).toBe("子级 {0}");
    expect(en["하위 맵"]).toBe("Sub-map");
    expect(ja["하위 맵"]).toBe("サブマップ");
    expect(zh["하위 맵"]).toBe("子地图");
    expect(en["하위 조건"]).toBe("Sub-conditions");
    expect(createTranslator(en).translate("하위 3")).toBe("3 sub");
  });
});
