// (선택자, 속성) 승자 판정. 캐스케이드 우선순위를 규격 순서대로 적용하는지 본다.
//
// 계획 문서의 초안에서 두 군데를 바꿨고, 둘 다 실측 때문이다:
//  1. 초안의 기준선은 "파일:줄" 뿐이었다 → D 시나리오 2(토큰 색을 전부 흑백으로)를 못 잡는다.
//     승자 **위치**는 그대로고 값만 바뀌기 때문이다. 그래서 래칫에 값을 넣었다.
//  2. 반대로 **줄 번호는 뺐다** → states.css 에 주석 한 줄 넣었더니 "승자 121건 변경"이
//     떴다. 전부 줄 밀림이고 픽셀 변화는 0이었다. 양치기 소년 게이트는 꺼진 게이트다.
// 그래서 읽기용 직렬화(formatWinners, 줄 포함)와 래칫용(ratchetOf, 줄 없음)이 따로 있다.
import { describe, expect, it } from "vitest";
import {
  computeWinners,
  decodeBaseline,
  encodeBaseline,
  formatWinners,
  ratchetOf,
} from "../scripts/check-css-winners.mjs";

const sheet = (name: string, css: string, layer: string | null = null) => ({ name, css, layer });
const where = (w: Record<string, { where: string }>, key: string) => w[key]?.where;

describe("computeWinners — 캐스케이드 우선순위", () => {
  it("레이어 순서가 특이도를 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["base", "app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer base { #id.x.y.z { color: blue } }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("a.css:1");
  });

  it("언레이어가 모든 레이어를 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", ".x { color: blue }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("b.css:1");
  });

  it("서브레이어는 부모 직속에게 진다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { @layer app { .x { color: red } } }"),
        sheet("b.css", "@layer app { .x { color: blue } }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("b.css:1");
  });

  it("import 이 준 레이어와 파일 안 @layer 가 겹치면 서브레이어가 된다", () => {
    // runtime/pictures.css 가 실제로 이 모양이다: layer(runtime) 으로 들어와서
    // 안에서 다시 `@layer runtime {` 으로 감싼다 → 실효 runtime.runtime.
    const w = computeWinners({
      layerOrder: ["runtime"],
      sheets: [
        sheet("pictures.css", "@layer runtime { .p { z-index: 1 } }", "runtime"),
        sheet("tabs.css", ".p { z-index: 2 }", "runtime"),
      ],
    });
    expect(where(w, ".p|z-index")).toBe("tabs.css:1");
  });

  it("!important 는 레이어 순서를 뒤집는다", () => {
    const w = computeWinners({
      layerOrder: ["base", "app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer base { .x { color: blue !important } }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("b.css:1");
  });

  it("언레이어 important 는 모든 important 중 가장 약하다", () => {
    const w = computeWinners({
      layerOrder: ["base", "app"],
      sheets: [
        sheet("a.css", ".x { color: red !important }"),
        sheet("b.css", "@layer app { .x { color: blue !important } }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("b.css:1");
  });

  it("important 는 레이어와 무관하게 normal 을 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["base", "app"],
      sheets: [
        sheet("a.css", "@layer base { .x { color: red !important } }"),
        sheet("b.css", ".x#id { color: blue }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("a.css:1");
  });

  it("같은 레이어에서는 특이도가 문서 순서를 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { .x.y { color: red } }"),
        sheet("b.css", "@layer app { .x { color: blue } }"),
      ],
    });
    expect(where(w, ".x.y|color")).toBe("a.css:1");
    expect(where(w, ".x|color")).toBe("b.css:1");
  });

  it("특이도가 같으면 나중 선언이 이긴다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer app { .x { color: blue } }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("b.css:1");
  });

  it("레이어 순서는 시트 안의 @layer 선언문에서 읽는다", () => {
    // D 시나리오 1: index.css:3 한 줄을 뒤집으면 앱 전체 캐스케이드가 역전된다.
    // 순서를 하드코딩하면 이 변경이 게이트에 안 보인다.
    const sheets = [
      sheet("order.css", "@layer base, app;"),
      sheet("a.css", "@layer app { .x { color: red } }"),
      sheet("b.css", "@layer base { .x { color: blue } }"),
    ];
    expect(where(computeWinners({ sheets }), ".x|color")).toBe("a.css:1");

    const reversed = [sheet("order.css", "@layer app, base;"), ...sheets.slice(1)];
    expect(where(computeWinners({ sheets: reversed }), ".x|color")).toBe("b.css:1");
  });
});

describe("computeWinners — 경쟁 범위", () => {
  it("@media 조건이 다르면 경쟁이 아니다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer app { @media (max-width: 600px) { .x { color: blue } } }"),
      ],
    });
    expect(where(w, ".x|color")).toBe("a.css:1");
    expect(where(w, ".x|color|@media (max-width: 600px)")).toBe("b.css:1");
  });

  it("@keyframes 안의 퍼센트 규칙은 선택자가 아니다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [sheet("a.css", "@layer app { @keyframes spin { from { opacity: 0 } to { opacity: 1 } } }")],
    });
    expect(Object.keys(w)).toHaveLength(0);
  });

  it("쉼표 선택자는 각각 따로 경쟁한다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [sheet("a.css", "@layer app { .x, .y { color: red } }")],
    });
    expect(where(w, ".x|color")).toBe("a.css:1");
    expect(where(w, ".y|color")).toBe("a.css:1");
  });

  it("속성 이름은 소문자로, 선택자 공백은 하나로 접는다", () => {
    const w = computeWinners({
      layerOrder: ["app"],
      sheets: [sheet("a.css", "@layer app { .a   >   .b { COLOR: red } }")],
    });
    expect(where(w, ".a > .b|color")).toBe("a.css:1");
  });
});

describe("formatWinners — 기준선 직렬화", () => {
  it("승자 값이 바뀌면 기준선 문자열이 바뀐다 (D 시나리오 2)", () => {
    const make = (color: string) =>
      formatWinners(computeWinners({ sheets: [sheet("t.css", `:root { --accent: ${color} }`)] }));
    expect(make("#4A57D6")).not.toEqual(make("#000000"));
  });

  it("시트가 사라지면 키가 사라진다 (D 시나리오 3)", () => {
    const kept = computeWinners({ sheets: [sheet("a.css", ".only-here { color: red }")] });
    const gone = computeWinners({ sheets: [] });
    expect(Object.keys(kept)).toContain(".only-here|color");
    expect(Object.keys(gone)).not.toContain(".only-here|color");
  });

  it("최상위 레이어 important 가 승자를 뒤집는다 (D 시나리오 4)", () => {
    const base = [
      sheet("order.css", "@layer shell, overrides;"),
      sheet("a.css", "@layer shell { .db-ws-btn-ghost { display: flex } }"),
    ];
    expect(where(computeWinners({ sheets: base }), ".db-ws-btn-ghost|display")).toBe("a.css:1");

    const laundered = [
      ...base,
      sheet("o.css", "@layer overrides { .db-ws-btn-ghost { display: none !important } }"),
    ];
    expect(where(computeWinners({ sheets: laundered }), ".db-ws-btn-ghost|display")).toBe("o.css:1");
  });

  it("직렬화는 위치·레이어·값을 모두 담는다", () => {
    const out = formatWinners(
      computeWinners({ layerOrder: ["app"], sheets: [sheet("a.css", "@layer app { .x { color: red } }")] }),
    );
    expect(out[".x|color"]).toBe("a.css:1 [app] red");
  });
});

describe("기준선 인코딩", () => {
  const winnersOf = (css: string) => computeWinners({ sheets: [sheet("a.css", css)] });

  it("래칫 값에 줄 번호가 없다 — 줄이 밀려도 변경이 아니다", () => {
    // 실측: 줄 번호를 넣었더니 states.css 에 주석 한 줄 넣는 것만으로 121건이 바뀌었다고 나왔다.
    const before = winnersOf(".x { color: red }");
    const after = winnersOf("\n\n/* 주석 */\n.x { color: red }");
    expect(after[".x|color"].where).not.toBe(before[".x|color"].where); // 줄은 실제로 달라졌고
    expect(ratchetOf(after[".x|color"])).toBe(ratchetOf(before[".x|color"])); // 래칫은 같다
  });

  it("값이 바뀌면 래칫도 바뀐다", () => {
    expect(ratchetOf(winnersOf(".x { color: red }")[".x|color"]))
      .not.toBe(ratchetOf(winnersOf(".x { color: blue }")[".x|color"]));
  });

  it("인코딩→디코딩이 래칫 값을 보존한다", () => {
    const winners = computeWinners({
      sheets: [
        sheet("a.css", "@layer app { .x { color: red } }"),
        sheet("b.css", "@layer app { .x { color: blue } .y { margin: 0 } }"),
      ],
    });
    const round = decodeBaseline({ generatedAt: "t", ...encodeBaseline({ "e.css": winners }) });
    const values = Object.values(round["e.css"].winners);
    expect(values).toContain(ratchetOf(winners[".x|color"]));
    expect(values).toContain(ratchetOf(winners[".y|margin"]));
  });

  it("경쟁이 있던 키만 원문을 남긴다", () => {
    const winners = computeWinners({
      sheets: [
        sheet("a.css", ".dup { color: red }"),
        sheet("b.css", ".dup { color: blue } .solo { margin: 0 }"),
      ],
    });
    const contested = Object.values(encodeBaseline({ "e.css": winners }).entries["e.css"].contested);
    expect(contested).toHaveLength(1);
    expect(contested[0]).toContain(".dup|color");
    expect(contested[0]).toContain("경쟁 2");
  });

  it("고유 값 테이블이 반복 값을 접는다", () => {
    const winners = computeWinners({
      sheets: [sheet("a.css", ".a { color: red } .b { color: red } .c { color: red }")],
    });
    expect(encodeBaseline({ "e.css": winners }).values).toEqual(["red"]);
  });
});
