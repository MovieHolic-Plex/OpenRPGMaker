import { describe, expect, it } from "vitest";
import { measure, countedContent } from "../scripts/fs-scale/score.mjs";
import { MIN_ACT_DEPTH, progressionDepth } from "@/ai/v2/judge/actDepth";
import { actDepthMinBlocker, mapsMinBlocker, editorDefaultsLeft } from "@/ai/v2/judge/shipChecks";
import { createBlankProject } from "@/project/defaults";
import type { Project, GameMap, GameEvent } from "@/project/types";
import { normalizeGameBlueprint } from "@/project/gameBlueprint";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { buildPuzzleChain, type ChainLink } from "@/ai/v2/story/puzzle";
import { walkBlueprint, escapeLeaks } from "@/ai/v2/story/blueprint";
import type { ToolContext } from "@/editor/tools/types";
import { isEscapeBlueprint } from "@/ai/v2/request/scope";
import { countMaps, MIN_COUNTED_MAPS, MIN_MAP_CELLS, MIN_TILE_KINDS, planLinks } from "@/ai/v2/judge/mapCount";
import { splitPreexisting, syncGateItems } from "@/ai/v2/judge/gates";
import { gateProblems } from "@/ai/v2/judge/finishGate";
import { tagged } from "@/ai/v2/judge/finding";
import { TodoStore } from "@/ai/v2/loop/todoStore";
import { runTool } from "@/editor/tools/toolRunner";
import { deserialize, serialize } from "@/project/io";
import { closeVqaUnchanged, noteVqaRound, vqaLedgerLines, vqaUnofferedBlockers, type VqaFinding } from "@/ai/v2/turn/vqaItems";
import { reviewVqaRound, vqaClassify, vqaDefectLine, vqaFixCall, vqaSameDefect, vqaShotPlan, type VqaDefect, type VqaRound } from "@/ai/v2/judge/vqa";
import { isolateTimers } from "./mergedTeardown";

describe("aiV2ActDepth", () => {
  isolateTimers();
  type Doc = Record<string, unknown>;
  const tiles = (n: number, kinds: number, seed = 0) => Array.from({ length: n }, (_, i) => (i % kinds) + seed);
  const say = (body: string) => ({ kind: "text", speaker: "누군가", body });
  const setSwitch = (switchId: string) => ({ kind: "setSwitch", switchId, value: true });
  const event = (id: string, commands: unknown[], conditions: unknown[] = []) => ({
    id, name: id, x: 1, y: 1, trigger: { kind: "action" }, commands: [],
    pages: [{ id: `${id}_p`, conditions, trigger: { kind: "action" }, commands }],
  });
  const gate = (switchId: string) => ({ kind: "switch", switchId, value: true });
  const mapWith = (id: string, events: unknown[], seed = 0, transfer?: string) => ({
    id, name: `맵 ${id}`, width: 12, height: 10, tilesetId: "ts_a",
    lowerTiles: tiles(120, 8, seed), upperTiles: Array(120).fill(-1),
    events: transfer ? [...events, event(`go_${id}`, [{ kind: "transfer", mapId: transfer, x: 1, y: 1 }])] : events,
  });
  const doc = (maps: Record<string, unknown>, extra: Doc = {}): Doc => ({ startMapId: "m1", maps, commonEvents: [], endings: [], quests: [], database: {}, system: {}, meta: {}, ...extra });
  const asProject = (d: Doc, request = "마을과 던전이 있는 모험 게임을 만들어 줘"): Project => {
    const p = createBlankProject() as unknown as Doc;
    Object.assign(p, d, { gameBlueprint: { request, title: "t", genre: "g", premise: "p", playerGoal: "g", steps: [], ending: { name: "e", how: "h", feeling: "f" } } });
    return p as unknown as Project;
  };
  const chain = (n: number): Doc => {
    const evs = Array.from({ length: n }, (_, i) => event(`step${i}`, [say(`단계 ${i} 대사`), setSwitch(`s_${i}`)], i > 0 ? [gate(`s_${i - 1}`)] : []));
    return doc({ m1: mapWith("m1", evs, 0, "m2"), m2: mapWith("m2", [event("far", [say("다른 맵")])], 1) });
  };
  const cases: Record<string, Doc> = {
    "사슬 없음": doc({ m1: mapWith("m1", [event("a", [say("안녕")])]) }),
    "3단계 사슬": chain(3),
    "5단계 사슬": chain(5),
    "8단계 사슬": chain(8),
    "이름만 다른 같은 이벤트": doc({ m1: mapWith("m1", [event("a", [say("같은 대사"), setSwitch("s_0")]), event("b", [say("같은 대사"), setSwitch("s_0")], [gate("s_0")])]) }),
  };
  describe("진행 깊이 — 완성도 척도(score.mjs measure.act_structure)와 같은 값", () => {
    for (const [name, d] of Object.entries(cases)) {
      it(`${name}: 깊이가 척도와 같다`, () => {
        expect(progressionDepth(d as unknown as Project)).toBe((measure(d) as { act_structure: number }).act_structure);
      });
    }
    it("사슬 길이가 곧 깊이다(3·5·8단계)", () => {
      expect(progressionDepth(cases["3단계 사슬"] as unknown as Project)).toBe(2);
      expect(progressionDepth(cases["5단계 사슬"] as unknown as Project)).toBe(4);
      expect(progressionDepth(cases["8단계 사슬"] as unknown as Project)).toBe(7);
    });
  });
  describe("act-depth-min 출하 차단", () => {
    it("깊이가 모자라면 write_blueprint 6~8단계·새 이름·patch_event_page 를 한 문장에 싣는다", () => {
      const [b] = actDepthMinBlocker(asProject(cases["3단계 사슬"]!), "마을과 던전이 있는 모험 게임을 만들어 줘");
      expect(b!.id).toBe("act-depth-min");
      expect(b!.message).toContain(`2/${MIN_ACT_DEPTH}`);
      expect(b!.message).toContain("write_blueprint");
      expect(b!.message).toContain("새 이름");
      expect(b!.message).toContain("patch_event_page");
    });
    it("깊이가 충분하면 차단이 없다", () => {
      expect(actDepthMinBlocker(asProject(cases["8단계 사슬"]!), "마을과 던전이 있는 모험 게임을 만들어 줘")).toEqual([]);
    });
    it("이름만 늘리거나 같은 이벤트를 복사해도 깊이가 늘지 않아 막힌다", () => {
      expect(progressionDepth(cases["이름만 다른 같은 이벤트"] as unknown as Project)).toBeLessThan(MIN_ACT_DEPTH);
      expect(actDepthMinBlocker(asProject(cases["이름만 다른 같은 이벤트"]!), "마을과 던전이 있는 모험 게임을 만들어 줘")).toHaveLength(1);
    });
    it("방탈출·한 장소 게임은 면제다", () => {
      expect(actDepthMinBlocker(asProject(cases["사슬 없음"]!, "방탈출 게임 하나 만들어 줘"), "방탈출 게임 하나 만들어 줘")).toEqual([]);
      expect(actDepthMinBlocker(asProject(cases["사슬 없음"]!, "방 하나만 있는 게임 만들어줘"), "방 하나만 있는 게임 만들어줘")).toEqual([]);
    });
  });
});

describe("aiV2ChainSlots", () => {
  isolateTimers();
  // 2026-11-12 Terra 측정 r1-fun(눈가림 재미 2 — 첫 마을에서 막힘)의 두 원인.
  //  1) 같은 이름의 사슬을 두 번에 나눠 지으면(청사진을 다시 쓰고 경로를 다시 지으면 새 단계만 온다) 고리 스위치 번호가 호출마다 1 부터라
  //     뒤 호출의 첫 사람이 앞 호출 첫 사람의 «집어 감» 스위치를 같이 썼다 — 앞 사람과 말하면 뒤 사람이 «받은 뒤» 대사로 넘어가 길을 여는 스위치를 켜지 않았다.
  //  2) 그 다시 쓰기를 시킨 것은 act-depth-min 관문이었다 — 7단계 경로를 다 지었는데 가운데 단계 하나가 물건으로 넘겨 깊이가 3 으로 재어졌다.
  // 재는 법(모델 없음): /tmp 탐침 chainslot.mts · depthguard.mts 와 같은 호출. 문서 openwiki/assistant-v2.md 「사슬 고리 번호는 고리의 것」.

  const CHAIN = "달샘과 잠든 태양";
  function start(): { ctx: ToolContext; build: (links: ChainLink[]) => ReturnType<typeof buildPuzzleChain> } {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    return { ctx, build: (links) => buildPuzzleChain(createBuildRun(ctx), { mapId: ctx.project.startMapId, name: CHAIN, links }) };
  }
  /** 이벤트마다: 그 이벤트 페이지에 든 고리 몫 스위치·변수(집어 감 · 풀림 · 문 열림 · 입력한 번호 · 틀린 횟수). */
  function perLinkIds(project: Project): Map<string, string[]> {
    const out = new Map<string, string[]>();
    for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
      const ids = [...new Set([...JSON.stringify(ev.pages ?? []).matchAll(/"((?:sw_[a-z0-9]+_(?:taken|door_open|[a-z0-9_]+_solved)|var_[a-z0-9]+)_\d+(?:_wrong)?)"/gu)].map((hit) => hit[1]!))];
      if (ids.length) out.set(String((ev as { name?: string }).name ?? ev.id), ids);
    }
    return out;
  }
  const shared = (ids: Map<string, string[]>): string[] => {
    const owners = new Map<string, string[]>();
    for (const [name, list] of ids) for (const id of list) owners.set(id, [...(owners.get(id) ?? []), name]);
    return [...owners].filter(([, names]) => names.length > 1).map(([id, names]) => `${id} ← ${names.join(" + ")}`);
  };
  describe("사슬 고리의 스위치·변수 번호는 호출 순번이 아니라 그 고리의 것", () => {
    it("같은 이름의 사슬을 두 번에 나눠 지어도 두 고리가 같은 «집어 감» 스위치·같은 번호 변수를 쓰지 않는다", () => {
      const { ctx, build } = start();
      expect(build([
        { role: "pickup", name: "나디아", person: "마을 사람", at: { x: 3, y: 3 }, lines: ["샘지기를 찾아가 보렴."], reward: { flag: "나디아의 부탁" } },
        { role: "code", name: "낡은 궤", at: { x: 5, y: 3 }, code: "4826", needs: "나디아의 부탁", lines: ["번호 자물쇠다."], hintAfter: 2, hintLines: ["(일지를 다시 보자.)"], reward: { flag: "궤 열림" } },
      ]).ok).toBe(true);
      expect(build([
        { role: "pickup", name: "샘지기 아말", person: "마을 사람", at: { x: 3, y: 6 }, lines: ["길을 열어 주마."], reward: { flag: "샘지기의 허락" } },
        { role: "code", name: "돌문 자물쇠", at: { x: 5, y: 6 }, code: "7315", needs: "샘지기의 허락", lines: ["번호 자물쇠다."], hintAfter: 2, hintLines: ["(샘지기의 말을 떠올리자.)"], reward: { flag: "돌문 열림" } },
      ]).ok).toBe(true);
      const ids = perLinkIds(ctx.project);
      expect([...ids.keys()].sort()).toEqual(["나디아", "낡은 궤", "돌문 자물쇠", "샘지기 아말"].sort());
      expect(shared(ids)).toEqual([]);
      // 첫 호출의 번호는 그대로다(1, 2) — 처음 짓는 사슬의 결과는 바뀌지 않는다.
      expect(ids.get("나디아")!.every((id) => /_1$/u.test(id))).toBe(true);
      expect(ids.get("낡은 궤")!.every((id) => /_2(?:_wrong)?$/u.test(id))).toBe(true);
    });

    it("한 고리만 다시 지으면 그 고리가 쓰던 번호를 그대로 쓴다", () => {
      const { ctx, build } = start();
      build([
        { role: "pickup", name: "나디아", person: "마을 사람", at: { x: 3, y: 3 }, lines: ["샘지기를 찾아가 보렴."], reward: { flag: "나디아의 부탁" } },
        { role: "pickup", name: "자히르", person: "상인", at: { x: 5, y: 3 }, lines: ["찻집으로 가 봐."], needs: "나디아의 부탁", reward: { flag: "상인의 단서" } },
      ]);
      build([{ role: "pickup", name: "샘지기 아말", person: "마을 사람", at: { x: 3, y: 6 }, lines: ["길을 열어 주마."], reward: { flag: "샘지기의 허락" } }]);
      const before = perLinkIds(ctx.project).get("샘지기 아말");
      expect(build([{ role: "pickup", name: "샘지기 아말", lines: ["길을 열어 주마. 조심하렴."], reward: { flag: "샘지기의 허락" } }]).ok).toBe(true);
      const after = perLinkIds(ctx.project);
      expect(after.get("샘지기 아말")).toEqual(before);
      expect(shared(after)).toEqual([]);
    });
  });
  describe("act-depth-min: 청사진 경로가 이미 길고 이어져 있으면 «다시 써라» 를 올리지 않는다", () => {
    const task = "사막 오아시스 모험 게임 하나 만들어 줘.";
    const names = ["나디아", "자히르", "라일라", "파리드", "사미라", "모래의 파수꾼", "잠든 왕의 수호자"];
    const gives = ["샘의 부탁", "상인의 단서", "라일라의 약속", "대상의 신뢰", "왕실의 진실", "열린 피라미드", "달샘의 귀환"];
    function game(steps: number, itemAt: number): Project {
      const { ctx, build } = start();
      const used = names.slice(0, steps);
      const built = build(used.map((name, i): ChainLink => ({
        role: i === steps - 1 ? "ending" : "pickup", name, person: "마을 사람", at: { x: 2 + i * 2, y: 4 }, lines: [`${name}의 말.`],
        ...(i ? { needs: gives[i - 1]! } : {}), ...(i === steps - 1 ? {} : { reward: i === itemAt ? { item: gives[i]! } : { flag: gives[i]! } }),
      })));
      expect(built.ok).toBe(true);
      const project = ctx.project;
      const place = project.maps[project.startMapId]!.name || project.startMapId;
      project.gameBlueprint = normalizeGameBlueprint({
        title: CHAIN, genre: "모험", playerGoal: "샘을 되살리자.", ending: { name: CHAIN, how: "물이 돌아왔다.", feeling: "안도" },
        steps: used.map((name, i) => ({ id: `s${i + 1}`, kind: "talk", who: name, place, event: name, action: `${name}에게 말을 건다`, ...(i ? { needs: gives[i - 1] } : {}), gives: gives[i], feeling: "설렘" })),
      });
      return project;
    }

    it("7단계 경로(가운데 한 단계가 물건을 준다)를 다 지은 판: 깊이는 모자라게 재어져도 관문은 서지 않는다", () => {
      const project = game(7, 2);
      expect(walkBlueprint(project).blockers).toEqual([]);
      expect(progressionDepth(project)).toBeLessThan(MIN_ACT_DEPTH);
      expect(actDepthMinBlocker(project, task)).toEqual([]);
    });

    it("청사진이 짧으면(4단계) 종전대로 선다", () => {
      const project = game(4, -1);
      expect(actDepthMinBlocker(project, task).map((b) => b.id)).toEqual(["act-depth-min"]);
    });

    it("청사진은 길어도 경로가 끊겨 있으면(단계 이벤트가 없다) 종전대로 선다", () => {
      const project = game(7, -1);
      const map = project.maps[project.startMapId]!;
      map.events = map.events.filter((ev) => (ev as { name?: string }).name !== "파리드");
      expect(walkBlueprint(project).blockers.length).toBeGreaterThan(0);
      expect(actDepthMinBlocker(project, task).map((b) => b.id)).toEqual(["act-depth-min"]);
    });
  });
});

describe("aiV2EscapeScope", () => {
  isolateTimers();
  // 2026-11-10 link 측정 forest-0001: «무서운 숲에서 탈출하는 게임» 이 갇힌 방 게임으로 판정돼, build_blueprint_path 의 sealEscapeExits 가
  // 모델이 막 create_transfer_pair 로 만든 출구(시작 맵 → 새벽 숲 가장자리)를 «조건 없이 나가는 이동» 으로 지웠다(세는 맵 1/4).
  // 갇힌 방 판정은 닫힌 공간 낱말이 있을 때만 «탈출» 을 센다. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

  const bp = (playerGoal: string, request: string, endingName = "끝", how = "") => ({ playerGoal, request, ending: { name: endingName, how } }) as never;
  describe("갇힌 방 게임 판정 — «탈출» 단독은 방탈출이 아니다", () => {
    it("열린 맵 게임(숲·성·학교에서 탈출)은 갇힌 방이 아니다", () => {
      expect(isEscapeBlueprint(bp("무서운 숲에서 표식과 등불을 찾아 길을 밝히고 숲의 출구로 탈출하자.", "무서운 숲에서 탈출하는 게임 만들어줘"))).toBe(false);
      expect(isEscapeBlueprint(bp("성에 숨어 들어가 비밀 문서를 훔치고 성 외곽으로 탈출하자.", "닌자 게임 만들어줘"))).toBe(false);
      expect(isEscapeBlueprint(bp("그림자 성에 잠입해 기밀 문서를 훔치고 무사히 탈출하자.", "닌자", "그림자 속 탈출"))).toBe(false);
      expect(isEscapeBlueprint(bp("밤의 학교에서 귀신을 피해 탈출하자", "학교 공포 게임"))).toBe(false);
    });
    it("방향·방법 같은 낱말 속 «방» 은 닫힌 공간이 아니다", () => {
      expect(isEscapeBlueprint(bp("방향을 찾아 숲을 탈출하자", "숲 게임"))).toBe(false);
      expect(isEscapeBlueprint(bp("나가는 방법을 찾아 탈출하자", "숲 게임"))).toBe(false);
    });
    it("방탈출·밀실·갇힌·감옥 탈출은 갇힌 방 게임이다", () => {
      expect(isEscapeBlueprint(bp("서재를 탈출하자", "방탈출 게임 하나 만들어 줘"))).toBe(true);
      expect(isEscapeBlueprint(bp("밀실에서 나가자", "밀실 추리"))).toBe(true);
      expect(isEscapeBlueprint(bp("갇힌 저택에서 나가자", "저택 게임"))).toBe(true);
      expect(isEscapeBlueprint(bp("잠긴 방에서 탈출하자", "방에서 탈출하는 게임"))).toBe(true);
      expect(isEscapeBlueprint(bp("감옥에서 탈출한다", "감옥 탈출 게임"))).toBe(true);
    });
    it("갇힌 공주·감옥 동료 구출 같은 열린 맵 이야기는 갇힌 방이 아니다", () => {
      expect(isEscapeBlueprint(bp("마왕성에 갇힌 공주를 구하자", "공주를 구하는 모험 게임"))).toBe(false);
      expect(isEscapeBlueprint(bp("감옥에서 동료를 구출하자", "구출 게임"))).toBe(false);
    });
  });
  function projectWithExit(request: string, goal: string): Project {
    const p = createBlankProject() as Project;
    const start = p.maps[p.startMapId]!;
    const other = JSON.parse(JSON.stringify(start)) as GameMap;
    other.id = "map_edge"; other.name = "새벽 숲 가장자리"; other.events = [];
    p.maps.map_edge = other;
    start.name = "무서운 숲";
    start.events = [{ id: "door", name: "door", x: 5, y: 5, trigger: { kind: "touch" }, commands: [], pages: [{ id: "p", conditions: [], trigger: { kind: "touch" }, commands: [{ kind: "transfer", mapId: "map_edge", x: 2, y: 2 }] }] } as never];
    p.gameBlueprint = { request, title: "t", genre: "g", premise: "x", playerGoal: goal, steps: [{ id: "s1", place: "무서운 숲", event: "e", does: "d" }], ending: { name: "끝", how: "z", feeling: "w" } } as never;
    return p;
  }
  describe("조건 없이 나가는 문 — 방탈출만 막는다", () => {
    it("숲에서 탈출 게임에서는 시작 맵의 출구를 누수로 세지 않는다", () => {
      expect(escapeLeaks(projectWithExit("무서운 숲에서 탈출하는 게임 만들어줘", "숲의 출구로 탈출하자"))).toEqual([]);
    });
    it("방탈출 게임에서는 같은 출구를 누수로 센다(기존 동작 유지)", () => {
      const leaks = escapeLeaks(projectWithExit("방탈출 게임 만들어줘", "방을 탈출하자"));
      expect(leaks.map((l) => l.toMapId)).toEqual(["map_edge"]);
    });
  });
  describe("맵 최소와 갇힌 방 판정이 같은 편이다", () => {
    it("«감옥에서 탈출» 청사진은 맵 최소 1장만 요구한다(문을 지우는 쪽과 반대로 작동하지 않는다)", () => {
      const p = projectWithExit("감옥 탈출 게임", "감옥에서 탈출한다");
      expect(mapsMinBlocker(p, "감옥 탈출 게임을 만들어 줘")[0]?.message).toContain("/1장");
    });
    it("«숲에서 탈출» 청사진은 맵 최소(현재 6장)를 그대로 요구한다", () => {
      const p = projectWithExit("무서운 숲에서 탈출하는 게임 만들어줘", "숲에서 탈출한다");
      expect(mapsMinBlocker(p, "숲 탈출 게임을 만들어 줘")[0]?.message).toContain("/6장");
    });
  });
});

describe("aiV2MapCount", () => {
  isolateTimers();
  // 2026-11-10 오너 「맵을 가장 우선」: 끝맺음 관문이 세는 맵 6장을 강제한다(4 → 6, 한 번에 한 단계). 맵을 세는 규칙은 완성도 척도(scripts/fs-scale/score.mjs)와 같아야 하고,
  // 못 센 맵은 이유와 함께 문구에 실린다. 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

  type Doc = Record<string, unknown>;
  const tiles = (n: number, kinds: number, seed = 0) => Array.from({ length: n }, (_, i) => (i % kinds) + seed);
  function event(id: string, commands: unknown[]) {
    return { id, name: id, x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{ id: `${id}_p`, conditions: [], trigger: { kind: "action" }, commands }] };
  }
  const transferTo = (mapId: string) => ({ kind: "transfer", mapId, x: 1, y: 1 });
  const say = (body: string) => ({ kind: "text", speaker: "누군가", body });
  function map(id: string, opts: { w?: number; h?: number; kinds?: number; seed?: number; events?: unknown[] } = {}) {
    const w = opts.w ?? 12, h = opts.h ?? 10;
    return { id, name: `맵 ${id}`, width: w, height: h, tilesetId: "ts_a", lowerTiles: tiles(w * h, opts.kinds ?? 8, opts.seed ?? 0), upperTiles: Array(w * h).fill(-1), events: opts.events ?? [event(`ev_${id}`, [say(`안녕 ${id}`)])] };
  }
  function doc(maps: Record<string, unknown>, extra: Doc = {}): Doc {
    return { startMapId: "m1", maps, commonEvents: [], endings: [], quests: [], database: {}, system: {}, meta: {}, ...extra };
  }
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();
  const cases: Record<string, Doc> = {
    "시작 맵 하나": doc({ m1: map("m1") }),
    "문으로 이어진 네 장": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")]), event("b", [say("x")])] }), m2: map("m2", { seed: 1, events: [event("c", [transferTo("m3")]), event("d", [say("y")])] }), m3: map("m3", { seed: 2, events: [event("e", [transferTo("m4")]), event("f", [say("z")])] }), m4: map("m4", { seed: 3 }) }),
    "문으로 이어진 여섯 장": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")]), event("b", [say("x")])] }), m2: map("m2", { seed: 1, events: [event("c", [transferTo("m3")]), event("d", [say("y")])] }), m3: map("m3", { seed: 2, events: [event("e", [transferTo("m4")]), event("f", [say("z")])] }), m4: map("m4", { seed: 3, events: [event("g", [transferTo("m5")]), event("h", [say("w")])] }), m5: map("m5", { seed: 4, events: [event("i", [transferTo("m6")]), event("j", [say("v")])] }), m6: map("m6", { seed: 5 }) }),
    "문이 없어 안 닿는 맵": doc({ m1: map("m1"), m2: map("m2", { seed: 1 }) }),
    "넓이 모자란 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { w: 9, h: 8, seed: 1 }) }),
    "타일 종류 모자란 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { kinds: 3, seed: 1 }) }),
    "명령 든 이벤트 없는 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { seed: 1, events: [event("e", [])] }) }),
    "배치를 복사한 맵": doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: map("m2", { events: [event("b", [say("복사")])] }) }),
  };
  describe("세는 맵 — 완성도 척도(score.mjs countedContent)와 같은 규칙", () => {
    for (const [name, d] of Object.entries(cases)) {
      it(`${name}: 센 맵 집합이 척도와 같다`, () => {
        expect(ids(countMaps(d as unknown as Project).counted.map((id) => ({ id })))).toEqual(ids(countedContent(d).countedMaps));
      });
    }
    it("못 센 맵은 이유와 함께 나온다(안 닿음·좁음·타일 적음·이벤트 없음·복사)", () => {
      const reasons = (d: Doc) => countMaps(d as unknown as Project).uncounted.map((m) => m.reason);
      expect(reasons(cases["문이 없어 안 닿는 맵"]!)).toEqual(["unreachable"]);
      expect(reasons(cases["넓이 모자란 맵"]!)).toEqual(["small"]);
      expect(reasons(cases["타일 종류 모자란 맵"]!)).toEqual(["few-tiles"]);
      expect(reasons(cases["명령 든 이벤트 없는 맵"]!)).toEqual(["no-event"]);
      expect(reasons(cases["배치를 복사한 맵"]!)).toEqual(["copy"]);
      expect(MIN_MAP_CELLS).toBe(100); expect(MIN_TILE_KINDS).toBe(6);
    });
  });
  describe("maps-min 출하 차단", () => {
    const whole = "포켓몬 같은 몬스터 수집 모험 게임 만들어줘";
    const asProject = (d: Doc, request = whole): Project => { const p = createBlankProject() as unknown as Doc; Object.assign(p, d, { gameBlueprint: { request, title: "t", genre: "g", premise: "p", playerGoal: "g", steps: [], ending: { name: "e", how: "h", feeling: "f" } } }); return p as unknown as Project; };
    it("세는 맵이 모자라면 장수·부족분·못 센 이유·make_place 를 한 문장에 싣는다", () => {
      const [b] = mapsMinBlocker(asProject(cases["넓이 모자란 맵"]!), whole);
      expect(b!.id).toBe("maps-min");
      expect(b!.message).toContain(`1/${MIN_COUNTED_MAPS}장`);
      expect(b!.message).toContain(`${MIN_COUNTED_MAPS - 1}장 더`);
      expect(b!.message).toContain("넓이 72칸<100");
      expect(b!.message).toContain("make_place");
    });
    it("세는 맵이 최소 수 이상이면 차단이 없다", () => {
      expect(mapsMinBlocker(asProject(cases["문으로 이어진 여섯 장"]!), whole)).toEqual([]);
    });
    it("네 장은 더 이상 통과하지 않는다 — 최소 6장(오너 「맵을 가장 우선」, 4 에서 한 단계 올림)", () => {
      expect(MIN_COUNTED_MAPS).toBe(6);
      const [b] = mapsMinBlocker(asProject(cases["문으로 이어진 네 장"]!), whole);
      expect(b!.message).toContain("4/6장");
      expect(b!.message).toContain("2장 더");
    });
    it("방 하나짜리 게임(방탈출)은 한 장이면 통과한다", () => {
      expect(mapsMinBlocker(asProject(cases["시작 맵 하나"]!, "방 하나만 있는 방탈출 게임 만들어줘"), "방 하나만 있는 방탈출 게임 만들어줘")).toEqual([]);
    });
    it("안 세는 맵 이름이 달라도 할 일 항목의 열쇠(문구 앞 160자, 숫자는 #)는 같다 — 3번 뒤 막힘이 걸리려면 열쇠가 안정해야 한다", () => {
      const key = (text: string) => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);
      const named = (name: string): Doc => doc({ m1: map("m1", { events: [event("a", [transferTo("m2")])] }), m2: { ...map("m2", { w: 9, h: 8, seed: 1 }), name } });
      const [x] = mapsMinBlocker(asProject(named("창고")), whole), [y] = mapsMinBlocker(asProject(named("지하 통로의 아주 긴 이름")), whole);
      expect(key(`[출하 차단 ${x!.id}] ${x!.message}`)).toBe(key(`[출하 차단 ${y!.id}] ${y!.message}`));
      expect(x!.message).toContain("창고");
      expect(y!.message).toContain("지하 통로");
    });
    it("이어 하는 턴에서도 «기존 결함» 으로 면제되지 않는다(시작 저장본에 이미 있어도 이번 턴이 끝낼 일)", () => {
      const problem = gateProblems([tagged("ship", "maps-min", "세는 맵이 1/6장이다 — 5장 더.")])[0]!;
      const { current, preexisting } = splitPreexisting([problem], new Set([problem.textKey!]), undefined, undefined);
      expect(current).toHaveLength(1);
      expect(preexisting).toHaveLength(0);
    });
  });
});

describe("aiV2MapLink", () => {
  isolateTimers();
  // 2026-11-10 forest-0039(6장 작성)·ninja-0038(4장 작성)이 세는 맵 1/4: 만든 맵이 시작 맵에서 문으로 안 닿았다.
  // 안 닿는 맵 무리가 있으면 맵 관문이 이을 호출(create_transfer_pair)을 문구 맨 끝에 싣고 syncGateItems 가 항목의 다음 호출로 넘긴다.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

  const whole = "마을과 던전이 있는 모험 게임을 만들어 줘";
  /** verbs.ts gameProblemTexts 가 출하 차단 줄에 붙이는 꼬리 문장 — 호출은 문구 맨 끝이 아니다. */
  const gateText = (message: string): string => `[출하 차단 maps-min] ${message} 고치지 못하면 «완성»이라고 쓰지 말고 남은 기본값으로 보고한다.`;
  /**
   * 말 거는 이벤트 하나 — 실제 프로젝트에 있을 수 있는 온전한 페이지로 만든다(name · graphic · priority · movement 포함).
   * 이 칸들이 빠진 페이지는 저장본 읽기(deserialize)가 받지 않고 upsert_event 가 채워 넣으므로 프로젝트 안에 생기지 않는다 —
   * 형을 속여(as never) 빠진 채 넣으면 도구 커밋의 린트가 page.movement.type 을 읽다 죽는다(이 시험이 #4486 부터 빨갛던 까닭).
   */
  function talkEvent(id: string, x: number, y: number, pageId: string): GameEvent {
    return {
      id, name: id, x, y, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: pageId, name: id, conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "text", speaker: "누군가", body: "안녕" }],
      }],
    };
  }
  /** createBlankProject 의 시작 맵을 복제해 한 장 더 만든다 — 같은 배치는 «복사» 라 못 세므로 타일 하나를 바꿔 다르게 한다. */
  function cloneMap(project: Project, from: GameMap, id: string, tweak: number): GameMap {
    const copy = JSON.parse(JSON.stringify(from)) as GameMap;
    copy.id = id;
    copy.name = `맵 ${id}`;
    copy.events = [talkEvent(`${id}_talk`, 2, 2, `${id}_p`)];
    copy.lowerTiles = copy.lowerTiles.map((tile, index) => (index === tweak ? (tile === 0 ? 1 : 0) : tile));
    project.maps[id] = copy;
    return copy;
  }
  function isolatedProject(isolated: number): Project {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    start.events = start.events.filter((event) => !JSON.stringify(event).includes('"transfer"'));
    start.events.push(talkEvent("start_talk", 3, 3, "p"));
    for (let i = 0; i < isolated; i += 1) cloneMap(project, start, `iso_${i}`, 5 + i);
    return project;
  }
  describe("안 닿는 맵 무리 — 이을 호출", () => {
    it("시작 맵에서 안 닿는 맵이 있으면 무리와 이을 곳(시작 맵의 빈 바닥 칸)을 계획한다", () => {
      const project = isolatedProject(2);
      const plan = planLinks(project);
      expect(plan.groups.length).toBeGreaterThan(0);
      expect(plan.from?.mapId).toBe(project.startMapId);
      expect(plan.groups.every((group) => group.cell)).toBe(true);
      expect(plan.from!.cell).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    });

    it("맵 관문 문구 맨 끝에 create_transfer_pair 호출이 있고, 열쇠(앞 160자)에는 안 들어간다", () => {
      const [blocker] = mapsMinBlocker(isolatedProject(2), whole);
      expect(blocker!.id).toBe("maps-min");
      expect(blocker!.message).toMatch(/ Next call: create_transfer_pair\(\{"a":\{"mapId":"[^"]+","x":\d+,"y":\d+\},"b":\{"mapId":"iso_\d","x":\d+,"y":\d+\}\}\)$/u);
      const key = (text: string) => text.replace(/\d+/gu, "#").replace(/\s+/gu, " ").trim().slice(0, 160);
      expect(key(`[출하 차단 maps-min] ${blocker!.message}`)).not.toContain("Next call");
      expect(key(`[출하 차단 maps-min] ${blocker!.message}`)).not.toContain("iso_");
    });

    it("syncGateItems 를 거치면 항목 내용(220자 절단)에는 호출이 없어도 meta.nextCall 이 그 호출이다", () => {
      const [blocker] = mapsMinBlocker(isolatedProject(2), whole);
      const store = new TodoStore();
      const text = gateText(blocker!.message);
      const { opened } = syncGateItems(store, [{ key: "game:" + text.replace(/\d+/gu, "#").slice(0, 160), text, source: "gate" }], new Set(), new Set(["create_transfer_pair"]));
      expect(opened).toHaveLength(1);
      expect(opened[0]!.content).not.toContain("Next call");
      const next = store.meta.get(opened[0]!.id)?.nextCall;
      expect(next?.verb).toBe("create_transfer_pair");
      expect(JSON.parse(/\((\{.*\})\)$/u.exec(next!.text)![1]!)).toMatchObject({ a: { mapId: expect.any(String) }, b: { mapId: expect.stringMatching(/^iso_/u) } });
    });

    it("그 호출을 실제 도구로 실행하면 닿는 맵이 늘어난다(도구가 받아들이는 좌표인 증거)", () => {
      const ctx: ToolContext = { project: isolatedProject(2) };
      // 시험이 만든 프로젝트는 저장본으로 읽히는 것이어야 한다 — 읽히지 않는 모양으로는 도구가 무엇을 받아들이는지 증명하지 못한다.
      expect(() => deserialize(serialize(ctx.project))).not.toThrow();
      const before = countMaps(ctx.project);
      const [blocker] = mapsMinBlocker(ctx.project, whole);
      const call = /Next call: (\w+)\((\{.*\})\)\s*$/u.exec(blocker!.message)!;
      const result = runTool(ctx, call[1]!, JSON.parse(call[2]!) as Record<string, unknown>);
      expect(result.ok, result.summary).toBe(true);
      const after = countMaps(ctx.project);
      expect(after.uncounted.filter((u) => u.reason === "unreachable").length).toBeLessThan(before.uncounted.filter((u) => u.reason === "unreachable").length);
      expect(() => deserialize(serialize(ctx.project))).not.toThrow(); // 도구가 만든 문 이벤트까지 담고도 읽힌다
    });

    it("안 닿는 맵이 없으면(작거나 이벤트가 없어 못 센 경우) 호출을 싣지 않는다", () => {
      const project = createBlankProject();
      const [blocker] = mapsMinBlocker(project, whole);
      expect(blocker!.message).not.toContain("Next call");
    });
  });
});

// 화면 검수 판정 규칙(2026-11-11 J-B2): 같은 결함 가르기 · 항목 열쇠 · 급(막음/다듬기) · 자동 오프닝 · 찍을 자리.
// 결함 글은 Terra 판 기록(jrpg-w3 · fun-w3, 2026-11-10)에서 그대로 가져왔다.
describe("aiV2VqaJudge", () => {
  isolateTimers();
  const START_WHERE = "맵 «별샘 오아시스» (44×36칸 · 시작 맵 · 주인공은 게임에서만 그려짐, 시작 칸 19,35)";
  const onMap = (ref: string, what: string, severity: VqaDefect["severity"] = "polish", where = `맵 «${ref}» (20×15칸) · 어딘가`): VqaDefect => ({ where, what, severity, target: { kind: "map", ref } });
  const onOpening = (ref: string, what: string, severity: VqaDefect["severity"] = "blocker"): VqaDefect => ({ where: "오프닝 1/4 (애니메틱 시작·중간·끝) · 세 컷 전체", what, severity, target: { kind: "opening", ref } });
  const round = (n: number, defects: VqaDefect[], shots: VqaRound["shots"] = [{ where: "", kind: "map", ref: "tomb" }, { where: "", kind: "map", ref: "start" }, { where: "", kind: "map", ref: "lake" }, { where: "", kind: "map", ref: "hall" }]): VqaRound => ({ round: n, shots, defects, ms: 0, reviewer: "test" });
  describe("vqaSameDefect — the defect itself, not the location prefix", () => {
    const same: [string, string][] = [
      ["애니메틱 세 컷 중 한 칸이 아무것도 없는 짙은 남색 빈 블록으로 남아 있어 미완성처럼 보인다.", "애니메틱 세 컷 중 한 칸이 아무것도 없는 짙은 남색 빈 블록으로 그대로 남아 있어 미완성처럼 보인다."],
      ["붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다."],
      ["피라미드 맵의 대부분이 빈 모래 바닥이고 상호작용할 만한 오브젝트가 드물다.", "맵의 상당 부분이 빈 모래 바닥이고 상호작용할 만한 오브젝트가 드물다."],
      ["긴 집 내부의 하단 절반이 가구 없이 빈 나무 바닥으로 남아 있어 족장의 방으로는 휑하다.", "긴 집 내부의 하단 절반이 가구 없이 빈 나무 바닥이라 족장의 방으로는 휑하다."],
      ["인물이 벽난로 옆 벽 타일 줄에 걸쳐 서 있는 것처럼 보여, 벽이나 벽난로에 겹쳐 박힌 배치로 읽힌다.", "인물이 벽난로 옆 벽 타일 줄에 걸쳐 서 있어 벽이나 벽난로에 겹친 배치로 보인다."],
      ["호수가 나무 윤곽처럼 이상하게 생겼고, 길이 호수 한가운데로 줄기처럼 끊겨 들어가 어색하다.", "호수가 나무 윤곽처럼 어색한 모양이고 길이 호수 한가운데로 줄기처럼 끊겨 들어가며, 얼음 한복판에 집 두 채가 놓여 있어 부자연스럽다."],
    ];
    const different: [string, string][] = [
      ["붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다."],
      ["시작 칸 19,35가 맵 이미지 범위(약 30×25칸) 밖이라 주인공이 맵 바깥에서 시작하게 되어 게임을 시작할 수 없다.", "왼쪽 길이 위쪽 건물에 막혀 끝나 어디로도 이어지지 않는 막다른 길이다."],
      ["인물이 벽난로 옆 벽 타일 줄에 걸쳐 서 있는 것처럼 보여, 벽이나 벽난로에 겹쳐 박힌 배치로 읽힌다.", "상자가 어두운 바깥 벽 테두리에 붙어 잘린 것처럼 놓여 있어 방 안쪽 바닥 위의 가구로 보이지 않는다."],
      ["방이 작은데도 왼쪽 아래 절반이 빈 타일 바닥에 항아리 하나뿐이라 휑하다.", "탁자, 방석, 카펫이 서로 겹쳐 배치되어 가구 층이 뒤엉켜 보인다."],
      ["오두막 두 채가 얼음 위에 놓여 있고 호수 모양이 나무 같은 덩어리 형태여서, 얼음낚시 구멍과 함께 배치가 어색하다.", "배가 물이나 얼음 위가 아니라 호수 바깥 눈밭과 나무 사이에 놓여 있어 배치가 어색하다."],
      ["붉은 점무늬 디더링 오버레이가 장면을 거의 가려 낙타와 건물이 알아보기 어렵다.", "애니메틱 세 컷 중 한 칸이 아무것도 없는 짙은 남색 빈 블록으로 남아 있어 미완성처럼 보인다."],
    ];
    it.each(same)("same defect reworded: %s", (a, b) => {
      expect(vqaSameDefect(onMap("m", a, "polish", `${START_WHERE} · 위쪽`), onMap("m", b, "blocker", `${START_WHERE} · 오른쪽 아래`))).toBe(true);
    });
    it.each(different)("different defects on the same map with the same location prefix: %s", (a, b) => {
      expect(vqaSameDefect(onMap("m", a, "polish", `${START_WHERE} · 시작 칸 19,35 (맵 전체)`), onMap("m", b, "polish", `${START_WHERE} · 시작 칸 19,35 (맵 전체)`))).toBe(false);
    });
    it("the same words on another target are another defect (opening 1/4 vs 4/4)", () => {
      const what = "오프닝 컷 구성에 빈 남색 블록이 그대로 노출되어 있다.";
      expect(vqaSameDefect(onOpening("scene-1", what), onOpening("scene-4", what))).toBe(false);
      expect(vqaSameDefect(onOpening("scene-1", what), onOpening("scene-1", what))).toBe(true);
    });
  });
  function gameProject(): Project {
    const p = createBlankProject() as Project;
    const start = p.maps[p.startMapId]!;
    start.name = "별샘 오아시스";
    p.startPos = { x: 3, y: 4 } as Project["startPos"];
    p.system.opening = {
      enabled: true, skippable: true,
      scenes: [
        { id: "bp-open-1", kind: "animatic", narration: "", durationMs: 4000, composition: { width: 384, height: 216, layers: [] } },
        { id: "mine-1", kind: "animatic", narration: "", durationMs: 4000, composition: { width: 384, height: 216, layers: [] } },
      ],
    } as never;
    return p;
  }
  describe("vqaShotPlan", () => {
    it("gives every map shot its size in cells and every animatic shot its own target", () => {
      const p = gameProject();
      const start = p.maps[p.startMapId]!;
      const plan = vqaShotPlan(p, new Set());
      const map = plan.find((s) => s.kind === "map" && s.ref === p.startMapId)!;
      expect(map.where).toContain(`${start.width}×${start.height}칸`);
      expect(map.where).toContain("시작 칸 3,4");
      expect(plan.filter((s) => s.kind === "opening").map((s) => s.ref)).toEqual(["mine-1", "bp-open-1"]);
    });
    it("puts auto-built map-crop opening shots after the maps", () => {
      const plan = vqaShotPlan(gameProject(), new Set());
      expect(plan.findIndex((s) => s.ref === "bp-open-1")).toBeGreaterThan(plan.findIndex((s) => s.kind === "map"));
      expect(plan.findIndex((s) => s.ref === "mine-1")).toBeLessThan(plan.findIndex((s) => s.kind === "map"));
    });
    it("photographs the staged opening around its cell", () => {
      const p = gameProject();
      const start = p.maps[p.startMapId]!;
      p.system.opening!.stage = { mapId: start.id, x: 2, y: 2, eventId: "ev_opening_stage" };
      const stage = vqaShotPlan(p, new Set()).find((s) => s.region)!;
      expect(stage.kind).toBe("opening");
      expect(stage.ref).toBe(`stage:${start.id}:ev_opening_stage`);
      expect(stage.region!.mapId).toBe(start.id);
      expect(stage.region!.x).toBe(0);
      expect(stage.region!.w).toBeLessThanOrEqual(start.width);
      expect(stage.where).toContain("오프닝 무대");
    });
    it("tells the reviewer the map size instead of letting it estimate from pixels", async () => {
      const p = gameProject();
      let prompt = "";
      const shots = vqaShotPlan(p, new Set()).filter((s) => s.kind === "map").map((s) => ({ where: s.where, kind: s.kind, ref: s.ref!, image: "data:," }));
      await reviewVqaRound({ task: "판타지 RPG 게임 하나 만들어 줘.", shots, round: 1, previous: [], reviewer: "test", chat: async (messages) => { prompt = (messages[0] as { content: { text?: string }[] }).content[0]!.text ?? ""; return '{"defects":[]}'; } });
      expect(prompt).toContain("칸 · 시작 맵");
      expect(prompt).toMatch(/Never estimate the map size/u);
    });
  });
  describe("vqaClassify — auto-built opening is a builder defect by fact", () => {
    it.each([
      ["오프닝 컷이 건물 벽과 모래 타일만 확대한 맵 조각이라 인물이나 사건 같은 이야기 내용이 전혀 보이지 않는다.", "blocker"],
      ["오프닝 2/4가 긴 집 내부 맵을 그대로 잘라 낸 장면이고 주인공이나 NPC가 없다.", "polish"],
    ] as const)("bp-open scene: %s", (what, severity) => {
      const c = vqaClassify(onOpening("bp-open-2", what, severity));
      expect(c.fixable).toBe(false);
      expect(c.kind).toBe("builder-opening");
    });
    it("the same wording on a scene the model authored is model work, fixed by restaging — never by turning the opening off", () => {
      const d = onOpening("mine-1", "오프닝 컷이 건물 벽과 모래 타일만 확대한 맵 조각이라 인물이나 사건 같은 이야기 내용이 전혀 보이지 않는다.");
      expect(vqaClassify(d).fixable).toBe(true);
      expect(vqaFixCall(d)).toContain("author_opening_stage");
      expect(vqaDefectLine(d, 0)).toContain("do not turn the opening off");
    });
    it("the ship gate's opening line does not offer turning the opening off either", () => {
      const line = editorDefaultsLeft(createBlankProject() as Project).find((b) => b.id === "opening")!.message;
      expect(line).toContain("author_opening_stage");
      expect(line).not.toMatch(/enabled:false\} 로 끈다/u);
    });
  });
  describe("noteVqaRound — findings ↔ todo items", () => {
    const dragon = onMap("tomb", "붉은 용 스프라이트가 윗벽 장식 띠에 겹쳐 반쯤 벽 속에 박힌 것처럼 보인다.", "blocker");
    const dragonAgain = onMap("tomb", "붉은 용 스프라이트의 머리가 윗벽 장식 띠에 맞닿아 벽에 박힌 것처럼 보인다.", "blocker");
    const chest = onMap("tomb", "보물상자가 방의 오른쪽 벽 경계에 걸쳐 있어 벽에 묻힌 것처럼 보이고 다가가기 어렵다.", "blocker");
    const sparse = onMap("hall", "긴 집 내부의 하단 절반이 가구 없이 빈 나무 바닥으로 남아 있어 족장의 방으로는 휑하다.");
    const boat = onMap("lake", "배가 물이나 얼음 위가 아니라 호수 바깥 눈밭과 나무 사이에 놓여 있어 배치가 어색하다.");
    const crop = onOpening("bp-open-1", "오프닝이 인물도 사건도 없는 통나무집 외관 맵 캡처 한 장뿐이다.");
    const project = createBlankProject() as Project;

    function firstRound() {
      const book: VqaFinding[] = [];
      const store = new TodoStore();
      const out = noteVqaRound(book, store, round(1, [dragon, sparse, boat, crop]), project);
      return { book, store, out };
    }

    it("round 1: blockers and polish with a fix call become items; outside and call-less polish stay in the ledger", () => {
      const { store, out, book } = firstRound();
      expect(out.offered).toEqual([dragon, sparse]);
      expect(out.outside.map((f) => f.defect)).toEqual([crop]);
      expect(store.items.map((i) => i.severity)).toEqual([undefined, "polish"]);
      expect(vqaLedgerLines(book, store).join("\n")).toContain("배가 물이나 얼음 위가 아니라");
      expect(vqaLedgerLines(book, store).join("\n")).toContain("builder-opening");
    });

    it("round 2: an unrelated defect on the same map is a new item, not «stuck»; the repeated one closes with its own reason", () => {
      const { book, store } = firstRound();
      const [dragonItem, sparseItem] = store.items;
      store.markOffered();
      for (const item of [...store.items]) store.done(item, undefined);
      const content = dragonItem!.content;
      const out = noteVqaRound(book, store, round(2, [chest, dragonAgain]), project);
      expect(out.offered).toEqual([chest]);
      expect(out.left.map((f) => f.itemId)).toEqual([dragonItem!.id]);
      expect(dragonItem!.status).toBe("blocked");
      expect(dragonItem!.blockedReason).toContain("붉은 용");
      expect(dragonItem!.blockedReason).not.toContain("보물상자");
      expect(dragonItem!.content).toBe(content);
      expect(store.holds(dragonItem!)).toBe(true);
      // 빈 방 결함은 2판에 없다 — 조수가 닫은 대로 끝.
      expect(sparseItem!.status).toBe("completed");
      const chestItem = store.items.at(-1)!;
      expect(chestItem.content).toContain("보물상자");
      expect(chestItem.status).not.toBe("blocked");
    });

    it("an item is keyed by its defect: a new turn's round 1 never rewrites it with another defect", () => {
      const { store } = firstRound();
      const before = store.items.map((i) => [i.id, i.content]);
      // 새 턴 = 새 장부, 1판부터 다시. 옛 순번 열쇠(vqa:1:0)였다면 첫 항목이 «보물상자»로 덮였다.
      noteVqaRound([], store, round(1, [chest]), project);
      expect(store.items.slice(0, before.length).map((i) => [i.id, i.content])).toEqual(before);
      expect(store.items).toHaveLength(before.length + 1);
    });

    it("polish seen again is kept as «remaining polish»: it does not hold completion and is not reopened", () => {
      const { book, store } = firstRound();
      const sparseItem = store.items[1]!;
      store.markOffered();
      for (const item of [...store.items]) store.done(item, undefined);
      noteVqaRound(book, store, round(2, [sparse]), project);
      expect(sparseItem.status).toBe("blocked");
      expect(store.holds(sparseItem)).toBe(false);
      // 3판에도 그대로 — 다시 열지 않는다.
      const out = noteVqaRound(book, store, round(3, [sparse]), project);
      expect(out.opened).toEqual([]);
      expect(sparseItem.status).toBe("blocked");
      // 다음 턴 «계속»에서도 다시 열지 않는다.
      const next = new TodoStore();
      next.restore(JSON.parse(JSON.stringify({ ...store.serialize("계속"), items: [...store.items, { id: "t9", phase: "p", content: "열린 일", status: "pending", attempts: 0, source: "model" }] })));
      expect(next.get(sparseItem.id)!.status).toBe("blocked");
    });

    it("a defect whose picture was not taken this round is not «gone»", () => {
      const { book, store } = firstRound();
      const dragonItem = store.items[0]!;
      store.markOffered();
      store.block(dragonItem, "옮길 칸을 찾지 못함");
      noteVqaRound(book, store, round(2, [], [{ where: "", kind: "map", ref: "start" }]), project);
      expect(dragonItem.status).toBe("blocked");
      noteVqaRound(book, store, round(3, []), project);
      expect(dragonItem.status).toBe("completed");
    });

    it("offers nothing once no round is left to look again (polish 3, blockers 5)", () => {
      const store = new TodoStore();
      expect(noteVqaRound([], store, round(3, [sparse]), project).opened).toEqual([]);
      expect(noteVqaRound([], store, round(3, [dragon]), project).opened).toHaveLength(1);
    });

    it("a blocker first seen when no round is left is not an item, yet it is reported as an un-offered blocker (not as ledger polish)", () => {
      const book: VqaFinding[] = [];
      const store = new TodoStore();
      expect(noteVqaRound(book, store, round(5, [chest, boat, crop]), project).opened).toEqual([]);
      expect(vqaUnofferedBlockers(book, store)).toHaveLength(1);
      expect(vqaUnofferedBlockers(book, store)[0]).toContain("보물상자");
      const ledger = vqaLedgerLines(book, store).join("\n");
      expect(ledger).not.toContain("보물상자");
      expect(ledger).toContain("배가 물이나 얼음 위가 아니라");
      expect(ledger).toContain("builder-opening");
      // 다음 판(또는 다음 턴의 1판)에서 다시 보이면 그때 할 일로 건넨다.
      const next: VqaFinding[] = [];
      expect(noteVqaRound(next, store, round(1, [chest]), project).offered).toEqual([chest]);
      expect(vqaUnofferedBlockers(next, store)).toEqual([]);
    });

    it("a round that could not be reviewed changes nothing", () => {
      const { book, store } = firstRound();
      const before = JSON.stringify(store.items);
      expect(noteVqaRound(book, store, { ...round(2, []), problem: "검수자 빈 답" }, project).opened).toEqual([]);
      expect(JSON.stringify(store.items)).toBe(before);
    });

    it("nothing changed after the hand-off: handed items close as still there, even ones the model marked done", () => {
      const { book, store } = firstRound();
      store.markOffered();
      for (const item of [...store.items]) store.done(item, undefined);
      const left = closeVqaUnchanged(book, store);
      expect(left).toHaveLength(2);
      expect(store.items.map((i) => i.status)).toEqual(["blocked", "blocked"]);
      expect(store.items.map((i) => store.holds(i))).toEqual([true, false]);
    });
  });
});
