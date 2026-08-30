// 이벤트 페이지 가려짐(shadow) 판정 — "여러 페이지를 만들었는데 한 장만 나온다"의 정체.
//
// 런타임(`io/pageResolution.resolveEventPage`)은 페이지 배열을 **뒤에서 앞으로** 훑어 조건이 모두
// 참인 첫 페이지 **하나만** 활성화한다. 즉 동시에 사는 페이지는 언제나 1장이고, 뒤 페이지가 앞
// 페이지를 덮는다(RM2K3 의미).
//
// 따라서 뒤 페이지의 조건 집합이 앞 페이지 조건 집합의 **부분집합**이면, 앞 페이지 조건이 참인 모든
// 세션에서 뒤 페이지도 참이므로 앞 페이지는 영원히 발동하지 않는다. 조건이 0개인 무조건 페이지는
// 자기 앞의 모든 페이지를 가린다(공집합은 모든 집합의 부분집합).
//
// 실측 배경: 에디터 AI 에게 "랜덤하게 대사 치는 NPC"를 요청하면 대사 후보를 페이지로 나눠 담았다.
// 페이지 4장 전부 조건이 비어 있었으므로 런타임은 마지막 1장만 실행했고, 나머지 3장은 죽은 데이터로
// 남았다. 판정 자체는 순수 함수이므로 툴 경고·프로젝트 린트·explain_event 가 같은 근거를 공유한다.
import type { EventPage, EventPageCondition } from "./types";

export interface ShadowedPage {
  /** 가려진(죽은) 페이지의 0-based 인덱스. */
  readonly index: number;
  readonly pageId: string;
  /** 실제로 대신 실행되는 페이지의 0-based 인덱스 — 조건이 맞는 마지막 페이지다. */
  readonly byIndex: number;
  readonly byPageId: string;
  readonly byUnconditional: boolean;
}

/** `all: [a, b]` 는 `[a, b]` 와 같다 — 중첩을 풀어 집합 비교가 표기 차이에 속지 않게 한다. */
function flattenConditions(conditions: readonly EventPageCondition[]): readonly EventPageCondition[] {
  const flat: EventPageCondition[] = [];
  for (const condition of conditions) {
    if (condition.kind === "all") {
      flat.push(...flattenConditions(condition.conditions));
      continue;
    }
    flat.push(condition);
  }
  return flat;
}

function canonicalKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalKey).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${canonicalKey(entryValue)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function conditionKeys(conditions: readonly EventPageCondition[] | undefined): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const condition of flattenConditions(conditions ?? [])) keys.add(canonicalKey(condition));
  return keys;
}

function isSubset(candidate: ReadonlySet<string>, of: ReadonlySet<string>): boolean {
  for (const key of candidate) {
    if (!of.has(key)) return false;
  }
  return true;
}

/**
 * 절대 발동하지 않는 페이지를 앞에서부터 열거한다.
 *
 * 판정은 보수적이다 — 조건 집합의 부분집합 관계만 본다. 서로 다른 조건이 사실상 같은 뜻이거나
 * (변수 `>= 0` 처럼) 항상 참인 경우까지 추론하지는 않으므로, 보고된 항목은 전부 진짜 죽은 페이지다.
 */
export function findShadowedPages(pages: readonly EventPage[] | undefined): readonly ShadowedPage[] {
  const list = pages ?? [];
  if (list.length < 2) return [];
  const keys = list.map((page) => conditionKeys(page.conditions));
  const shadowed: ShadowedPage[] = [];
  for (let index = 0; index < list.length - 1; index += 1) {
    const own = keys[index];
    if (!own) continue;
    // 뒤에서부터 찾는다 — 런타임이 고르는 것은 조건이 맞는 **마지막** 페이지다.
    for (let later = list.length - 1; later > index; later -= 1) {
      const laterKeys = keys[later];
      if (!laterKeys || !isSubset(laterKeys, own)) continue;
      shadowed.push({
        index,
        pageId: list[index]?.id ?? `pages[${index}]`,
        byIndex: later,
        byPageId: list[later]?.id ?? `pages[${later}]`,
        byUnconditional: laterKeys.size === 0,
      });
      break;
    }
  }
  return shadowed;
}

/** 랜덤 대사·단계 진행을 페이지로 하려다 실패한 저작을 고치는 방법 — 경고마다 한 번만 붙인다. */
export const PAGE_SHADOW_FIX_HINT =
  "페이지는 대사 후보가 아니라 상태별 변형이다. 랜덤 대사는 한 페이지 안에서 "
  + "m2Command(commandId:\"m2-211-weighted-branch\", fields:{table:\"0=1\\n1=1\\n2=1\", resultVariableId})로 뽑고 "
  + "fork(variable) 로 갈라라. 순서대로 진행하려면 setSelfSwitch 로 단계를 올리고 각 페이지에 selfSwitch 조건을 걸어라.";

export function describeShadowedPage(shadow: ShadowedPage, pageCount: number): string {
  const dead = `페이지 ${shadow.index + 1}/${pageCount}('${shadow.pageId}')`;
  const winner = `페이지 ${shadow.byIndex + 1}('${shadow.byPageId}')`;
  const reason = shadow.byUnconditional
    ? `${winner}가 조건 없는 페이지라 항상 이깁니다`
    : `${winner}의 조건이 이 페이지 조건에 포함돼 항상 함께 참입니다`;
  return `${dead}는 절대 발동하지 않습니다 — 런타임은 조건이 맞는 마지막 페이지 하나만 실행하고, ${reason}.`;
}

export function shadowedPageWarnings(label: string, pages: readonly EventPage[] | undefined): readonly string[] {
  const shadows = findShadowedPages(pages);
  if (shadows.length === 0) return [];
  const count = (pages ?? []).length;
  return [
    ...shadows.map((shadow) => `${label} ${describeShadowedPage(shadow, count)}`),
    PAGE_SHADOW_FIX_HINT,
  ];
}
