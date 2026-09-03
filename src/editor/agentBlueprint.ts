// editor/agentBlueprint.ts
// 확정된 밑그림(BuildSpec)을 "맵에 그릴 수 있는 청사진"으로 바꿔 들고 있는 순수 상태 저장소.
//
// 왜 필요한가: 코드베이스의 진짜 밑그림인 `BuildSpec` 은 에셋별 사각형과 명시적 `buildOrder`
// 를 이미 갖고 있는데, 지금은 채팅에 접힌 `<details>` 텍스트로만 나가고 맵에는 한 번도
// 그려지지 않는다(aiChatPanel 의 set_build_spec 분기). 그래서 사용자는 "무엇을 어디에 몇 번째로
// 세울 계획인지"를 시공이 끝난 뒤 diff 로만 알게 된다. 이 모듈은 그 계획을 착공 전에 꺼내
// 놓고, 툴콜이 들어올 때마다 어느 칸이 진행 중이고 어디까지 끝났는지를 갱신한다.
//
// 브라우저·Phaser 비의존이다(렌더러는 `agentBlueprintRenderer.ts`). 고스트 프리뷰와 같은
// 모듈 싱글턴 규약을 따른다 — 마지막 기록자가 이긴다.
//
// 수명은 **세션의 활성 BuildSpec** 이다(고스트는 한 턴짜리라 수명이 다르다). 턴 시작마다
// `syncAgentBlueprintWithSpec(session.getActiveSpec())` 로 맞추고, 새 대화·패널 폐기에서
// `clearAgentBlueprint()` 로 지운다. 자세한 사고 기록은 syncAgentBlueprintWithSpec 주석에 있다.
//
// 다만 **표시**의 수명은 스펙보다 짧다: 계획에 남은 일이 없으면(전 칸 done) 읽기 경로
// `agentBlueprintForMap` 이 빈 목록을 내어 캔버스에서 물러난다 — 상태는 진실을 그대로 들고
// 있으므로 물려받기·정산은 불변이다. 사유는 그 함수 주석에 있다. 시공이 저장소에 들어간 턴이 끝나면 패널이
// `retireAgentBlueprint()` 로 칸을 물러나게 하고, 물러난 칸은 같은 스펙의 재동기화가 되살리지 않는다(전 칸
// done 이 아니어도 — 건너뛴 에셋·자동 확장 칸이 계획을 영구히 남기던 결함, 2026-09-03).

import { orderedAssets, type AffectedRegion, type BuildSpec, type SpecAsset } from "@/ai/buildSpec";
import { blueprintRegionsForToolCall, type AppliedBlueprintRegions } from "@/editor/agentBlueprintRegions";
import type { MapId } from "@/project/types";

export type BlueprintEntryStatus = "planned" | "building" | "done";

export interface BlueprintEntry {
  /** BuildSpec 에셋 id — 진행 판정과 테스트 식별에만 쓰고 캔버스 라벨에는 넣지 않는다. */
  readonly id: string;
  readonly kind: string;
  /** 캔버스에 그릴 사람 말 라벨(도구명·내부 id 노출 금지 정책을 지킨다). */
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** buildOrder 기준 1-based 순번. */
  readonly order: number;
  readonly status: BlueprintEntryStatus;
  /** 면 채우기 형태 힌트(SpecAsset.shape) — 렌더러가 원형 호수를 네모로 찍지 않게. */
  readonly shape?: "rect" | "ellipse" | "circle";
}

export interface AgentBlueprintState {
  readonly mapId: MapId | null;
  readonly entries: readonly BlueprintEntry[];
  readonly revision: number;
}

/** 툴콜의 쓰기 여부 — 레지스트리의 `mode === "write"` 를 호출자가 넘긴다(아래 markAgentBlueprintProgress). */
export interface BlueprintToolCallMode {
  readonly write: boolean;
}

type Listener = (state: AgentBlueprintState) => void;

const listeners = new Set<Listener>();
let mapId: MapId | null = null;
let entries: BlueprintEntry[] = [];
let revision = 0;
/**
 * 이번 턴에 planned 밖으로 올린 칸(entryShapeKey) — 턴 정산이 되돌릴 수 있는 대상의 전량이다.
 *
 * 왜 `building` 만 보면 안 되는가: markAgentBlueprintProgress 는 다음 칸으로 넘어갈 때 앞 칸을
 * 그 자리에서 `done` 으로 내린다(인과 순서 판정). 그 done 은 저장소에 아무것도 들어가기 **전**의
 * 표시다 — 한 턴에 길·집을 이어 치고 중단하면 길은 done, 집은 building 이 되고, building 만
 * 되돌리면 손도 안 댄 길에 회색 ✓ 가 남는다. 그래서 "이번 턴에 움직인 칸" 을 전부 들고 있는다.
 * 앞 턴에 확정된 done 은 여기 없으므로 정산이 건드리지 않는다.
 */
let turnAdvanced = new Set<string>();
/**
 * 시공이 저장소에 들어간 뒤 물러난 칸(entryShapeKey) 과 그 맵 — 턴 시작 재동기화가 되살리지 않는다.
 *
 * 실측 결함: 조수와의 대화가 끝난(시공이 적용된) 뒤에도 밑그림이 맵 위에 남았다. 청사진의 수명이
 * 세션의 활성 BuildSpec 에 매여 있고 스펙은 세션이 죽을 때까지 살기 때문이다 — 계획 칸 중 하나라도
 * done 이 아니면(모델이 건너뛴 에셋, 자동 확장으로 덧붙은 칸) 전 칸 완료 판정에 걸리지 않아 회색
 * ✓ 와 파랑 계획이 다음 질문·조회 턴마다 syncAgentBlueprintWithSpec 으로 되깔렸다. 밑그림은 착공
 * 전의 안내다: 그 턴의 시공이 저장소에 들어갔으면 할 일을 다 했으므로 물러나고(retireAgentBlueprint),
 * 물러난 칸은 같은 스펙이 다시 와도 그리지 않는다. 새 set_build_spec 은 새 계획이므로 기록을 비운다.
 */
let retiredMapId: MapId | null = null;
let retiredKeys = new Set<string>();

/**
 * 재제출된 밑그림이 진행을 물려받는 겹침 하한 — 새 칸 면적의 이 비율 이상을 같은 종류의 옛 칸이 덮어야 한다.
 *
 * 실측(2026-09-03 run1): 집을 짓는 도중 모델이 명세를 다시 냈고(`house_1 (5,10) 8×10` → `built_house_1
 * (6,10) 7×7`), id·사각형이 모두 바뀌어 shape-key 상속이 끊겼다. 다 지은 집이 planned(파랑)로 되감기고
 * 계획이 「미완료」라 완성된 맵 위에 영구히 남았다. 같은 종류가 새 칸을 절반 넘게 덮으면 같은 물건이다.
 */
const INHERIT_MIN_OVERLAP = 0.5;

/**
 * 진행 귀속의 덮인 비율 하한 — 이보다 적게 스치는 칸에는 호출을 귀속하지 않는다.
 *
 * 실측(2026-09-03 e1-03): `author_house` 한 호출은 몸통 사각형 + 문 앞 1칸을 낸다. 벗겨내기 첫 회에
 * 집 칸이 몸통을 가져가면 남는 것은 문 칸 하나인데, 그 칸을 담는 유일한 후보가 맵 전체 `clear` 칸이라
 * 1/4096 의 덮임으로 정리 칸이 building 이 됐다 — 맵 전체가 노란 테두리로 덮이고 다음 호출에서 done ✓
 * 로 굳었다(정리는 한 칸도 안 했다). 맵 전체를 실제로 치우는 호출은 1.0 이라 이 하한에 걸리지 않는다.
 */
const MIN_ATTRIBUTION_COVERAGE = 0.02;

// kind → 사람 말. BuildSpec.kind 는 모델이 자유롭게 쓰지만 villagePlan/village builder 가 내는
// 어휘는 좁다(road·house·prop·terrain·clear·event 계열). 모르는 kind 는 그대로 보여준다 —
// 억지 번역보다 원문이 덜 틀린다.
const KIND_LABELS: Readonly<Record<string, string>> = {
  clear: "정리",
  road: "길",
  path: "길",
  house: "집",
  building: "건물",
  // 스펙 자동 확장(assistantSession.autoExpandedAssetKind)의 기본값 — 코드가 정하는 7종
  // (clear·road·terrain·npc·prop·house·structure) 중 유일하게 번역이 없어 맵에 "3/9 structure"
  // 라는 영어 원문이 찍혔다. 나머지 6종은 위에 있다.
  structure: "구조물",
  yard: "마당",
  wall: "벽",
  fence: "울타리",
  water: "물",
  terrain: "지형",
  field: "밭",
  prop: "소품",
  tree: "나무",
  forest: "숲",
  furniture: "가구",
  interior: "실내",
  room: "방",
  door: "문",
  bridge: "다리",
  plaza: "광장",
  market: "장터",
  shop: "상점",
  well: "우물",
  npc: "주민",
  event: "이벤트",
  transfer: "이동",
  chest: "상자",
};

export function blueprintKindLabel(kind: string): string {
  const key = kind.trim().toLowerCase();
  return KIND_LABELS[key] ?? (kind.trim() === "" ? "구역" : kind.trim());
}

export function subscribeAgentBlueprint(listener: Listener): () => void {
  listeners.add(listener);
  listener(getAgentBlueprintState());
  return () => listeners.delete(listener);
}

export function getAgentBlueprintState(): AgentBlueprintState {
  return { mapId, entries: [...entries], revision };
}

/**
 * 계획에 남은 일이 없으면 청사진은 할 일을 다 했다 — 캔버스에서 물러난다.
 *
 * 실측 결함: 조수에게 명령해 시공이 **끝난 뒤에도** 맵 위에 계획 사각형과 라벨(`1/2 지형 ✓`,
 * blueprintEntryCaption)이 그대로 남았다. 청사진의 수명이 세션의 활성 `BuildSpec` 에 매여
 * 있고(턴 시작마다 syncAgentBlueprintWithSpec 이 다시 깐다) `clearAgentBlueprint` 는
 * dropSession/패널 dispose 에서만 불리기 때문이다 — 즉 결과가 다 나온 완성된 맵 위에 회색 ✓
 * 라벨이 최대 40장 영구히 덮여 있고, 대화를 버리지 않고 걷는 수단은 **원본 보기 꾹 누름**
 * 하나뿐이었다(순간 토글이다). 사용자가 보고 싶은 것은 자기 결과물이지 다 끝난 진행 표시가 아니다.
 */
export function isAgentBlueprintComplete(entries: readonly BlueprintEntry[]): boolean {
  return entries.length > 0 && entries.every((entry) => entry.status === "done");
}

/**
 * 렌더러가 보는 유일한 읽기 경로다 — 완료된 계획을 여기서 감춘다.
 *
 * 왜 상태를 지우지 않는가: `setAgentBlueprintFromSpec` 은 `done` 을 **사각형 기준으로 물려받아**
 * 턴 시작 재동기화(스펙 자동 확장 포함)가 진행을 날리지 않게 한다. 완료 시점에
 * `clearAgentBlueprint()` 를 부르면 물려받을 상태가 사라지므로 다음 턴의
 * `syncAgentBlueprintWithSpec(activeSpec)` 이 **다 지어진 맵 위에 전량 planned 파랑 계획을
 * 되살린다**. 상태는 진실을 그대로 들고(정산·물려받기·turnAdvanced 전부 불변) 캔버스만
 * 물러나면 재부활이 구조적으로 불가능하다 — 되깔린 계획도 여전히 전량 done 이라 감춰진 채다.
 *
 * 되감김은 그대로 보인다: 턴 끝 정산(settleAgentBlueprintTurn)이 적용되지 않은 칸을 `planned`
 * 로 되돌리면 완료가 아니므로 계획이 남는다 — "이건 안 들어갔다" 는 참인 정보다. 스펙
 * 자동 확장이 `planned` 에셋을 덧붙이는 경우도 같은 이유로 다시 그려진다.
 */
export function agentBlueprintForMap(state: AgentBlueprintState, currentMapId: MapId | null): readonly BlueprintEntry[] {
  if (!currentMapId || state.mapId !== currentMapId) return [];
  if (isAgentBlueprintComplete(state.entries)) return [];
  return state.entries;
}

/**
 * set_build_spec 이 통과한 직후, 그리고 **턴이 시작될 때마다** 호출 — 계획을 청사진으로 깐다.
 *
 * 같은 맵에서 id·사각형이 그대로인 칸은 진행 상태(building/done)를 물려받는다. 물려받지 않으면
 * 턴마다 다시 깔 때 이미 끝난 칸이 planned 로 되감기고, 스펙 자동 확장(assistantSession 의
 * expandSpecWithRegions 가 활성 스펙에 에셋을 덧붙인다)이 한 번만 일어나도 진행이 전부 날아간다.
 * 바뀐 것이 없으면 emit 하지 않는다 — 턴마다 부르는 경로라서 조용해야 재렌더가 낭비되지 않는다.
 *
 * `orderedAssets` 를 쓰므로 화면 순번이 모델이 선언한 시공 순서와 같다.
 */
export function setAgentBlueprintFromSpec(spec: BuildSpec): void {
  // 새 계획이다 — 물러난 기록은 옛 계획의 것이다.
  retiredMapId = null;
  retiredKeys = new Set();
  applySpec(spec);
}

function applySpec(spec: BuildSpec): void {
  const previous = spec.mapId === mapId ? entries : [];
  const retired = spec.mapId === retiredMapId ? retiredKeys : null;
  const inherited = new Map<string, BlueprintEntryStatus>();
  for (const entry of previous) inherited.set(entryShapeKey(entry), entry.status);
  const next: BlueprintEntry[] = [];
  const advancedKeys: string[] = [];
  for (const asset of orderedAssets(spec)) {
    const normalized = normalizeAsset(asset);
    if (!normalized) continue;
    const candidate: BlueprintEntry = {
      id: asset.id,
      kind: asset.kind,
      label: blueprintKindLabel(asset.kind),
      x: normalized.x,
      y: normalized.y,
      w: normalized.w,
      h: normalized.h,
      order: next.length + 1,
      status: "planned",
      ...(asset.shape === undefined ? {} : { shape: asset.shape }),
    };
    const key = entryShapeKey(candidate);
    if (retired?.has(key)) continue;
    const exact = inherited.get(key);
    if (exact !== undefined) {
      next.push({ ...candidate, status: exact });
      continue;
    }
    // id·사각형이 바뀐 재제출 — 같은 종류의 옛 칸이 새 칸을 절반 넘게 덮으면 그 진행을 물려받는다.
    const ancestor = overlappingAncestor(previous, candidate);
    if (ancestor === null) {
      next.push(candidate);
      continue;
    }
    next.push({ ...candidate, status: ancestor.status });
    if (turnAdvanced.has(entryShapeKey(ancestor))) advancedKeys.push(key);
  }
  if (spec.mapId === mapId && sameEntries(entries, next)) return;
  mapId = spec.mapId;
  entries = next;
  // 물려받은 칸은 이번 턴 정산 대상도 물려받는다 — 안 그러면 옛 키만 정산돼 새 칸이 building 에 영원히 머문다.
  for (const key of advancedKeys) turnAdvanced.add(key);
  emit();
}

function overlappingAncestor(previous: readonly BlueprintEntry[], candidate: BlueprintEntry): BlueprintEntry | null {
  const area = candidate.w * candidate.h;
  if (area <= 0) return null;
  let best: BlueprintEntry | null = null;
  let bestOverlap = 0;
  for (const entry of previous) {
    if (entry.kind !== candidate.kind || entry.status === "planned") continue;
    const overlap = overlapArea(candidate, entry);
    if (overlap / area < INHERIT_MIN_OVERLAP || overlap <= bestOverlap) continue;
    best = entry;
    bestOverlap = overlap;
  }
  return best;
}

/**
 * 세션의 활성 밑그림에 청사진을 맞춘다 — 스펙이 없으면 지운다.
 *
 * 고스트(초안)는 한 턴짜리지만 BuildSpec 은 세션 것이다(assistantSession.applyBuildSpec:
 * "검증 통과 시 활성화(턴 간 유지)"). 청사진 정리를 clearAgentGhostPreview 에 묶어 뒀을 때는
 * 적용 경로(aiProposalCard.applyProposal 이 적용 직전에 고스트를 지운다)가 **처음 시공한 턴의
 * 끝에서 청사진을 지웠고**, set_build_spec 은 다음 턴에 다시 오지 않으므로 그 뒤로는 영원히 빈
 * 상태였다(패널은 "밑그림 확정 — 에셋 N개" 를 계속 출력했다). 마지막 칸의 done ✓ 도 확정과
 * 정리가 같은 턴 꼬리에서 일어나 볼 수 없었다. 그래서 청사진의 수명을 **세션 스펙**에 맨다.
 */
export function syncAgentBlueprintWithSpec(spec: BuildSpec | null): void {
  if (spec === null) {
    clearAgentBlueprint();
    return;
  }
  applySpec(spec);
}

/**
 * 이번 턴의 시공이 저장소에 들어갔다 — 밑그림은 할 일을 다 했으므로 캔버스에서 물러난다.
 *
 * 지금 깔린 칸을 전부(진행 상태와 무관하게) 물러난 것으로 기록한다. 모델이 건너뛴 에셋은 채팅의
 * 「⚠ 미이행」 경고가 이미 말하고 있고, 시공이 끝난 맵 위에 파랑 계획을 계속 두는 것은 사용자가
 * 결과물을 보는 데 방해만 된다. 다음 턴이 같은 스펙을 다시 맞춰도(syncAgentBlueprintWithSpec) 이
 * 칸들은 그려지지 않는다 — 그 턴에 새로 덧붙은 칸(자동 확장)만 계획으로 나온다.
 * 적용되지 않은 턴(중단·오류·게이트 거부)은 부르지 않는다: 계획은 아직 유효하다.
 */
export function retireAgentBlueprint(): void {
  turnAdvanced = new Set();
  if (entries.length === 0 || mapId === null) return;
  if (retiredMapId !== mapId) retiredKeys = new Set();
  retiredMapId = mapId;
  for (const entry of entries) retiredKeys.add(entryShapeKey(entry));
  entries = [];
  emit();
}

/**
 * 공간 쓰기 툴콜 하나가 들어왔을 때 청사진 진행을 갱신한다.
 *
 * 판정은 누적 커버리지 퍼센트가 아니라 **인과 순서**다: 이번 호출이 가장 잘 맞아떨어지는
 * 칸들(bestOverlapIndices — 칸이 덮인 비율로 뽑고 덮은 만큼 벗겨내며 되풀이한다)을 `building`
 * 으로 올리고, 그 전에 `building` 이던 다른 칸은 `done` 으로 내린다. 한 호출이 여러 칸을
 * 올릴 수 있다 — 집 여러 채를 한 호출로 짓는 `author_house kind=lots` 가 그 경로다.
 * 누적 퍼센트를 쓰지 않는 이유는 한 에셋이 여러 툴콜로 쪼개져 들어오기
 * 때문이다(집 한 채 = paint 여러 번) — 비율은 그럴 때 조용히 거짓말을 하고, 순서는 그러지 않는다.
 *
 * 영역은 `blueprintRegionsForToolCall`(청사진 전용 추출)이 뽑는다 — 스펙 게이트의
 * `affectedRegions` 는 좌표를 wrapper 키(`area`/`at`/`wallRect`/`origin`)에 담는 툴을 면적 0 으로
 * 떨어뜨리는데(게이트에는 맞는 fail-closed 동작이다) 청사진이 그대로 받으면 진행이 한 칸도
 * 안 움직인다. 사유는 그 모듈 머리말에 있다.
 *
 * 세 가지를 막는다. 전부 실측된 오작동이다.
 * 1. **읽기 툴**(`mode !== "write"`): 패널의 tool_call 훅은 성공한 모든 툴콜에서 발화하고
 *    show_map_region/get_map_region 은 `{mapId,x,y,w,h}` 를 그대로 받는다. show_map_region 의
 *    설명이 "맵에 뭔가 깐 뒤 이 툴로 눈으로 확인하라" 이므로 시공 직후의 정상 경로인데,
 *    영역이 진짜 사각형이라 IoU 승자가 바뀌어 **아직 짓는 중인 칸이 done 으로 밀려났다**.
 * 2. **위치를 모르는 호출**: 인자에 좌표가 아예 없는 쓰기 툴이 있다(wallRect 없는 build_roof 는
 *    맵의 벽 어휘 셀을 스캔해 자리를 스스로 찾는다). 폴백 `(0,0)` 은 시공 위치가 아니라 상수라서
 *    점으로 귀속하면 맵 전체를 덮는 1번 칸(clear)이 항상 이기고 나머지 칸이 전부 done 으로
 *    밀려난다. 위치를 모르면 침묵한다.
 * 3. **done → building 역주행**: 끝난 칸을 다시 짓는 중으로 표시하면 그 사이 칸들이 done 으로
 *    확정돼 "다 지었다"는 거짓 표시가 남는다.
 */
export function markAgentBlueprintProgress(
  toolName: string,
  args: Record<string, unknown>,
  mode: BlueprintToolCallMode
): void {
  if (!mode.write) return;
  if (entries.length === 0 || mapId === null) return;
  const call = blueprintRegionsForToolCall(toolName, args);
  // 한 호출의 영역은 모두 같은 맵이다(affectedRegions·이 모듈 둘 다 mapId 하나로 만든다) —
  // 맵 판정은 위 한 줄로 끝났으므로 영역마다 다시 보지 않는다.
  if (call.mapId !== mapId) return;
  const regions = call.regions.filter((region) => region.w > 0 && region.h > 0);
  // 대상 전체를 한 호출로 짓는 파사드(author_village)는 한 칸으로 귀속하지 않는다 — 아래 함수 주석.
  if (call.wholeTarget) {
    advanceAllPlanned(regions);
    return;
  }
  if (regions.length === 0) return;
  const targets = new Set(bestOverlapIndices(entries, regions));
  // planned 만 building 으로 올린다 — 같은 칸 반복 호출은 그대로 두고, done 은 되돌리지 않는다.
  const advancing = new Set([...targets].filter((index) => entries[index].status === "planned"));
  if (advancing.size === 0) return;

  entries = entries.map((entry, index) => {
    if (advancing.has(index)) return { ...entry, status: "building" };
    // 이번 호출이 건드리지 않은 칸이 아직 짓는 중이면 앞 칸이므로 내린다(정산이 다시 검증한다).
    if (entry.status === "building" && !targets.has(index)) return { ...entry, status: "done" };
    return entry;
  });
  for (const index of advancing) turnAdvanced.add(entryShapeKey(entries[index]));
  emit();
}

/**
 * 대상 전체를 짓는 파사드 한 호출 — 걸리는 planned 칸을 **전부** 짓는 중으로 올린다.
 *
 * 왜 한 칸을 고르지 않는가: `author_village` 한 호출이 정리·길·집·소품·주민을 다 만든다. 후보
 * 사각형을 하나 만들어 IoU 로 고르면(맵 사각형을 대신 넣든 target.bounds 를 쓰든) 맵 전체를
 * 덮는 `clear` 칸이 이기고 나머지 칸은 계획 상태로 남는다 — 1차 리뷰에서 고친 결함(큰 칸이
 * 항상 이긴다)의 재발이다. "이 호출이 모든 칸을 건드렸다"를 그대로 표시하는 것이 실제로 일어난
 * 일에 가장 가깝다.
 *
 * `regions` 가 비어 있으면(bounds 없는 호출 = 대상 전체) 그 맵의 planned 칸 전부, 있으면 그
 * 영역에 걸리는 칸만 올린다 — 북쪽 절반에 지은 마을이 남쪽 계획을 끌고 가지 않는다.
 * done 은 되돌리지 않고(역주행 금지), 확정은 턴 끝의 settleAgentBlueprintTurn 이 한다 — 그때
 * 적용이 들어가지 않았으면 여기서 올린 칸은 전부 planned 로 되돌아간다.
 */
function advanceAllPlanned(regions: readonly AffectedRegion[]): void {
  const touched = (entry: BlueprintEntry): boolean =>
    entry.status === "planned" && (regions.length === 0 || regions.some((region) => overlapArea(entry, region) > 0));
  if (!entries.some(touched)) return;
  entries = entries.map((entry) => (touched(entry) ? { ...entry, status: "building" } : entry));
  for (const entry of entries) {
    if (entry.status === "building") turnAdvanced.add(entryShapeKey(entry));
  }
  emit();
}

/**
 * 턴이 시작됐다 — 지난 턴의 "이번 턴에 올린 칸" 기록을 버린다.
 *
 * `turnAdvanced` 는 턴 끝 정산(settleAgentBlueprintTurn)이나 마일스톤 확정
 * (commitAgentBlueprintProgress)에서 비워진다. 그런데 패널에는 그 둘 중 **아무것도 지나지 않는**
 * 종료 경로가 있다: `!ownsTurn(true)` 반환(프로젝트 전환·패널 폐기로 소유권을 잃은 턴)은 정산을
 * 건너뛰고 바로 나간다. 그러면 지난 턴의 기록이 다음 턴의 정산까지 살아남아, 이번 턴이 손대지도
 * 않은 칸을 "적용 안 됨" 으로 planned 로 되돌린다. 오늘 그 일이 실제로 안 나는 이유는
 * dropSession/dispose 가 `clearAgentBlueprint()` 로 청사진을 함께 지우기 때문이다 — **결합에
 * 의한 안전**이라 그 호출이 하나 빠지는 순간 조용히 깨진다. 턴 시작에서 명시적으로 끊는다.
 *
 * 상태(칸)는 건드리지 않으므로 emit 하지 않는다 — 이 기록은 공개 상태가 아니다.
 */
export function beginAgentBlueprintTurn(): void {
  turnAdvanced = new Set();
}

/**
 * 턴이 끝났다 — 이번 턴에 올린 칸을 **적용이 실제로 들어갔는지**로 가른다.
 * 들어간 영역에 걸리면 `done`, 걸리지 않으면 `planned` 로 되돌린다.
 *
 * 종전에는 종료 경로마다 "짓는 중을 done 으로 확정" 만 했다. 그런데 패널의 다섯 종료 경로 중
 * 셋(중단 return, catch 두 개)은 applyProposal **앞에서** 끝난다 — 초안은 그대로 버려지고
 * 저장소는 한 칸도 바뀌지 않는데 청사진에는 회색 ✓ 가 박혔다(실측: 같은 툴콜을 정상 종료와
 * 중단으로 각각 돌려 store 변경 true/false, 청사진은 양쪽 다 done). 그리고 이 표시는 세션이
 * 죽을 때까지 풀리지 않는다 — markAgentBlueprintProgress 는 planned 가 아닌 칸을 다시 올리지
 * 않고 syncAgentBlueprintWithSpec 은 done 을 사각형 기준으로 물려받는다. 즉 시공 중 한 번의
 * 중단이 손도 안 댄 타일 위에 "완료" 를 영구히 칠했다. 이 기능이 없애려던 바로 그 거짓이다.
 *
 * 그래서 종료 **분기**가 아니라 **적용 결과**로 정산한다. 중단이라고 전부 되돌리는 것도 틀렸다:
 * 자율 런은 마일스톤을 턴 도중에 커밋하므로(assistantSession.maybeAutoApplyMilestone) 중단
 * 전에 실제로 들어간 시공이 있다 — 그 몫은 commitAgentBlueprintProgress 가 그 시점에 확정한다.
 */
export function settleAgentBlueprintTurn(applied: AppliedBlueprintRegions): void {
  if (turnAdvanced.size === 0) return;
  // bounds 없는 파사드는 영역을 인자에 남기지 않는다 — 그 맵이면 이번 턴 진행분을 그대로 인정한다.
  const wholeMap = mapId !== null && applied.wholeTargetMapIds.includes(mapId);
  const landed = (entry: BlueprintEntry): boolean =>
    wholeMap || applied.regions.some((region) => region.mapId === mapId && overlapArea(entry, region) > 0);
  const next = entries.map((entry) =>
    turnAdvanced.has(entryShapeKey(entry))
      ? { ...entry, status: landed(entry) ? ("done" as const) : ("planned" as const) }
      : entry
  );
  turnAdvanced = new Set();
  if (sameEntries(entries, next)) return;
  entries = next;
  emit();
}

/**
 * 여기까지의 진행분이 저장소에 들어갔다 — 짓는 중이던 칸을 끝난 것으로 확정한다.
 *
 * 자율 런의 마일스톤 커밋 시점에 부른다(패널의 milestone_applied). 그 커밋은 턴 도중에
 * 일어나고 적용된 제안을 turnProposals 에서 지우므로(=턴 결과에 남지 않는다) 턴 끝의
 * settleAgentBlueprintTurn 이 그 몫을 "적용 안 됨" 으로 되돌리면 안 된다.
 */
export function commitAgentBlueprintProgress(): void {
  turnAdvanced = new Set();
  if (!entries.some((entry) => entry.status === "building")) return;
  entries = entries.map((entry) => (entry.status === "building" ? { ...entry, status: "done" } : entry));
  emit();
}

export function clearAgentBlueprint(): void {
  turnAdvanced = new Set();
  retiredMapId = null;
  retiredKeys = new Set();
  if (entries.length === 0 && mapId === null) return;
  mapId = null;
  entries = [];
  emit();
}

/**
 * 이번 호출이 진행시킨 칸들 — 영역이 여러 개면 **한 칸으로 접지 않는다**.
 *
 * 실측 결함: 시스템 프롬프트는 집 2채 이상을 `author_house kind=lots + houses[]` **한 호출**로
 * 짓게 글자 그대로 지시한다(contextBuilder: "개별 single 반복 금지"). 그 호출의 게이트 영역은
 * 집마다 몸통+마당 2장씩 정확히 나오는데(buildSpec.wingsRegions), 전체를 합쳐 승자 하나만
 * 고르면 집 3채 중 1채만 building 이 되고 나머지 2채는 뒤에 오는 호출이 없으므로 영원히
 * 파랑으로 남았다(3채 호출 실측: {house_a:"building", house_b:"planned", house_c:"planned"}).
 *
 * 그렇다고 영역마다 독립으로 승자를 고르면 1차 리뷰가 고친 결함이 다른 얼굴로 돌아온다:
 * 1×1 점 하나만 보면 "그 점을 담은 가장 작은 칸" 이 이기므로, 집 사각형을 지나는 길을 칠하면
 * 집 안을 통과하는 점들이 길 대신 집을 뽑아 집까지 building 으로 올라간다(이 모듈의 첫
 * 테스트가 그 상황이다 — main_road(0,12,30,2) 와 house_a(10,10,6,5) 는 12칸 겹친다).
 *
 * 그래서 **덮은 만큼 벗겨내는** 탐욕법을 쓴다: 남은 영역 전체로 승자를 뽑고(합산 판정이라
 * 여러 호출로 쪼개진 한 에셋을 하나로 본다), 그 칸이 덮는 영역을 빼고 남은 것이 있으면 다시
 * 뽑는다. 길 60칸은 첫 승자(길)가 60칸을 모두 덮으므로 한 칸으로 끝나고, 서로 안 겹치는 집
 * N채는 N칸이 다 나온다. 매 회 최소 한 영역이 사라지므로 칸 수만큼 돌면 멈춘다.
 */
function bestOverlapIndices(candidates: readonly BlueprintEntry[], regions: readonly AffectedRegion[]): number[] {
  const winners: number[] = [];
  let remaining: readonly AffectedRegion[] = regions;
  while (remaining.length > 0) {
    const index = bestCoveredIndex(candidates, remaining);
    if (index === -1) break;
    winners.push(index);
    const winner = candidates[index];
    remaining = remaining.filter((region) => overlapArea(winner, region) === 0);
  }
  return winners;
}

/**
 * 이번 호출과 가장 잘 맞아떨어지는 칸 — **그 칸이 얼마나 덮였는지**(겹침 / 칸 면적)로 고른다.
 * 동점이면 겹침 면적이 큰 칸, 그래도 같으면 순번이 앞선 칸(strict `>`).
 *
 * 절대 면적으로 고르면 큰 칸이 항상 이긴다: 마을 계획은 보통 맵 전체를 덮는 `clear` 에셋을
 * 1번 칸으로 두는데, 길 60칸을 칠하면 길과의 겹침도 60, clear 와의 겹침도 60 이라 동점이 되고
 * 순서가 앞선 clear 가 계속 building 으로 남는다(1차 리뷰가 잡은 결함). 커버리지는 길 60/60=1.0
 * 대 clear 60/600=0.1 로 갈라주고, 맵 전체를 치우는 호출에서는 전 칸이 1.0 으로 동점이 되므로
 * 겹침 면적 타이브레이크가 clear(600)를 골라 준다 — 나머지 칸은 벗겨내기에서 사라져 올라가지
 * 않는다(맵을 잔디로 덮는 것은 집을 짓는 것이 아니다).
 *
 * **왜 IoU 를 버렸는가(3차 리뷰의 미완 수정)**: IoU 는 분모에 영역 합계가 들어가므로 한 호출이
 * 영역을 많이 낼수록 개별 칸의 점수가 1/N 로 깎인다. 집 N채 lots 호출에서 집의 IoU = 자기
 * 면적/Σ영역, `clear` 의 IoU = Σ영역/맵면적 이라 **N 이 커지는 순간 clear 가 이기고** 벗겨내기가
 * 첫 회에 영역 전량을 먹어 집이 한 칸도 안 올라갔다. 실측(맵 30×20, 몸통 5×6+마당 3행):
 * N=2 → 2/2, N=3 → 3/3, **N=4 → 0/4, N=5 → 0/5, 40×30 N=6 → 0/6, 100×100 N=20 → 0/20**.
 * 3차 리뷰가 붙인 테스트가 N=3(교차점 N≈3.65 바로 아래)에 앉아 있어 통과했을 뿐이고,
 * `author_village` 의 기본값은 `houseCount: 4` 다 — 즉 주경로가 전부 깨진 상태였다.
 * 커버리지는 분모가 칸 면적이라 N 과 무관하다. `clear` 가 집을 이기려면
 * Σ(칸 안에 칠해진 면적)/맵면적 > 자기 면적/자기 칸면적 이어야 하는데, 계획의 칸들은 맵 안에
 * 서로 겹치지 않게 들어가므로(validateBuildSpec) Σ칸면적 ≤ 맵면적 이고, 집이 자기 칸을 그대로
 * 칠하는 정상 경로에서는 집이 1.0 으로 절대 지지 않는다.
 *
 * 영역이 여러 개면 겹침을 합쳐서 계산한다 — 영역끼리 겹치면 이중 계산이 되므로 1.0 으로
 * 자른다(자르지 않으면 같은 칸을 두 번 지나는 경로가 칸 면적보다 큰 겹침을 만들어 정확히
 * 일치하는 다른 칸을 이긴다). 면적이 0 인 영역은 호출자가 이미 걸러 낸다.
 * 아무 칸도 안 걸리면 -1.
 */
function bestCoveredIndex(candidates: readonly BlueprintEntry[], regions: readonly AffectedRegion[]): number {
  let bestIndex = -1;
  let bestScore = 0;
  let bestIntersection = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const entry = candidates[index];
    let intersection = 0;
    for (const region of regions) {
      intersection += overlapArea(entry, region);
    }
    if (intersection <= 0) continue;
    const entryArea = entry.w * entry.h;
    const score = entryArea > 0 ? Math.min(1, intersection / entryArea) : 0;
    if (score < MIN_ATTRIBUTION_COVERAGE) continue;
    if (score > bestScore || (score === bestScore && intersection > bestIntersection)) {
      bestScore = score;
      bestIntersection = intersection;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function overlapArea(entry: BlueprintEntry, region: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }): number {
  if (region.w <= 0 || region.h <= 0) return 0;
  const x0 = Math.max(entry.x, region.x);
  const y0 = Math.max(entry.y, region.y);
  const x1 = Math.min(entry.x + entry.w, region.x + region.w);
  const y1 = Math.min(entry.y + entry.h, region.y + region.h);
  if (x1 <= x0 || y1 <= y0) return 0;
  return (x1 - x0) * (y1 - y0);
}

/** 진행 상태를 물려받을 때 쓰는 동일성 — id 가 같아도 사각형이 움직였으면 다른 칸이다. */
function entryShapeKey(entry: BlueprintEntry): string {
  return `${entry.id}:${entry.x},${entry.y},${entry.w},${entry.h}`;
}

function sameEntries(a: readonly BlueprintEntry[], b: readonly BlueprintEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry, index) => {
    const other = b[index];
    return entryShapeKey(entry) === entryShapeKey(other)
      && entry.status === other.status
      && entry.order === other.order
      && entry.label === other.label
      && entry.shape === other.shape;
  });
}

function normalizeAsset(asset: SpecAsset): { x: number; y: number; w: number; h: number } | null {
  const x = Math.trunc(asset.x);
  const y = Math.trunc(asset.y);
  const w = Math.trunc(asset.w);
  const h = Math.trunc(asset.h);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (w <= 0 || h <= 0) return null;
  return { x, y, w, h };
}

function emit(): void {
  revision += 1;
  const snapshot = getAgentBlueprintState();
  for (const listener of listeners) listener(snapshot);
}
