// (선택자, 속성) 승자 판정. 캐스케이드 우선순위를 규격 순서대로 적용하는지 본다.
//
// 계획 문서의 초안에서 두 군데를 바꿨고, 둘 다 실측 때문이다:
//  1. 초안의 기준선은 "파일:줄" 뿐이었다 → D 시나리오 2(토큰 색을 전부 흑백으로)를 못 잡는다.
//     승자 **위치**는 그대로고 값만 바뀌기 때문이다. 그래서 래칫에 값을 넣었다.
//  2. 반대로 **줄 번호는 뺐다** → states.css 에 주석 한 줄 넣었더니 "승자 121건 변경"이
//     떴다. 전부 줄 밀림이고 픽셀 변화는 0이었다. 양치기 소년 게이트는 꺼진 게이트다.
// 그래서 읽기용 직렬화(formatWinners, 줄 포함)와 래칫용(ratchetOf, 줄 없음)이 따로 있다.
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeWinners,
  decodeShard,
  diffWinners,
  encodeShard,
  formatWinners,
  groupByFile,
  ratchetOf,
  readBaseline,
  serializeShard,
  shardRelPath,
  writeBaseline,
} from "../scripts/check-css-winners.mjs";

const sheet = (name: string, css: string, layer: string | null = null) => ({ name, css, layer });
const where = (w: Record<string, { where: string }>, key: string) => w[key]?.where;

// #4791 이 시작 화면 설정을 에디터와 같은 AI 설정 창(.ai-settings-window)으로 바꾸며 .st-select 를 지웠다.
// 언어 목록은 이제 공용 .ai-config-select 다. 지킬 것은 #4787 의 회귀 — 펼친 목록(option)의 글자색만 칠하고
// 바탕은 시스템(다크 Canvas)에 맡겨 글자가 안 보이던 것 — 이므로, 두 시트에서 option 색은 바탕과 짝으로만 칠한다.
it("pairs option popup background and text colors in the launcher settings sheets", () => {
  const sheets = [
    "../src/start/settings/settings.css",
    "../src/styles/shell/dialogs/ai-settings-modal.css",
  ].map((path) => sheet(path, readFileSync(new URL(path, import.meta.url), "utf8")));
  const winners = computeWinners({ sheets });
  const optionProps = new Map<string, Set<string>>();
  for (const key of Object.keys(winners)) {
    const [selector, property] = key.split("|");
    if (!selector || !property || !/\boption\b/.test(selector)) continue;
    if (!["color", "background", "background-color"].includes(property)) continue;
    const props = optionProps.get(selector) ?? new Set<string>();
    props.add(property === "background-color" ? "background" : property);
    optionProps.set(selector, props);
  }
  for (const [selector, props] of optionProps) {
    expect({ selector, props: [...props].sort() }).toEqual({ selector, props: ["background", "color"] });
  }
  // 위 짝 검사가 실제 판정기 키 모양을 읽는지 — 글자색만 칠한 #4787 이전 규칙은 짝이 없다.
  const lone = computeWinners({ sheets: [sheet("lone.css", ".st-select option { color: #111; }")] });
  expect(Object.keys(lone)).toEqual([".st-select option|color"]);
});

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
    const shard = encodeShard("e.css", groupByFile(winners).get("b.css"));
    const values = Object.values(decodeShard(shard).winners);
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
    const contested = Object.values(groupByFile(winners).get("b.css").contested);
    expect(contested).toHaveLength(1);
    expect(contested[0]).toContain(".dup|color");
    expect(contested[0]).toContain("경쟁 2");
  });

  it("승자 원본 파일별로 나뉜다 — 다른 시트를 고친 PR 은 다른 조각을 쓴다", () => {
    const winners = computeWinners({
      sheets: [
        sheet("a.css", ".a { color: red } .dup { color: red }"),
        sheet("b.css", ".b { color: red } .dup { color: blue }"),
      ],
    });
    const groups = groupByFile(winners);
    expect([...groups.keys()]).toEqual(["a.css", "b.css"]);
    expect(Object.keys(groups.get("a.css")!.winners)).toHaveLength(1); // .a — .dup 은 b.css 가 이겼다
    expect(Object.keys(groups.get("b.css")!.winners)).toHaveLength(2);
    expect(shardRelPath("src/styles/index.css", "src/styles/runtime/shop.css")).toBe(
      "scripts/css-winners/styles/index/styles/runtime/shop.json",
    );
  });

  it("조각은 항목마다 한 줄이고 키는 정렬이다 — 다른 줄이면 git 이 합친다", () => {
    const winners = computeWinners({ sheets: [sheet("a.css", ".z { top: 0 } .a { top: auto } .m { top: 1px }")] });
    const lines = serializeShard(encodeShard("e.css", groupByFile(winners).get("a.css")!)).trimEnd().split("\n");
    const items = lines.filter((l) => /^  "[0-9a-f]{12}": /.test(l)).map((l) => l.trimEnd().replace(/,$/, ""));
    expect(items).toHaveLength(3);
    expect(items).toEqual([...items].sort());
  });

  describe("조각 저장", () => {
    const css = (color: string) =>
      computeWinners({ sheets: [sheet("src/a.css", `.x { color: ${color} }`), sheet("src/b.css", ".y { top: 0 }")] });
    const per = (winners: Record<string, Record<string, unknown>>) => ({ "src/e.css": winners });
    const inTmp = (fn: (root: string) => void) => {
      const root = mkdtempSync(join(tmpdir(), "css-winners-"));
      mkdirSync(join(root, "scripts"));
      try {
        fn(root);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    };
    const textOf = (root: string, shard: string) => readFileSync(join(root, "scripts/css-winners", shard), "utf8");

    it("내용이 같은 조각은 다시 쓰지 않고, 옛 단일 파일은 지운다", () => {
      inTmp((root) => {
        writeFileSync(join(root, "scripts/css-winners.baseline.json"), "{}");
        const first = writeBaseline(root, per(css("red")));
        expect(first).toEqual({ total: 2, written: 2, removed: ["scripts/css-winners.baseline.json"] });
        expect(writeBaseline(root, per(css("red")))).toEqual({ total: 2, written: 0, removed: [] });
        const aBefore = textOf(root, "e/a.json");
        const bBefore = textOf(root, "e/b.json");
        expect(aBefore).not.toContain("generatedAt"); // 저장마다 달라지는 줄은 조각끼리 충돌시킨다

        // a.css 의 승자 하나만 바뀌면 그 조각만 다시 쓴다.
        expect(writeBaseline(root, per(css("blue")))).toEqual({ total: 2, written: 1, removed: [] });
        expect(textOf(root, "e/a.json")).not.toBe(aBefore);
        expect(textOf(root, "e/b.json")).toBe(bBefore);

        const stored = readBaseline(root);
        expect(stored).toMatchObject({ shards: 2 });
        expect(diffWinners(stored!.entries, per(css("blue")))).toHaveLength(0);
        expect(diffWinners(stored!.entries, per(css("red")))).toHaveLength(1);
      });
    });

    it("승자가 사라진 조각은 지운다", () => {
      inTmp((root) => {
        writeBaseline(root, per(css("red")));
        const onlyB = computeWinners({ sheets: [sheet("src/b.css", ".y { top: 0 }")] });
        expect(writeBaseline(root, per(onlyB))).toEqual({ total: 1, written: 0, removed: ["scripts/css-winners/e/a.json"] });
        expect(readBaseline(root)?.shards).toBe(1);
      });
    });

    it("기준선이 없으면 null, 조각이 깨졌으면 파일을 짚고 던진다", () => {
      inTmp((root) => {
        expect(readBaseline(root)).toBeNull();
        writeBaseline(root, per(css("red")));
        writeFileSync(join(root, "scripts/css-winners/e/a.json"), "{");
        expect(() => readBaseline(root)).toThrow("scripts/css-winners/e/a.json");
      });
    });
  });
});

describe("diffWinners — 이동 증명용 비교", () => {
  const mk = (name: string, css: string) => computeWinners({ sheets: [sheet(name, css)] });
  // 엔트리 하나의 기준선. 키는 승자 키의 sha1 앞 12자리다 — diffWinners 가 현재 소스의 키를 같은 해시로 찾는다.
  const hashOf = (key: string) => createHash("sha1").update(key).digest("hex").slice(0, 12);
  const baselineOf = (winners: Record<string, Record<string, unknown>>) => ({
    "e.css": {
      winners: Object.fromEntries(Object.keys(winners).map((k) => [hashOf(k), ratchetOf(winners[k] as never)])),
      contested: {},
    },
  });

  it("파일이 옮겨지면 기본 비교는 변경으로 본다", () => {
    const a = mk("editor/x.css", ".p { color: red }");
    const b = mk("map/x.css", ".p { color: red }");
    expect(diffWinners(baselineOf(a), { "e.css": b }, { ignoreFile: false })).toHaveLength(1);
  });

  it("--ignore-file 이면 경로만 바뀐 이동은 변경이 아니다", () => {
    const a = mk("editor/x.css", ".p { color: red }");
    const b = mk("map/x.css", ".p { color: red }");
    expect(diffWinners(baselineOf(a), { "e.css": b }, { ignoreFile: true })).toHaveLength(0);
  });

  it("--ignore-file 이어도 값 변경은 잡는다", () => {
    const a = mk("editor/x.css", ".p { color: red }");
    const b = mk("map/x.css", ".p { color: blue }");
    expect(diffWinners(baselineOf(a), { "e.css": b }, { ignoreFile: true })).toHaveLength(1);
  });

  it("--ignore-file 이어도 레이어 변경은 잡는다", () => {
    const a = computeWinners({ sheets: [sheet("editor/x.css", "@layer map { .p { color: red } }")] });
    const b = computeWinners({ sheets: [sheet("map/x.css", "@layer shell { .p { color: red } }")] });
    expect(diffWinners(baselineOf(a), { "e.css": b }, { ignoreFile: true })).toHaveLength(1);
  });
});
