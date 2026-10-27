import { describe, expect, it } from "vitest";
import { MAP_SHIFT_NOTE } from "@/editor/panels/mapShiftCopy";
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

  it("uses a singular English count for one map event and one door", () => {
    // 맵 트리 메타는 「20×15 · 이벤트 1개 · 문 1개」를 조각으로 번역한다.
    // 한 줄로 붙으면 `{0}×{1} · 이벤트 {2}` 가 개수를 삼켜 "Events 1" 이 된다.
    const translator = createTranslator(en);
    expect(translator.translate("이벤트 1개")).toBe("1 event");
    expect(translator.translate("이벤트 2개")).toBe("2 events");
    expect(translator.translate("이벤트 0개")).toBe("0 events");
    expect(translator.translate("문 1개")).toBe("1 door");
    expect(translator.translate("문 2개")).toBe("2 doors");
    expect(translator.translate("문 0개")).toBe("0 doors");
  });

  it("calls terrain reachability a passability preview, not vehicle traffic or a corridor", () => {
    // 지형 도구의 통행 미리보기는 시작 위치에서 걸어 닿는 땅을 칠한다. 차 흐름(traffic)도, 복도(passage)도 아니다.
    const sentence = "경사로·기물, 지형 설계, 통행 미리보기는 아래 도구에서 고릅니다.";
    expect(en["통행"]).toBe("Passability");
    expect(en["통행 보기"]).toBe("View passability");
    expect(en["통행 미리보기"]).toBe("Passability preview");
    expect(en[sentence]).toBe("Choose ramps/props, terrain design, and passability preview from the tools below.");
    expect(en["통행 미리보기"].toLowerCase()).not.toMatch(/traffic|\bpassage\b/);
    expect(en[sentence].toLowerCase()).not.toMatch(/traffic|\bpassage\b/);
    expect(ja["통행 보기"]).toBe("通行を見る");
    expect(ja["통행 미리보기"]).toBe("通行プレビュー");
    expect(ja[sentence]).toContain("通行");
    expect(zh["통행 보기"]).toBe("查看通行");
    expect(zh["통행 미리보기"]).toBe("通行预览");
    expect(zh[sentence]).toContain("通行");
    expect(createTranslator(en).translate("통행 보기")).toBe("View passability");
    expect(createTranslator(en).translate("통행 미리보기")).toBe("Passability preview");
    expect(createTranslator(en).translate(sentence)).toBe(en[sentence]);
    expect(createTranslator(ja).translate("통행 보기")).toBe("通行を見る");
    expect(createTranslator(zh).translate("통행 미리보기")).toBe("通行预览");
  });

  it("names a map's parent separately from the upper tile layer, and its vertical size as height", () => {
    // 새 맵 칸의 글자가 「상위」·「세로」이면 영어는 Upper layer·Vertical, 일본어는 上位·縦,
    // 중국어는 上层·纵向가 된다. 부모 맵과 칸수에는 그 낱말을 쓰지 않는다.
    expect(en["상위"]).toBe("Upper layer");
    expect(ja["상위"]).toBe("上位");
    expect(zh["상위"]).toBe("上层");
    expect(en["상위 맵"]).toBe("Parent map");
    expect(ja["상위 맵"]).toBe("上位マップ");
    expect(zh["상위 맵"]).toBe("上级地图");
    expect(en["세로"]).toBe("Vertical");
    expect(ja["세로"]).toBe("縦");
    expect(zh["세로"]).toBe("纵向");
    expect(en["높이"]).toBe("Height");
    expect(ja["높이"]).toBe("高さ");
    expect(zh["높이"]).toBe("高度");
    const english = createTranslator(en);
    const japanese = createTranslator(ja);
    const chinese = createTranslator(zh);
    expect(english.translate("상위 맵")).toBe("Parent map");
    expect(english.translate("상위 맵")).not.toBe(english.translate("상위"));
    expect(japanese.translate("상위 맵")).toBe("上位マップ");
    expect(chinese.translate("상위 맵")).toBe("上级地图");
    expect(english.translate("높이")).toBe("Height");
    expect(japanese.translate("높이")).toBe("高さ");
    expect(chinese.translate("높이")).toBe("高度");
    // 기본 선택 값은 「그 맵의 자식으로 둔다」이다. Submaps of 는 목록처럼 읽힌다.
    expect(en["{0}의 하위"]).toBe("Child of {0}");
    expect(english.translate("빈 맵의 하위")).toBe("Child of Empty map");
  });

  it("describes right-drag region select as a release, not placing an object", () => {
    // 도움말의 우클릭 드래그. 「놓으면」은 드래그를 떼는 것이고, 그 뒤에 뜨는 동작은
    // AI 작업·복사·지우기·구조물로 저장이다. 「저장」은 구조물에만 붙는다.
    const hint = "영역 선택 — 놓으면 AI 작업·복사·지우기·구조물로 저장";
    expect(en[hint]).toBe("Select region — when you release: 「AI task」, copy, erase, and 「Save as structure」");
    expect(en[hint].toLowerCase()).not.toMatch(/placed|save as ai/);
    expect(ja[hint]).toBe("範囲選択 — 離すと「AIタスク」·コピー·消去·「構造物として保存」");
    expect(ja[hint]).not.toMatch(/配置|リージョン/);
    expect(zh[hint]).toBe("选择区域 — 松开后：「AI 任务」·复制·擦除·「保存为结构物」");
    expect(zh[hint]).not.toMatch(/放置|保存为AI/);
    expect(createTranslator(en).translate(hint)).toBe(en[hint]);
    expect(createTranslator(ja).translate(hint)).toBe(ja[hint]);
    expect(createTranslator(zh).translate(hint)).toBe(zh[hint]);
  });

  it("calls a dragged rectangle a range in Japanese, and keeps region ids as リージョン", () => {
    // 「영역」은 맵에서 드래그한 사각형(선택 도구 V, 채우기·복사·AI 작업)이다.
    // 맵에 칠하는 지역 번호만 リージョン 이다. 도구 이름이 リージョン選択 이면 지역 번호 도구로 읽힌다.
    const regionIds = "맵에 칠해 둔 지역 번호를 밟았을 때 이벤트를 부르거나 스위치를 켜도록 연결합니다. 지역 번호를 칠하는 것은 맵 편집 화면에서 합니다.";
    expect(ja["영역"]).toBe("範囲");
    expect(ja["영역 선택"]).toBe("範囲選択");
    expect(ja["영역 선택"]).toBe(ja["영역 선택 — 놓으면 AI 작업·복사·지우기·구조물로 저장"].split(" — ")[0]);
    expect(ja["선택 영역"]).toBe("選択範囲");
    expect(ja["영역 채우기"]).toBe("範囲を塗りつぶす");
    expect(ja["영역 표시"]).toBe("範囲を強調");
    expect(ja["영역 표시"]).not.toBe(ja["영역 보기"]);
    expect(ja[regionIds]).toContain("リージョン番号");
    const japanese = createTranslator(ja);
    const rectangle = Object.entries(ja).filter(([source]) => source.includes("영역"));
    expect(rectangle.length).toBeGreaterThan(0);
    for (const [source, target] of rectangle) {
      expect(target, source).not.toContain("リージョン");
      expect(japanese.translate(source), source).toBe(target);
    }
    expect(japanese.translate(regionIds)).toContain("リージョン");
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
  it("calls a number-input digit a digit, and one digit stays singular in English", () => {
    // 숫자 입력 미리보기의 「N자리 · 대기 중」은 자릿수다. 좌석이 아니다.
    expect(createTranslator(en).translate("1자리 · 대기 중")).toBe("1 digit · waiting");
    expect(createTranslator(en).translate("4자리 · 대기 중")).toBe("4 digits · waiting");
    expect(en["{0}자리 · 대기 중"]).not.toMatch(/seat/i);
    expect(createTranslator(ja).translate("1자리 · 대기 중")).toBe("1桁 · 待機中");
    expect(createTranslator(ja).translate("4자리 · 대기 중")).toBe("4桁 · 待機中");
    expect(ja["{0}자리 · 대기 중"]).not.toContain("席");
    expect(createTranslator(zh).translate("1자리 · 대기 중")).toBe("1位 · 等待中");
    expect(createTranslator(zh).translate("4자리 · 대기 중")).toBe("4位 · 等待中");
    expect(zh["{0}자리 · 대기 중"]).not.toContain("名额");  });
});
