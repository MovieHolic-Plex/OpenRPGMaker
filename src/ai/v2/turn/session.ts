// 한 실행(턴)의 v2 상태 — 동사·끝맺음 단계·판정자가 함께 읽고 쓴다. 턴이 시작될 때 새로 만든다(실행기 assistantV2Runtime.ts).
// 2026-11-11 리팩토링 R2: verbs.ts 에서 떼어 냈다 — 끝맺음 단계·레인 35파일이 이 형 하나 때문에 verbs.ts 와 서로를 끌어오고 있었다.
import type { CriticVerdict } from "@/ai/piAgent/featureReview";
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import type { MachineCheck } from "../judge/machineChecks";
import { TodoLoop } from "../loop/continuation";
import { HookStats } from "../loop/hookStats";
import { TodoStore } from "../loop/todoStore";
import type { StageWrites } from "../shared/stageWrites";
import type { ContentBuildResult, PlaceRecord, PlaceSpec } from "../shared/types";
import { layoutGiven } from "../place/interiorLayout";

/** 한 맵의 마지막 검사 결과(기계 검사·비평·그림). */
export interface Seen {
  readonly checks: readonly MachineCheck[];
  readonly critics: readonly CriticVerdict[];
  readonly images: readonly { readonly mapId: string; readonly dataUrl: string }[];
}

/** 이 실행의 v2 상태 — 맵별 장소 기록·마지막 검사·누적 「그림 없음」. */
export class V2Session {
  /** 이번 실행의 할 일 목록(omo todo — src/ai/v2/loop). todo 동사가 쓰고, 멈춤 재주입 고리·최종 보고가 읽는다. */
  readonly todo = new TodoStore();
  /** 멈춤 재주입 고리의 연속·진척 상태(src/ai/v2/loop/continuation.ts). */
  readonly loop = new TodoLoop();
  /** 할 일 고리 갈고리의 발화 수(src/ai/v2/loop/hookStats.ts) — v2.summary 에 싣는다. */
  readonly hooks = new HookStats();
  readonly places = new Map<string, PlaceRecord>();
  /** 앞 턴에서 이어 받은 장소 기록(tools/placeMemory.ts) — 고치는 동사만 읽는다. 끝맺음 단계·관문은 places(이번 턴에 지은 것)만 본다. */
  readonly pastPlaces = new Map<string, PlaceRecord>();
  /** 앞 턴의 설계가 있었지만 맵이 조수 밖에서 바뀌어 버린 맵 — 거절 글이 이유를 댄다. */
  readonly stalePlaces = new Set<string>();
  /** 이번 턴 기록, 없으면 앞 턴에서 이어 받은 기록. */
  placeOf(mapId: string): PlaceRecord | undefined { return this.places.get(mapId) ?? this.pastPlaces.get(mapId); }
  /** 세션마다 다른 덧값 — 던전 설계 안내(예시 순서·입구 낱말 순서·설계 실마리)를 같은 요청의 다른 세션에서 다르게 돌린다. */
  readonly nonce = Math.floor(Math.random() * 1_000_000_000);
  readonly seen = new Map<string, Seen>();
  readonly content: { verb: string; result: ContentBuildResult }[] = [];
  readonly missingArt = new Set<string>();
  /** 컷신 무대(맵별) — 무대 검사·연출 비평 major 가 남았는지(G39: 비평이 짚은 겹침을 보고만 하고 끝냈다). */
  readonly stages = new Map<string, { name: string; rounds: number; problems: string[]; eventIds?: readonly string[] }>();
  readonly questions: string[] = [];
  /** ask_user 를 한 번 되돌려 보냈는가(아무것도 짓지 않고 물었을 때). */
  askBounced = false;
  /** 설계 없이 온 손 도트 실내 make_place 를 한 번 되돌려 보낸 장소 이름(2026-10-29 「방을 짓는 건 조수여야만 한다」). */
  /** 칸 배치 없이 온 손 도트 실내를 돌려보낸 횟수(장소 이름별). */
  readonly designBounced = new Map<string, number>();
  /** 장소 이름 → 칸 배치 거절 횟수(고치기 두 번까지). */
  readonly layoutRejects = new Map<string, number>();
  /** 거절된(아직 짓지 않은) 칸 배치 장소 — 맵 id·장소 이름으로. edit_place layoutPatch 가 이것을 고쳐 make_place 로 다시 보낸다. */
  readonly pendingLayouts = new Map<string, PlaceSpec>();
  /** 지형 설계(hints.landform) 없이 온 마을 make_place 를 한 번 되돌려 보낸 장소 이름(2026-10-29 「지형을 먼저 깔고 마을은 지형에 맞춰 자란다」). */
  readonly terrainBounced = new Set<string>();
  /** 코드 지형 마을: 미리보기로 보여 준 땅(장소 이름 → 씨앗·크기·성격 힌트). 자리(hints.layout)를 받아 지을 때 같은 땅을 쓴다. */
  readonly villageTerrain = new Map<string, { terrainSeed: number; width: number; height: number; shape: string; previews: number }>();
  /** 설계(dungeonDesign) 없이 온 던전·동굴 make_place 를 한 번 되돌려 보낸 장소 이름(2026-10-29 「맵은 조수가 설계한다」). */
  readonly dungeonBounced = new Set<string>();
  /** 장소 지식 카드(prompt.ts placeSpecCards)를 기록으로 준 종류 → 그때의 대화 번호(env.contextEpoch). 대화가 비워지면 다시 준다. */
  readonly specsShown = new Map<string, number>();
  /**
   * generate_art 가 그림 생성을 시도한 기록(오너 2026-11-09 「인게임 스크린샷은 AI 가 그림을 그릴 수 없을 때로만」): 타이틀·엔딩 → 시도 결과.
   * ok = 만들어 건다 · failed = 생성이 실패(오류 글) · unavailable = 이미지 생성 경로가 이 실행에 없다. 끝맺음 관문은 map-view 그림을 이 기록이 있을 때만 허용한다.
   */
  readonly artAttempts = new Map<"title" | "ending", { readonly status: "ok" | "failed" | "unavailable"; readonly error?: string; readonly failures?: number }>();
  /** 같은 청사진을 다시 쓴 횟수(내용이 같으면 바꾸지 않고 다음 동사로 보낸다). */
  blueprintRewrites = 0;
  /** 첫 청사진이 장소·단계가 모자라 거절된 횟수(세션당 1회만 거절하고 다음부터는 걸어 준다 — 막다른 길 방지). */
  blueprintThinRejects = 0;
  /** 청사진 장소가 이 게임 세계(world.ts)와 안 맞아 돌려보낸 횟수 — 상한 뒤에는 함수가 메워서 건다(막다른 길 방지). */
  worldBounces = 0;
  /** 보이는 적·보물상자를 이미 둔 세계 장소(맵 id) — 한 실행에 한 번만 채운다(못 둔 자리를 다음 호출이 다시 채우지 않게). */
  readonly stockedPlaces = new Set<string>();
  /** build_blueprint_path 를 대사 없이 불러 돌려보낸 횟수(한 번만). */
  pathTextBounces = 0;
  /** 끝맺음에서 청사진 경로를 함수가 대신 지었는가(한 번만). */
  autoPathDone = false;
  /** 끝맺음에서 청사진 장소를 함수가 대신 지었는가(한 번만). */
  autoPlacesDone = false;
  /** 끝맺음에서 지은 장소를 시작과 이었는가(한 번만). */
  linkBuiltDone = false;
  /** 빈 맵을 가리키던 청사진 장소의 새 이름 → 그 빈 맵 id(renameBareBlueprintPlaces). 장소를 지으면 빈 맵 이벤트를 옮긴다. */
  barePlaces?: Map<string, string>;
  /** 필수전투 레벨 맞춤이 시간 예산을 넘겨 멈췄다는 기록(끝맺음 ship-defaults 가 쓰고 최종 보고가 읽는다 — 프로젝트 객체는 체크포인트·다시 읽기에서 바뀌어 기록을 못 지킨다). */
  fitIncomplete?: string;
  /** 끝맺음 단계·장르 기본값이 스스로 쓴 데이터베이스 칸(구역:id:칸 → 값 JSON) — 「[게임 검사 부작용]」이 모델이 한 변경과 가른다(stageWrites.ts). */
  readonly stageWrites: StageWrites = new Map();
  /** 끝맺음에서 이동 칸 앞을 막는 이벤트를 옮겼는가(한 번만). */
  autoLanesDone = false;
  /** 출구·이동 칸 마감을 돈 뒤의 맵 지문(finishAutoBuild.lanesStamp). 늦은 고치기 차례가 장소를 다시 지으면 달라져 마감을 다시 돈다. */
  lanesStamp?: string;
  /** 지문이 달라져 마감을 다시 돈 횟수(되풀이 상한). */
  lanesReruns = 0;
  /** 이동 칸(착지·문) 앞을 막는 이벤트를 옆으로 옮긴다(createV2Tools 가 건다). 한 일 목록. */
  clearLanes?: () => Promise<string[]>;
  /** 청사진에 있는데 없는(또는 닿지 않는) 장소를 짓고 앞 장소와 잇는다(createV2Tools 가 건다). 한 일 목록. */
  buildPlaces?: () => Promise<string[]>;
  /** 이번 실행에 make_place 로 지은 장소가 시작에서 닿지 않으면 요청 속 맵(없으면 지금·시작 맵)과 잇는다(createV2Tools 가 건다). 한 일 목록. */
  linkBuiltPlaces?: () => Promise<string[]>;
  /** 이 요청의 묶음에 없는 v2 도구 하나를 만들어 준다(createV2Tools 가 건다) — 끝맺음 관문이 고치는 법으로 이른 도구를 고치기 차례에 싣는 데 쓴다. v2 에 없는 이름이면 undefined. */
  repairTool?: (name: string) => PiToolShape | undefined;
  /** 청사진 경로를 결정적으로 짓는다(createV2Tools 가 건다) — 끝맺음 단계가 모델 대신 부른다. */
  buildPath?: (why: string) => Promise<{ ok: boolean; summary: string }>;
  criticCalls = 0;
  criticMs = 0;
  /** 비평가가 본 그림과 맵이 달라져 다시 본 횟수(맵별 — turn/relook.ts). */
  readonly relooks = new Map<string, number>();
  /** 모델 입장에서 「아직 안 끝난 것」 — 끝맺음 관문이 읽는다. */
  unresolved(): { mapId: string; name: string; rounds: number; cap: number; problems: string[] }[] {
    const out: { mapId: string; name: string; rounds: number; cap: number; problems: string[] }[] = [];
    for (const [mapId, record] of this.places) {
      const seen = this.seen.get(mapId);
      if (!seen) continue;
      const critics = seen.critics.filter((v) => v.mapId === mapId);
      const problems = [
        ...seen.checks.filter((c) => !c.ok && c.mapId === mapId).map((c) => `[기계 ${c.id}] ${c.detail}`),
        ...critics.flatMap((v) => v.majors.map((m) => `[비평 축${m.axis}${m.x !== undefined ? ` (${m.x},${m.y})${m.w ? ` ${m.w}×${m.h}` : ""}` : ""}] ${m.what}${m.fix ? ` → ${m.fix}` : ""}`)),
        ...critics.filter((v) => v.problem).map((v) => `[비평 미판정] ${v.problem}`),
      ];
      if (problems.length) out.push({ mapId, name: record.spec.name, rounds: record.rounds, cap: repairCapOf(record.spec), problems });
    }
    for (const [mapId, st] of this.stages) if (st.problems.length) out.push({ mapId, name: `${st.name} 컷신(add_event redo:${st.eventIds?.[0] ?? "<장면 id>"})`, rounds: st.rounds, cap: V2_MAX_REPAIR_ROUNDS, problems: st.problems });
    return out;
  }
}

// 2026-10-23 5차: 고치기 3바퀴는 바퀴마다 다시 짓기+비평(20~35초)이라 던전 한 장에 200~250초가 들었다.
// 속도 우선(6차)으로 1바퀴만 — 첫 비평의 major 를 한 번 고치고 남은 것은 보고한다.
// 2026-10-30 omo 할 일 고리: 1바퀴 상한이 비평 항목을 «상한 막힘»으로 닫았다(세 장면 모두). 상한은 할 일 항목의 시도 상한(TODO_MAX_ATTEMPTS=3)과
// 고리의 진척 규칙(진척 없는 재주입 2번이면 멈춤)이 맡는다 — 맵당 다시 짓기 상한도 같은 3.
export const V2_MAX_REPAIR_ROUNDS = 3;

/** 칸 배치(spec.layout) 장소의 다시 짓기 상한 — 고침이 싸고 매번 검증되며, 자기 검토 바퀴(review_layout)도 같은 수를 쓰므로 크게. */
const LAYOUT_MAX_REBUILDS = 12;

/**
 * 장소 하나의 고치기 상한 — 도구(edit_place·review_layout)와 끝맺음 관문이 같은 수를 쓴다.
 * 왜: 관문만 3을 쓰면 칸 배치 방은 자기 검토 두 바퀴가 그 3을 먹어, 비평 항목이 한 번 고친 뒤 «상한»으로 막혔다(도구는 «남은 바퀴 9» 라고 했다).
 */
export const repairCapOf = (spec: PlaceSpec | undefined): number => (spec && layoutGiven(spec.layout) ? LAYOUT_MAX_REBUILDS : V2_MAX_REPAIR_ROUNDS);
