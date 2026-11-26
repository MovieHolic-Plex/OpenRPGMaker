import { describe, expect, it } from "vitest";
import { measure, countedContent } from "../scripts/fs-scale/score.mjs";
import { MIN_ACT_DEPTH, progressionDepth } from "@/ai/v2/judge/actDepth";
import { actDepthMinBlocker, mapsMinBlocker, editorDefaultsLeft } from "@/ai/v2/judge/shipChecks";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
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
import { roomSpecOf } from "@/editor/handInterior/builder";
import { isPassable } from "@/project/collision";
import { isDoorArtCell } from "@/project/staging/doorCells";
import { offArtEntrances } from "@/ai/v2/judge/discoverability";
import { buildingEntrances, entranceArtCells } from "@/ai/v2/place/entrances";
import { moveEntrancesOntoArt, quietFieldGuides, fillStaleObjectives } from "@/ai/v2/story/shipObjectiveDefaults";
import { objectiveCommand, objectiveTargetOf } from "@/ai/v2/judge/objectiveCommand";
import { fieldGuidesOn, objectiveSentence, objectiveShown } from "@/player/objectiveTarget";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { namesNextStep, nextStepLine, stepGoalAt } from "@/ai/v2/story/playerLines";
import { refreshObjectiveRoutes } from "@/ai/v2/judge/objectiveRoutes";
import { OBJECTIVE_LINE_WIDTH, objectivePlaceNote, objectiveTextNotes, objectiveTextWidth, planObjective } from "@/ai/v2/judge/objectivePlan";
import { applyBlueprintOpening, openingCaptionLines, openingGoalText } from "@/editor/tools/blueprintOpening";

describe("shipChecks", () => {
  isolateTimers();
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
});

describe("shipObjectiveDefaults", () => {
  isolateTimers();
  // 출하 검사 「입구 그림 옆 맨바닥의 이벤트」(entrance-off-art)는 칩셋이 적어 둔 입구 그림만 입구로 본다 — 이름표의 「문」「구멍」「입구」 글자가 아니다.
  // 2026-11-11 명세 은행(저장된 Terra 판을 모델 없이 다시 지음): 얼어붙은 호수의 이야기 이벤트와 길 끝 출구가 호숫가 「가문비」 옆이라고,
  // 피라미드 길 끝 출구 셋이 「무너진 아치 문」 조각 옆이라고 출하가 막혔다. 출하 기본값(moveEntrancesOntoArt)은 같은 판정으로 그 이벤트를 그림 위로 옮긴다.
  describe("aiV2EntranceOffArt", () => {
    isolateTimers();
    type Ctx = { project: Project };
    type Meta = { label?: string } | undefined;
    function tileOf(project: Project, tilesetId: string, label: RegExp, pass?: boolean): number {
      const tileset = project.tilesets[tilesetId]!;
      const tile = (tileset.tileMeta as unknown as Meta[]).findIndex((m, t) => !!m?.label && label.test(m.label) && (pass === undefined || Object.values(tileset.passability[t] ?? {}).some(Boolean) === pass));
      expect(tile, `${tilesetId} ${label}`).toBeGreaterThanOrEqual(0);
      return tile;
    }
    /** 밟으면 다른 맵으로 가는 투명 이벤트 — 길 끝 출구·맨바닥 문. */
    const exit = (id: string, x: number, y: number, to = "map_other"): GameEvent => ({
      id, name: "나가는 길", x, y, trigger: { kind: "playerTouch" }, commands: [],
      pages: [{ id: `${id}_p0`, name: "", conditions: [], graphic: { transparent: true }, trigger: { kind: "playerTouch" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "transfer", mapId: to, x: 2, y: 2, direction: "down" }] }],
    }) as unknown as GameEvent;
    /** 한 가지 바닥을 깐 12×8 맵에 그림 타일과 이벤트를 놓는다 — lower 는 바닥층에 놓을 것(물). */
    function flat(tilesetId: string, ground: RegExp, art: { upper?: readonly (readonly [number, number, RegExp])[]; lower?: readonly (readonly [number, number, RegExp])[] }, events: GameEvent[]): Project {
      const ctx: Ctx = { project: createBlankProject() };
      expect(runTool(ctx, "create_map", { id: "map_t", name: "시험", width: 12, height: 8, tilesetId }).ok).toBe(true);
      expect(runTool(ctx, "create_map", { id: "map_other", name: "다른 곳", width: 8, height: 8, tilesetId }).ok).toBe(true);
      const map = structuredClone(ctx.project.maps.map_t!);
      const floor = tileOf(ctx.project, tilesetId, ground, true);
      for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
      for (const [x, y, label] of art.upper ?? []) (map.upperTiles as number[])[y * map.width + x] = tileOf(ctx.project, tilesetId, label);
      for (const [x, y, label] of art.lower ?? []) (map.lowerTiles as number[])[y * map.width + x] = tileOf(ctx.project, tilesetId, label);
      map.events = events;
      return { ...ctx.project, maps: { ...ctx.project.maps, map_t: map }, startMapId: "map_t", startPos: { x: 1, y: 6 } } as Project;
    }
    describe("entrance-off-art reads declared entrance art only", () => {
      it("a spruce by the lake is not an entrance — 「가문비」 has 「문」 in it", () => {
        const project = flat("snow_north", /^눈밭/u, { upper: [[5, 3, /^큰 가문비/u]] }, [exit("ev_road_end", 5, 4)]);
        // 이름표 낱말로 읽는 쪽(도구·런타임이 아직 쓰는 isDoorArtCell)은 이 나무를 문 그림으로 본다.
        expect(isDoorArtCell(project, project.maps.map_t!, 5, 3)).toBe(true);
        expect(entranceArtCells(project, project.maps.map_t!).size).toBe(0);
        expect(offArtEntrances(project)).toEqual([]);
        // 출하 기본값도 출구를 나무 위로 옮기지 않는다.
        expect(moveEntrancesOntoArt(project)).toEqual([]);
        expect(project.maps.map_t!.events[0]).toMatchObject({ x: 5, y: 4 });
      });

      it("open water in the ice (「얼음 구멍」) and a fallen arch piece (「무너진 아치 문」) are not entrances", () => {
        expect(offArtEntrances(flat("snow_north", /^눈밭/u, { lower: [[5, 3, /^얼음 구멍·여울/u]] }, [exit("ev_story", 5, 4)]))).toEqual([]);
        // 맵 가장자리의 길 끝 출구 두 칸 옆에 유적 조각.
        expect(offArtEntrances(flat("desert_east", /^모래/u, { upper: [[2, 4, /^무너진 아치 문/u]] }, [exit("ev_world_gate", 0, 4)]))).toEqual([]);
      });

      it("still names a door a building kit declares, and the ship default moves the event onto it", () => {
        const ctx: Ctx = { project: createBlankProject() };
        expect(runTool(ctx, "create_map", { id: "map_d", name: "바자르", width: 48, height: 40, tilesetId: "desert_east" }).ok).toBe(true);
        expect(runTool(ctx, "compose_desert_east_map", { mapId: "map_d", kind: "bazaar", seed: 1 }).ok).toBe(true);
        const built = ctx.project.maps.map_d!;
        let start = { x: 0, y: 0 };
        for (let x = 0; x < built.width; x++) if (isPassable(ctx.project, built, x, built.height - 1)) { start = { x, y: built.height - 1 }; break; }
        // 지은 그대로는 짚을 것이 없다.
        expect(offArtEntrances({ ...ctx.project, startMapId: "map_d", startPos: start } as Project)).toEqual([]);
        const door = buildingEntrances(ctx.project, built).find((d) => isPassable(ctx.project, built, d.x + 1, d.y + 1) && !built.events.some((e) => Math.abs(e.x - d.x) <= 2 && Math.abs(e.y - d.y) <= 2))!;
        expect(door).toBeDefined();
        // 문 앞 칸의 옆 칸(맨바닥)에 선 투명 출입 이벤트.
        const map = { ...built, events: [...built.events, exit("ev_side", door.x + 1, door.y + 1, "map_inside")] };
        const project = { ...ctx.project, maps: { ...ctx.project.maps, map_d: map }, startMapId: "map_d", startPos: start } as Project;
        expect(offArtEntrances(project)).toMatchObject([{ eventId: "ev_side", door: { x: door.x, y: door.y } }]);
        expect(moveEntrancesOntoArt(project)).toHaveLength(1);
        const moved = project.maps.map_d!.events.find((e) => e.id === "ev_side")!;
        expect(moved).toMatchObject({ x: door.x, y: door.y });
        // 문 칸은 막힌 그림이라 부딪혀 열린다.
        expect(moved.pages![0]).toMatchObject({ priority: "same", overlapForbidden: true });
        expect(offArtEntrances(project)).toEqual([]);
      }, 60_000);

      it("still names stairs a room kit declares", () => {
        const ctx: Ctx = { project: createBlankProject() };
        expect(runTool(ctx, "create_map", { id: "map_t", name: "방", width: 14, height: 12, tilesetId: "jp_city" }).ok).toBe(true);
        const spec = roomSpecOf(ctx.project.tilesets.jp_city)!;
        const map = structuredClone(ctx.project.maps.map_t!);
        const floor = tileOf(ctx.project, "jp_city", /플로어 바닥$/u, true);
        for (let i = 0; i < map.width * map.height; i++) { (map.lowerTiles as number[])[i] = floor; (map.upperTiles as number[])[i] = -1; }
        for (const [dx, dy, tile] of spec.objects["stairs-up-wood"]!.cells) (map.upperTiles as number[])[(4 + dy!) * map.width + 9 + dx!] = tile!;
        map.events = [exit("ev_up", 8, 4, "map_upstairs")];
        const project = { ...ctx.project, maps: { ...ctx.project.maps, map_t: map }, startMapId: "map_t", startPos: { x: 1, y: 10 } } as Project;
        expect(offArtEntrances(project)).toMatchObject([{ eventId: "ev_up", door: { x: 9, y: 4 } }]);
      });
    });
  });
  // 조수 v2 가 지은 게임은 필드 안내(곁 화살표 · 대상 빛무리 · 머리 위 ▼ · 목표 글의 「어디」 꼬리)를 끈 채로 출하한다.
  // 2026-11-12 r1w-fun 을 해 본 오너: 「화살표로 방향 다 설명하는 것도 열받고」. 목표 명령의 글·대상은 그대로 남아 자동 플레이가 따라가고,
  // 사용자가 켜 달라고 하면(set_project_settings{fieldGuides:"on"}) 다음 끝맺음이 다시 끄지 않는다.
  describe("aiV2FieldGuidesDefault", () => {
    isolateTimers();
    const named = (maps: Record<string, string[]>) => ({
      maps: Object.fromEntries(Object.entries(maps).map(([name, events], i) => [`m${i}`, { id: `m${i}`, name, events: events.map((n, k) => ({ id: `e${i}_${k}`, name: n })) }])),
    }) as never;
    describe("v2 ship default: field guides off unless somebody chose", () => {
      it("turns the guides off once and says so", () => {
        const p = createBlankProject() as Project;
        expect(p.system.fieldGuides).toBeUndefined();
        expect(quietFieldGuides(p)).toHaveLength(1);
        expect(p.system.fieldGuides).toBe("off");
        expect(quietFieldGuides(p)).toEqual([]);
      });

      it("keeps an explicit on (the user asked for a guide arrow) and survives save → load", () => {
        const ctx = { project: createBlankProject() as Project };
        expect(runTool(ctx, "set_project_settings", { fieldGuides: "on" }).ok).toBe(true);
        expect(ctx.project.system.fieldGuides).toBe("on");
        expect(quietFieldGuides(ctx.project)).toEqual([]);
        const loaded = deserialize(serialize(ctx.project));
        expect(loaded.system.fieldGuides).toBe("on");
        expect(fieldGuidesOn(loaded)).toBe(true);
        expect(runTool(ctx, "set_project_settings", { fieldGuides: "off" }).ok).toBe(true);
        expect(deserialize(serialize(ctx.project)).system.fieldGuides).toBe("off");
      });

      it("does not touch the objective data — text tail and target stay for the machine player", () => {
        const p = createBlankProject() as Project;
        const command = objectiveCommand("주술사에게 숫자를 받아 오자 (주술사의 오두막 입구: 서쪽 → 주술사)", { mapId: "m", eventId: "e" });
        const map = p.maps[p.startMapId]!;
        map.events.push({ id: "ev_x", name: "촌장", x: 1, y: 1, pages: [{ id: "p", trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands: [command] }] } as never);
        const before = JSON.stringify(map.events);
        quietFieldGuides(p);
        expect(JSON.stringify(map.events)).toBe(before);
        expect(objectiveTargetOf(command)).toEqual({ mapId: "m", eventId: "e" });
      });
    });
    describe("runtime: with the guides off the objective shows its sentence only", () => {
      const game = named({ "부족 마을": ["떠돌이 상인", "촌장"], "주술사의 오두막": ["주술사", "번호 쪽지"], "늪지": ["늪 괴수"] });

      it("reads the switch: omitted and on = on, off and the old arrows = off", () => {
        expect(fieldGuidesOn({ system: {} })).toBe(true);
        expect(fieldGuidesOn({ system: { fieldGuides: "on" } })).toBe(true);
        expect(fieldGuidesOn({ system: { fieldGuides: "off" } })).toBe(false);
        expect(fieldGuidesOn({ system: { fieldGuides: "arrows" } })).toBe(false);
      });

      it("drops every tail shape the builders write", () => {
        expect(objectiveSentence(game, "주술사의 오두막에 가서 조상의 숫자를 받아 오자 (주술사의 오두막 입구: 서쪽 → 주술사)")).toBe("주술사의 오두막에 가서 조상의 숫자를 받아 오자");
        expect(objectiveSentence(game, "주술사의 오두막에 가서 조상의 숫자를 받아 오자 (주술사)")).toBe("주술사의 오두막에 가서 조상의 숫자를 받아 오자");
        expect(objectiveSentence(game, "늪 괴수를 물리친다 (부족 마을 입구: 이 맵 남쪽 끝 가운데 → 부족 마을에서 동쪽 끝 가운데 → 늪지 · 늪 괴수)")).toBe("늪 괴수를 물리친다");
        expect(objectiveSentence(game, "번호 쪽지를 살펴보자 (번호 쪽지: 「떠돌이 상인」 옆)")).toBe("번호 쪽지를 살펴보자");
        expect(objectiveSentence(game, "문을 열자 (북서쪽)")).toBe("문을 열자");
        expect(objectiveSentence(game, "촌장을 찾아가자 (촌장 / 떠돌이 상인: 부족 마을 남쪽)")).toBe("촌장을 찾아가자");
        // 이름 없는 표지(회복의 샘)도 「무엇: 자리」 꼴이면 꼬리다.
        expect(objectiveSentence(game, "「촌장」을 찾아가자 (회복의 샘: 부족 마을 남쪽)")).toBe("「촌장」을 찾아가자");
      });

      it("keeps what the author wrote in parentheses and a text that is only a tail", () => {
        expect(objectiveSentence(game, "약초를 모으자 (0/3)")).toBe("약초를 모으자 (0/3)");
        expect(objectiveSentence(game, "약초를 모으자 (세 개)")).toBe("약초를 모으자 (세 개)");
        expect(objectiveSentence(game, "약초를 모으자 (세 개 / 주술사)")).toBe("약초를 모으자 (세 개 / 주술사)");
        expect(objectiveSentence(game, "단추를 누르자 (오른쪽)")).toBe("단추를 누르자 (오른쪽)");
        expect(objectiveSentence(game, "약초를 모으자 (주의: 독초는 빼고)")).toBe("약초를 모으자 (주의: 독초는 빼고)");
        expect(objectiveSentence(game, "(주술사)")).toBe("(주술사)");
        expect(objectiveSentence(game, "별의 정령에게 소원을 빌자")).toBe("별의 정령에게 소원을 빌자");
      });

      it("shows the tail read from the current map when the guides are on", () => {
        const text = "조상의 숫자를 받아 오자 (주술사의 오두막 입구: 서쪽 → 주술사)";
        const hut = { name: "주술사의 오두막", events: [] } as never;
        expect(objectiveShown({ ...(game as object), system: {} } as never, hut, text)).toBe("조상의 숫자를 받아 오자 (주술사)");
        expect(objectiveShown({ ...(game as object), system: { fieldGuides: "off" } } as never, hut, text)).toBe("조상의 숫자를 받아 오자");
      });
    });
  });
  // 확인 빌드 r6 의 브라우저 플레이(포구 마을 「갈매나루」 · 「역 앞 상점가」)에서 찾은 조수 결함 다섯 — 안내 글 · 오프닝 · 퀘스트 대사 · 엔딩 도구.
  // 증거: assistant-fable-runs/r6/DEFECTS.md «플레이에서 찾은 조수 결함» P3 · P7 · P8 · P9 · P10. P9 는 test/defineEndingKeepsFields.test.ts,
  // P10 의 알림 띠는 test/objectiveCardTouchControls.test.ts · test/fieldHudBudget.test.ts 에 있다.
  describe("aiV2GuideTextR6", () => {
    isolateTimers();
    type Obj = Record<string, unknown>;
    const SLOW = 120_000;
    const move = { type: "fixed" as const, speed: 3, frequency: 3 };
    const page = (id: string, conditions: unknown[], commands: unknown[], more: Obj = {}) => ({ id, name: id, conditions, graphic: {}, trigger: { kind: "action" }, priority: "same", movement: move, commands, ...more });
    const say = (speaker: string, body: string) => ({ kind: "text", speaker, body });
    const person = (id: string, name: string, x: number, y: number, pages: unknown[]) => ({ id, name, x, y, trigger: { kind: "action" }, commands: [], pages }) as unknown as GameEvent;
    const door = (id: string, name: string, x: number, y: number, to: { mapId: string; x: number; y: number }) =>
      person(id, name, x, y, [page(`${id}_0`, [], [{ kind: "transfer", ...to, direction: "up", fade: "black" }], { trigger: { kind: "playerTouch" }, priority: "below" })]);
    const step = (id: string, kind: string, who: string, place: string, gives: string) => ({ id, kind, who, place, event: who, action: `${who} 단계`, gives, feeling: "긴장" });
    /** 목표 명령들 — [이벤트 id, 쪽 id, 화면에 보이는 문장(필드 안내를 끈 게임), 대상 이벤트 id, 저장된 글]. */
    function objectives(project: Project): { eventId: string; pageId: string; shown: string; target: string | undefined; raw: string }[] {
      const out: { eventId: string; pageId: string; shown: string; target: string | undefined; raw: string }[] = [];
      for (const map of Object.values(project.maps)) for (const event of map.events) for (const pg of event.pages ?? []) for (const command of pg.commands as unknown as { fields?: Obj }[]) {
        if (command.fields?.surface !== "objectiveChip") continue;
        const raw = String(command.fields.message);
        out.push({ eventId: event.id, pageId: pg.id, shown: objectiveSentence(project, raw), target: command.fields.targetEventId as string | undefined, raw });
      }
      return out;
    }
    /** 갈매나루 → 대성당 → 옛 지하 묘지. 어부는 스위치를 켜고(이정표), 신부는 제 스위치만 켜고, 병사는 아무것도 남기지 않는다 — r6 「갈매나루」 의 모양. */
    function harbour(): Project {
      const ctx: ToolContext = { project: createBlankProject() };
      ctx.project.maps[ctx.project.startMapId]!.name = "갈매나루";
      for (const [id, name] of [["m_cathedral", "대성당"], ["m_crypt", "옛 지하 묘지"]] as const) expect(runTool(ctx, "create_map", { id, name, width: 20, height: 15 }, { dryRun: false }).ok).toBe(true);
      const p = ctx.project as Project;
      const town = p.maps[p.startMapId]!, cathedral = p.maps.m_cathedral!, crypt = p.maps.m_crypt!;
      town.events.push(
        person("ev_maru", "어부 마루", 4, 4, [page("maru_0", [], [say("어부 마루", "대성당 밑에서 종소리가 들려."), { kind: "setSwitch", switchId: "sw_heard", value: true }])]),
        door("ev_to_cathedral", "대성당 문", 10, 1, { mapId: "m_cathedral", x: 5, y: 12 }),
      );
      cathedral.events.push(
        person("ev_priest", "신부 안셀름", 6, 5, [
          page("priest_locked", [], [say("신부 안셀름", "아직은 때가 아닙니다.")]),
          page("priest_open", [{ kind: "switch", switchId: "sw_heard", value: true }], [say("신부 안셀름", "이 열쇠로 지하 묘지에 갈 수 있습니다."), { kind: "setSelfSwitch", key: "A", value: true }]),
          page("priest_done", [{ kind: "switch", switchId: "sw_heard", value: true }, { kind: "selfSwitch", key: "A", value: true }], [say("신부 안셀름", "주님의 가호가 함께하기를.")]),
        ]),
        door("ev_to_crypt", "지하 계단", 15, 2, { mapId: "m_crypt", x: 3, y: 3 }),
      );
      crypt.events.push(
        person("ev_soldier", "해골 병사", 8, 8, [page("soldier_0", [], [say("해골 병사", "지나가려면 나를 쓰러뜨려라!")])]),
        person("ev_boss", "검은 종지기", 15, 12, [page("boss_0", [], [say("검은 종지기", "돌아가라…"), { kind: "triggerEnding", endingId: "ending_dawn" }])]),
      );
      p.gameBlueprint = normalizeGameBlueprint({
        title: "갈매나루의 종", genre: "모험", playerGoal: "갈매나루 사람들의 이야기를 듣고 지하의 종소리를 멎게 하자.",
        steps: [step("s1", "talk", "어부 마루", "갈매나루", "종소리 소문"), step("s2", "talk", "신부 안셀름", "대성당", "지하 묘지 열쇠"), step("s3", "battle", "해골 병사", "옛 지하 묘지", "길목 개방"), step("s4", "battle", "검은 종지기", "옛 지하 묘지", "엔딩")],
        ending: { name: "새벽의 종소리", how: "보스를 이기면", feeling: "안도" },
      });
      return p;
    }
    // P3 — 목표 줄이 «「강지기 할아버지」를 찾아가자» 처럼 사람 이름뿐이고(길 꼬리는 필드 안내를 끈 게임에서 숨는다), 신부와 말한 뒤에도 목표가 그대로였다.
    describe("P3 목표 줄은 누구를 · 어디서 말하고, 단계가 끝나면 다음으로 넘어간다", () => {
      it("다른 맵으로 가야 하는 단계의 목표 줄은 그 맵 이름을 문장에 싣는다 — 모델이 쓴 goal 은 고치지 않는다", () => {
        const keeper = { kind: "talk" as const, who: "강지기 할아버지", event: "강지기 할아버지", place: "강지기의 집" };
        expect(stepGoalAt(keeper, "강지기의 집")).toBe("강지기의 집에서 강지기 할아버지에게 말을 걸자");
        // 같은 맵이면(장소를 주지 않으면) 이름만.
        expect(stepGoalAt(keeper)).toBe("강지기 할아버지에게 말을 걸자");
        expect(stepGoalAt({ kind: "battle", who: "해골 병사", event: "해골 병사", place: "옛 지하 묘지" }, "옛 지하 묘지")).toBe("옛 지하 묘지에서 해골 병사를 쓰러뜨리자");
        // 줄이 이미 그 장소 이름을 담고 있으면(「어물전 주인 해순」) 되풀이하지 않는다.
        expect(stepGoalAt({ kind: "talk", who: "어물전 주인 해순", event: "어물전 주인 해순", place: "어물전" }, "어물전")).toBe("어물전 주인 해순에게 말을 걸자");
        // 모델이 쓴 goal(누구를 · 어디서 · 왜)은 그 글 그대로다.
        expect(stepGoalAt({ kind: "talk", who: "신부", event: "신부", place: "대성당", text: { goal: "등불을 알아볼 신부를 대성당에서 찾자." } }, "대성당")).toBe("등불을 알아볼 신부를 대성당에서 찾자");
      });

      it("끝맺음이 거는 다음 목표는 «<맵>에서 <누구>에게 …» 이고, 이정표를 남기지 않는 단계(말만 하는 신부 · 싸움) 뒤에도 다음 단계로 넘어간다", () => {
        const p = harbour();
        const notes = fillStaleObjectives(p);
        const hung = objectives(p);
        // 어부(스위치를 켠다) 뒤: 사람 이름뿐인 «「신부 안셀름」을 찾아가자» 가 아니라 어디서 누구에게.
        expect(hung.find((o) => o.eventId === "ev_maru")).toMatchObject({ pageId: "maru_0", shown: "대성당에서 신부 안셀름에게 말을 걸자", target: "ev_priest" });
        // 신부(제 스위치만 켠다) 뒤: 잠긴 쪽(priest_locked)도 끝난 뒤의 쪽(priest_done)도 아닌, 단계가 열렸을 때 도는 쪽에 건다.
        expect(hung.filter((o) => o.eventId === "ev_priest")).toEqual([expect.objectContaining({ pageId: "priest_open", shown: "옛 지하 묘지에서 해골 병사를 쓰러뜨리자", target: "ev_soldier" })]);
        // 병사(아무것도 남기지 않는다) 뒤: 같은 맵의 다음 상대 — 장소를 되풀이하지 않는다.
        expect(hung.find((o) => o.eventId === "ev_soldier")).toMatchObject({ shown: "검은 종지기를 쓰러뜨리자", target: "ev_boss" });
        // 엔딩을 부르는 마지막 단계에는 걸지 않는다.
        expect(hung.some((o) => o.eventId === "ev_boss")).toBe(false);
        expect(notes.filter((line) => line.includes("이정표 없는 단계"))).toHaveLength(2);
        // 화면에 «찾아가자» 꼴의 이름뿐인 목표는 없다.
        expect(hung.some((o) => /^「[^」]+」[을를] 찾아가자$/u.test(o.shown))).toBe(false);
        // 두 번 불러도 같다.
        expect(fillStaleObjectives(p)).toEqual([]);
        expect(objectives(p)).toEqual(hung);
      });

      it("where 로 준 대상은 목표가 들고 다닌다 — 끝맺음이 글에 지나가며 나온 다른 맵 이름으로 꼬리를 붙이지 않는다", () => {
        const text = "광장의 어부 마루에게 대성당 밑 종소리 소문을 물어보자.";
        const hang = (p: Project, target?: { mapId: string; eventId: string }) => {
          const plan = planObjective(p, { at: "start", text, where: "어부 마루", ...(target ? { target } : {}) });
          expect(plan.ok, plan.summary).toBe(true);
          for (const { mapId, event } of plan.events) p.maps[mapId]!.events.push(event as unknown as GameEvent);
          refreshObjectiveRoutes(p);
          return objectives(p).find((o) => o.eventId === "ev_objective_start")!;
        };
        // set_objective 가 where 의 이벤트를 대상으로 싣는다: 어부 마루는 이 맵에 있다 — «(대성당 입구: …)» 가 붙지 않는다.
        const withTarget = harbour();
        expect(hang(withTarget, { mapId: withTarget.startMapId, eventId: "ev_maru" })).toMatchObject({ raw: text, target: "ev_maru" });
        // 대상이 없던 옛 글은 글에 나온 맵 이름으로 꼬리가 붙는다(r6 에서 화면 밖에 남아 있던 틀린 꼬리).
        expect(hang(harbour()).raw).toContain("대성당 입구");
      });

      it("대사가 다음 사람·장소를 말했는지 이름의 낱말로 본다 — 말하지 않았으면 잇는 서술 한 줄", () => {
        const clerk = { kind: "talk" as const, who: "편의점 점원", event: "편의점 점원", place: "역 앞 상점가 편의점 앞" };
        const bookseller = { kind: "talk" as const, who: "서점 주인", event: "서점 주인", place: "역 앞 상점가 서점 앞" };
        // 「서점 주인」 을 «서점 할아버지» 라고 불러도 말한 것이다(게임 2 의 대사).
        expect(namesNextStep(["우유 달라고 야옹거리더니 서점 쪽으로 가던데요.", "서점 할아버지한테 가 보세요."], bookseller, clerk)).toBe(true);
        // 두 단계가 함께 쓰는 낱말(«상점가»)은 다음 갈 곳을 말한 것이 아니다.
        expect(namesNextStep(["상점가는 늘 붐비지."], bookseller, clerk)).toBe(false);
        // 게임 1: 강지기는 등불만 건네고 어물전 이야기를 하지 않았다.
        expect(namesNextStep(["이 낡은 등불을 가져가게. 어둠 속에서 길을 비춰 줄 걸세."], { kind: "choice", who: "어물전 주인 해순", event: "어물전 주인 해순", place: "어물전" }, { kind: "talk", who: "강지기 할아버지", event: "강지기 할아버지", place: "강지기의 집" })).toBe(false);
        expect(nextStepLine({ kind: "battle", who: "해골 병사", event: "해골 병사", place: "옛 지하 묘지" }, "옛 지하 묘지")).toBe("(이제 옛 지하 묘지에서 해골 병사를 쓰러뜨리자.)");
        expect(nextStepLine(bookseller)).toBe("(이제 서점 주인에게 말을 걸자.)");
      });
    });
    function harness(task: string) {
      const project = createBlankProject();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const env: PiAssistantV2Env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
      const tools = createV2Tools(env, new V2Session());
      const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
        const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
        const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!;
        try { return JSON.parse(text.split("\n[")[0]!) as { ok?: boolean; summary?: string }; } catch { return { ok: false, summary: text }; }
      };
      const eventOf = (name: string) => Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => e.name === name);
      return { ctx, call, eventOf };
    }
    const texts = (event: GameEvent | undefined, pageIndex: number): string[] => ((event?.pages?.[pageIndex]?.commands ?? []) as unknown as { kind: string; body?: string }[]).filter((c) => c.kind === "text").map((c) => c.body ?? "");
    describe("P3 · P8 청사진 도구 — 대사는 다음 갈 곳을 잇고, 오프닝 글을 받는다", () => {
      const blueprint = {
        title: "밤의 학교", genre: "모험", playerGoal: "밤의 학교에서 단서를 따라 옥상까지 가자.",
        ending: { name: "새벽", how: "해가 뜨고 문이 열렸다.", feeling: "안도", closing: ["해가 떴다.", "문이 열렸다."] },
        steps: [
          { id: "s1", kind: "talk", who: "촌장 하르", place: "현관", event: "촌장 하르", action: "촌장에게 사정을 듣는다", gives: "촌장의 부탁", feeling: "걱정" },
          { id: "s2", kind: "talk", who: "사서 유나", place: "복도", event: "사서 유나", action: "사서에게 묻는다", needs: "촌장의 부탁", gives: "일지의 기록", feeling: "호기심" },
          { id: "s3", kind: "battle", who: "얼음 문지기", place: "도서실", event: "얼음 문지기", action: "문지기를 이긴다", needs: "일지의 기록", gives: "문지기 격파", feeling: "긴장" },
          { id: "s4", kind: "talk", who: "별의 정령", place: "옥상", event: "별의 정령", action: "정령에게 소원을 빈다", needs: "문지기 격파", gives: "엔딩", feeling: "안도" },
        ],
      };

      it("write_blueprint 는 opening(오프닝에서 읽는 글)을 받아 청사진에 남기고, 없으면 알린다 — 다시 써도 물려받는다", async () => {
        const { ctx, call } = harness("밤의 학교를 탐험하는 게임 하나 만들어 줘.");
        let wrote = await call("write_blueprint", blueprint);
        if (!wrote.ok) wrote = await call("write_blueprint", blueprint);
        expect(wrote.ok, wrote.summary).toBe(true);
        expect(wrote.summary).toContain("opening is empty");
        expect(wrote.summary).toContain("no answer, no game words");
        const opening = ["밤의 학교에는 아무도 없어야 한다.", "그런데 종이 저절로 울린다."];
        const again = await call("write_blueprint", { ...blueprint, opening });
        expect(again.ok, again.summary).toBe(true);
        expect(again.summary).not.toContain("opening is empty");
        expect(ctx.project.gameBlueprint?.opening).toEqual(opening);
        // 이름 맞추기 다시 쓰기(opening 을 빼고 보냄)가 오프닝 글을 지우지 않는다.
        expect((await call("write_blueprint", { ...blueprint, playerGoal: "밤의 학교에서 종소리의 까닭을 찾아 옥상까지 가자." })).ok).toBe(true);
        expect(ctx.project.gameBlueprint?.opening).toEqual(opening);
      }, SLOW);

      it("build_blueprint_path: 다음 사람을 말하지 않는 대사 뒤에 잇는 서술 한 줄을 붙이고 알린다 — 다음 사람을 말한 대사는 그대로 둔다", async () => {
        const { call, eventOf } = harness("밤의 학교를 탐험하는 게임 하나 만들어 줘.");
        let wrote = await call("write_blueprint", blueprint);
        if (!wrote.ok) wrote = await call("write_blueprint", blueprint);
        expect(wrote.ok, wrote.summary).toBe(true);
        const built = await call("build_blueprint_path", { steps: [
          { id: "s1", lines: ["어서 오게. 밤마다 종이 저절로 울린다네."] },
          { id: "s2", lines: ["종 이야기라면 도서실 일지에 있어요.", "얼음 문지기가 도서실을 막고 있으니 조심하세요."] },
          { id: "s3", lines: ["여기부터는 못 지나간다."], winLines: ["(문지기가 얼음 속으로 물러난다.)"] },
          { id: "s4", lines: ["네 소원을 들려다오."] },
        ] });
        expect(built.ok, built.summary).toBe(true);
        // 촌장은 사서 이야기를 하지 않았다 — 그 대사 뒤에 다음 단계의 목표 줄과 같은 문장이 서술로 붙는다.
        expect(texts(eventOf("촌장 하르"), 0)).toEqual(["어서 오게. 밤마다 종이 저절로 울린다네.", "(이제 사서 유나에게 말을 걸자.)"]);
        // 사서는 «얼음 문지기» 를 말했다 — 덧붙이지 않는다. 싸움 단계의 싸우기 전 말에도 붙이지 않는다.
        expect(texts(eventOf("사서 유나"), 1)).toEqual(["종 이야기라면 도서실 일지에 있어요.", "얼음 문지기가 도서실을 막고 있으니 조심하세요."]);
        expect(texts(eventOf("얼음 문지기"), 1)).toEqual(["여기부터는 못 지나간다."]);
        // 무엇을 덧붙였는지 결과 글이 말한다(모델이 읽는 글 — 영어).
        expect(built.summary).toContain("The lines of s1 did not say who or where next");
        expect(built.summary).not.toMatch(/The lines of [^.]*s2/u);
      }, SLOW);
    });
    // P7 — 수녀가 제 이름표 밑에서 «수녀가 부두 사람들에게 촛불 나눔을 부탁한다.» 고 말하고, 수락하면 «고맙네! 잘 부탁하지.» 라고 답했다.
    describe("P7 create_quest — 요약문은 의뢰인의 대사가 아니다", () => {
      const compile = (dialogue?: Obj) => {
        const ctx: ToolContext = { project: createBlankProject() };
        const mapId = ctx.project.startMapId;
        const def = {
          key: "q_candle", title: "성당의 촛불", summary: "수녀가 부두 사람들에게 촛불 나눔을 부탁한다.", order: "sequence",
          giver: { create: { mapId, x: 5, y: 5, name: "수녀" } },
          steps: [{ kind: "talk", target: { create: { mapId, x: 8, y: 5, name: "광장의 할머니" } }, lines: ["정말 고맙습니다."] }],
          rewards: { gold: 40 }, ...(dialogue ? { dialogue } : {}),
        };
        const result = runTool(ctx, "create_quest", { def }, { dryRun: false });
        expect(result.ok, result.summary).toBe(true);
        const giver = ctx.project.maps[mapId]!.events.find((e) => e.id === "ev_q_candle_giver")!;
        const offer = giver.pages!.find((pg) => pg.id.endsWith("_offer"))!.commands as unknown as Obj[];
        const accept = ((offer.find((c) => c.kind === "choices") as { options: { branch: Obj[] }[] }).options[0]!.branch).filter((c) => c.kind === "text");
        return { warnings: result.diff?.warnings ?? [], line: offer[0]!, accept };
      };

      it("dialogue 를 주지 않으면 요약문은 이름표 없는 서술로 뜨고, 수락 답은 정해진 말투가 아니라 서술 한 줄이다 — 결과 글이 알린다", () => {
        const { warnings, line, accept } = compile();
        expect(line).toEqual({ kind: "text", body: "수녀가 부두 사람들에게 촛불 나눔을 부탁한다." });
        expect(accept).toEqual([{ kind: "text", body: "의뢰 '성당의 촛불'을 받았다." }]);
        const note = warnings.find((w) => w.startsWith("Quest '성당의 촛불'"));
        expect(note).toContain("giver «수녀» has no words of their own for offer, accepted");
        expect(note).toContain("The summary is shown as narration");
        expect(note).toContain("def.dialogue{offer, accepted");
      });

      it("dialogue.offer · accepted 를 주면 그 사람의 이름표 밑에서 그 말을 한다 — 알릴 것이 없다", () => {
        const { warnings, line, accept } = compile({ offer: "부두 사람들에게 촛불을 나눠 주실 수 있을까요?", accepted: "고마워요. 주님의 은총이 함께하기를." });
        expect(line).toEqual({ kind: "text", speaker: "수녀", body: "부두 사람들에게 촛불을 나눠 주실 수 있을까요?" });
        expect(accept).toEqual([{ kind: "text", speaker: "수녀", body: "고마워요. 주님의 은총이 함께하기를." }]);
        expect(warnings.some((w) => w.startsWith("Quest '"))).toBe(false);
      });
    });
    // P8 — 오프닝이 목표 문장을 둘로 자른 것 + 맵 이름 카드였다: 찾는 게임이 시작 전에 «라멘집에서 고양이를 찾자.» 고 답을 말하고, «보스» 가 그대로 나왔다.
    describe("P8 청사진 기본 오프닝 — 오프닝 글은 청사진의 opening, 목표 문장은 답·게임 낱말이 없을 때만", () => {
      const CAT_GOAL = "상점가 사람들에게 잃어버린 고양이 '미케'의 행방을 물어 단서를 모으고, 라멘집에서 고양이를 찾자.";
      function street(opening?: string[], playerGoal = CAT_GOAL): Project {
        const project = createBlankProject() as Project;
        const start = project.maps[project.startMapId]!;
        start.name = "역 앞 상점가";
        start.lowerTiles[3] = (start.lowerTiles[0] ?? 0) + 1; // 그릴 것이 있는 맵
        for (const [id, name, at] of [["map_ramen", "라멘집 다이키", 7], ["map_book", "서점", 9]] as const) {
          const copy = { ...structuredClone(start), id, name, events: [] as GameEvent[] };
          copy.lowerTiles[at] = (copy.lowerTiles[0] ?? 0) + 1;
          project.maps[id] = copy as never;
        }
        project.gameBlueprint = normalizeGameBlueprint({
          title: "상점가의 미케", genre: "모험", playerGoal, ...(opening ? { opening } : {}),
          steps: [step("s1", "talk", "전단지 아주머니", "역 앞 상점가", "단서"), step("s2", "talk", "서점 주인", "서점", "단서 둘"), step("s3", "find", "미케", "라멘집 다이키 안쪽 구석", "엔딩")],
          ending: { name: "미케, 집으로", how: "찾으면", feeling: "포근함" },
        });
        return project;
      }
      const narration = (project: Project): string[] => (project.system.opening?.scenes ?? []).map((scene) => String((scene as { narration?: string }).narration ?? ""));
      const shown = (project: Project): string => JSON.stringify(project.system.opening?.scenes ?? []);

      it("목표 문장에서 읽어도 되는 문장만 고른다 — 찾는 게임의 답(마지막 단계의 장소)과 게임 낱말이 든 문장은 문장째 뺀다", () => {
        expect(openingGoalText(street().gameBlueprint!)).toBe("");
        // 찾는 것의 이름(«고양이»)은 답이 아니다 — 장소를 말하지 않는 문장은 남는다.
        expect(openingGoalText(street(undefined, "상점가 사람들을 도와 잃어버린 고양이를 찾아 주자.").gameBlueprint!)).toBe("상점가 사람들을 도와 잃어버린 고양이를 찾아 주자.");
        const harbourGoal = (playerGoal: string) => normalizeGameBlueprint({
          title: "갈매나루의 종", genre: "모험", playerGoal, steps: [step("s1", "talk", "어부", "갈매나루", "소문"), step("s2", "battle", "검은 종지기", "옛 지하 묘지", "엔딩")], ending: { name: "끝", how: "h", feeling: "f" },
        });
        // 게임 1: «보스» 는 게임을 가리키는 낱말이다.
        expect(openingGoalText(harbourGoal("갈매나루 사람들의 이야기를 들어 대성당 지하 열쇠를 얻고, 옛 지하 묘지 맨 안쪽의 보스를 쓰러뜨려 마을을 지키자."))).toBe("");
        // 싸워 끝나는 게임이 상대와 장소를 이야기의 말로 부르면 그대로 읽는다(답이 아니다).
        expect(openingGoalText(harbourGoal("마을 사람들의 이야기를 듣자. 옛 지하 묘지의 종지기를 쓰러뜨려 마을을 지키자."))).toBe("마을 사람들의 이야기를 듣자. 옛 지하 묘지의 종지기를 쓰러뜨려 마을을 지키자.");
      });

      it("opening 이 없으면: 답을 말하는 문장도, 답인 장소의 장면도 오프닝에 나오지 않는다", () => {
        const project = street();
        const [note] = applyBlueprintOpening(project);
        expect(note).toContain("opening 없음");
        expect(narration(project).join(" ")).not.toContain("라멘집");
        expect(narration(project).join(" ")).not.toContain("찾자");
        // 마지막 단계(찾기)의 맵은 장면으로도 보이지 않는다.
        expect(shown(project)).not.toContain("map_ramen");
        expect(narration(project)).toContain("역 앞 상점가");
      }, SLOW);

      it("opening 이 있으면 그 글이 오프닝이다 — 걸러 내지 않고, 긴 줄만 구절에서 나눈다", () => {
        const opening = ["전학 온 첫날, 낯선 상점가 전봇대에 전단지가 붙어 있다.", "하얀 꼬리의 고양이 '미케'를 찾는다는 글씨가 비에 번져 있다."];
        const project = street(opening);
        const [note] = applyBlueprintOpening(project);
        expect(note).toContain("청사진 opening 2줄");
        expect(narration(project)).toEqual(opening);
        expect(openingCaptionLines(["아주 긴 한 줄이 들어오면 구절 단위로 나뉘어야 한다, 예컨대 이 문장처럼 쉼표가 있고 길이가 마흔여섯 자를 훌쩍 넘는 경우에는 두 줄이 된다."]))
          .toEqual(["아주 긴 한 줄이 들어오면 구절 단위로 나뉘어야 한다,", "예컨대 이 문장처럼 쉼표가 있고", "길이가 마흔여섯 자를 훌쩍 넘는 경우에는 두 줄이 된다."]);
        // 숫자가 든 줄도 모델이 플레이어에게 쓴 글이면 그대로 싣는다(목표 문장과 달리 걸러 내지 않는다).
        expect(openingCaptionLines(["  종은 새벽 4시에 울린다.  "])).toEqual(["종은 새벽 4시에 울린다."]);
      }, SLOW);
    });
    // P10 — 52자 시작 목표가 화면에서 «… 먼저 역 앞 전단지…» 로 끊겼고, set_objective 는 아무 말 없이 받았다.
    describe("P10 set_objective — 목표 줄에 다 안 들어가는 글을 알린다(받기는 한다)", () => {
      const LONG = "상점가 사람들에게 잃어버린 고양이를 본 적 있는지 물어보자. 먼저 역 앞 전단지 아주머니에게.";

      it("글의 화면 폭을 한글 글자 수로 잰다 — 구석의 목표 줄 두 줄은 36자", () => {
        expect(OBJECTIVE_LINE_WIDTH).toBe(36);
        // r6 a1 실측: 이 글이 102px(한글·낫표 14자 × 7px + 빈칸 둘 × 2px) 이었다.
        expect(objectiveTextWidth("「강지기 할아버지」를 찾아가자")).toBeCloseTo(14.6, 5);
        expect(objectiveTextWidth("Ask Varga")).toBeCloseTo(8 * 0.55 + 0.3, 5);
        expect(objectiveTextWidth(LONG)).toBeGreaterThan(OBJECTIVE_LINE_WIDTH);
      });

      it("넘치는 글은 걸고, 화면에서 잘리는 뒷부분을 적어 알린다 — 들어가는 글에는 알릴 것이 없다", () => {
        const plan = planObjective(createBlankProject() as Project, { at: "start", text: LONG });
        expect(plan.ok, plan.summary).toBe(true);
        expect(plan.summary).toContain(LONG);
        expect(plan.notes).toHaveLength(1);
        // 플레이에서 보인 것은 «… 먼저 역 앞 전단지…» 였다 — 잘린 것은 그 뒤다.
        expect(plan.notes![0]).toContain("«아주머니에게.» is cut off there");
        expect(plan.notes![0]).toContain("about 36 Korean characters");
        expect(planObjective(createBlankProject() as Project, { at: "start", text: "광장의 어부 마루에게 대성당 밑 종소리 소문을 물어보자." }).notes).toBeUndefined();
        expect(objectiveTextNotes("촌장에게 말을 걸자", "촌장에게 말을 걸자")).toEqual([]);
      });

      it("80자를 넘는 글은 잘라 걸고 잘랐다고 알린다", () => {
        const plan = planObjective(createBlankProject() as Project, { at: "start", text: "가".repeat(95) });
        expect(plan.ok).toBe(true);
        expect(plan.summary).toContain(`「${"가".repeat(80)}」`);
        expect(plan.notes![0]).toContain("longer than 80 characters and was cut");
      });

      it("대상이 다른 맵에 있는데 글이 그 장소를 말하지 않으면 알린다 — 필드 안내를 켠 게임과 같은 맵 대상에는 알리지 않는다", () => {
        const p = harbour();
        const priest = { mapId: "m_cathedral", eventId: "ev_priest" };
        const [note] = objectivePlaceNote(p, "신부 안셀름에게 종소리를 물어보자", p.startMapId, priest);
        expect(note).toContain("«대성당»");
        expect(note).toContain("«대성당에서 …»");
        expect(objectivePlaceNote(p, "대성당의 신부 안셀름에게 종소리를 물어보자", p.startMapId, priest)).toEqual([]);
        expect(objectivePlaceNote(p, "어부 마루에게 소문을 물어보자", p.startMapId, { mapId: p.startMapId, eventId: "ev_maru" })).toEqual([]);
        p.system.fieldGuides = "on";
        expect(objectivePlaceNote(p, "신부 안셀름에게 종소리를 물어보자", p.startMapId, priest)).toEqual([]);
      });
    });
  });
});
