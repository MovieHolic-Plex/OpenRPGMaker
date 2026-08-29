// test/eventEditorInteractionSurface.ts
//
// **상호작용 후 폼 표면** 축. 컨트롤을 하나 조작한 뒤 폼이 어떻게 바뀌는지를 수확한다.
//
// ── 왜 이 축이 따로 필요한가 (기존 축들의 사각) ────────────────────────────────────────
//
//  폼 축(eventEditorFormSurface.ts)은 **초기 렌더 한 장면만** 본다. `controls` 값에
//  `{hidden,disabled,…}` 플래그를 굽지만 그건 조작 전 상태다. 그래서:
//    · 초기 1회 `syncVisibility()` 호출을 지우면 → 폼 축이 잡는다.
//    · 조작 시 다시 동기화하는 `change` 핸들러를 지우면 → **아무도 안 잡는다.**
//
//  커밋 프로브 축은 조작 결과로 **저장되는 커맨드 객체**를 본다. 조작 결과로 **화면이 어떻게
//  바뀌는지**는 안 본다. 즉 "select 를 바꿨는데 관련 입력칸이 나타나지 않는다"는 회귀가
//  모든 게이트를 통과한다(스키마 이행이 조건부 표시 로직을 통째로 잃어도 초록이다).
//
//  이 축은 컨트롤 하나를 조작하고 **폼 표면 전후를 diff** 해서 그 사각을 메운다.
//  diff 는 폼 축의 `diffFormSurface` 를 그대로 재사용한다 — 축마다 diff 가 갈라지면
//  하나는 반드시 뒤처지고, 뒤처진 축은 조용히 무보증이 된다.
//
// ── CSS 게이트에 대한 이 축의 고유 기여 ────────────────────────────────────────────────
//
//  최상위 `classes` 는 **조작 후 표면들의 클래스 합집합**이다. 조건부로만 나타나는 UI
//  (숨은 칸이 드러날 때 붙는 클래스, 조작 후 렌더되는 미리보기 블록 등)의 CSS 는
//  초기 렌더만 보는 폼 축에서는 "미사용"으로 보인다. scripts/check-css-live-classes.mjs 가
//  표면 기준선 JSON 을 재귀로 훑어 모든 `classes` 배열을 실사용 정본으로 읽으므로,
//  이 축의 기준선이 그 클래스들의 유일한 증거다.
//  ⚠ `classes` 는 반드시 최상위 이름 그대로 둔다. 중첩·개명하면 CSS 게이트가 죽는다.
//
// ── 실측된 함정과 대책 ────────────────────────────────────────────────────────────────
//
//  1) 컨트롤마다 **fresh 렌더**가 필수다. `change` 를 디스패치하면 폼이 내부를
//     `replaceChildren()` 으로 다시 그리는 경로가 있어(commandBodyAdvanced/M2Actor/Page3Native
//     등에서 실측) 이전 NodeList 가 무효화된다. 한 번 렌더해서 컨트롤을 순서대로 다 만지면
//     두 번째 이후 조작은 사라진 노드를 만지게 되고 결과는 조용히 "변화 없음"이 된다.
//
//  2) 마커 값은 **현재 값과 반드시 달라야 한다.** 같으면 `change` 가 나도 아무 일이 없어
//     거짓 "변화 없음"이 된다. select 는 현재 선택이 아닌 option, number 는 min/max/step 을
//     존중한 다른 값(범위를 벗어나면 브라우저가 값을 잘라 결정성이 깨진다).
//
//  3) 폼이 **루트를 교체**할 수 있다. 그래서 렌더 결과를 컨테이너 div 에 담고
//     **컨테이너를 수확한다.** 루트가 교체돼도 수확이 공허해지지 않는다. 교체가 실제로
//     일어나면 반응 문자열에 `[루트교체]` 마커가 남고, 그래도 표면이 비면
//     `collapsed:` 로 기록해 게이트가 하드 실패시킨다.
//
//  4) `button` 은 제외한다. 클릭이 피커/모달을 열어 `document.body` 를 오염시키는 게
//     실측됐고(포털 축이 그쪽을 따로 담당한다), 오염된 body 는 다음 kind 의 수확까지
//     흔든다. 여기서 보려는 것은 "값 변경에 따른 조건부 표시"라 버튼은 대상이 아니다.
//
//  5) 체크박스/라디오를 뒤집으면 **자기 `{checked}` 플래그**가 바뀌므로 diff 는 항상
//     비지 않는다. 그걸 "반응"으로 세면 반응 목록의 절반이 "체크박스가 체크된다"는
//     DOM 기본 동작이 되어 래칫이 희석된다. 그래서 자기 항목만 변한 경우는
//     `self-only` 로 따로 기록하고 반응으로 세지 않는다.
//
//  6) **래퍼에 걸린 `hidden` 은 폼 축 다이제스트에 안 보인다.** `harvestSurface` 는 상태
//     플래그를 컨트롤 노드에만 굽는데, 이 저장소의 조건부 표시 로직은 대부분 **필드 래퍼**를
//     숨긴다(실측: `commandBodyVariable.ts` 의 `numberField.hidden = useVariable`,
//     `numberField` 는 `<label class="inline-field …">` 이고 안에 input 이 있다).
//     그래서 브리핑이 대표 예시로 든 `setVariable` 의 피연산자 종류 select 조차 처음 측정에서
//     `no-change` 로 나왔다 — 폼이 정상 반응했는데 수확이 못 본 것이다.
//     → 대책: 수확 직전에 **실효 가시성(effective visibility)** 을 컨트롤 자신에게 내려
//        찍고(조상이 hidden 이면 컨트롤에 hidden 속성, 조상이 display:none 이면 컨트롤에
//        display:none), 수확 후 **원래대로 되돌린다.** 조작 전/후 양쪽에 똑같이 적용하므로
//        diff 는 "실효 가시성이 바뀌었다"만 보고한다. DOM 을 복제하지 않고 되돌리는 이유:
//        `cloneNode` 는 프로그램으로 설정한 dirty 상태(`.checked`, `.value`)를 잃어
//        조작 자체가 사라진다.
//     ⚠ 한계: 검증 경고 `<p hidden>` 같은 **비컨트롤 노드의 표시/숨김**은 여전히 안 보인다
//        (텍스트 내용이 함께 바뀌는 경로는 `texts` 축이 잡는다). 보고서에 남긴다.
//     ※ 2026-08-30: 이 대책은 `harvestSurface` **안으로 들어갔다**. 이 축만 고쳐 놓으면
//        폼/M2 축은 여전히 눈이 멀어 있고, 실제로 `syncVisibility-초기호출-누락` 소스 변이가
//        폼 축을 exit 0 으로 통과했다. 그래서 여기서는 `harvestSurface` 를 그대로 부른다.
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import type { Command } from "@/project/types";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import {
  diffFormSurface,
  harvestSurface,
  renderCommandSurfaceRoot,
  stableKey,
  type FormSurface,
} from "./eventEditorFormSurface";

export type InteractionSurface = {
  /** stableKey → 조작 후 표면 변화 요약 (변화 없으면 "no-change") */
  readonly reactions: Record<string, string>;
  /** 초기 렌더 표면 — classes 를 CSS 정본에 기여시키기 위해 담는다 */
  readonly initial: FormSurface;
  /** 조작 후 표면들의 클래스 합집합. 조작으로만 나타나는 클래스가 여기 잡힌다 */
  readonly classes: string[];
  readonly probeCount: number;
  readonly reactingCount: number;
  readonly error?: string;
};

/**
 * 폼 축과 **같은 컨트롤 집합**을 열거해야 키가 어긋나지 않는다.
 * (폼 축 `CONTROL_SELECTOR` 와 동일 문자열 — 여기서 button 을 빼면 중복 testid 충돌
 *  번호(`~2`)가 폼 축과 달라져 `initial.controls` 키와 대조가 안 된다.)
 */
const CONTROL_SELECTOR = "input, select, textarea, button";

/** 조작 대상에서 뺄 태그. 이유는 파일 머리 주석 4) 참조. */
const EXCLUDED_TAGS = new Set(["button"]);

/** 조작 불가로 기록하는 input type. */
const UNSUPPORTED_INPUT_TYPES = new Set(["hidden", "file", "submit", "reset", "button", "image"]);

/** 반응으로 세지 않는 기록값. 접두사 비교라 뒤에 상세가 붙어도 판정이 같다. */
const NON_REACTION_PREFIXES = [
  "no-change",
  "self-only",
  "single-option",
  "no-options",
  "unsupported:",
  "unprobable:",
  "probe-error:",
] as const;

/** 반응 요약 문자열 최대 길이. 넘으면 절단 사실을 문자열에 남긴다. */
const SUMMARY_LIMIT = 300;

/**
 * 폼이 루트를 갈아치웠을 때 붙는 접두 마커. 판정 함수들은 이걸 **먼저 떼고** 본다 —
 * 안 떼면 `"[루트교체] no-change"` 가 "반응함"으로 세어져 래칫이 조용히 헐거워진다.
 */
const REROOT_MARKER = "[루트교체] ";

function withoutMarker(value: string): string {
  return value.startsWith(REROOT_MARKER) ? value.slice(REROOT_MARKER.length) : value;
}

/**
 * 오류가 난 프로브의 스택. 기준선 JSON 에 넣지 않는다 — 스택에는 절대 경로가 섞여
 * 기계마다 달라지고, 그러면 결정성 검사가 무너진다. 게이트 실패 메시지에서만 읽는다.
 */
const errorStacks = new Map<string, string>();

/** kind → 오류 스택(앞 4프레임). 오류가 없으면 빈 맵. */
export function interactionErrorStacks(): Record<string, string> {
  return Object.fromEntries([...errorStacks.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
}

export function isReactionValue(value: string): boolean {
  const bare = withoutMarker(value);
  return !NON_REACTION_PREFIXES.some((prefix) => bare === prefix || bare.startsWith(prefix));
}

/**
 * 키 충돌 해소 — 폼 축 `uniqueKey` 와 **같은 규칙**이어야 한다(문서순 `~2`, `~3`).
 * 폼 축이 export 하지 않으므로 복제한다. 규칙이 갈라지면 `initial.controls` 키와
 * `reactions` 키가 어긋나 리뷰가 불가능해진다.
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

type ControlEntry = { node: Element; key: string; tag: string; type: string };

/** 컨테이너 안 컨트롤 전량을 폼 축과 동일한 키로 열거한다(문서순). */
function enumerateControls(container: Element): ControlEntry[] {
  const used = new Set<string>();
  return Array.from(container.querySelectorAll(CONTROL_SELECTOR)).map((node) => {
    const tag = node.tagName.toLowerCase();
    return {
      node,
      key: uniqueKey(stableKey(node, container), used),
      tag,
      type: tag === "input" ? (node.getAttribute("type") ?? "text").toLowerCase() : tag,
    };
  });
}

/**
 * 렌더 결과를 컨테이너에 담아 돌려준다. 수확은 항상 **컨테이너** 기준이다(함정 3).
 * 컨테이너는 클래스·testid 가 없는 순수 래퍼라 표면에 `div` 1개만 더한다.
 */
function renderIntoContainer(cmd: Command): { container: HTMLElement; root: HTMLElement } {
  const root = renderCommandSurfaceRoot(cmd);
  const container = root.ownerDocument.createElement("div");
  container.appendChild(root);
  return { container, root };
}

/**
 * 실효 가시성을 반영한 표면 수확. 조작 전/후 양쪽에서 동일하게 쓴다.
 *
 * 내려찍기 로직 자체는 `harvestSurface` 안으로 옮겼다(함정 6 주석 참고) — 여기만 고치면
 * 폼/M2 축은 그대로 눈이 멀어 있기 때문이다. 이 얇은 별칭은 "조작 전/후 같은 방식으로
 * 수확한다"는 축의 계약을 이름으로 남겨 두기 위해 유지한다.
 */
function harvestEffective(container: Element): FormSurface {
  return harvestSurface(container);
}

function numberAttr(node: Element, name: string): number | undefined {
  const raw = node.getAttribute(name);
  if (raw === null || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

/** 부동소수 잔재(0.30000000000000004)를 없앤 결정적 문자열. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}

/**
 * 현재값과 다른 숫자를 min/max/step 안에서 고른다.
 * 범위를 벗어나는 값을 넣으면 값이 잘려(clamp) 실제 조작이 안 되거나 결과가 비결정적이다.
 */
function nextNumberValue(node: HTMLInputElement): string | undefined {
  const min = numberAttr(node, "min");
  const max = numberAttr(node, "max");
  const rawStep = node.getAttribute("step");
  const step = rawStep && rawStep !== "any" && Number.isFinite(Number(rawStep)) ? Math.abs(Number(rawStep)) : 1;
  const parsed = Number(node.value);
  const current = Number.isFinite(parsed) && node.value.trim() !== "" ? parsed : (min ?? 0);

  const candidates = [current + step, current - step, min, max].filter(
    (value): value is number => value !== undefined && Number.isFinite(value)
  );
  for (const candidate of candidates) {
    if (candidate === current) continue;
    if (min !== undefined && candidate < min) continue;
    if (max !== undefined && candidate > max) continue;
    return formatNumber(candidate);
  }
  return undefined;
}

/** select 에서 현재 선택이 아닌 첫 option value. 없으면 이유를 돌려준다. */
function nextSelectValue(node: HTMLSelectElement): { value: string } | { reason: string } {
  const options = Array.from(node.querySelectorAll("option"));
  if (options.length === 0) return { reason: "no-options" };
  const current = node.value;
  for (const option of options) {
    if (option.hasAttribute("disabled")) continue;
    const value = option.getAttribute("value") ?? option.textContent ?? "";
    if (value !== current) return { value };
  }
  return { reason: "single-option" };
}

/** 조작을 시도한다. 성공하면 undefined, 못 하면 기록할 이유 문자열. */
function mutateControl(entry: ControlEntry): string | undefined {
  const { node, tag, type } = entry;
  if (tag === "select") {
    const picked = nextSelectValue(node as HTMLSelectElement);
    if ("reason" in picked) return picked.reason;
    (node as HTMLSelectElement).value = picked.value;
    return undefined;
  }
  if (tag === "textarea") {
    const area = node as HTMLTextAreaElement;
    area.value = area.value === "__probe__" ? "__probe2__" : "__probe__";
    return undefined;
  }
  const input = node as HTMLInputElement;
  if (UNSUPPORTED_INPUT_TYPES.has(type)) return `unsupported:${type}`;
  if (type === "checkbox" || type === "radio") {
    input.checked = !input.checked;
    return undefined;
  }
  if (type === "number" || type === "range") {
    const next = nextNumberValue(input);
    if (next === undefined) return "unprobable:number-range";
    input.value = next;
    return undefined;
  }
  if (type === "color") {
    input.value = input.value.toLowerCase() === "#123456" ? "#654321" : "#123456";
    return undefined;
  }
  // text / search / 그 외 텍스트 계열(email, url, tel, password, date …)
  input.value = input.value === "__probe__" ? "__probe2__" : "__probe__";
  return undefined;
}

/** `input` → `change` 순서로 둘 다 쏜다 — 폼마다 듣는 이벤트가 다르다(실측). */
function dispatchInteraction(node: Element): void {
  const view = node.ownerDocument?.defaultView as (Window & typeof globalThis) | null;
  const EventCtor = view?.Event ?? Event;
  node.dispatchEvent(new EventCtor("input", { bubbles: true }));
  node.dispatchEvent(new EventCtor("change", { bubbles: true }));
}

function compact(parts: readonly string[]): string {
  const joined = parts.join(" | ");
  if (joined.length <= SUMMARY_LIMIT) return joined;
  return `${joined.slice(0, SUMMARY_LIMIT)}…(절단: 총 ${joined.length}자)`;
}

/**
 * 조작 대상 자신의 상태 플래그 변화를 되돌린 사본.
 * 체크박스를 뒤집으면 자기 `{checked}` 가 바뀌어 diff 가 항상 비지 않는다(함정 5).
 * 이 사본으로 다시 diff 해서 "자기 말고 다른 게 바뀌었나"를 본다.
 */
function withoutSelfChange(before: FormSurface, after: FormSurface, key: string): FormSurface {
  if (!(key in after.controls) || !(key in before.controls)) return after;
  return { ...after, controls: { ...after.controls, [key]: before.controls[key] } };
}

function firstFrames(error: unknown, count = 4): string {
  const stack = (error as Error)?.stack ?? "";
  return stack.split("\n").slice(0, count + 1).join("\n");
}

/** 실패 표면 — 렌더 자체가 죽었을 때. */
function errorSurface(kindLabel: string, error: unknown, initial: FormSurface): InteractionSurface {
  errorStacks.set(kindLabel, firstFrames(error));
  return {
    reactions: {},
    initial,
    classes: [],
    probeCount: 0,
    reactingCount: 0,
    error: `${(error as Error).name}: ${(error as Error).message}`.slice(0, 200),
  };
}

const EMPTY_INITIAL: FormSurface = {
  testids: [],
  controls: {},
  selectOptions: {},
  labels: [],
  tags: {},
  tagByTestid: {},
  texts: {},
  classes: [],
  testidCount: 0,
  controlCount: 0,
};

/**
 * 커맨드 하나의 상호작용 표면을 수확한다.
 *
 * @param kindLabel 오류 스택 사이드채널의 키(보통 kind 이름)
 */
export function captureInteractionSurface(cmd: Command, kindLabel: string): InteractionSurface {
  let initial: FormSurface = EMPTY_INITIAL;
  try {
    const first = renderIntoContainer(cmd);
    initial = harvestEffective(first.container);
    // 프로브 계획은 초기 렌더에서 세운다. 인덱스로 다시 찾는 이유: 조작마다 fresh 렌더라
    // 노드 참조를 재사용할 수 없다(함정 1). 렌더가 결정적이므로 인덱스는 안정적이다.
    const plan = enumerateControls(first.container)
      .map((entry, index) => ({ index, key: entry.key, tag: entry.tag, type: entry.type }))
      .filter((entry) => !EXCLUDED_TAGS.has(entry.tag));

    const reactions: Record<string, string> = {};
    const classes = new Set<string>(initial.classes);

    for (const planned of plan) {
      try {
        const { container, root } = renderIntoContainer(cmd);
        const before = harvestEffective(container);
        const controls = enumerateControls(container);
        const entry = controls[planned.index];
        if (!entry) {
          reactions[planned.key] = `probe-error: 재렌더에서 컨트롤 인덱스 ${planned.index} 가 사라졌다`;
          continue;
        }
        if (entry.key !== planned.key) {
          reactions[planned.key] = `probe-error: 재렌더에서 키가 흔들렸다 → ${entry.key}(비결정 렌더 의심)`;
          continue;
        }

        const blocked = mutateControl(entry);
        if (blocked) {
          reactions[entry.key] = blocked;
          continue;
        }
        dispatchInteraction(entry.node);

        const after = harvestEffective(container);
        for (const cls of after.classes) classes.add(cls);

        const rerooted = !container.contains(root);
        const marker = rerooted ? REROOT_MARKER : "";

        if (before.testidCount > 0 && after.testidCount === 0) {
          reactions[entry.key] =
            `collapsed: ${marker}조작 후 표면이 비었다 (testid ${before.testidCount}→0)`;
          continue;
        }

        const parts = diffFormSurface("", before, after);
        if (parts.length === 0) {
          reactions[entry.key] = rerooted ? `${marker}no-change` : "no-change";
          continue;
        }
        const others = diffFormSurface("", before, withoutSelfChange(before, after, entry.key));
        if (others.length === 0) {
          reactions[entry.key] = compact([`self-only ${marker}${parts.join(" | ")}`]);
          continue;
        }
        reactions[entry.key] = compact([`${marker}${parts[0]}`, ...parts.slice(1)]);
      } catch (error) {
        errorStacks.set(`${kindLabel}/${planned.key}`, firstFrames(error));
        reactions[planned.key] =
          `probe-error: ${(error as Error).name}: ${(error as Error).message}`.slice(0, 200);
      }
    }

    const sortedReactions = Object.fromEntries(
      Object.entries(reactions).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    );
    const firstProbeError = Object.entries(sortedReactions).find(([, v]) => v.startsWith("probe-error:"));
    return {
      reactions: sortedReactions,
      initial,
      classes: [...classes].sort(),
      probeCount: Object.keys(sortedReactions).length,
      reactingCount: Object.values(sortedReactions).filter(isReactionValue).length,
      ...(firstProbeError ? { error: `${firstProbeError[0]}: ${firstProbeError[1]}` } : {}),
    };
  } catch (error) {
    return errorSurface(kindLabel, error, initial);
  }
}

export function captureAllInteractionSurfaces(): Record<string, InteractionSurface> {
  const out: Record<string, InteractionSurface> = {};
  for (const kind of COMMAND_KINDS) {
    out[kind] = captureInteractionSurface(MINIMAL_COMMANDS[kind as CommandKind], kind);
  }
  return out;
}

// ── 기준선 diff / 하한선 지표 ────────────────────────────────────────────────────────

function cap(items: readonly string[], n = 6): string {
  return items.length <= n ? items.join(", ") : `${items.slice(0, n).join(", ")}, …+${items.length - n}`;
}

function listDelta(before: readonly string[], after: readonly string[]): { lost: string[]; added: string[] } {
  const b = new Set(before);
  const a = new Set(after);
  return { lost: before.filter((x) => !a.has(x)), added: after.filter((x) => !b.has(x)) };
}

/** 반응이 죽었다고 볼 수 있는 값 — 조건부 표시 로직 사망의 시그니처. */
function isDegraded(value: string): boolean {
  const bare = withoutMarker(value);
  return bare === "no-change" || bare.startsWith("self-only");
}

/**
 * 기준선 ↔ 현재 상호작용 표면 diff.
 *
 * `"… → no-change"` 퇴화를 **맨 앞에 따로** 싣는다. 그게 이 축이 지키려는 단 하나의
 * 회귀(조작해도 폼이 반응하지 않는다)이고, 다른 잡음에 섞이면 리뷰에서 놓친다.
 */
export function diffInteractionSurface(
  _key: string,
  before: InteractionSurface,
  after: InteractionSurface
): string[] {
  const parts: string[] = [];

  if ((before.error ?? null) !== (after.error ?? null)) {
    parts.push(`프로브 오류 ${before.error ?? "없음"} → ${after.error ?? "없음"}`);
  }

  const lost = Object.keys(before.reactions).filter((k) => !(k in after.reactions));
  const added = Object.keys(after.reactions).filter((k) => !(k in before.reactions));
  const changed = Object.keys(before.reactions).filter(
    (k) => k in after.reactions && before.reactions[k] !== after.reactions[k]
  );
  const degraded = changed.filter(
    (k) => !isDegraded(before.reactions[k]) && isDegraded(after.reactions[k])
  );

  if (degraded.length) {
    parts.push(
      `⚠ 반응 퇴화 ${degraded.length}개 → no-change/self-only [${cap(degraded)}] ` +
        `— 조건부 표시/재렌더 로직이 죽었는지 확인하라`
    );
  }
  if (lost.length) parts.push(`프로브 소실 ${lost.length}개 [${cap(lost)}]`);
  if (added.length) parts.push(`프로브 신규 ${added.length}개 [${cap(added)}]`);
  const otherChanged = changed.filter((k) => !degraded.includes(k));
  if (otherChanged.length) {
    parts.push(
      `반응 변경 ${otherChanged.length}개 [${cap(
        otherChanged.map(
          (k) => `${k}: "${before.reactions[k].slice(0, 40)}"→"${after.reactions[k].slice(0, 40)}"`
        ),
        4
      )}]`
    );
  }

  const cls = listDelta(before.classes, after.classes);
  if (cls.lost.length) parts.push(`조작후 클래스 소실 ${cls.lost.length}개 [${cap(cls.lost, 8)}]`);
  if (cls.added.length) parts.push(`조작후 클래스 신규 ${cls.added.length}개 [${cap(cls.added, 8)}]`);

  if (before.reactingCount !== after.reactingCount) {
    parts.push(`반응 컨트롤 수 ${before.reactingCount}→${after.reactingCount}`);
  }
  if (before.probeCount !== after.probeCount) {
    parts.push(`프로브 수 ${before.probeCount}→${after.probeCount}`);
  }

  // 초기 표면은 폼 축과 같은 diff 를 쓴다(축마다 갈라지면 하나가 뒤처진다).
  const initialParts = diffFormSurface(_key, before.initial, after.initial);
  if (initialParts.length) parts.push(`초기표면: ${initialParts.join(" | ")}`);

  return parts;
}

/**
 * 하한선 지표. `reactingCount` 가 핵심이다 — 조건부 표시 로직이 통째로 사라지는 것을
 * 기준선 갱신으로도 덮을 수 없게 하는 벽이다.
 */
export function interactionSurfaceMetrics(surface: InteractionSurface): Record<string, number> {
  return {
    probeCount: surface.probeCount,
    reactingCount: surface.reactingCount,
    classCount: surface.classes.length,
    initialTestidCount: surface.initial.testidCount,
  };
}

/** 측정으로 반응 목록(래칫)을 만든다: kind → 반응하는 stableKey 목록(정렬). */
export function collectReactingKeys(
  surfaces: Record<string, InteractionSurface>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const kind of Object.keys(surfaces).sort()) {
    const keys = Object.entries(surfaces[kind].reactions)
      .filter(([, value]) => isReactionValue(value))
      .map(([key]) => key)
      .sort();
    if (keys.length) out[kind] = keys;
  }
  return out;
}
