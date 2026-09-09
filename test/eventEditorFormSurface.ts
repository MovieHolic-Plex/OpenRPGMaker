// test/eventEditorFormSurface.ts
//
// kind 별 편집 폼의 "표면"을 구조 다이제스트로 수확한다.
// 목적: 폼 로직을 갈아엎어도(스키마 이행 / M2 헬퍼 추출 / kind 지식 통합) 사용자가 보는
// 컨트롤이 사라지거나 타입이 바뀌면 즉시 빨강이 되게 한다.
//
// 다이제스트에 담는 것 (원시 HTML 이 아니다 — 클래스·순서 변경에 흔들리지 않게):
//   testids       : 폼이 내는 data-testid 전량(정렬)
//   tags          : tagName 히스토그램 — details→div 같은 태그 퇴화를 잡는다
//   tagByTestid   : testid → tagName. 같은 testid 가 다른 태그로 바뀌면 잡는다
//   controls      : stableKey → "tag[type]{상태플래그}" — 위치 + 가시성/활성 상태를 함께 본다
//   selectOptions : select stableKey → option value 목록. enum 선택지 유실을 잡는다
//   labels        : 사용자가 읽는 라벨/버튼 텍스트(정렬) — 한국어 라벨 드리프트를 잡는다
//   texts         : 검증/경고/미리보기 노드의 정규화 텍스트 — 검증 로직 소실을 잡는다
//   classes       : 이 폼이 쓰는 클래스 전량(정렬)
//   counts        : testid 총수, 컨트롤 총수
//
// ── 이전 판(집계형)이 놓쳤던 구멍과 이 판의 대책 (전부 실측된 구멍이다) ────────────────
//
//  구멍 4 — hidden/disabled/속성을 안 봤다.
//    `syncVisibility()` 호출을 지워도, 6개 폼에서 hidden 극성을 뒤집어도 다이제스트가 동일했다.
//    → 대책: `controls` 값에 상태 플래그(hidden/disabled/readonly/checked/required/nodisplay)를
//      결정적 순서로 굽는다.
//
//  구멍 5 — 태그 이름을 안 봤고 컨트롤에 위치 정보가 없었다.
//    `details` → `div` 로 바꿔도(클래스·testid 유지) 통과했다. `controls` 가 `tag[type] → 개수`
//    집계라, A 컨트롤이 사라지고 B 컨트롤이 생기면 개수가 같아 통과했다.
//    → 대책: `controls` 를 stableKey → 값 맵으로 바꾸고, `tags` / `tagByTestid` 를 추가한다.
//
//  검증 경고 텍스트가 전부 안 보였다 — 검증 로직을 통째로 지워도 초록이었다.
//    → 대책: `texts` 축. 숫자를 마스킹해 DB 수량 증감에는 흔들리지 않게 한다.
//
//  stableKey 가 래퍼 삽입에 깨졌다 — 조상 testid + tag 경로(`wrap>div>div>select`)였으므로
//    리팩터가 `div` 하나만 더 감싸도 24개 selectOptions 키가 전부 바뀌어 거짓 빨강이 났다.
//    안전망이 잡음을 내면 사람은 무조건 `*_UPDATE=1` 로 갱신하고, 그러면 진짜 소실도 승인된다.
//    → 대책: 경로를 버리고 "가장 가까운 조상 testid + 자기 tagName + 그 서브트리 안 문서순
//      ordinal" 로 바꿨다. 중간 div 를 더 감싸도 키가 불변이다
//      (test/eventEditorFormSurface.baseline.test.ts 의 "래퍼 삽입 불변성" 테스트가 증명한다).
//
//  기준선의 27~30% 가 DB 내용이었다 — 아이템 카탈로그를 늘리면 폼과 무관하게 빨개졌다.
//    → 대책: `createBlankProject()` 대신 고정 캡처 프로젝트(`createCaptureProject()`)를 쓴다.
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { store } from "@/project/store";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import {
  M2_COMMAND_CATALOG,
  createDefaultM2Fields,
  type M2CommandCatalogEntry,
} from "@/project/eventCommands/m2Catalog";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { createCaptureProject } from "./fixtures/captureProject";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";

export type FormSurface = {
  readonly testids: string[];
  /**
   * stableKey → `tag[type]{플래그}`.
   *
   * 형식을 고른 이유: 값은 항상 `{...}` 를 붙이고 플래그가 없으면 `{}` 로 통일한다.
   * (a) 파싱·grep 이 한 가지 모양만 다루면 되고, (b) 플래그가 "0개 → 1개"로 바뀌는 변이가
   * 문자열 길이 변화로 눈에 띄고, (c) 조건부 접미사는 미래에 플래그를 추가할 때
   * 기존 기준선 전체를 흔든다. 플래그 순서는 알파벳 고정이라 삽입 순서에 무관하다.
   */
  readonly controls: Record<string, string>;
  readonly selectOptions: Record<string, string[]>;
  readonly labels: string[];
  /** tagName(소문자) → 개수. `details` → `div` 퇴화 같은 태그 교체를 잡는다. */
  readonly tags: Record<string, number>;
  /** testid → tagName(소문자). 구멍 5 의 정면 대책 — testid 를 유지한 태그 교체를 잡는다. */
  readonly tagByTestid: Record<string, string>;
  /**
   * 검증/경고/미리보기 텍스트. stableKey → 정규화 텍스트(숫자 마스킹).
   * 폼이 내는 오류·경고·의도 요약이 통째로 사라지는 걸 잡는다.
   */
  readonly texts: Record<string, string>;
  /**
   * 이 폼이 쓰는 클래스 전량(정렬). CSS 정리(과제 C)와 헬퍼 추출(과제 B)의 안전망이다 —
   * testid 를 그대로 두고 클래스만 떨어뜨리는 사고가 실측으로 확인됐다.
   * 이 목록이 CSS 게이트의 "실사용 클래스" 정본 역할도 한다.
   * ⚠ scripts/check-css-live-classes.mjs 가 이 배열을 최상위 `classes` 로 읽는다 —
   *   이름을 바꾸거나 중첩시키면 그 게이트가 죽는다.
   */
  readonly classes: string[];
  readonly testidCount: number;
  readonly controlCount: number;
  readonly error?: string;
};

const noopActions: CommandListActions = {
  addCommand: () => undefined,
  insertCommand: () => undefined,
  replaceCommand: () => undefined,
  deleteCommand: () => undefined,
  moveCommand: () => undefined,
  moveCommandTo: () => undefined,
};

/** 컨트롤로 취급하는 셀렉터 — controlCount 와 controls 맵이 같은 집합을 본다. */
const CONTROL_SELECTOR = "input, select, textarea, button";

/** 검증/경고/미리보기 성격의 testid. 이 노드들의 텍스트를 texts 축에 담는다. */
const TEXT_TESTID_RE = /(error|warning|preview|intent|summary|hint|note|badge)/i;

function tagOf(node: Element): string {
  return node.tagName.toLowerCase();
}

function testidOf(node: Element): string | undefined {
  return (node as HTMLElement).dataset?.testid || undefined;
}

/** `input` 은 type 까지 봐야 의미가 있다 — number 가 text 로 퇴화하면 잡아야 한다. */
function controlType(node: Element): string {
  const tag = tagOf(node);
  if (tag === "input") return `input[${node.getAttribute("type") ?? "text"}]`;
  return tag;
}

/**
 * 상태 플래그. 알파벳 고정 순서로 방출한다(속성 선언 순서에 흔들리지 않게).
 * `nodesplay` 가 아니라 `nodisplay` — 인라인 `style.display:none` 은 이 저장소가 실제로 쓰는
 * 숨김 수단이고, hidden 속성만 보면 syncVisibility 변이의 절반을 놓친다.
 */
function stateFlags(node: Element): string {
  const flags: string[] = [];
  const anyNode = node as HTMLInputElement;
  if (anyNode.checked === true) flags.push("checked");
  if (node.hasAttribute("disabled") || anyNode.disabled === true) flags.push("disabled");
  if (node.hasAttribute("hidden") || (node as HTMLElement).hidden === true) flags.push("hidden");
  const display = (node as HTMLElement).style?.display;
  if (display === "none") flags.push("nodisplay");
  if (node.hasAttribute("readonly") || anyNode.readOnly === true) flags.push("readonly");
  if (node.hasAttribute("required") || anyNode.required === true) flags.push("required");
  return `{${flags.sort().join(",")}}`;
}

/**
 * 안정 식별자.
 *  1) 자기 testid 가 있으면 그것.
 *  2) 없으면 가장 가까운 조상 testid + `>` + 자기 tagName + `#` + 그 조상 서브트리 안에서
 *     같은 tagName 노드들 중 문서순 몇 번째인지(0-base).
 *  3) 조상 testid 가 아예 없으면 `:root>tag#n` (root = 수확 루트).
 *
 * 왜 경로가 아니라 ordinal 인가: 리팩터가 레이아웃용 `div` 를 하나 더 감싸는 것은 표면 변경이
 * 아니다. 경로 기반 키는 그때 전부 바뀌어 거짓 빨강을 냈다(실측 24개 키).
 */
export function stableKey(node: Element, root: Element): string {
  const own = testidOf(node);
  if (own) return own;
  const tag = tagOf(node);
  let scope: Element = root;
  let scopeLabel = ":root";
  let cur: Element | null = node.parentElement;
  while (cur) {
    const id = testidOf(cur);
    if (id) {
      scope = cur;
      scopeLabel = id;
      break;
    }
    if (cur === root) break;
    cur = cur.parentElement;
  }
  const siblings = Array.from(scope.querySelectorAll(tag));
  const ordinal = siblings.indexOf(node);
  return `${scopeLabel}>${tag}#${ordinal < 0 ? 0 : ordinal}`;
}

/**
 * 키 충돌 해소. 같은 testid 가 두 번 나오는 폼이 실제로 있다(리스트 행 템플릿).
 * 문서 순서로 `~2`, `~3` 을 붙인다 — 결정적이고, 충돌 자체가 눈에 보인다.
 */
function uniqueKey(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let n = 2;
  while (used.has(`${base}~${n}`)) n += 1;
  const key = `${base}~${n}`;
  used.add(key);
  return key;
}

/**
 * 텍스트 정규화: 공백 압축 → 숫자 마스킹 → 200자 절단.
 *
 * 숫자를 `#` 로 마스킹하는 이유: "아이템 208종 → 256종" 같은 DB 증감이 경고 문구에 섞여
 * 게이트를 빨갛게 만들면, 사람은 통째로 갱신하고 그 diff 안의 진짜 문구 소실도 승인된다.
 * 마스킹하면 "경고 문구가 사라졌다"는 잡히고 "수량이 늘었다"는 안 잡힌다.
 */
function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/\d+/g, "#").slice(0, 200);
}

/**
 * 실효 가시성(effective visibility) 내려찍기 + 되돌리기.
 *
 * `stateFlags` 는 **컨트롤 자신의** `hidden` / `style.display` 만 본다. 그런데 이 저장소가
 * 실제로 쓰는 조건부 표시 수단은 컨트롤이 아니라 **필드 래퍼** 토글이다
 * (실측: `commandBodyVariable.ts:146` `numberField.hidden = useVariable`). 그래서 이 단계가
 * 없으면 "초기 동기화 호출을 지웠다" 같은 변이가 다이제스트에서 완전히 투명하다
 * (실측: `syncVisibility-초기호출-누락` 변이가 폼 축 exit 0 으로 통과했다).
 *
 * 조상이 숨겨져 있으면 같은 숨김 수단을 컨트롤에 임시로 찍고, 수확 후 **반드시 되돌린다.**
 * 되돌리지 않으면 다음 수확이 "이미 hidden" 을 원래 상태로 착각한다. 이미 자기 자신에게
 * 찍혀 있던 노드는 건드리지 않으므로 중첩 호출도 안전하다(상호작용 축이 밖에서 한 번 더 감싼다).
 *
 * ⚠ 한계: 검증 경고 `<p hidden>` 처럼 **컨트롤이 아닌 노드**의 표시/숨김은 여전히 안 보인다.
 */
function markEffectiveVisibility(root: Element): () => void {
  const undos: (() => void)[] = [];
  const visit = (node: Element, hiddenAbove: boolean, noDisplayAbove: boolean): void => {
    const html = node as HTMLElement;
    const ownHidden = node.hasAttribute("hidden") || html.hidden === true;
    const ownNoDisplay = html.style?.display === "none";
    const hidden = hiddenAbove || ownHidden;
    const noDisplay = noDisplayAbove || ownNoDisplay;

    if (node.matches(CONTROL_SELECTOR)) {
      if (hidden && !ownHidden) {
        node.setAttribute("hidden", "");
        undos.push(() => node.removeAttribute("hidden"));
      }
      if (noDisplay && !ownNoDisplay) {
        const previous = html.style.display;
        html.style.display = "none";
        undos.push(() => {
          html.style.display = previous;
        });
      }
    }
    for (const child of Array.from(node.children)) visit(child, hidden, noDisplay);
  };
  // 루트 자신의 숨김도 본다 — 폼 전체가 래퍼째 숨겨지는 경우가 실재한다.
  visit(root, false, false);
  return () => {
    for (const undo of undos.reverse()) undo();
  };
}

/**
 * 이미 렌더된 엘리먼트에서 표면을 뽑는다.
 * 렌더와 분리한 이유: "래퍼를 삽입해도 키가 불변"이라는 성질을 DOM 변형 + 재수확으로
 * 증명할 수 있어야 한다(테스트가 실제로 그렇게 한다).
 *
 * 수확 중에만 실효 가시성을 DOM 에 임시로 찍고 끝나면 되돌린다 — 관측 결과는 순수하지만
 * 호출 중에는 DOM 을 만진다.
 */
export function harvestSurface(root: Element): FormSurface {
  const undoVisibility = markEffectiveVisibility(root);
  try {
    return harvestInPlace(root);
  } finally {
    undoVisibility();
  }
}

function harvestInPlace(root: Element): FormSurface {
  const testids = new Set<string>();
  const tagByTestid: Record<string, string> = {};
  const tags: Record<string, number> = {};

  const allNodes = [root, ...Array.from(root.querySelectorAll("*"))];
  for (const node of allNodes) {
    const tag = tagOf(node);
    tags[tag] = (tags[tag] ?? 0) + 1;
    const id = testidOf(node);
    if (id) {
      testids.add(id);
      // 같은 testid 가 중복되면 첫 노드의 태그를 정본으로 삼는다(문서 순서라 결정적).
      if (!(id in tagByTestid)) tagByTestid[id] = tag;
    }
  }

  const controlNodes = Array.from(root.querySelectorAll(CONTROL_SELECTOR));
  const controls: Record<string, string> = {};
  const controlKeys = new Set<string>();
  for (const node of controlNodes) {
    const key = uniqueKey(stableKey(node, root), controlKeys);
    controls[key] = `${controlType(node)}${stateFlags(node)}`;
  }

  const selectOptions: Record<string, string[]> = {};
  const selectKeys = new Set<string>();
  for (const sel of Array.from(root.querySelectorAll("select"))) {
    const key = uniqueKey(stableKey(sel, root), selectKeys);
    selectOptions[key] = Array.from(sel.querySelectorAll("option")).map(
      (o) => o.getAttribute("value") ?? (o.textContent ?? "")
    );
  }

  const labels = new Set<string>();
  for (const node of Array.from(root.querySelectorAll("label, button, legend, summary"))) {
    // 라벨은 숫자를 마스킹하지 않는다. "선택지 1 / 2 / 3", "자릿수 4", "1번 스위치" 처럼
    // 숫자가 곧 식별자·개수 의미를 갖는 라벨이 많고, 마스킹하면 선택지 3개가 1개로
    // 줄어드는 진짜 회귀가 "선택지 #" 하나로 접혀 보이지 않는다.
    // DB 유래 숫자 잡음은 고정 캡처 프로젝트(항목 3개 절단)가 이미 막는다.
    const t = (node.textContent ?? "").trim().replace(/\s+/g, " ");
    if (t && t.length <= 60) labels.add(t);
  }

  const texts: Record<string, string> = {};
  const textKeys = new Set<string>();
  for (const node of allNodes) {
    const id = testidOf(node);
    if (!id || !TEXT_TESTID_RE.test(id)) continue;
    const value = normalizeText(node.textContent ?? "");
    texts[uniqueKey(stableKey(node, root), textKeys)] = value;
  }

  const classes = new Set<string>();
  for (const node of allNodes) {
    for (const c of Array.from(node.classList ?? [])) classes.add(c);
  }

  return {
    testids: Array.from(testids).sort(),
    classes: Array.from(classes).sort(),
    controls: sortRecord(controls),
    selectOptions: sortRecord(selectOptions),
    labels: Array.from(labels).sort(),
    tags: sortRecord(tags),
    tagByTestid: sortRecord(tagByTestid),
    texts: sortRecord(texts),
    testidCount: testids.size,
    controlCount: controlNodes.length,
  };
}

function sortRecord<V>(input: Record<string, V>): Record<string, V> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** 실패 표면 — error 만 채운 빈 다이제스트. */
function errorSurface(e: unknown): FormSurface {
  return {
    testids: [],
    classes: [],
    controls: {},
    selectOptions: {},
    labels: [],
    tags: {},
    tagByTestid: {},
    texts: {},
    testidCount: 0,
    controlCount: 0,
    error: `${(e as Error).name}: ${(e as Error).message}`.slice(0, 200),
  };
}

export function captureFormSurface(kind: CommandKind): FormSurface {
  return captureCommandSurface(MINIMAL_COMMANDS[kind]);
}

/** 렌더만 하고 엘리먼트를 돌려준다 — 변형 실험(래퍼 삽입 등)이 필요한 테스트용. */
export function renderCommandSurfaceRoot(cmd: Command): HTMLElement {
  // 고정 캡처 프로젝트. createBlankProject() 를 쓰면 기준선의 27~30% 가 DB 레코드 id 가 되고
  // 아이템 카탈로그 증감만으로 게이트가 빨개진다(fixtures/captureProject.ts 주석 참조).
  const descriptor = Object.getOwnPropertyDescriptor(window, "setInterval");
  const schedule: Window["setInterval"] = window.setInterval;
  const intervals: number[] = [];
  // Static captures keep the initial rendered state, but own every interval
  // created while constructing it, including callers that harvest the root later.
  Object.defineProperty(window, "setInterval", {
    configurable: true,
    value: (handler: TimerHandler, timeout?: number, ...args: unknown[]): number => {
      const timer = schedule.call(window, handler, timeout, ...args);
      intervals.push(timer);
      return timer;
    },
  });
  try {
    store.replace(createCaptureProject());
    return renderCommandBody({ path: [0], actions: noopActions, lockKind: true }, cmd);
  } finally {
    if (descriptor) Object.defineProperty(window, "setInterval", descriptor);
    else Reflect.deleteProperty(window, "setInterval");
    for (const timer of intervals) window.clearInterval(timer);
  }
}

export function captureCommandSurface(cmd: Command): FormSurface {
  try {
    return harvestSurface(renderCommandSurfaceRoot(cmd));
  } catch (e) {
    return errorSurface(e);
  }
}

export function captureAllFormSurfaces(): Record<string, FormSurface> {
  const out: Record<string, FormSurface> = {};
  for (const kind of COMMAND_KINDS) out[kind] = captureFormSurface(kind);
  return out;
}

/**
 * m2Command 축. kind 는 하나지만 폼은 commandId 로 갈린다 —
 * commandBodyM2Actor / commandBodyM2Page3 / commandBodyM2 가 이 축을 나눠 담당한다.
 */
export function captureM2Surface(entry: M2CommandCatalogEntry): FormSurface {
  const cmd: Command = { kind: "m2Command", commandId: entry.id, fields: createDefaultM2Fields(entry) };
  return captureCommandSurface(cmd);
}

/**
 * 이 항목이 **빈 폴백 껍데기**로 렌더됐는가.
 *
 * `commandBodyM2.ts` 는 전용 폼들을 차례로 시도하고(actor → weighted → page3 → eraseEvent),
 * 아무것도 안 잡히면 `m2-command-body-<commandId>` 래퍼를 만들어 `fields` 를 제네릭으로 그린다.
 * 그 래퍼가 있고 컨트롤이 0개면, 그 항목은 "이름만 있고 편집할 게 없는" 껍데기다.
 *
 * 선언(`bodyStrategy`)이 아니라 **렌더 결과**로 판정하는 이유는 아래 주석 참조.
 */
function isEmptyFallbackShell(entry: M2CommandCatalogEntry, surface: FormSurface): boolean {
  return surface.controlCount === 0 && surface.testids.includes(`m2-command-body-${entry.id}`);
}

/**
 * M2 축 분할. 카탈로그 **전량**을 렌더한 뒤, 빈 폴백 껍데기만 스냅샷에서 뺀다.
 *
 * ── 왜 `bodyStrategy === "existing"` 로 빼면 안 되는가 (실측) ──────────────────────
 * 원래 이 축은 `bodyStrategy !== "existing"` 로 42종을 통째로 뺐다. 근거는 "existing 항목은
 * `fields: []` 라 전부 같은 껍데기가 나온다"였는데, 42종 중 **4종은 전용 폼을 낸다**:
 *   m2-051-show-picture(testid 9/컨트롤 5), m2-053-erase-picture(5/1),
 *   m2-067-key-input-processing(20/5), m2-071-change-tile(10/5)
 * `renderPage3M2CommandBody` 가 `bodyStrategy` 가 아니라 `entry.title` 로 분기하기 때문이다.
 * `bodyStrategy` 는 `existingKind ? "existing" : fields.length > 0 ? "generic" : "none"` 이라
 * `existingKind` 가 있으면 전용 폼과 필드가 둘 다 있어도 "existing" 이 된다.
 *
 * 이 누락은 CSS 실사용 정본에서 잡혔다: `keyInputProcessingBody` 의 `.actor-m2-keycap*` 7종이
 * 렌더 증명 집합에서 사라졌다(정본 총량은 늘고 있었는데도).
 *
 * ── 껍데기를 빼는 건 유지한다 ────────────────────────────────────────────────────
 * 38종은 실제로 표면이 동일하다(testid 2 / 컨트롤 0 / 클래스 4). 기준선에 38번 같은 걸 박으면
 * 숫자만 부풀고, 이 항목들의 실제 편집 폼은 kind 축이 전량 감시한다.
 * 대신 제외 목록을 **정확히 못 박는다**(m2AliasCoverage.json 의 shellAliasIds) — 전용 폼이
 * 죽으면 그 항목이 껍데기로 떨어져 조용히 축에서 빠지는데, 그게 바로 막아야 할 일이다.
 */
export function partitionM2Surfaces(): {
  surfaces: Record<string, FormSurface>;
  snapshotIds: string[];
  shellIds: string[];
} {
  const surfaces: Record<string, FormSurface> = {};
  const snapshotIds: string[] = [];
  const shellIds: string[] = [];
  for (const entry of m2CatalogSorted()) {
    const surface = captureM2Surface(entry);
    surfaces[entry.id] = surface;
    if (entry.bodyStrategy === "existing" && isEmptyFallbackShell(entry, surface)) shellIds.push(entry.id);
    else snapshotIds.push(entry.id);
  }
  return { surfaces, snapshotIds, shellIds };
}

/** 스냅샷 대상만 남긴 표면 맵. */
export function captureAllM2Surfaces(): Record<string, FormSurface> {
  const { surfaces, snapshotIds } = partitionM2Surfaces();
  return Object.fromEntries(snapshotIds.map((id) => [id, surfaces[id]]));
}

/** 카탈로그 전량, id 정렬. */
export function m2CatalogSorted(): M2CommandCatalogEntry[] {
  return [...M2_COMMAND_CATALOG].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * 네이티브 kind 별칭 항목(`bodyStrategy === "existing"`, 실측 42종). id 정렬.
 * 이 중 4종은 전용 폼도 갖기 때문에 **스냅샷 제외 목록과 같지 않다** — 별칭→kind 계약용이다.
 */
export function m2AliasEntries(): M2CommandCatalogEntry[] {
  return m2CatalogSorted().filter((entry) => entry.bodyStrategy === "existing");
}

// ── 기준선 diff / 하한선 지표 ────────────────────────────────────────────────────────
// 폼 축과 M2 축이 같은 diff 를 써야 한다. 축마다 따로 쓰면 새 축(tags/tagByTestid/texts)이
// 한쪽에만 반영되고, 반영 안 된 축은 조용히 무보증이 된다(실제로 그렇게 되어 있었다).

function listDelta(before: readonly string[], after: readonly string[]): { lost: string[]; added: string[] } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    lost: before.filter((x) => !a.has(x)),
    added: after.filter((x) => !b.has(x)),
  };
}

function mapDelta<V>(
  before: Record<string, V>,
  after: Record<string, V>
): { lost: string[]; added: string[]; changed: string[] } {
  const lost = Object.keys(before).filter((k) => !(k in after));
  const added = Object.keys(after).filter((k) => !(k in before));
  const changed = Object.keys(before).filter(
    (k) => k in after && JSON.stringify(before[k]) !== JSON.stringify(after[k])
  );
  return { lost, added, changed };
}

function cap(items: readonly string[], n = 8): string {
  return items.length <= n ? items.join(", ") : `${items.slice(0, n).join(", ")}, …+${items.length - n}`;
}

/**
 * 기준선 ↔ 현재 표면 차이를 사람이 읽는 줄로 바꾼다. 같으면 빈 배열.
 * 축 하나라도 빠지면 그 축은 무보증이므로, 새 축을 FormSurface 에 추가할 때 여기도 반드시 늘린다.
 */
export function diffFormSurface(_key: string, before: FormSurface, after: FormSurface): string[] {
  const parts: string[] = [];

  if ((before.error ?? null) !== (after.error ?? null)) {
    parts.push(`렌더 오류 ${before.error ?? "없음"} → ${after.error ?? "없음"}`);
  }

  const ids = listDelta(before.testids, after.testids);
  if (ids.lost.length) parts.push(`testid 소실 ${ids.lost.length}종 [${cap(ids.lost)}]`);
  if (ids.added.length) parts.push(`testid 신규 ${ids.added.length}종 [${cap(ids.added)}]`);

  // 태그 교체(details→div 등). testid 를 유지한 태그 퇴화는 tagByTestid 만 잡는다.
  const tagSwap = Object.keys(before.tagByTestid)
    .filter((id) => id in after.tagByTestid && before.tagByTestid[id] !== after.tagByTestid[id])
    .map((id) => `${id}: ${before.tagByTestid[id]}→${after.tagByTestid[id]}`);
  if (tagSwap.length) parts.push(`태그 교체 ${tagSwap.length}종 [${cap(tagSwap, 6)}]`);

  const tagHist = mapDelta(before.tags, after.tags);
  const histLines = [
    ...tagHist.lost.map((t) => `${t} 소멸(${before.tags[t]})`),
    ...tagHist.added.map((t) => `${t} 등장(${after.tags[t]})`),
    ...tagHist.changed.map((t) => `${t} ${before.tags[t]}→${after.tags[t]}`),
  ];
  if (histLines.length) parts.push(`태그 개수 [${cap(histLines, 8)}]`);

  // controls 는 이제 맵이다 — 개수 집계로는 "A 사라지고 B 생김"이 상쇄돼 통과했다.
  const ctl = mapDelta(before.controls, after.controls);
  if (ctl.lost.length) parts.push(`컨트롤 소실 ${ctl.lost.length}개 [${cap(ctl.lost)}]`);
  if (ctl.added.length) parts.push(`컨트롤 신규 ${ctl.added.length}개 [${cap(ctl.added)}]`);
  if (ctl.changed.length) {
    parts.push(
      `컨트롤 값 변경 ${ctl.changed.length}개 [${cap(
        ctl.changed.map((k) => `${k}: ${before.controls[k]}→${after.controls[k]}`),
        6
      )}]`
    );
  }

  const sel = mapDelta(before.selectOptions, after.selectOptions);
  if (sel.lost.length) parts.push(`select 소실 ${sel.lost.length}개 [${cap(sel.lost)}]`);
  if (sel.added.length) parts.push(`select 신규 ${sel.added.length}개 [${cap(sel.added)}]`);
  if (sel.changed.length) {
    parts.push(
      `select 선택지 변경 ${sel.changed.length}개 [${cap(
        sel.changed.map(
          (k) => `${k}: ${before.selectOptions[k].length}→${after.selectOptions[k].length}종`
        ),
        6
      )}]`
    );
  }

  const txt = mapDelta(before.texts, after.texts);
  if (txt.lost.length) parts.push(`검증텍스트 소실 ${txt.lost.length}개 [${cap(txt.lost)}]`);
  if (txt.added.length) parts.push(`검증텍스트 신규 ${txt.added.length}개 [${cap(txt.added)}]`);
  if (txt.changed.length) {
    parts.push(
      `검증텍스트 변경 ${txt.changed.length}개 [${cap(
        txt.changed.map((k) => `${k}: "${before.texts[k].slice(0, 40)}"→"${after.texts[k].slice(0, 40)}"`),
        4
      )}]`
    );
  }

  const lab = listDelta(before.labels, after.labels);
  if (lab.lost.length) parts.push(`라벨 소실 ${lab.lost.length}개 [${cap(lab.lost, 6)}]`);
  if (lab.added.length) parts.push(`라벨 신규 ${lab.added.length}개 [${cap(lab.added, 6)}]`);

  const cls = listDelta(before.classes, after.classes);
  if (cls.lost.length) parts.push(`클래스 소실 ${cls.lost.length}개 [${cap(cls.lost)}]`);
  if (cls.added.length) parts.push(`클래스 신규 ${cls.added.length}개 [${cap(cls.added)}]`);

  return parts;
}

/** 모든 select 의 option value 총 개수 — 하한선 지표. */
export function selectOptionCount(surface: FormSurface): number {
  return Object.values(surface.selectOptions).reduce((sum, list) => sum + list.length, 0);
}

/**
 * 하한선 지표. 기준선이 갱신으로 무엇이든 정답이 되는 걸 막는 두 번째 벽이라,
 * "줄어들면 안 되는 것"만 담는다(태그 히스토그램처럼 리팩터로 정당하게 줄 수 있는 건 제외).
 */
export function formSurfaceMetrics(surface: FormSurface): Record<string, number> {
  return {
    testidCount: surface.testidCount,
    controlCount: surface.controlCount,
    selectOptionCount: selectOptionCount(surface),
    classCount: surface.classes.length,
    labelCount: surface.labels.length,
    textCount: Object.keys(surface.texts).length,
  };
}
