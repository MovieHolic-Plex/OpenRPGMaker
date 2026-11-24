import { describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { parseBattleCommandCss, mountBattleCommandCss } from "@/project/battleCommandCss";
import { Window } from "happy-dom";
import { battleRoundCount } from "@/project/battleReports";
import type { BattleSnapshot } from "@/battle/types";
import { AREA_LABELS, COUNTED_PROJECT_FIELDS, changedAreaLabels } from "@/project/changeAreas";
import type { Project, GameEvent, GameMap } from "@/project/types";
import { buildChangeLedger, summarizeLedgerValue, type ChangeLedgerEntry } from "@/project/changeLedger";
import { computeChangeSites } from "@/project/changeSites";
import { isolateTimers } from "./mergedTeardown";

describe("battleCommandCss", () => {
  isolateTimers();
  describe("authored battle command CSS", () => {
    it("preserves CSS through the public project save and load boundary", () => {
      const project = createBlankProject();
      const css = ".command { color: #123456; border-radius: 8px; }";
      const authored = { ...project, system: { ...project.system, battleCommandCss: css } };
      const restored = deserialize(serialize(authored));
      expect(restored.system).toMatchObject({ battleCommandCss: css });
    });
    it("keeps legacy projects free of overrides", () => {
      expect(deserialize(serialize(createBlankProject())).system.battleCommandCss).toBeUndefined();
    });
    it.each([
      "body { color: red; }", ".command, body { color: red; }",
      "@import 'https://example.com/a.css';", ".command { position: fixed; }",
      ".command { background-color: url(https://example.com); }",
      ".command { color: var(--outside); }", ".command { color: red !important; }",
      ".command { color: red; } </style><script>alert(1)</script>",
      ".command { color: r\\65 d; }", ".command { color: red;",
      "x".repeat(8001),
    ])("rejects CSS outside the menu dialect: %s", (css) => {
      expect(parseBattleCommandCss(css).ok).toBe(false);
    });
    it("accepts colors, focus states and independent blocks", () => {
      expect(parseBattleCommandCss("/* sample */ .command { color: rgba(20, 40, 60, 0.8); } .command:focus-visible { border-color: #abcdef; }")).toMatchObject({
        ok: true, rules: [
          { selector: ".battle-command", declarations: "color: rgba(20, 40, 60, 0.8) !important;" },
          { selector: ".battle-command:focus-visible", declarations: "border-color: #abcdef !important;" },
        ],
      });
    });
    it("rejects non-string persisted CSS at the import boundary", () => {
      const project = createBlankProject();
      expect(() => deserialize(JSON.stringify({ ...project, system: { ...project.system, battleCommandCss: 42 } }))).toThrow();
    });
    it("isolates two mounted menus and removes overrides on reset", () => {
      const window = new Window();
      vi.stubGlobal("document", window.document);
      try {
        const first = document.createElement("section");
        const second = document.createElement("section");
        mountBattleCommandCss(first, ".command { color: #123456; }");
        mountBattleCommandCss(second, ".command { color: #abcdef; }");
        const firstScope = first.dataset.commandCssScope;
        const secondScope = second.dataset.commandCssScope;
        expect(firstScope).not.toBe(secondScope);
        expect(first.querySelector("style")?.textContent).toContain(`[data-command-css-scope="${firstScope}"] .battle-command`);
        expect(second.querySelector("style")?.textContent).not.toContain(firstScope);
        mountBattleCommandCss(first, ".command { color: red; }");
        expect(first.querySelectorAll("style")).toHaveLength(1);
        mountBattleCommandCss(first, "");
        expect(first.querySelectorAll("style")).toHaveLength(0);
        expect(second.querySelectorAll("style")).toHaveLength(1);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });
});

describe("battleReportTurnCount", () => {
  isolateTimers();
  const snapshot = (fields: Partial<BattleSnapshot>) => fields as BattleSnapshot;
  describe("battleRoundCount", () => {
    it("gauge 전투는 파티가 낸 명령 수를 센다", () => {
      expect(battleRoundCount(snapshot({ turn: 1, strictRound: 0, partyCommandRounds: 7 }))).toBe(7);
    });

    it("strict 전투는 완료한 라운드 수를 센다", () => {
      expect(battleRoundCount(snapshot({ turn: 3, strictRound: 3, partyCommandRounds: 4 }))).toBe(3);
    });

    it("명령 수를 남기지 않은 옛 스냅샷은 사이클 수로 되돌아간다", () => {
      expect(battleRoundCount(snapshot({ turn: 2, strictRound: 0 }))).toBe(2);
    });

    it("명령이 하나도 없는 전투도 0턴이 아니라 1턴이다", () => {
      expect(battleRoundCount(snapshot({ turn: 0, strictRound: 0, partyCommandRounds: 0 }))).toBe(1);
    });
  });
});

// 요약 카운터 **밖**의 변경이 사라지지 않는지 — 조수 검토 카드·영수증 카드가 읽는 어휘의 회귀.
//
// 왜 이 테스트가 있나 (실측 2026-09-14): 퀘스트·스토리 플래그·캐릭터·맵 연결·공통 이벤트처럼
// ChangeSummary 에 축이 없는 변경은 검토 카드에서 아무 흔적도 남기지 않았다 — 사용자는
// "적용/버리기" 만 있는 빈 카드로 결정해야 했다.
describe("changeAreas", () => {
  isolateTimers();
  function pair(mutate: (after: Project) => void): { before: Project; after: Project } {
    const before = createBlankProject();
    const after = structuredClone(before) as Project;
    mutate(after);
    return { before, after };
  }
  describe("changedAreaLabels", () => {
    it("카운터가 없는 영역의 변경을 사람 말로 남긴다", () => {
      const { before, after } = pair((project) => {
        project.meta = { ...project.meta, author: "다른 사람" };
        project.startPos = { x: 3, y: 4 };
        project.aiInstructions = "항상 한국어로 답한다";
      });
      // 라벨 표 순서 고정 — 사용자가 매번 같은 자리에서 같은 낱말을 읽는다.
      expect(changedAreaLabels(before, after)).toEqual(["프로젝트 정보", "AI 지시문", "시작 위치"]);
    });

    it("카운터가 이미 세는 영역은 입을 다문다 — 같은 사실을 두 번 말하지 않는다", () => {
      const { before, after } = pair((project) => {
        project.switches = [...project.switches, { id: "switch_1", name: "문 열림" }];
        project.variables = [...project.variables, { id: "var_1", name: "호감도" }];
        project.meta = { ...project.meta }; // 값이 같은 복사는 변경이 아니다.
      });
      expect(changedAreaLabels(before, after)).toEqual([]);
    });

    it("세계관은 엔티티 밖 변경만 이름으로 남긴다", () => {
      const withWorld = (relations: readonly unknown[]): Project => {
        const project = createBlankProject();
        project.world = { entities: [], relations: relations as never };
        return project;
      };
      const before = withWorld([]);

      const entitiesOnly = structuredClone(before) as Project;
      entitiesOnly.world = { entities: [{ id: "e1", name: "달" } as never], relations: [] };
      expect(changedAreaLabels(before, entitiesOnly)).toEqual([]);

      const relationsOnly = structuredClone(before) as Project;
      relationsOnly.world = { entities: [], relations: [{ id: "r1", from: "a", to: "b", kind: "ally" } as never] };
      expect(changedAreaLabels(before, relationsOnly)).toEqual(["세계관 관계"]);
    });

    it("아무것도 안 바뀌면 빈 배열", () => {
      const before = createBlankProject();
      expect(changedAreaLabels(before, structuredClone(before) as Project)).toEqual([]);
    });
  });
  describe("커버리지 — 새 필드는 조용히 사라질 수 없다", () => {
    // Project 인터페이스(src/project/types/project.ts)의 키 전량. 필드를 더하면 여기도 늘리고,
    // `COUNTED_PROJECT_FIELDS` 나 `AREA_LABELS` 중 하나에 **반드시** 넣어라. 둘 다 없으면 그 필드의
    // 변경은 검토 카드·영수증 어디에도 나타나지 않는다.
    const PROJECT_FIELDS = [
      "spatialAuthoring", "growth", "version", "meta", "assets", "resourceProfiles", "tilesets",
      "switches", "variables", "commonEvents", "database", "system", "session", "maps",
      "mapConnections", "villageInfoDocuments", "villageTemplates", "villagePresets",
      "defaultVillagePresetId", "aiDocuments", "aiInstructions", "worldCanon", "world", "worldGraph",
      "factions", "quests", "testPresets", "endings", "storyFlags", "characters", "charsetLabels",
      "audioDescriptions", "monsterMetadata", "mapTree", "startMapId", "startPos", "flags",
    ];

    it("모든 Project 키가 카운터에 있거나 라벨이 있다", () => {
      const uncovered = PROJECT_FIELDS.filter(
        (key) => COUNTED_PROJECT_FIELDS[key] !== true && AREA_LABELS[key] === undefined,
      );
      expect(uncovered).toEqual([]);
    });

    it("기본 프로젝트가 실제로 가진 키도 전부 덮인다", () => {
      const uncovered = Object.keys(createBlankProject()).filter(
        (key) => COUNTED_PROJECT_FIELDS[key] !== true && AREA_LABELS[key] === undefined,
      );
      expect(uncovered).toEqual([]);
    });

    it("라벨 표와 카운터 표는 겹치지 않는다 — 겹치면 어느 쪽도 보고하지 않는다", () => {
      const both = Object.keys(AREA_LABELS).filter((key) => COUNTED_PROJECT_FIELDS[key] === true);
      expect(both).toEqual([]);
    });
  });
});

// 변경 내역(긴 명세) — 큰 위임의 검토는 칩이 아니라 항목별 before → after 로 한다.
//
// 깨질 것(실측 2026-09-14, 감독 지시): "before/after 가 굉장히 긴 명세여야 하는 것 아닌가.
// 보통 맡기는 일이 매우 클텐데" — 지도 그림 두 장과 칩 한 줄로는 위임을 검토할 수 없다.
describe("changeLedger", () => {
  isolateTimers();
  function blank(): { project: Project; mapId: string } {
    const project = createBlankProject();
    return { project, mapId: Object.keys(project.maps)[0]! };
  }
  function clone(project: Project): Project {
    return structuredClone(project) as Project;
  }
  function mapOf(project: Project, mapId: string): GameMap {
    const map = project.maps[mapId];
    if (!map) throw new TypeError(`맵 없음: ${mapId}`);
    return map;
  }
  function event(id: string, name: string, x: number, y: number): GameEvent {
    return { id, name, x, y, trigger: "action", commands: [], pages: [] } as unknown as GameEvent;
  }
  function entryFor(entries: readonly ChangeLedgerEntry[], label: string): ChangeLedgerEntry {
    const entry = entries.find((candidate) => candidate.label === label);
    if (!entry) throw new Error(`항목 없음: ${label} — ${entries.map((candidate) => candidate.label).join(", ")}`);
    return entry;
  }
  function mapLabel(project: Project, mapId: string): string {
    return `${mapOf(project, mapId).name} (${mapId})`;
  }
  describe("buildChangeLedger — 항목별 before → after", () => {
    it("이벤트가 움직이면 영역·이름·좌표 변화가 나온다", () => {
      const { project: before, mapId } = blank();
      mapOf(before, mapId).events = [event("e1", "NPC_가드", 1, 1)];
      const after = clone(before);
      mapOf(after, mapId).events = [event("e1", "NPC_가드", 4, 7)];

      const { entries } = buildChangeLedger(before, after);
      const entry = entryFor(entries, "NPC_가드");

      expect(entry.area).toContain("이벤트 ·");
      expect(entry.change).toBe("changed");
      expect(entry.detail).toEqual(expect.arrayContaining(["X: 1 → 4", "Y: 1 → 7"]));
    });

    it("새 이벤트는 추가로, 지운 이벤트는 삭제로 남는다 — 어느 쪽도 조용히 사라지지 않는다", () => {
      const { project: before, mapId } = blank();
      mapOf(before, mapId).events = [event("e0", "사라진 경비", 2, 2)];
      const after = clone(before);
      mapOf(after, mapId).events = [event("e1", "새 상인", 5, 5)];

      const { entries } = buildChangeLedger(before, after);

      expect(entryFor(entries, "새 상인").change).toBe("added");
      expect(entryFor(entries, "새 상인").detail).toEqual(expect.arrayContaining(["X: 5", "Y: 5"]));
      expect(entryFor(entries, "사라진 경비").change).toBe("removed");
      expect(entryFor(entries, "사라진 경비").detail).toEqual(expect.arrayContaining(["X: 2"]));
    });

    it("퀘스트는 key 가 신원이고 title 이 이름이다", () => {
      const { project: before } = blank();
      const after = clone(before);
      after.quests = [{ key: "quest_bell", title: "종을 되찾아라", summary: "…", steps: [] } as never];

      const quest = entryFor(buildChangeLedger(before, after).entries, "종을 되찾아라");

      expect(quest.area).toBe("퀘스트");
      expect(quest.change).toBe("added");
      expect(quest.detail).toEqual(expect.arrayContaining(["제목: 종을 되찾아라"]));
    });

    it("데이터베이스 레코드의 필드 변화가 값과 함께 나온다", () => {
      const { project: before } = blank();
      before.database = { ...before.database, items: [{ id: "item_1", name: "포션", price: 50 } as never] };
      const after = clone(before);
      after.database = { ...after.database, items: [{ id: "item_1", name: "큰 포션", price: 120 } as never] };

      const item = entryFor(buildChangeLedger(before, after).entries, "큰 포션");

      expect(item.area).toBe("데이터베이스 · 아이템");
      expect(item.detail).toEqual(expect.arrayContaining(["이름: 포션 → 큰 포션", "가격: 50 → 120"]));
    });

    it("맵 타일은 칸 수로 요약한다 — 만 칸짜리 배열을 명세에 쏟지 않는다", () => {
      const { project: before, mapId } = blank();
      const after = clone(before);
      const map = mapOf(after, mapId);
      map.lowerTiles[0] = (map.lowerTiles[0] ?? 0) + 1;
      map.lowerTiles[1] = (map.lowerTiles[1] ?? 0) + 1;

      const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

      expect(detail).toContain("아래층 타일: 2칸 바뀜");
      // 이벤트는 자기 항목이 맡는다 — 맵 항목이 이벤트 목록 전체를 요약하지 않는다.
      expect(detail.some((line) => line.startsWith("이벤트:"))).toBe(false);
    });

    it("맵 이름·인카운터 같은 속성 변화도 이름을 얻는다", () => {
      const { project: before, mapId } = blank();
      const after = clone(before);
      mapOf(after, mapId).name = "달빛 숲";
      mapOf(after, mapId).encounterRate = 12;

      const detail = entryFor(buildChangeLedger(before, after).entries, mapLabel(after, mapId)).detail ?? [];

      expect(detail).toEqual(expect.arrayContaining([`이름: ${summarizeLedgerValue(before.maps[mapId]!.name)} → 달빛 숲`]));
      expect(detail).toEqual(expect.arrayContaining(["인카운터율: 없음 → 12"]));
    });

    it("프로젝트 정보 같은 싱글톤도 필드별로 나온다", () => {
      const { project: before } = blank();
      const after = clone(before);
      after.meta = { ...after.meta, title: "새 게임", author: "나" };

      const meta = entryFor(buildChangeLedger(before, after).entries, "게임 정보");

      expect(meta.area).toBe("프로젝트 정보");
      expect(meta.detail).toEqual(expect.arrayContaining([`제목: ${summarizeLedgerValue(before.meta.title)} → 새 게임`]));
    });

    it("모르는 모양의 필드도 남는다 — 변경이 사라지지 않는다", () => {
      const { project: before } = blank();
      const after = clone(before);
      after.aiInstructions = "항상 한국어로";

      expect(entryFor(buildChangeLedger(before, after).entries, "AI 지시문").after).toBe("항상 한국어로");
    });

    it("아무것도 안 바뀌면 빈 명세", () => {
      const { project: before } = blank();
      const ledger = buildChangeLedger(before, clone(before));
      expect(ledger.entries).toEqual([]);
      expect(ledger.total).toBe(0);
    });

    it("상한을 넘으면 자르되 전체 수를 잃지 않는다", () => {
      const { project: before, mapId } = blank();
      const after = clone(before);
      mapOf(after, mapId).events = Array.from({ length: 12 }, (_, index) => event(`e${index}`, `NPC_${index}`, index, index));

      const ledger = buildChangeLedger(before, after, { maxEntries: 5 });

      expect(ledger.entries).toHaveLength(5);
      expect(ledger.total).toBeGreaterThan(5);
    });
  });
  describe("summarizeLedgerValue", () => {
    it("긴 본문은 잘라 한 줄로 만든다 — 명세가 카드를 삼키지 않게", () => {
      const summary = summarizeLedgerValue("가".repeat(400));
      expect(summary.length).toBeLessThanOrEqual(91);
      expect(summary.endsWith("…")).toBe(true);
    });

    it("빈 값·목록·불리언을 사람이 읽는 말로 바꾼다", () => {
      expect(summarizeLedgerValue(undefined)).toBe("없음");
      expect(summarizeLedgerValue("")).toBe("빈 값");
      expect(summarizeLedgerValue(["a", "b"])).toBe("a, b (2개)");
      expect(summarizeLedgerValue([{ a: 1 }, { b: 2 }])).toBe("2개 항목");
      expect(summarizeLedgerValue(true)).toBe("true");
    });

    it("중첩 개체는 JSON 대신 키 이름으로 — 명세에 소음을 쏟지 않는다", () => {
      expect(summarizeLedgerValue({ hp: "HP", mp: "MP" })).toBe("hp HP, mp MP (2개)");
      expect(summarizeLedgerValue({ pages: [{}, {}], commands: [] })).toBe("pages, commands … (2개 항목)");
      expect(summarizeLedgerValue({})).toBe("빈 값");
    });
  });
});

describe("changeSites", () => {
  isolateTimers();
  function makeMap(id: string, name: string, width: number, height: number): GameMap {
    return {
      id, name, width, height, tilesetId: "ts", tileSize: 16,
      lowerTiles: new Array(width * height).fill(0),
      upperTiles: new Array(width * height).fill(0),
      events: [],
    } as unknown as GameMap;
  }
  function project(maps: Record<string, GameMap>): Project {
    return { maps } as unknown as Project;
  }
  function withTile(map: GameMap, x: number, y: number, tile: number): GameMap {
    const lowerTiles = [...map.lowerTiles];
    lowerTiles[y * map.width + x] = tile;
    return { ...map, lowerTiles };
  }
  function withEvents(map: GameMap, events: readonly { id: string; x: number; y: number }[]): GameMap {
    return { ...map, events: events.map((e) => ({ id: e.id, x: e.x, y: e.y, pages: [] }) as unknown as GameEvent) };
  }
  describe("computeChangeSites", () => {
    it("멀리 떨어진 두 군집은 두 지점, 가까운 변경은 한 지점으로 뭉친다", () => {
      const base = makeMap("m", "시장 마을", 40, 30);
      let next = withTile(base, 5, 5, 9);
      next = withTile(next, 6, 5, 9);
      next = withTile(next, 8, 6, 9); // (6,5) 와 거리 2 — gap 4 안, 같은 지점
      next = withTile(next, 30, 25, 9); // 멀다 — 다른 지점
      const sites = computeChangeSites(project({ m: base }), project({ m: next }));
      expect(sites.length).toBe(2);
      expect(sites[0]!.placeLabel).toBe("(2,2) 10×8"); // (5,5)-(8,6) bbox + pad 3
      expect(sites[0]!.tilesChanged).toBe(3);
      expect(sites[0]!.kind).toBe("tiles");
      expect(sites[1]!.region.x).toBe(27);
      expect(sites[1]!.tilesChanged).toBe(1);
      // 위→아래 정렬
      expect(sites[0]!.region.y).toBeLessThan(sites[1]!.region.y);
    });

    it("이벤트 이동은 출발지와 도착지를 함께 덮고, 추가·삭제·이동을 따로 센다", () => {
      const base = withEvents(makeMap("m", "숲", 40, 30), [
        { id: "npc", x: 10, y: 10 },
        { id: "gone", x: 12, y: 10 },
      ]);
      const next = withEvents(makeMap("m", "숲", 40, 30), [
        { id: "npc", x: 14, y: 10 }, // 이동
        { id: "new", x: 11, y: 11 }, // 추가
      ]);
      const sites = computeChangeSites(project({ m: base }), project({ m: next }));
      expect(sites.length).toBe(1);
      const site = sites[0]!;
      expect(site.kind).toBe("events");
      expect([site.eventsAdded, site.eventsRemoved, site.eventsMoved]).toEqual([1, 1, 1]);
      // 출발지 (10,10) 와 도착지 (14,10) 둘 다 영역 안
      expect(site.region.x).toBeLessThanOrEqual(10 - 3);
      expect(site.region.x + site.region.width).toBeGreaterThan(14);
      expect(site.statsLabel).toBe("이벤트 +1 · 이벤트 −1 · 이벤트 이동 1");
    });

    it("타일과 이벤트가 섞이면 mixed, 지점 없는 맵은 지점을 내지 않는다", () => {
      const base = withEvents(makeMap("a", "마을", 20, 20), []);
      let next = withTile(base, 3, 3, 7);
      next = withEvents(next, [{ id: "e", x: 4, y: 4 }]);
      const untouched = makeMap("b", "그대로", 10, 10);
      const sites = computeChangeSites(project({ a: base, b: untouched }), project({ a: next, b: untouched }));
      expect(sites.length).toBe(1);
      expect(sites[0]!.kind).toBe("mixed");
      expect(sites[0]!.mapName).toBe("마을");
    });

    it("맵 추가·삭제·크기 변경은 전체 맵 지점 하나로 선다", () => {
      const stays = makeMap("stay", "본토", 10, 10);
      const resizedBefore = makeMap("rs", "확장", 10, 10);
      const resizedAfter = makeMap("rs", "확장", 20, 10);
      const added = makeMap("new", "신도시", 8, 8);
      const removed = makeMap("old", "폐허", 6, 6);
      const sites = computeChangeSites(
        project({ stay: stays, rs: resizedBefore, old: removed }),
        project({ stay: stays, rs: resizedAfter, new: added }),
      );
      expect(sites.map((s) => [s.mapId, s.kind])).toEqual([
        ["rs", "map-resized"],
        ["new", "map-added"],
        ["old", "map-removed"],
      ]);
      expect(sites[0]!.statsLabel).toBe("크기 10×10 → 20×10");
      expect(sites[1]!.region).toEqual({ x: 0, y: 0, width: 8, height: 8 });
    });

    it("지점이 상한을 넘으면 gap 을 키워 더 굵게 뭉친다 — 지점을 자르지 않는다", () => {
      const base = makeMap("m", "넓은 맵", 100, 10);
      let next = base;
      const columns = [0, 12, 24, 36, 48, 60, 72, 84, 96]; // 서로 거리 12 — gap 4 로는 9 지점
      for (const x of columns) next = withTile(next, x, 5, 9);
      const sites = computeChangeSites(project({ m: base }), project({ m: next }), { maxSites: 4 });
      expect(sites.length).toBeLessThanOrEqual(4);
      const totalTiles = sites.reduce((acc, s) => acc + s.tilesChanged, 0);
      expect(totalTiles).toBe(columns.length);
    });

    it("변경이 없으면 빈 목록", () => {
      const map = makeMap("m", "정지", 10, 10);
      expect(computeChangeSites(project({ m: map }), project({ m: map }))).toEqual([]);
    });
  });
});
