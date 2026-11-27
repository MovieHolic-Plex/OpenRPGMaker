import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeWinners, decodeShard, diffWinners, encodeShard, formatWinners, groupByFile, ratchetOf, readBaseline, serializeShard, shardRelPath, writeBaseline } from "../scripts/check-css-winners.mjs";
import { runTool } from "@/editor/tools";
import { freshSession, interact } from "@/harnesses/assistant-capability/node/smallJobs/checkSupport";
import { buildFixture } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import { findShadowedPages } from "@/project/eventPageShadow";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

// (선택자, 속성) 승자 판정. 캐스케이드 우선순위를 규격 순서대로 적용하는지 본다.
//
// 계획 문서의 초안에서 두 군데를 바꿨고, 둘 다 실측 때문이다:
//  1. 초안의 기준선은 "파일:줄" 뿐이었다 → D 시나리오 2(토큰 색을 전부 흑백으로)를 못 잡는다.
//     승자 **위치**는 그대로고 값만 바뀌기 때문이다. 그래서 래칫에 값을 넣었다.
//  2. 반대로 **줄 번호는 뺐다** → states.css 에 주석 한 줄 넣었더니 "승자 121건 변경"이
//     떴다. 전부 줄 밀림이고 픽셀 변화는 0이었다. 양치기 소년 게이트는 꺼진 게이트다.
// 그래서 읽기용 직렬화(formatWinners, 줄 포함)와 래칫용(ratchetOf, 줄 없음)이 따로 있다.
describe("checkCssWinners", () => {
  isolateTimers();
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
});

describe("checkSupport", () => {
  isolateTimers();
  describe("toolsKeepNpcContent", () => {
    isolateTimers();
    // 이미 있는 NPC 에 도구를 쓸 때 그 사람이 하던 일이 남는가 (2026-11-11 작은 일 둘째 묶음에서 본 결함 셋).
    // create_quest: 여관·상점·화자·완료 뒤 대사·움직임 / add_companion: 지금 도는 페이지 + joinParty / set_shop_stock: add·remove, 상점 없던 페이지에 안 넣기.

    const VILLAGE = "map_ember_village";
    const SNOW = "map_1c3b4f24-9d3d-4c31-9d24-4dbda2df705d";
    const MARKET = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";
    function start(fixture: "starter" | "built"): { project: Project } {
      return { project: buildFixture(fixture) };
    }
    function call(ctx: { project: Project }, tool: string, args: Record<string, unknown>) {
      const result = runTool(ctx, tool, args);
      expect(result.ok, result.summary).toBe(true);
      return result;
    }
    function eventOf(project: Project, id: string): GameEvent {
      const event = Object.values(project.maps).flatMap((map) => map.events).find((entry) => entry.id === id);
      if (!event) throw new Error(`missing event ${id}`);
      return event;
    }
    const talk = (project: Project, session: unknown, id: string) => interact(eventOf(project, id) as never, session, project as never);
    const kindsOf = (play: { ran: Command[] }): string[] => play.ran.map((command) => command.kind);
    const speakersOf = (play: { ran: Command[] }): (string | undefined)[] => play.ran.flatMap((command) => (command.kind === "text" ? [command.speaker] : []));
    const pageIds = (event: GameEvent): string[] => (event.pages ?? []).map((page) => page.id);
    function errand(overrides: Record<string, unknown> = {}): Record<string, unknown> {
      return {
        key: "q_herb", title: "약초 배달", summary: "미루의 약초를 여관 주인 마사에게 전한다.", presetId: "custom", blueprint: ["talk"], order: "sequence",
        giver: { mapId: VILLAGE, eventId: "ev_ember_child" },
        steps: [{ kind: "talk", target: { mapId: VILLAGE, eventId: "ev_ember_inn" }, lines: ["약초 고마워요."] }],
        dialogue: { accepted: "이 약초를 마사 아줌마한테 전해 줄래?", completed: "고마워! 이건 심부름 값이야." },
        rewards: { gold: 50 },
        ...overrides,
      };
    }
    describe("create_quest — 이미 있는 NPC 가 하던 일은 남는다", () => {
      it("대상(여관 주인)은 단계 뒤에도 여관이고, 의뢰인은 제 이름으로 말하고 제 움직임을 지키며, 끝나면 제 대사로 돌아간다", () => {
        const ctx = start("starter");
        const before = structuredClone(eventOf(ctx.project, "ev_ember_child").pages!);
        call(ctx, "create_quest", { def: errand() });
        const child = eventOf(ctx.project, "ev_ember_child"), inn = eventOf(ctx.project, "ev_ember_inn");

        // 그 사람 페이지는 그대로, 의뢰 페이지는 뒤에(키가 든 id) — 죽은 페이지 없음.
        expect(child.pages!.slice(0, before.length)).toEqual(before);
        expect(pageIds(child).slice(before.length)).toEqual(["ev_ember_child_q_herb_offer", "ev_ember_child_q_herb_active"]);
        expect(child.pages!.every((page) => page.movement?.type === "random")).toBe(true);
        expect(findShadowedPages(child.pages)).toEqual([]);
        expect(findShadowedPages(inn.pages)).toEqual([]);

        const session = freshSession();
        const offer = talk(ctx.project, session, "ev_ember_child");
        // 그 사람의 말은 제 이름으로, 요약문(3인칭 설명)은 이름표 없는 서술로 뜬다 — dialogue.offer 를 주지 않았다(2026-11-16 확인 빌드 r6 P7).
        expect(new Set(speakersOf(offer).filter((speaker) => speaker !== undefined))).toEqual(new Set(["꼬마 미루"]));
        expect(offer.ran.find((command) => command.kind === "text" && command.body === "미루의 약초를 여관 주인 마사에게 전한다.")).toMatchObject({ kind: "text" });
        expect(offer.ran.find((command) => command.kind === "text" && command.body === "미루의 약초를 여관 주인 마사에게 전한다.")).not.toHaveProperty("speaker");
        const step = talk(ctx.project, session, "ev_ember_inn");
        expect(speakersOf(step)).toEqual(["여관 주인 마사"]);
        expect(kindsOf(step)).toContain("inn");
        expect(talk(ctx.project, session, "ev_ember_child").gold).toBe(50);
        // 끝난 뒤: 여관 주인은 처음 그대로, 의뢰인은 제 대사(보상은 다시 없음).
        expect(kindsOf(talk(ctx.project, session, "ev_ember_inn"))).toEqual(["text", "inn"]);
        const after = talk(ctx.project, session, "ev_ember_child");
        expect(after.gold).toBe(0);
        expect(after.texts[0]).toContain("세라 누나");
      });

      it("가게 주인이 의뢰인이면 의뢰가 걸려 있는 동안에도 가게가 열린다 — 완료 뒤 대사를 주면 그 대사 뒤에도", () => {
        const ctx = start("starter");
        call(ctx, "create_quest", { def: errand({
          giver: { mapId: VILLAGE, eventId: "ev_ember_inn" },
          steps: [{ kind: "talk", target: { mapId: VILLAGE, eventId: "ev_ember_child" }, lines: ["알았어!"] }],
          dialogue: { afterComplete: "덕분에 방이 다 찼어요." },
        }) });
        const session = freshSession();
        expect(kindsOf(talk(ctx.project, session, "ev_ember_inn")).slice(0, 2)).toEqual(["text", "inn"]);
        const open = talk(ctx.project, session, "ev_ember_inn");
        expect(kindsOf(open).at(-1)).toBe("inn");
        expect(speakersOf(open)).toEqual(["여관 주인 마사"]);
        talk(ctx.project, session, "ev_ember_child");
        expect(talk(ctx.project, session, "ev_ember_inn").gold).toBe(50);
        const done = talk(ctx.project, session, "ev_ember_inn");
        expect(done.texts).toEqual(["덕분에 방이 다 찼어요."]);
        expect(kindsOf(done).at(-1)).toBe("inn");
      });

      it("같은 사람에게 의뢰를 하나 더 얹어도 앞 의뢰가 남는다", () => {
        const ctx = start("starter");
        call(ctx, "create_quest", { def: errand() });
        call(ctx, "create_quest", { def: errand({ key: "q_second", title: "두 번째 심부름", rewards: { gold: 7 } }) });
        const ids = pageIds(eventOf(ctx.project, "ev_ember_child"));
        expect(ids).toEqual(expect.arrayContaining(["ev_ember_child_q_herb_offer", "ev_ember_child_q_herb_active", "ev_ember_child_q_second_offer", "ev_ember_child_q_second_active"]));
        const session = freshSession();
        const rewards: number[] = [];
        for (let round = 0; round < 2; round += 1) {
          talk(ctx.project, session, "ev_ember_child");
          talk(ctx.project, session, "ev_ember_inn");
          rewards.push(talk(ctx.project, session, "ev_ember_child").gold);
        }
        expect(rewards.sort()).toEqual([50, 7].sort());
      });

      it("옛 배치(키 없는 _offer/_active/_done)가 있던 상인: 상점 페이지를 되살리고, 옛 의뢰도 남고, 옛 진행 페이지에서도 상점이 열린다", () => {
        const ctx = start("built");
        const sold = (eventOf(ctx.project, "ev_supply_shop").pages![0]!.commands.find((command) => command.kind === "shop") as { itemIds: string[] }).itemIds;
        call(ctx, "create_quest", { def: errand({
          key: "q_pen", title: "깃펜 심부름", summary: "토르에게 깃펜 값을 묻는다.",
          giver: { mapId: SNOW, eventId: "ev_supply_shop" },
          steps: [{ kind: "talk", target: { mapId: MARKET, eventId: "ev_chain_kehegd7_2" }, lines: ["은화 두 닢이지."] }],
          dialogue: {}, rewards: { gold: 10 },
        }) });
        const merchant = eventOf(ctx.project, "ev_supply_shop");
        expect(pageIds(merchant)).toEqual([
          "ev_supply_shop_base", "ev_supply_shop_q_hearth_offer", "ev_supply_shop_q_hearth_active", "ev_supply_shop_q_hearth_done",
          "ev_supply_shop_q_pen_offer", "ev_supply_shop_q_pen_active",
        ]);
        expect(merchant.pages![0]!.conditions).toEqual([]);
        expect(findShadowedPages(merchant.pages)).toEqual([]);
        const session = freshSession();
        talk(ctx.project, session, "ev_supply_shop");
        const open = talk(ctx.project, session, "ev_supply_shop");
        expect(open.shops.map((shop: { itemIds: string[] }) => shop.itemIds)).toEqual([sold]);
        expect(new Set(speakersOf(open))).toEqual(new Set(["떠돌이 상인"]));
        talk(ctx.project, session, "ev_chain_kehegd7_2");
        expect(talk(ctx.project, session, "ev_supply_shop").gold).toBe(10);
        // 새 의뢰가 끝나면 옛 의뢰 «화롯불의 안부»를 다시 받을 수 있고, 받은 뒤에도 상점이 열린다.
        const old = talk(ctx.project, session, "ev_supply_shop");
        expect(session.switches.sw_q_hearth_started).toBe(true);
        expect(old.shops).toHaveLength(1);
        expect(talk(ctx.project, session, "ev_supply_shop").shops).toHaveLength(1);
      });

      it("장 구성기가 넘기는 takeOverNpcs 는 옛 배치를 그대로 쓴다(폴른 스타 다듬기가 기대는 페이지 순서·기본 문구)", () => {
        const ctx = start("starter");
        call(ctx, "create_quest", { def: errand({ dialogue: {} }), takeOverNpcs: true });
        expect(pageIds(eventOf(ctx.project, "ev_ember_child"))).toEqual(["child_clear", "ev_ember_child_offer", "ev_ember_child_active", "ev_ember_child_done"]);
        expect(pageIds(eventOf(ctx.project, "ev_ember_inn"))).toEqual(["inn_page", "ev_ember_inn_q_herb_talk0", "ev_ember_inn_q_herb_talkdone0"]);
        const done = eventOf(ctx.project, "ev_ember_child").pages!.at(-1)!.commands[0] as { speaker?: string; body?: string };
        expect(done).toMatchObject({ speaker: "의뢰인", body: "자네 덕분에 살았어. 정말 고맙네." });
      });
    });
    describe("add_companion — 지금 도는 페이지에 붙이고, joinParty 면 파티에도 넣는다", () => {
      it("조건 페이지가 있는 NPC: 게임 시작 때 도는 첫 페이지에 붙는다(마지막 조건 페이지가 아니다)", () => {
        const ctx = start("starter");
        const result = call(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { eventId: "ev_ember_guard" } });
        const guard = eventOf(ctx.project, "ev_ember_guard");
        expect(guard.pages!.map((page) => page.commands.some((command) => command.kind === "addFollower"))).toEqual([true, false, false]);
        expect(kindsOf(talk(ctx.project, freshSession(), "ev_ember_guard"))).toContain("addFollower");
        expect(result.summary).toContain("page 1 of 3");
        expect(JSON.stringify(result)).toContain("joinParty:true");
      });

      it("joinParty: 말을 걸면 파티에 들어오고 그 자리에서 떠난다 — who 를 비우면(빈 문자열 채움 포함) 그 사람으로 배우를 만든다", () => {
        for (const who of [undefined, { actorId: "", query: "", textureKey: "", characterIndex: 0 }]) {
          const ctx = start("starter");
          const actorsBefore = ctx.project.database.actors.length;
          const result = call(ctx, "add_companion", { ...(who ? { who } : {}), target: { eventId: "ev_ember_guard", mapId: "", x: 0, y: 0 }, joinParty: true, name: "" });
          const actorId = (result.data as { actorId: string }).actorId;
          const made = ctx.project.database.actors.find((actor) => actor.id === actorId);
          expect(made?.name).toBe("파수꾼 데릭");
          expect(ctx.project.database.actors).toHaveLength(actorsBefore + 1);
          const guard = eventOf(ctx.project, "ev_ember_guard");
          const session = Object.assign(freshSession(), { partyActorIds: ["actor_hero"] });
          const first = talk(ctx.project, session, "ev_ember_guard");
          expect(first.ran).toContainEqual({ kind: "changeParty", actorId, action: "add" });
          // 합류 뒤: 마지막 페이지(투명·통과)가 이긴다.
          expect(talk(ctx.project, session, "ev_ember_guard").ran).toEqual([]);
          const gone = guard.pages!.at(-1) as EventPage;
          expect(gone).toMatchObject({ id: "ev_ember_guard_joined", graphic: { transparent: true }, priority: "below", commands: [] });
          expect(findShadowedPages(guard.pages)).toEqual([]);
        }
      });

      it("joinParty 에 있는 배우를 주면 그 배우가 들어오고, 그림만 준 동료는 파티에 못 넣는다고 알려 준다", () => {
        const ctx = start("starter");
        call(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { eventId: "ev_ember_guard" }, joinParty: true });
        const play = talk(ctx.project, Object.assign(freshSession(), { partyActorIds: ["actor_hero"] }), "ev_ember_guard");
        expect(play.ran).toContainEqual({ kind: "changeParty", actorId: "actor_guardian", action: "add" });
        const refused = runTool(start("starter"), "add_companion", { who: { query: "고양이" }, target: { eventId: "ev_ember_guard" }, joinParty: true });
        expect(refused.ok).toBe(false);
        expect(refused.summary).toContain("who:{actorId}");
      });

      it("새로 세우는 합류 이벤트: 합류 뒤 페이지가 뒤에 있어 실제로 사라진다", () => {
        const ctx = start("starter");
        const result = call(ctx, "add_companion", { who: { actorId: "actor_guardian" }, target: { mapId: VILLAGE, x: 12, y: 12 }, trigger: "talk", joinParty: true });
        const id = (result.data as { eventId: string }).eventId;
        const event = eventOf(ctx.project, id);
        expect(findShadowedPages(event.pages)).toEqual([]);
        const session = Object.assign(freshSession(), { partyActorIds: ["actor_hero"] });
        expect(kindsOf(talk(ctx.project, session, id))).toEqual(["addFollower", "changeParty", "setSelfSwitch"]);
        expect(talk(ctx.project, session, id).ran).toEqual([]);
      });
    });
    describe("set_shop_stock — 더하고 빼기, 상점 없던 페이지는 그대로", () => {
      const shopsPerPage = (event: GameEvent): string[][][] => event.pages!.map((page) => page.commands.flatMap((command) => (command.kind === "shop" ? [command.stock?.map((entry) => entry.itemId) ?? command.itemIds] : [])));
      const was = ["item_gen_potion_large", "item_hi_potion", "item_antidote", "item_gen2_purifying_serum"];

      it("add 는 지금 파는 것에 더하고 remove 는 그것만 뺀다 — 의뢰 페이지에는 상점이 생기지 않는다", () => {
        const ctx = start("built");
        call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", add: [{ itemId: "item_quill" }] });
        expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))).toEqual([[[...was, "item_quill"]], [], []]);
        call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", remove: ["item_antidote"] });
        expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))).toEqual([[["item_gen_potion_large", "item_hi_potion", "item_gen2_purifying_serum", "item_quill"]], [], []]);
      });

      it("빈 배열 채움(stock:[] remove:[])은 «안 줬다»다 — add 만 적용된다", () => {
        const ctx = start("built");
        call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", stock: [], add: [{ itemId: "item_quill" }], remove: [] });
        expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))[0]).toEqual([[...was, "item_quill"]]);
      });

      it("값을 붙여 더하면 stock 표로 옮겨 가격을 지킨다", () => {
        const ctx = start("built");
        call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", add: [{ itemId: "item_quill", priceOverride: 12 }] });
        const shop = eventOf(ctx.project, "ev_supply_shop").pages![0]!.commands.find((command) => command.kind === "shop") as Extract<Command, { kind: "shop" }>;
        expect(shop.stock).toEqual([...was.map((itemId) => ({ itemId })), { itemId: "item_quill", priceOverride: 12 }]);
        expect(shop.itemIds).toEqual([...was, "item_quill"]);
      });

      it("stock 은 여전히 통째로 바꾸지만 상점이 있던 페이지만 고친다", () => {
        const ctx = start("built");
        call(ctx, "set_shop_stock", { mapId: SNOW, eventId: "ev_supply_shop", stock: [{ itemId: "item_quill" }] });
        expect(shopsPerPage(eventOf(ctx.project, "ev_supply_shop"))).toEqual([[["item_quill"]], [], []]);
      });

      it("상점 페이지가 뒤의 조건 없는 페이지에 늘 가려져 있으면 실제로 도는 그 페이지에도 상점을 둔다(2026-08-24 결함 유지)", () => {
        const ctx = start("starter");
        call(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_inn", stock: [{ itemId: "item_potion" }] });
        call(ctx, "add_event_page", { mapId: VILLAGE, eventId: "ev_ember_inn", page: { name: "잡담", conditions: [], commands: [{ kind: "text", body: "오늘은 날이 좋네요." }] } });
        call(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_inn", add: [{ itemId: "item_ether" }] });
        expect(shopsPerPage(eventOf(ctx.project, "ev_ember_inn"))).toEqual([[["item_potion", "item_ether"]], [["item_potion", "item_ether"]]]);
        expect(talk(ctx.project, freshSession(), "ev_ember_inn").shops).toHaveLength(1);
      });

      it("상점이 없던 사람은 add 로 상점이 되고(말할 수 있는 페이지마다), remove 만 주면 거절한다", () => {
        const ctx = start("starter");
        const refused = runTool(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_guard", remove: ["item_potion"] });
        expect(refused.ok).toBe(false);
        expect(refused.summary).toContain("no shop command");
        call(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_guard", add: [{ itemId: "item_potion" }] });
        expect(shopsPerPage(eventOf(ctx.project, "ev_ember_guard"))).toEqual([[["item_potion"]], [["item_potion"]], [["item_potion"]]]);
        const nothing = runTool(ctx, "set_shop_stock", { mapId: VILLAGE, eventId: "ev_ember_guard" });
        expect(nothing.ok).toBe(false);
        expect(nothing.summary).toContain("stock (whole replacement), add");
      });
    });
  });
  describe("toolsOneCallGaps", () => {
    isolateTimers();
    // 한 호출로 끝나야 할 작은 일들 (2026-11-11 작은 일 둘째 묶음에서 본 빈틈): 그림 없는 전투 블로커 · 맨 위에 준 맵 깃발 · 상자 수량 ·
    // 회복만 하는 자리 · 조건 페이지 NPC 의 움직임 · 빈 칸 채움에 지워지지 않는 시작 상태.

    const VILLAGE = "map_ember_village";
    const FIELD = "map_blank_start";
    const MARKET = "map_5eec6ba0-1ac1-48ab-9d7f-db5032670b4c";
    const CLIFF = "map_638339b3-341f-4d31-93bd-ccc90a33304a";
    function start(fixture: "starter" | "built"): { project: Project } {
      return { project: buildFixture(fixture) };
    }
    function call(ctx: { project: Project }, tool: string, args: Record<string, unknown>) {
      const result = runTool(ctx, tool, args);
      expect(result.ok, result.summary).toBe(true);
      return result;
    }
    function eventOf(project: Project, id: string): GameEvent {
      const event = Object.values(project.maps).flatMap((map) => map.events).find((entry) => entry.id === id);
      if (!event) throw new Error(`missing event ${id}`);
      return event;
    }
    const made = (result: { data?: unknown }): string => (result.data as { eventId: string }).eventId;
    const examine = (project: Project, id: string): Command[] => interact(eventOf(project, id) as never, freshSession(), project as never).ran;
    describe("place_battle_blocker — graphic 이 없어도 세운다", () => {
      it("이름에 맞는 걷기 칩이 없으면 두건 괴물 칩으로 세우고 어느 칩인지 알린다 — 빈 칸만 채운 graphic 도 안 준 것이다", () => {
        for (const graphic of [undefined, { query: "", textureKey: "", characterIndex: 0, transparent: false }]) {
          const ctx = start("starter");
          const result = call(ctx, "place_battle_blocker", { mapId: FIELD, x: 10, y: 7, troopId: "troop_golem_guard", intro: ["여기는 지나갈 수 없다."], ...(graphic ? { graphic } : {}) });
          const shown = eventOf(ctx.project, made(result)).pages!.find((entry) => entry.graphic.sprite?.id === "tex_easyrpg_charset_monster3");
          expect(shown, "전투 페이지가 두건 괴물 칩으로 보인다").toBeTruthy();
          expect(shown!.graphic.transparent).not.toBe(true);
          expect(JSON.stringify(result)).toContain("generic hooded-monster chip (tex_easyrpg_charset_monster3 #2");
          expect(examine(ctx.project, made(result)).map((command) => command.kind)).toEqual(expect.arrayContaining(["text", "battleProcessing"]));
        }
      });

      it("준 graphic 은 그대로 쓴다", () => {
        const ctx = start("starter");
        const result = call(ctx, "place_battle_blocker", { mapId: FIELD, x: 10, y: 7, troopId: "troop_golem_guard", graphic: { textureKey: "tex_easyrpg_charset_monster2", characterIndex: 4 } });
        expect(eventOf(ctx.project, made(result)).pages!.some((entry) => entry.graphic.sprite?.id === "tex_easyrpg_charset_monster2")).toBe(true);
        expect(JSON.stringify(result)).not.toContain("generic hooded-monster");
      });
    });
    describe("set_map_properties — 맨 위에 준 제한 깃발", () => {
      it("disableSave:true 를 받고, 그 깃발 하나만 바꾼다", () => {
        const ctx = start("built");
        call(ctx, "set_map_properties", { mapId: CLIFF, disableEscape: true });
        call(ctx, "set_map_properties", { mapId: CLIFF, disableSave: true });
        expect(ctx.project.maps[CLIFF]).toMatchObject({ disableSave: true, disableEscape: true });
        call(ctx, "set_map_properties", { mapId: CLIFF, disableSave: false });
        expect(ctx.project.maps[CLIFF]!.disableSave).toBeUndefined();
        expect(ctx.project.maps[CLIFF]!.disableEscape).toBe(true);
      });

      it("모르는 키만 오면 그 키와 맞는 모양을 알려 준다", () => {
        const refused = runTool(start("built"), "set_map_properties", { mapId: CLIFF, noSave: true });
        expect(refused.ok).toBe(false);
        expect(refused.summary).toContain("noSave");
        expect(refused.summary).toContain("flags:{disableSave:true");
      });
    });
    describe("place_chest — 수량", () => {
      it("contents.count 만큼 주고, 0·빈 칸은 1개다", () => {
        const ctx = start("starter");
        const three = call(ctx, "place_chest", { mapId: VILLAGE, x: 10, y: 12, contents: { itemId: "item_potion", count: 3 } });
        expect(examine(ctx.project, made(three))).toContainEqual({ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 3 });
        expect(interact(eventOf(ctx.project, made(three)) as never, freshSession(), ctx.project as never).texts.join(" ")).toContain("「회복약」 3개를 얻었다.");
        const one = call(ctx, "place_chest", { mapId: VILLAGE, x: 12, y: 12, contents: { itemId: "item_potion", count: 0, gold: 0 } });
        expect(examine(ctx.project, made(one))).toContainEqual({ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 });
      });
    });
    describe("place_savepoint — 회복만 하는 자리", () => {
      it("mode:'heal' 은 회복하고 저장·체크포인트는 하지 않는다", () => {
        const ctx = start("built");
        const result = call(ctx, "place_savepoint", { mapId: MARKET, x: 20, y: 23, mode: "heal", name: "회복의 샘" });
        expect(examine(ctx.project, made(result)).map((command) => command.kind)).toEqual(["recoverAll", "text"]);
        expect(eventOf(ctx.project, made(result)).name).toBe("회복의 샘");
        expect(result.summary).toContain("does not save");
      });

      it("기본·heal:true 는 전과 같다", () => {
        const ctx = start("built");
        const plain = call(ctx, "place_savepoint", { mapId: MARKET, x: 20, y: 23 });
        expect(examine(ctx.project, made(plain)).map((command) => command.kind)).toEqual(["checkpointSave", "text", "openSaveMenu"]);
        const healing = call(ctx, "place_savepoint", { mapId: MARKET, x: 24, y: 23, heal: true });
        expect(examine(ctx.project, made(healing)).map((command) => command.kind)).toEqual(["recoverAll", "checkpointSave", "text", "openSaveMenu"]);
      });
    });
    describe("configure_npc_patrol — 서성이기·제자리는 어느 NPC 에나", () => {
      const types = (project: Project, id: string): string[] => eventOf(project, id).pages!.map((page) => page.movement.type);

      it("조건 페이지가 있는 NPC 도 type 으로 모든 페이지의 움직임만 바꾼다(대사·조건·자리 그대로)", () => {
        const ctx = start("starter");
        const before = structuredClone(eventOf(ctx.project, "ev_ember_guard"));
        call(ctx, "configure_npc_patrol", { mapId: VILLAGE, eventId: "ev_ember_guard", type: "random" });
        const guard = eventOf(ctx.project, "ev_ember_guard");
        expect(types(ctx.project, "ev_ember_guard")).toEqual(["random", "random", "random"]);
        expect(guard.pages!.map((page) => [page.commands, page.conditions])).toEqual(before.pages!.map((page) => [page.commands, page.conditions]));
        expect([guard.x, guard.y]).toEqual([before.x, before.y]);
        call(ctx, "configure_npc_patrol", { mapId: VILLAGE, eventId: "ev_ember_child", type: "fixed", directions: [] });
        expect(types(ctx.project, "ev_ember_child")).toEqual(["fixed", "fixed"]);
      });

      it("순찰 경로는 여전히 조건 페이지 NPC 를 거절하고, 서성이기·제자리로 가는 길을 알려 준다", () => {
        const ctx = start("starter");
        const refused = runTool(ctx, "configure_npc_patrol", { mapId: VILLAGE, eventId: "ev_ember_guard", directions: ["up", "down"] });
        expect(refused.ok).toBe(false);
        expect(refused.issues?.[0]?.code).toBe("protected-npc");
        expect(refused.summary).toContain("type:'random'");
        expect(types(ctx.project, "ev_ember_guard")).toEqual(["fixed", "fixed", "fixed"]);
      });
    });
    describe("set_session_start — 빈 칸 채움이 시작 상태를 지우지 않는다", () => {
      it("gold:0 · partyActorIds:[] 가 딸려 와도 소지금·파티는 그대로, 가방만 바뀐다", () => {
        const ctx = start("built");
        const result = call(ctx, "set_session_start", { gold: 0, inventory: { item_hi_potion: 3, item_potion: 3 }, partyActorIds: [] });
        expect(ctx.project.session).toMatchObject({ gold: 100, inventory: { item_hi_potion: 3, item_potion: 3 }, partyActorIds: ["actor_hero"] });
        expect(JSON.stringify(result)).toContain("Ignored as unfilled defaults: gold:0, partyActorIds:[]");
      });

      it("빈 값도 그 칸 하나만 보내면 뜻이 있다(소지금 0 · 빈 가방) — 빈 파티는 언제나 무시한다", () => {
        const ctx = start("built");
        call(ctx, "set_session_start", { gold: 0 });
        expect(ctx.project.session.gold).toBe(0);
        call(ctx, "set_session_start", { inventory: {} });
        expect(ctx.project.session.inventory).toEqual({});
        call(ctx, "set_session_start", { partyActorIds: [] });
        expect(ctx.project.session.partyActorIds).toEqual(["actor_hero"]);
      });
    });
  });
});
