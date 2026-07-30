// 낡은 export 에 남은 속성/상태 비율 키를 정리한다.
//
// 실측 배경(2026-07-26): 샘플 데모 픽스처(dew-village-demo.json)의 적 35명 전원이
// elementRates 에 `state_death` 를 갖고 있었다. state_death 는 **속성이 아니고**(정의된 속성은
// sword/spear/hit/bow/fire/... ) 정의된 상태 목록에도 없다 — 옛 DB 버전의 잔재다.
//
// 심각도: 역직렬화는 성공하고 전투 계산도 알 수 없는 키를 무시하므로 게임은 돌아간다.
// 그런데 projectLint 가 error 35건을 내뿜어 **진짜 오류를 덮는다**. map-audit 스킬이 run_lint 로
// 시작하기 때문에, 이 잡음이 있으면 AI 도 사람도 "오류 35건" 앞에서 판단을 포기한다.
//
// 기본 DB(createBlankProject)와 잿불의 유산에는 이 키가 없다 — 픽스처에서만 나온다.

import type { Project } from "@/project/types";

export interface RateKeyRepairResult {
  /** 키가 제거된 레코드 수(적 + 클래스 + 액터). */
  readonly records: number;
  /** 제거된 키 이름(중복 없음). */
  readonly removedKeys: readonly string[];
}

/** 값이 있는 키만 남기고, 알려진 id 집합에 없는 키는 버린다. */
function prune(
  rates: Record<string, unknown> | undefined,
  known: ReadonlySet<string>,
  removed: Set<string>,
): { changed: boolean; next: Record<string, unknown> } {
  const next: Record<string, unknown> = {};
  let changed = false;
  for (const [key, value] of Object.entries(rates ?? {})) {
    if (known.has(key)) {
      next[key] = value;
      continue;
    }
    removed.add(key);
    changed = true;
  }
  return { changed, next };
}

/** elementRates/stateRates 를 가진 레코드 — 적·클래스·액터가 같은 형태를 공유한다. */
interface RateHolder {
  elementRates?: Record<string, unknown>;
  stateRates?: Record<string, unknown>;
}

/**
 * 정의되지 않은 elementRates/stateRates 키를 제거한다. project 를 제자리에서 수정한다.
 *
 * 적만 고쳤다가 클래스·액터에도 같은 잔재가 남아 오류가 계속 나왔다(실측). 세 종류를 함께 본다.
 */
export function repairLegacyRateKeys(project: Project): RateKeyRepairResult {
  // elements/states 는 옛 저장본에서 없을 수 있다. 없으면 "알려진 키 없음" 이 되어 전부 지워지므로
  // 그 경우엔 아무것도 하지 않는다 — 정보가 없을 때 지우는 것은 복구가 아니라 파괴다.
  const elementList = project.database.elements;
  const stateList = project.database.states;
  if (!elementList || !stateList) return { records: 0, removedKeys: [] };
  const elements = new Set(elementList.map((record) => record.id));
  const states = new Set(stateList.map((record) => record.id));
  const removed = new Set<string>();
  let records = 0;

  const holders: RateHolder[] = [
    ...(project.database.enemies as unknown as RateHolder[]),
    ...(project.database.classes as unknown as RateHolder[]),
    ...(project.database.actors as unknown as RateHolder[]),
  ];
  for (const holder of holders) {
    const element = prune(holder.elementRates, elements, removed);
    const state = prune(holder.stateRates, states, removed);
    if (!element.changed && !state.changed) continue;
    if (element.changed) holder.elementRates = element.next;
    if (state.changed) holder.stateRates = state.next;
    records += 1;
  }
  return { records, removedKeys: [...removed] };
}
