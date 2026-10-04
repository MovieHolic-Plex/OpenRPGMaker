// project/playableSegment.ts
// 프리셋 첫 생성의 「끝낼 수 있는 구간」 뼈대와 그 판정.
//
// 왜 코드가 뼈대를 만드는가 (2026-09-28): 프리셋 첫 생성을 AI 팀에만 맡긴 실측 24판 중 끝낼 수 있는 판이 없었다.
// 맵 17장을 만든 판도 구간 끝이 없었고, 맵 4장 판은 문이 끊긴 빈 맵 셋·첫 몬스터 없음·포획 도구 없음이었다
// (runGameCheck 로 확인). AI 결과는 매번 달라 「끝까지 간다」를 약속할 수 없다. 그래서
//   1. 인터뷰 직후 코드가 실제 편집 도구(runTool)로 뼈대를 깔고 자동 플레이로 합격을 확인한 뒤 저장한다.
//   2. AI 팀은 그 위에 얹는다. 팀장의 finish 는 같은 판정을 통과해야 받아들여진다(scripts/lib/piTeamRuntime.ts).
//   3. 끝난 결과가 판정을 통과하지 못하면 브라우저가 적용하지 않고 마지막 합격본으로 되돌린다(aiPiAgentCommand.ts).
// 판정은 「구간 끝(SEGMENT_END_ENDING_ID) 까지 헤드리스 런타임으로 걸어가 도달했는가」 하나다.
// 이 판정은 재미·보기 좋음을 보증하지 않는다 — 시작부터 구간 끝까지 막힘 없이 갈 수 있음만 보증한다.
//
// 장르마다 핵심 행동이 다르다: 몬스터 수집은 첫 파트너 받기 + 풀숲 조우, JRPG 는 의뢰 받기 + 이길 수 있는 전투,
// 스토리는 기억 조사 + 이어지는 장면. 셋 다 「핵심 행동 → 문 → 길 → 구간 끝」이고 구간 끝은 핵심 행동의 스위치가 연다.

import { runTool } from "@/editor/tools";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project } from "@/project/types";
import { authoringHarnessFor, eligibleAuthoringHarnessFor, inspectAuthoringHarness } from '../harnesses/_core/authoringRegistry';
import {
  hasPlayableSegmentSkeleton,
  playableSegmentGenre,
  SEGMENT_END_ENDING_ID,
  SEGMENT_END_EVENT_ID,
  SEGMENT_KEY_SWITCH_ID,
  SEGMENT_ROUTE_MAP_ID,
  SEGMENT_STARTER_EVENT_ID,
  SEGMENT_WILD_TROOP_ID,
  supportsPlayableSegment,
  type PlayableSegmentGenre,
} from "./playableSegmentContract";

export * from "./playableSegmentContract";

const SEGMENT_WILD_ENEMY_ID = "enemy_segment_wild";
const CAPTURE_ITEM_ID = "item_capture_orb";
const STARTER_SPECIES = ["species_leafling", "species_sparkit", "species_aqualing"] as const;
/** JRPG 문지기. 기본 DB 의 슬라임 무리는 시작 파티(Lv1 영웅)가 모의전 5/5 로 이긴다(2026-09-28 simulateBattle). */
const JRPG_GATE_TROOP_ID = "troop_slime_pair";

export type PlayableSegmentVerdict =
  | { readonly ok: true; readonly endingId: string; readonly ms: number }
  | { readonly ok: false; readonly blockers: readonly string[]; readonly ms: number };

/**
 * 구간 끝까지 갈 수 있는가. 자동 플레이가 SEGMENT_END_ENDING_ID 에 닿아야 합격이다.
 * 다른 엔딩에 닿은 것만으로는 합격이 아니다 — 첫 구간의 약속은 이 엔딩이다.
 */
export function judgePlayableSegment(project: Project, options: { readonly budgetMs?: number; readonly expected?: Project } = {}): PlayableSegmentVerdict {
  const authoring = inspectAuthoringHarness(project, options.expected ?? project);
  if (authoring) return authoring.ok ? { ok: true, endingId: 'ending_romance_first_meeting', ms: authoring.ms }
    : { ok: false, blockers: authoring.blockers, ms: authoring.ms };
  const started = Date.now();
  const report = runGameCheck(project, { autoPlayBudgetMs: options.budgetMs ?? 60_000 });
  const reached = report.autoPlay?.runs.some((run) => run.ok && run.endingReached === SEGMENT_END_ENDING_ID) === true;
  const ms = Date.now() - started;
  if (reached) return { ok: true, endingId: SEGMENT_END_ENDING_ID, ms };
  const blockers = report.findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.message);
  if (!project.endings?.some((ending) => ending.id === SEGMENT_END_ENDING_ID)) blockers.unshift("첫 구간의 끝(" + SEGMENT_END_ENDING_ID + ") 엔딩이 없습니다.");
  if (report.autoPlay?.skipped) blockers.push("자동 플레이: " + report.autoPlay.skipped);
  if (blockers.length === 0) blockers.push("자동 플레이가 첫 구간의 끝(" + SEGMENT_END_ENDING_ID + ")에 닿지 못했습니다.");
  return { ok: false, blockers: [...new Set(blockers)], ms };
}

/**
 * 이 프로젝트가 판정 대상인가 — 뼈대를 가진 지원 장르 프로젝트이고, 지금 합격 상태인가.
 * 합격하지 않은 프로젝트(저자가 이미 뼈대를 고쳐 끊은 경우 등)는 판정으로 되돌릴 합격본이 없으므로 대상이 아니다.
 */
export function playableSegmentGateApplies(project: Project): boolean {
  if (authoringHarnessFor(project)) return true;
  return supportsPlayableSegment(project) && hasPlayableSegmentSkeleton(project) && judgePlayableSegment(project).ok;
}

function tool(ctx: { project: Project }, name: string, args: Record<string, unknown>): void {
  const result = runTool(ctx, name, args);
  if (!result.ok) throw new Error("첫 구간 뼈대 " + name + " 실패: " + result.summary + " " + JSON.stringify(result.issues ?? []));
}

function page(id: string, commands: readonly unknown[], conditions: readonly unknown[] = []): Record<string, unknown> {
  return { id, conditions, trigger: { kind: "action" }, graphic: { transparent: true }, commands };
}

interface GenreSkeleton {
  readonly routeName: string;
  /** 길 맵을 채운다(도로 시공·조우). 문을 달기 전에 부른다. */
  readonly paveRoute: (ctx: { project: Project }, tilesetId: string) => void;
  /** 시작 맵의 핵심 행동 이벤트. 끝나면 SEGMENT_KEY_SWITCH_ID 가 켜져야 한다. */
  readonly placeStarter: (ctx: { project: Project }, at: { mapId: string; x: number; y: number }) => void;
  readonly lockedLine: string;
  /** 구간 끝에서 엔딩 앞에 도는 명령(JRPG 의 문지기 전투 등). */
  readonly endCommands: readonly unknown[];
  readonly epilogue: string;
  /** 도구가 없는 마무리(시작 소지품 등). 복제본에 직접 쓴다. */
  readonly finish?: (project: Project) => void;
}

const SKELETONS: Record<PlayableSegmentGenre, GenreSkeleton> = {
  "monster-collect": {
    routeName: "1번 길",
    paveRoute(ctx) {
      // 도로 야생은 Lv5 스타터가 이기고 잡을 수 있는 세기(종족 공식 Lv3). 기본 DB 의 troop_slime 은 액터 파티 척도라 스타터가 진다.
      tool(ctx, "upsert_enemy", { enemy: { id: SEGMENT_WILD_ENEMY_ID, name: "야생 슬라임", speciesId: "species_wild_slime", level: 3, monsterResourceId: "generated-enemy-slime-01" } });
      tool(ctx, "upsert_troop", { troop: { id: SEGMENT_WILD_TROOP_ID, name: "풀숲 슬라임", enemyIds: [SEGMENT_WILD_ENEMY_ID] } });
      tool(ctx, "author_wild_route", { mapId: SEGMENT_ROUTE_MAP_ID, exits: [{ x: 0, y: 6 }, { x: 23, y: 6 }], grassPatches: 2, encounters: [{ troopId: SEGMENT_WILD_TROOP_ID, weight: 1 }] });
    },
    placeStarter(ctx, at) {
      tool(ctx, "give_starter_monsters", { speciesIds: [...STARTER_SPECIES], actorEvent: { mapId: at.mapId, eventId: SEGMENT_STARTER_EVENT_ID, x: at.x, y: at.y, name: "박사" } });
      // 도구가 만든 선택지마다 giveMonster 뒤에 구간 스위치를 켠다(스위치 켜기 인자가 도구에 없다).
      const map = ctx.project.maps[at.mapId]!;
      const next = structuredClone(ctx.project);
      const starter = next.maps[map.id]!.events.find((event) => event.id === SEGMENT_STARTER_EVENT_ID);
      let switched = 0;
      for (const starterPage of starter?.pages ?? []) {
        for (const command of starterPage.commands) {
          if (command.kind !== "choices") continue;
          for (const option of command.options) {
            const index = option.branch.findIndex((entry) => entry.kind === "giveMonster");
            if (index < 0) continue;
            option.branch.splice(index + 1, 0, { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true });
            switched += 1;
          }
        }
      }
      if (switched === 0) throw new Error("첫 구간 뼈대: 박사 이벤트에서 giveMonster 선택지를 찾지 못했습니다.");
      ctx.project = next;
    },
    lockedLine: "혼자서는 더 갈 수 없다. 마을의 박사에게 먼저 가 보자.",
    endCommands: [{ kind: "text", body: "여기까지가 첫 구간이다." }],
    epilogue: "첫 여정을 마쳤다. 다음 길은 이어서 만들 수 있다.",
    finish(project) {
      // 시작 소지품 도구는 없다 — 포획 게임이 포획 도구 없이 시작하지 않게 코드가 직접 넣는다.
      const inventory = project.session.inventory ?? {};
      project.session = { ...project.session, inventory: { ...inventory, [CAPTURE_ITEM_ID]: Math.max(5, inventory[CAPTURE_ITEM_ID] ?? 0) } };
    },
  },
  "adventure-jrpg": {
    routeName: "숲길",
    paveRoute(ctx) {
      // 계약 문장이 부르는 id 를 실제 트룹으로 둔다 — 길 조우를 바꾸고 싶으면 이 트룹을 고치면 된다.
      tool(ctx, "upsert_troop", { troop: { id: SEGMENT_WILD_TROOP_ID, name: "숲길 슬라임", enemyIds: ["enemy_slime"] } });
      tool(ctx, "set_encounter_table", { mapId: SEGMENT_ROUTE_MAP_ID, entries: [{ troopId: SEGMENT_WILD_TROOP_ID, weight: 1 }], encounterRate: 20 });
    },
    placeStarter(ctx, at) {
      tool(ctx, "upsert_event", {
        mapId: at.mapId,
        event: {
          id: SEGMENT_STARTER_EVENT_ID, name: "촌장", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [
            page(SEGMENT_STARTER_EVENT_ID + "_ask", [
              { kind: "text", body: "숲길 끝에 괴물이 길을 막고 있네. 부탁하네." },
              { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true },
            ]),
            page(SEGMENT_STARTER_EVENT_ID + "_asked", [{ kind: "text", body: "숲길은 동쪽 문 너머일세." }], [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
          ],
        },
      });
    },
    lockedLine: "길이 막혀 있다. 먼저 마을 촌장에게 이야기를 들어 보자.",
    endCommands: [
      { kind: "text", body: "길을 막던 괴물이 덤벼든다!" },
      { kind: "battleProcessing", troopId: JRPG_GATE_TROOP_ID, canEscape: false, canLose: false },
      { kind: "text", body: "길이 열렸다. 여기까지가 첫 구간이다." },
    ],
    epilogue: "첫 의뢰를 마쳤다. 다음 길은 이어서 만들 수 있다.",
  },
  "story-cutscene": {
    routeName: "기억의 길",
    paveRoute() {},
    placeStarter(ctx, at) {
      tool(ctx, "upsert_event", {
        mapId: at.mapId,
        event: {
          id: SEGMENT_STARTER_EVENT_ID, name: "기억의 조각", x: at.x, y: at.y, trigger: { kind: "action" },
          pages: [
            page(SEGMENT_STARTER_EVENT_ID + "_look", [
              { kind: "text", body: "낡은 물건을 만지자 오래된 기억이 떠오른다." },
              { kind: "setSwitch", switchId: SEGMENT_KEY_SWITCH_ID, value: true },
            ]),
            page(SEGMENT_STARTER_EVENT_ID + "_seen", [{ kind: "text", body: "동쪽 길 끝에 그날의 장소가 있다." }], [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
          ],
        },
      });
    },
    lockedLine: "아직 무엇을 찾아야 할지 모르겠다. 마을에서 단서를 찾아보자.",
    endCommands: [{ kind: "text", body: "그날의 장소에 닿았다. 여기까지가 첫 구간이다." }],
    epilogue: "첫 기억을 되찾았다. 다음 장면은 이어서 만들 수 있다.",
  },
};

/**
 * 장르별 첫 구간 뼈대: 시작 맵의 핵심 행동 이벤트 → 동쪽 문 → 길 맵 → 길 끝의 구간 끝(핵심 행동의 스위치가 있어야 열림).
 * 맵·문·조우·이벤트·엔딩은 실제 편집 도구로 만든다 — 모델이 쓰는 것과 같은 검증(통행·착지·커밋 게이트)을 지난다.
 * 도구가 없는 것(스위치 이름, 선택지 안 스위치, 시작 소지품)만 코드가 직접 넣는다.
 * 입력은 바꾸지 않고 새 프로젝트를 돌려준다. 이미 뼈대가 있으면 입력을 그대로 돌려준다.
 */
export function buildPlayableSegmentSkeleton(input: Project): Project {
  const genre = playableSegmentGenre(input);
  if (!genre) throw new Error("이 장르에는 첫 구간 뼈대가 없습니다: " + String(input.system.genre));
  if (hasPlayableSegmentSkeleton(input)) return input;
  const skeleton = SKELETONS[genre];
  const start = input.maps[input.startMapId];
  if (!start) throw new Error("시작 맵이 없어 첫 구간 뼈대를 깔 수 없습니다.");
  const ctx = { project: structuredClone(input) };
  // 구간 스위치는 먼저 정의한다 — upsert_event 참조 검사와 페이지 조건이 이 id 를 본다. 스위치 정의 도구는 없다.
  if (!ctx.project.switches.some((entry) => entry.id === SEGMENT_KEY_SWITCH_ID)) ctx.project.switches.push({ id: SEGMENT_KEY_SWITCH_ID, name: "첫 구간 핵심 행동" });
  const midY = Math.min(start.height - 2, Math.max(1, input.startPos.y));

  tool(ctx, "create_map", { id: SEGMENT_ROUTE_MAP_ID, name: skeleton.routeName, width: 24, height: 12, tilesetId: start.tilesetId });
  skeleton.paveRoute(ctx, start.tilesetId);
  tool(ctx, "create_transfer_pair", { a: { mapId: start.id, x: start.width - 1, y: midY }, b: { mapId: SEGMENT_ROUTE_MAP_ID, x: 0, y: 6 } });
  skeleton.placeStarter(ctx, { mapId: start.id, x: Math.min(start.width - 2, input.startPos.x + 2), y: midY });
  tool(ctx, "define_ending", {
    id: SEGMENT_END_ENDING_ID,
    name: "첫 구간 끝",
    conditions: [],
    epilogue: [{ kind: "say", speaker: "", text: skeleton.epilogue }],
  });
  tool(ctx, "upsert_event", {
    mapId: SEGMENT_ROUTE_MAP_ID,
    event: {
      id: SEGMENT_END_EVENT_ID, name: "구간 끝", x: 22, y: 6, trigger: { kind: "action" },
      pages: [
        page(SEGMENT_END_EVENT_ID + "_locked", [{ kind: "text", body: skeleton.lockedLine }]),
        page(SEGMENT_END_EVENT_ID + "_page", [...skeleton.endCommands, { kind: "triggerEnding", endingId: SEGMENT_END_ENDING_ID }],
          [{ kind: "switch", switchId: SEGMENT_KEY_SWITCH_ID, value: true }]),
      ],
    },
  });
  const project = structuredClone(ctx.project);
  skeleton.finish?.(project);
  return project;
}

/**
 * 뼈대를 깔고 판정까지 통과한 프로젝트. 대상 장르가 아니거나, 이미 있거나, 깔다 실패하거나, 판정을 통과하지 못하면 null —
 * 호출부는 예전 흐름(AI 만)으로 진행한다. 실패는 코드 결함이므로 콘솔에 남긴다.
 */
export function withVerifiedPlayableSegment(project: Project): Project | null {
  const harness = authoringHarnessFor(project) ?? eligibleAuthoringHarnessFor(project);
  if (harness) {
    const seeded = harness.seed(project);
    if (!seeded) return null;
    const verdict = harness.inspect(seeded, seeded, { allowDraft: true });
    if (!verdict.ok) throw Error('첫 만남 초안 실행 실패: ' + verdict.blockers.join(' / '));
    return seeded;
  }
  if (!supportsPlayableSegment(project) || hasPlayableSegmentSkeleton(project)) return null;
  try {
    const skeleton = buildPlayableSegmentSkeleton(project);
    const verdict = judgePlayableSegment(skeleton);
    if (verdict.ok) return skeleton;
    console.error("[playable-segment] 뼈대가 자동 플레이를 통과하지 못했습니다:", verdict.blockers);
  } catch (error) {
    console.error("[playable-segment] 뼈대를 깔지 못했습니다:", error);
  }
  return null;
}

