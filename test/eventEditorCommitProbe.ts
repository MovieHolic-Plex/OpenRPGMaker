// test/eventEditorCommitProbe.ts
//
// **커밋 프로브 축** — "컨트롤을 조작하면 어떤 커맨드 객체가 저장되는가".
//
// 왜 이 축이 따로 필요한가 (전부 실측):
//   기존 표면 스냅샷 축은 "어떤 컨트롤이 DOM 에 있는가"만 본다. 그래서 다음 3개 변이가
//   전부 초록으로 통과했다.
//     1) commandBodyCore.ts 의 `autoAdvance.addEventListener("change", apply)` 삭제
//        → 체크박스는 화면에 남고 클릭해도 아무 일이 없는데 9개 테스트 전부 통과.
//     2) choices 의 readOptionsFromDom 이 `branch: []` 를 반환하게 바꿈
//        → 표면 축 + choicesCommandBody(3) + StagedState(14) + StoryboardBranches(11) 전부 초록.
//          선택지 안의 명령이 통째로 날아가는 데이터 파괴인데 아무도 안 잡았다.
//     3) showPicture 의 x↔y 결선 교환 → 통과.
//   즉 "존재"는 보는데 "동작"은 아무도 안 본다. 이 파일이 그 동작 축이다.
//
// 방법: 폼에 넘기는 CommandListActions 를 스파이로 갈아끼우고, 컨트롤을 하나씩 조작해
//   그 조작이 유발한 replaceCommand(path, cmd) 의 cmd 를 정규화 JSON 으로 기록한다.
//
// 설계상 지킨 것들:
//   * **컨트롤 하나당 fresh 렌더.** change 를 디스패치하면 폼이 스스로 재렌더/DOM 교체를 해서
//     미리 잡아둔 노드 목록이 무효화된다. 컨트롤 i 만 조작하는 새 렌더가 유일하게 결정적이다.
//   * **button 제외.** 클릭이 모달/레코드 픽커를 열어 document.body 로 새 노드를 뿌린다(실측:
//     피커 testid 1,928개가 축 밖으로 새어나온다). 다만 enum 컨트롤은 segmentedSelect 가
//     `hidden` <select> + 버튼 조합으로 만들고 **버튼이 그 hidden select 의 change 를 그대로
//     발화**하므로(recordPicker.ts:600-603), hidden select 를 프로브하면 버튼 경로의 배선까지
//     같이 검증된다. 그래서 hidden select 는 일부러 포함한다.
//   * **lockKind: true.** 잠금을 풀면 종류 select 가 렌더되고 그걸 건드리면 newCommand() 로
//     통째 교체되어 분기가 정상적으로(=의도적으로) 사라진다. 그게 lockKind 가 있는 이유다
//     (types.ts:13-15). 기존 명령 편집 모달과 같은 조건으로 고정한다.
//   * **자체 문서순 순회.** test/fakeDom.ts 의 querySelectorAll 은 콤마 셀렉터를 파트별로
//     따로 수집해 이어붙이므로("input, select, textarea" → input 전부 → select 전부) 문서순이
//     아니다. 게다가 tag 매칭에서 disabled 를 제외한다. 둘 다 키 안정성을 깨므로 직접 걷는다.
//   * stableKey 는 이 파일 안에서 자체 구현한다(패키지 A 의 폼 표면 파일에 의존하지 않는다).
//
// 이 파일에는 classes: string[] 류의 CSS 축 정보를 담지 않는다 — 축이 섞이면 CSS 예산 게이트가
// 커밋 배선 변경을 CSS 변경으로 오해한다.
import { createHash } from "node:crypto";
import { renderCommandBody } from "@/editor/panels/eventEditor/commandBody";
import { editorState } from "@/editor/editorState";
import { COMMAND_KINDS, type CommandKind } from "@/project/commandKindRegistry";
import { createDefaultM2Fields, m2CommandById } from "@/project/eventCommands/m2Catalog";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import type { CommandListActions } from "@/editor/panels/eventEditor/types";
import { CAPTURE_SEED_IDS, createCommitProbeProject } from "./fixtures/captureProject";
import { MINIMAL_COMMANDS } from "./fixtures/minimalCommands";
import { FakeElement, installFakeDom, type FakeNode } from "./fakeDom";

/** 프로브가 만지는 태그. button 은 제외한다(위 주석의 모달 누출 이유). */
const PROBE_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** 스파이가 기록할 액션 이름들. CommandListActions 의 키와 1:1. */
const SPIED_ACTIONS = [
  "addCommand",
  "insertCommand",
  "replaceCommand",
  "deleteCommand",
  "moveCommand",
  "moveCommandTo",
  "moveCommandAcross",
] as const;

export type ProbeOutcome =
  | "commit"
  | "no-commit"
  | "disabled"
  | "single-option"
  | "radio-uncheck"
  | "error";

/** 컨트롤 하나를 조작한 결과(원본 객체 유지 — 분기 계약 검사가 객체를 필요로 한다). */
export type ProbeResult = {
  readonly key: string;
  /** 마지막으로 불린 액션 이름. 커밋이 없으면 "no-commit" / "disabled" / "single-option" / "error". */
  readonly action: string;
  /** 액션이 몇 번 불렸는가(input + change 로 2회가 정상인 폼도 있다). */
  readonly callCount: number;
  /** 커밋된 커맨드 객체(마지막 호출). 커밋이 없으면 null. */
  readonly committed: Command | null;
  readonly outcome: ProbeOutcome;
  /** 조작에 실제로 넣은 값(진단용). */
  readonly applied?: string;
  readonly errorMessage?: string;
};

export type CommitRecord = {
  /** 어떤 액션이 불렸는가: "replaceCommand" | "insertCommand" | ... | "no-commit" */
  readonly action: string;
  /** 커밋된 커맨드의 정규화 JSON. 액션이 없으면 null */
  readonly committed: string | null;
};

export type CommitSurface = {
  /** stableKey → CommitRecord 를 사람이 읽는 한 줄로 압축한 값 */
  readonly probes: Record<string, string>;
  readonly probeCount: number;
  readonly commitCount: number;
  readonly noCommitCount: number;
  readonly error?: string;
};

// ---------------------------------------------------------------------------
// 정규화 JSON
// ---------------------------------------------------------------------------

/** 키를 재귀적으로 정렬한다 — 필드 선언 순서 변경에 기준선이 흔들리지 않게. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) out[key] = sortKeysDeep(source[key]);
    return out;
  }
  // undefined 를 남기면 JSON.stringify 가 키를 조용히 지운다 — 명시 토큰으로 바꿔 보이게 한다.
  if (value === undefined) return "<undefined>";
  return value;
}

/** 정규화 JSON 문자열. 같은 내용이면 항상 같은 문자열이다. */
export function normalizeJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

const MAX_VALUE_CHARS = 1000;

/**
 * 과도하게 긴 JSON 은 앞부분 + sha1 로 안정 압축한다(파일 폭발 방지, 변경 감지는 유지).
 * 절단하지 않으면 shop 처럼 목록이 큰 커맨드 하나가 기준선을 수십 KB 로 만든다.
 */
function compressValue(json: string): string {
  if (json.length <= MAX_VALUE_CHARS) return json;
  const hash = createHash("sha1").update(json).digest("hex").slice(0, 8);
  return `${json.slice(0, MAX_VALUE_CHARS - 60)}…sha1:${hash}:len${json.length}`;
}

function encodeRecord(result: ProbeResult): string {
  const action = result.callCount > 1 ? `${result.action} x${result.callCount}` : result.action;
  if (result.committed === null) {
    return result.errorMessage ? `${action} ${result.errorMessage}` : action;
  }
  return `${action} ${compressValue(normalizeJson(result.committed))}`;
}

// ---------------------------------------------------------------------------
// stableKey — 래퍼 div 를 하나 더 감싸도 변하지 않아야 한다
// ---------------------------------------------------------------------------

function isElement(node: FakeNode): node is FakeElement {
  return node instanceof FakeElement;
}

function testIdOf(node: FakeElement): string | undefined {
  const id = node.dataset.testid;
  return id && id.length > 0 ? id : undefined;
}

/** 문서순으로 subtree 안의 모든 요소를 모은다. */
function collectElements(root: FakeNode, out: FakeElement[] = []): FakeElement[] {
  for (const child of root.childNodes) {
    if (!isElement(child)) continue;
    out.push(child);
    collectElements(child, out);
  }
  return out;
}

/**
 * stableKey 규칙:
 *   1) 노드 자신의 testid 가 있으면 그것.
 *   2) 없으면 `가장 가까운 조상 testid > tagName # 그 조상 서브트리 안 같은 tagName 의 0-base 문서순 서수`.
 *   3) 조상 testid 도 없으면 `:root>tagName#서수`(렌더 루트 기준).
 * 래퍼 div 를 하나 끼워도 (2)(3) 의 조상과 서수가 모두 그대로다 — 그게 이 규칙의 목적이다.
 */
export function stableKeyOf(root: FakeElement, node: FakeElement): string {
  const own = testIdOf(node);
  if (own) return own;

  let anchor: FakeElement | null = node.parentElement;
  let anchorId: string | undefined;
  while (anchor) {
    const id = testIdOf(anchor);
    if (id) {
      anchorId = id;
      break;
    }
    if (anchor === root) break;
    anchor = anchor.parentElement;
  }
  const scope = anchorId && anchor ? anchor : root;
  const prefix = anchorId ?? ":root";
  const sameTag = collectElements(scope).filter((element) => element.tagName === node.tagName);
  const ordinal = sameTag.indexOf(node);
  return `${prefix}>${node.tagName.toLowerCase()}#${ordinal}`;
}

/** 같은 키가 여러 번 나오면 문서순으로 ~2, ~3 을 붙인다(중복 testid 방어). */
function dedupeKeys(keys: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key}~${n}`;
  });
}

// ---------------------------------------------------------------------------
// 마커 값 — "현재 값과 반드시 다른" 값을 만든다
// ---------------------------------------------------------------------------

function attr(node: FakeElement, name: string): string | null {
  return node.getAttribute(name);
}

function controlType(node: FakeElement): string {
  if (node.tagName === "SELECT") return "select";
  if (node.tagName === "TEXTAREA") return "textarea";
  // el() 은 type 을 attrs 로 넣으므로 FakeElement 의 .type 프로퍼티는 비어 있다.
  return (attr(node, "type") ?? node.type ?? "text").toLowerCase();
}

function parseNum(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 부동소수 누적을 자르고 문자열로. 0.07000000000000001 → "0.07". */
function fmtNum(value: number): string {
  return String(Number(value.toFixed(10)));
}

/**
 * 마커 씨앗을 stableKey 에서 뽑는다 — **문서 인덱스에서 뽑으면 안 된다.**
 * 인덱스 기반이면 폼 앞쪽에 컨트롤 하나만 추가돼도 뒤쪽 전 항목의 마커 값이 밀려
 * 기준선이 통째로 빨개진다(진짜 배선 변경이 그 소음에 묻힌다).
 * 키 기반이면 각 행이 서로 독립이라 diff 가 바뀐 컨트롤만 가리킨다.
 */
function seedOf(key: string): number {
  return Number.parseInt(createHash("sha1").update(key).digest("hex").slice(0, 6), 16);
}

/**
 * min/max/step 을 존중하는 숫자 마커. 범위를 벗어난 값을 넣으면 폼이 clamp 해서
 * 저장값이 마커와 무관해진다(x↔y 결선 교환 같은 변이를 구분하는 힘이 떨어진다).
 * 반환 null = 조작 불가(값이 하나뿐인 범위).
 */
export function numberMarker(node: FakeElement, key: string): string | null {
  const current = node.value;
  const seed = seedOf(key);
  const lo = parseNum(attr(node, "min"));
  const hi = parseNum(attr(node, "max"));
  const step = parseNum(attr(node, "step")) ?? 1;
  const unit = step || 1;
  const differs = (candidate: string): boolean => candidate !== current;

  if (lo !== null && hi !== null) {
    const slots = Math.max(0, Math.round((hi - lo) / unit));
    for (let bump = 0; bump <= slots; bump += 1) {
      const k = (seed + bump) % (slots + 1);
      const candidate = fmtNum(lo + k * unit);
      if (differs(candidate)) return candidate;
    }
    return null;
  }
  let base = 7000 + (seed % 900);
  if (lo !== null && base < lo) base = lo + unit * (1 + (seed % 7));
  if (hi !== null && base > hi) base = hi - unit * (1 + (seed % 7));
  let candidate = fmtNum(base);
  if (!differs(candidate)) candidate = fmtNum(base + unit);
  return differs(candidate) ? candidate : null;
}

/** select 의 option 을 문서순으로(optgroup 안쪽까지) 모은다. */
function optionsOf(select: FakeElement): FakeElement[] {
  return collectElements(select).filter((element) => element.tagName === "OPTION");
}

/**
 * 현재 선택된 것이 아닌 option 을 고른다.
 * seed === null(정규 실행)이면 뒤에서 첫 번째 — 기준선을 안정적으로 유지한다.
 * seed 가 있으면(측정 실행) 후보를 회전시켜 실행마다 다른 값을 넣는다. 후보가 1개뿐이면
 * 두 실행이 같은 값이 되어 편집기 판정이 불가능해진다(호출부가 그 수를 세어 보고한다).
 */
export function selectMarker(select: FakeElement, seed: number | null = null): string | null {
  const candidates = [
    ...new Set(optionsOf(select).map((option) => option.value ?? "").filter((value) => value !== select.value)),
  ];
  if (candidates.length === 0) return null;
  if (seed === null) return candidates[candidates.length - 1] ?? null;
  return candidates[seed % candidates.length] ?? null;
}

type Manipulation =
  | { readonly kind: "applied"; readonly applied: string }
  | { readonly kind: "skip"; readonly outcome: ProbeOutcome };

/** 컨트롤 타입별로 "현재와 다른" 값을 실제로 써넣는다. 이벤트 디스패치는 호출부가 한다. */
function manipulate(node: FakeElement, rawKey: string, salt: string): Manipulation {
  const key = `${salt}${rawKey}`;
  const type = controlType(node);
  switch (type) {
    case "select": {
      const next = selectMarker(node, salt === "" ? null : seedOf(key));
      if (next === null) return { kind: "skip", outcome: "single-option" };
      node.value = next;
      return { kind: "applied", applied: next };
    }
    case "radio": {
      // 이미 켜진 라디오를 반전하면 꺼지는데, 실제 브라우저에서는 클릭으로 라디오를 끌 수 없다.
      // 폼 핸들러도 `if (!input.checked) return;` 으로 그 상태를 걸러낸다
      // (commandBodyChoices.ts:199-200). 즉 여기서 나오는 무커밋은 배선 결함이 아니라
      // 프로브 방법의 부산물이므로 no-commit 래칫에서 분리해 별도 결과로 남긴다.
      // 라디오 그룹에는 항상 꺼진 형제가 있고 그것들이 배선을 검증하므로 감지력 손실은 없다.
      if (node.checked) return { kind: "skip", outcome: "radio-uncheck" };
      node.checked = true;
      return { kind: "applied", applied: "checked" };
    }
    case "checkbox": {
      node.checked = !node.checked;
      return { kind: "applied", applied: node.checked ? "checked" : "unchecked" };
    }
    case "number":
    case "range": {
      const next = numberMarker(node, key);
      if (next === null) return { kind: "skip", outcome: "single-option" };
      node.value = next;
      return { kind: "applied", applied: next };
    }
    case "color": {
      // 정규 실행은 고정 색, 측정 실행은 키에서 뽑은 색 — 두 실행이 달라야 편집기 판정이 된다.
      const next =
        salt === "" ? "#123456" : `#${createHash("sha1").update(key).digest("hex").slice(0, 6)}`;
      node.value = next;
      return { kind: "applied", applied: next };
    }
    default: {
      const next = `__p_${createHash("sha1").update(key).digest("hex").slice(0, 6)}__`;
      node.value = next;
      return { kind: "applied", applied: next };
    }
  }
}

// ---------------------------------------------------------------------------
// 스파이 + 렌더
// ---------------------------------------------------------------------------

type SpyLog = { action: string; command: Command | null }[];

function createSpyActions(log: SpyLog): CommandListActions {
  const actions: Record<string, unknown> = {};
  for (const name of SPIED_ACTIONS) {
    actions[name] = (...args: unknown[]): void => {
      const command = args.find(
        (arg): arg is Command =>
          Boolean(arg) && typeof arg === "object" && typeof (arg as { kind?: unknown }).kind === "string"
      );
      log.push({ action: name, command: command ?? null });
    };
  }
  return actions as unknown as CommandListActions;
}

function renderFresh(cmd: Command, log: SpyLog): FakeElement {
  const body = globalThis.document.body as unknown as FakeElement;
  body.replaceChildren();
  const node = renderCommandBody(
    {
      path: [0],
      actions: createSpyActions(log),
      // 폼 핸들러가 렌더 시점 cmd 대신 이 값을 기준으로 patch 한다(types.ts:9-12).
      getCurrentCommand: () => cmd,
      // 기존 명령 편집 모달과 같은 조건. 잠금을 풀면 종류 select 가 분기를 의도적으로 날린다.
      lockKind: true,
    },
    cmd
  );
  if (!(node instanceof FakeElement)) throw new Error("renderCommandBody did not return a FakeElement");
  body.append(node);
  return node;
}

function probeTargets(root: FakeElement): FakeElement[] {
  return collectElements(root).filter((element) => PROBE_TAGS.has(element.tagName));
}

/**
 * showAnimation 본문은 렌더 중에 `window.setInterval` 과 `new Image()` 를 부른다
 * (showAnimationPlayback.ts:114 / chromaKey.ts:110). node 환경엔 둘 다 없어서
 * 렌더가 ReferenceError 로 죽고, Image 쪽은 잡히지 않는 Promise rejection 으로 새어
 * vitest 를 빨갛게 만든다. test/eventEditorShowAnimationPreview.test.ts 가 쓰는 것과
 * 같은 최소 스텁을 깐다.
 *
 * setInterval 은 **일부러 아무것도 발화하지 않는다** — 프레임이 돌면 저장 대상과 무관한
 * 시간 의존 상태가 생겨 프로브가 비결정이 된다. 프레임 0 에서 멈춘 화면으로 고정한다.
 */
function installProbeBrowserGlobals(): () => void {
  const had = { window: "window" in globalThis, Image: "Image" in globalThis };
  const previous = {
    window: (globalThis as { window?: unknown }).window,
    Image: (globalThis as { Image?: unknown }).Image,
  };
  const timerWindow = had.window ? window : undefined;
  const timerDescriptors = timerWindow
    ? (["setInterval", "clearInterval"] as const).map((key) => [key, Object.getOwnPropertyDescriptor(timerWindow, key)] as const)
    : [];
  const define = (name: string, value: unknown): void => {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  };
  if (!had.window) {
    define("window", {
      setInterval: () => 0,
      clearInterval: () => undefined,
      setTimeout: () => 0,
      clearTimeout: () => undefined,
      // playAudio 본문은 오디오 엔진 싱글턴을 만들며 자동재생 언락 리스너를 window 에 건다
      // (audioEngine.ts:54). `typeof window === "undefined"` 가드가 스텁 때문에 풀리므로
      // 리스너 등록 자리를 no-op 으로 채워준다.
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
  } else if (timerWindow) {
    Object.defineProperties(timerWindow, {
      setInterval: { configurable: true, writable: true, value: () => 0 },
      clearInterval: { configurable: true, writable: true, value: () => undefined },
    });
  }
  if (!had.Image) {
    define(
      "Image",
      class {
        addEventListener(): void {}
        set src(_value: string) {}
      }
    );
  }
  return () => {
    if (timerWindow) {
      for (const [key, descriptor] of timerDescriptors) {
        if (descriptor) Object.defineProperty(timerWindow, key, descriptor);
        else Reflect.deleteProperty(timerWindow, key);
      }
    }
    for (const name of ["window", "Image"] as const) {
      if (had[name]) define(name, previous[name]);
      else Reflect.deleteProperty(globalThis, name);
    }
  };
}

/**
 * **에디터의 현재 맵을 캡처 프로젝트의 시드 맵으로 가리킨다.**
 *
 * 왜 프로젝트만 심어서는 부족한가 (실측): callMapEvent 폼은 `project.maps` 를 훑지 않는다.
 * `editorState.get().currentMapId` 를 읽고 그 맵의 events 만 열거한다
 * (commandBodyAdvanced.ts:1193-1200). 기본값은 `null` 이라 맵과 이벤트를 아무리 심어도
 * 옵션이 placeholder 한 줄뿐이고, 축은 `single-option` / commitCount 0 으로 남는다.
 * 실제 이벤트 편집기는 맵을 고른 상태에서만 열리므로(modal.ts:174 가 currentMapId 를 세운다)
 * 현재 맵을 세우는 것이 **덜** 인공적인 조건이다.
 *
 * 캡처 프로젝트 쪽이 아니라 여기서 세운다: currentMapId 는 프로젝트 데이터가 아니라 에디터
 * 상태이고, 이 축만 그것을 필요로 한다. 픽스처 팩토리가 전역 상태를 건드리면 같은 픽스처를
 * 쓰는 다른 축(폼/포털/셸)의 표면까지 조용히 움직인다.
 *
 * 복원까지 한다 — 같은 워커에서 도는 다른 테스트가 `currentMapId === null` 을 가정한다.
 */
function pointEditorAtSeededMap(): () => void {
  const previous = editorState.get().currentMapId;
  editorState.set({ currentMapId: CAPTURE_SEED_IDS.map });
  return () => {
    editorState.set({ currentMapId: previous });
  };
}

function shortStack(error: unknown, frames = 4): string {
  const stack = error instanceof Error ? error.stack ?? error.message : String(error);
  return stack.split("\n").slice(0, frames + 1).map((line) => line.trim()).join(" ⏎ ");
}

export type ProbeRunOptions = {
  /** 프로젝트 교체를 호출부가 이미 했으면 false 로 건너뛴다(성능). */
  readonly replaceProject?: boolean;
  /** fake DOM 을 이 함수가 설치/복원할지. 이미 설치돼 있으면 false. */
  readonly installDom?: boolean;
  /**
   * 마커 값에 섞는 소금. 같은 컨트롤에 **서로 다른 값**을 넣은 두 실행을 만들기 위한 것이다.
   * 분기 내용 계약(2층)이 "이 컨트롤은 분기 자식의 편집기인가"를 추측이 아니라 측정으로
   * 판정하는 데 쓴다 — A 를 넣으면 A 가, B 를 넣으면 B 가 분기에 들어가면 편집기다.
   * 기본값 "" 은 스냅샷 축이 쓰는 정규 실행이다(기준선은 이 값으로만 만든다).
   */
  readonly markerSalt?: string;
};

export type ProbeRun = {
  readonly results: ProbeResult[];
  /** 이 kind 를 프로브하며 실제로 renderCommandBody 를 몇 번 불렀는가. */
  readonly renderCount: number;
  readonly error?: string;
};

/**
 * 커맨드 하나의 모든 컨트롤을 하나씩 조작하고, 각 조작이 유발한 커밋을 기록한다.
 * 컨트롤마다 폼을 새로 렌더한다 — 조작이 재렌더를 유발해 노드 목록을 무효화하기 때문.
 */
export function probeCommandControls(cmd: Command, options: ProbeRunOptions = {}): ProbeRun {
  const restoreDom = options.installDom === false ? undefined : installFakeDom();
  const restoreBrowser = options.installDom === false ? undefined : installProbeBrowserGlobals();
  // 프로젝트를 심는 쪽이 에디터의 현재 맵도 같이 세운다 — 두 개는 한 세트다(위 주석).
  let restoreMap: (() => void) | undefined;
  try {
    if (options.replaceProject !== false) {
      store.replace(createCommitProbeProject());
      restoreMap = pointEditorAtSeededMap();
    }

    let renderCount = 0;
    let probeRoot: FakeElement;
    try {
      probeRoot = renderFresh(cmd, []);
      renderCount += 1;
    } catch (error) {
      return { results: [], renderCount, error: `초기 렌더 예외: ${shortStack(error)}` };
    }

    // 키는 "조작 전" 렌더에서 한 번만 계산한다. 조작 후 DOM 은 폼에 따라 달라진다.
    const baseTargets = probeTargets(probeRoot);
    const keys = dedupeKeys(baseTargets.map((node) => stableKeyOf(probeRoot, node)));

    const results: ProbeResult[] = [];
    for (let index = 0; index < baseTargets.length; index += 1) {
      const key = keys[index] ?? `:unknown#${index}`;
      const log: SpyLog = [];
      let spyTarget: FakeElement | undefined;
      try {
        spyTarget = probeTargets(renderFresh(cmd, log))[index];
        renderCount += 1;
      } catch (error) {
        results.push({
          key,
          action: "error",
          callCount: 0,
          committed: null,
          outcome: "error",
          errorMessage: shortStack(error),
        });
        continue;
      }
      // 렌더 중에 폼이 스스로 커밋을 부르는 경우가 있다(정규화 patch). 그건 조작 결과가
      // 아니므로 여기서 잘라내고, 조작 이후에 쌓인 것만 센다.
      const renderCommits = log.length;
      if (!spyTarget) {
        results.push({
          key,
          action: "error",
          callCount: 0,
          committed: null,
          outcome: "error",
          errorMessage: "스파이 렌더에서 같은 위치의 컨트롤을 찾지 못했다(렌더 비결정)",
        });
        continue;
      }
      if (spyTarget.disabled) {
        results.push({ key, action: "disabled", callCount: 0, committed: null, outcome: "disabled" });
        continue;
      }
      const manipulation = manipulate(spyTarget, key, options.markerSalt ?? "");
      if (manipulation.kind === "skip") {
        results.push({
          key,
          action: manipulation.outcome,
          callCount: 0,
          committed: null,
          outcome: manipulation.outcome,
        });
        continue;
      }
      try {
        // 어떤 폼은 input, 어떤 폼은 change 를 듣는다 — 둘 다 쏜다.
        spyTarget.dispatchEvent(new Event("input", { bubbles: true }));
        spyTarget.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (error) {
        results.push({
          key,
          action: "error",
          callCount: 0,
          committed: null,
          outcome: "error",
          applied: manipulation.applied,
          errorMessage: shortStack(error),
        });
        continue;
      }
      const fired = log.slice(renderCommits);
      const last = fired.at(-1);
      if (!last) {
        results.push({
          key,
          action: "no-commit",
          callCount: 0,
          committed: null,
          outcome: "no-commit",
          applied: manipulation.applied,
        });
        continue;
      }
      results.push({
        key,
        action: last.action,
        callCount: fired.length,
        committed: last.command,
        outcome: last.command ? "commit" : "no-commit",
        applied: manipulation.applied,
      });
    }
    return { results, renderCount };
  } finally {
    restoreMap?.();
    restoreBrowser?.();
    restoreDom?.();
  }
}

// ---------------------------------------------------------------------------
// 스냅샷 표면
// ---------------------------------------------------------------------------

export function toCommitSurface(run: ProbeRun): CommitSurface {
  const probes: Record<string, string> = {};
  let commitCount = 0;
  let noCommitCount = 0;
  for (const result of run.results) {
    probes[result.key] = encodeRecord(result);
    if (result.outcome === "commit") commitCount += 1;
    if (result.outcome === "no-commit") noCommitCount += 1;
  }
  return {
    probes,
    probeCount: run.results.length,
    commitCount,
    noCommitCount,
    ...(run.error ? { error: run.error } : {}),
  };
}

export function captureCommitSurface(cmd: Command, options: ProbeRunOptions = {}): CommitSurface {
  return toCommitSurface(probeCommandControls(cmd, options));
}

/**
 * 여러 커맨드를 한 환경에서 프로브한다. fake DOM 과 브라우저 스텁, 캡처 프로젝트를
 * **한 번만** 깔고 전 kind 를 돌린다 — kind 마다 store.replace(createCommitProbeProject()) 를
 * 다시 부르면 프로젝트 생성이 전체 시간의 대부분이 된다(폼은 프로젝트를 읽기만 한다).
 */
export function probeMany<K extends string>(
  entries: readonly (readonly [K, Command])[],
  options: { readonly markerSalt?: string } = {}
): { runs: Record<K, ProbeRun>; renderCount: number } {
  const runs = {} as Record<K, ProbeRun>;
  let renderCount = 0;
  const restoreDom = installFakeDom();
  const restoreBrowser = installProbeBrowserGlobals();
  let restoreMap: (() => void) | undefined;
  try {
    store.replace(createCommitProbeProject());
    restoreMap = pointEditorAtSeededMap();
    for (const [key, cmd] of entries) {
      const run = probeCommandControls(cmd, {
        installDom: false,
        replaceProject: false,
        markerSalt: options.markerSalt,
      });
      runs[key] = run;
      renderCount += run.renderCount;
    }
  } finally {
    restoreMap?.();
    restoreBrowser();
    restoreDom();
  }
  return { runs, renderCount };
}

/**
 * 이 축이 MINIMAL_COMMANDS 대신 쓰는 자체 픽스처.
 *
 * m2Command 는 M2 표면 축(다른 패키지) 소유라 그 항목이 바뀐다 — 실제로 이 작업 중에
 * `m2_test`(카탈로그에 없는 id → 컨트롤 0개 폴백)에서 실재 카탈로그 항목으로 교체됐다.
 * 공유 픽스처를 그대로 참조하면 그쪽 편집이 이 축의 기준선을 빨갛게 만들고, 그 diff 안에
 * 섞인 진짜 배선 변경이 함께 승인된다(캡처 프로젝트를 절단한 이유와 같은 함정).
 * 그래서 여기서 **id 를 직접 못박아** 고정한다.
 *
 * m2-014 를 고른 이유: bodyStrategy "generic" 이고 필드가 6개(text/select/select/number/
 * select/text)라 세 렌더 경로를 한 번에 탄다. 카탈로그에서 없어지면 즉시 터진다 —
 * 조용히 컨트롤 0개 폴백으로 되돌아가지 않게 한다.
 * M2 명령 125종의 commandId 별 폼은 M2 축이 보므로 이 축은 대표 1건만 본다.
 */
const M2_PROBE_COMMAND_ID = "m2-014-change-parameters";

function m2ProbeCommand(): Command {
  const entry = m2CommandById(M2_PROBE_COMMAND_ID);
  if (!entry) {
    throw new Error(
      `커밋 프로브: M2 픽스처 id 가 카탈로그에 없다: ${M2_PROBE_COMMAND_ID} — ` +
        `M2_COMMAND_CATALOG 에서 bodyStrategy === "generic" 이고 필드가 여러 개인 항목으로 교체하라.`
    );
  }
  return { kind: "m2Command", commandId: M2_PROBE_COMMAND_ID, fields: createDefaultM2Fields(entry) };
}

const FIXTURE_OVERRIDES: Partial<Record<CommandKind, () => Command>> = {
  m2Command: m2ProbeCommand,
};

/** COMMAND_KINDS 전량의 등재 커맨드. kind → 최소 유효 커맨드. */
export function allKindEntries(): readonly (readonly [string, Command])[] {
  return COMMAND_KINDS.map((kind) => {
    const override = FIXTURE_OVERRIDES[kind as CommandKind];
    return [kind, override ? override() : MINIMAL_COMMANDS[kind as CommandKind]] as const;
  });
}

/** COMMAND_KINDS 전량. kind → 표면. */
export function captureAllCommitSurfaces(): Record<string, CommitSurface> {
  return captureAllCommitRuns().surfaces;
}

/** 진단용: 전체 렌더 횟수 합계까지 같이 낸다. */
export function captureAllCommitRuns(): { surfaces: Record<string, CommitSurface>; renderCount: number } {
  const { runs, renderCount } = probeMany(allKindEntries());
  const surfaces: Record<string, CommitSurface> = {};
  for (const [kind, run] of Object.entries(runs)) surfaces[kind] = toCommitSurface(run);
  return { surfaces, renderCount };
}

// ---------------------------------------------------------------------------
// 분기 보존 검사 — 순수 함수라 합성 변이로 "이 검사가 진짜 잡는지"를 증명할 수 있다
// ---------------------------------------------------------------------------

/**
 * 자식 명령 배열로 보이는 것: 모든 원소가 문자열 kind 를 가진 객체인 배열(빈 배열 포함).
 * 반환형을 타입 가드로 두면 안 된다 — 부정 분기가 never 로 좁혀져 같은 값을 배열로 다시
 * 순회하는 코드가 컴파일되지 않는다.
 */
function isCommandArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(
    (entry) => Boolean(entry) && typeof entry === "object" && typeof (entry as { kind?: unknown }).kind === "string"
  );
}

/** 객체 안의 모든 자식 명령 배열을 경로 → 배열로 모은다. */
export function collectBranchArrays(value: unknown, path = "", out = new Map<string, readonly unknown[]>()): Map<string, readonly unknown[]> {
  if (Array.isArray(value)) {
    if (isCommandArray(value) && path !== "") out.set(path, value);
    value.forEach((entry, index) => collectBranchArrays(entry, `${path}[${index}]`, out));
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      collectBranchArrays(child, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

const MARKER_PATTERN = /__BRANCH_MARK_[A-Za-z0-9_]+__/gu;

/** 문자열 안의 분기 마커를 전부 모은다. */
export function collectMarkers(value: unknown): string[] {
  const found = JSON.stringify(value ?? null).match(MARKER_PATTERN) ?? [];
  return [...found].sort();
}

/** 지정 경로의 자식 명령 배열을 [] 로 비운 사본. 마커 검사에서 그 배열을 빼기 위한 것. */
function clearPaths(value: unknown, paths: ReadonlySet<string>, path = ""): unknown {
  if (Array.isArray(value)) {
    if (isCommandArray(value) && paths.has(path)) return [];
    return value.map((entry, index) => clearPaths(entry, paths, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = clearPaths(child, paths, path ? `${path}.${key}` : key);
    }
    return out;
  }
  return value;
}

function kindSequence(array: readonly unknown[]): string[] {
  return array.map((entry) => {
    const kind = (entry as { kind?: unknown } | null)?.kind;
    return typeof kind === "string" ? kind : "<비명령>";
  });
}

/**
 * **1층: 분기 구조 보존 (모든 컨트롤에 무조건 적용되는 하드 계약).**
 *
 * 커밋 전후로 분기의 *모양*이 같아야 한다 — 배열 경로 존재 / 길이 / 자식 kind 시퀀스.
 * 중첩 분기는 collectBranchArrays 가 `[i]` 하위 경로까지 훑으므로 같은 규칙이 재귀적으로 걸린다.
 *
 * 왜 예외가 없어야 하는가: loop 본문의 인라인 편집기(commandBodyLoop.ts:96-102)는 자식의
 * **텍스트만** 바꾸므로 이 계약을 절대 깨지 않는다. 반대로 실측된 최악의 사각 —
 * choices 의 readOptionsFromDom 이 `branch: []` 를 반환하던 변이 — 는 길이가 0이 되므로
 * 즉시 잡힌다. 그래서 이 축의 주 계약은 내용이 아니라 구조다.
 */
export function checkBranchStructure(before: Command, after: Command): string[] {
  const problems: string[] = [];
  const beforeArrays = collectBranchArrays(before);
  const afterArrays = collectBranchArrays(after);
  for (const [path, beforeArray] of beforeArrays) {
    const afterArray = afterArrays.get(path);
    if (!afterArray) {
      problems.push(`분기 경로 소실: ${path} (길이 ${beforeArray.length})`);
      continue;
    }
    if (afterArray.length !== beforeArray.length) {
      problems.push(`분기 길이 변경: ${path} ${beforeArray.length} → ${afterArray.length}`);
      continue;
    }
    const was = kindSequence(beforeArray);
    const now = kindSequence(afterArray);
    if (was.join(",") !== now.join(",")) {
      problems.push(`분기 kind 시퀀스 변경: ${path} [${was.join(",")}] → [${now.join(",")}]`);
    }
  }
  return problems;
}

/**
 * **2층: 분기 내용 보존 (분기 편집기가 아닌 컨트롤에만 적용).**
 *
 * `editablePaths` 는 손으로 관리하는 예외 목록이 아니라 classifyBranchEditors() 가
 * **측정으로** 뽑아낸 결과다 — 같은 컨트롤에 서로 다른 값 A/B 를 넣어 분기 내용이 그에 따라
 * 달라지면 그 컨트롤은 그 분기 자식의 편집기다.
 */
export function checkBranchContent(
  before: Command,
  after: Command,
  editablePaths: readonly string[] = []
): string[] {
  const problems: string[] = [];
  const editable = new Set(editablePaths);

  // 편집이 허용된 배열은 양쪽에서 비운 뒤 마커를 비교한다 — 그 배열 밖의 마커는 여전히 필수다.
  const wanted = collectMarkers(clearPaths(before, editable));
  const got = new Set(collectMarkers(clearPaths(after, editable)));
  const lostMarkers = wanted.filter((marker) => !got.has(marker));
  if (lostMarkers.length) {
    problems.push(
      `이 컨트롤은 분기 편집기가 아닌데 분기 내용이 변했다 — 마커 소실: ${lostMarkers.join(", ")}`
    );
  }

  const afterArrays = collectBranchArrays(after);
  for (const [path, beforeArray] of collectBranchArrays(before)) {
    if (editable.has(path)) continue;
    const afterArray = afterArrays.get(path);
    if (!afterArray) continue; // 경로 소실은 1층이 보고한다(중복 보고 방지).
    if (normalizeJson(beforeArray) !== normalizeJson(afterArray)) {
      problems.push(`이 컨트롤은 분기 편집기가 아닌데 분기 내용이 변했다 — 경로: ${path}`);
    }
  }
  return problems;
}

export type BranchEditorClassification = {
  /** 측정으로 "이 컨트롤이 편집하는 분기"라고 판정된 경로. */
  readonly editablePaths: string[];
  /** 값 A/B 를 넣었는데도 내용이 같아 편집기 여부를 가릴 수 없던 경로. */
  readonly undecidablePaths: string[];
  /** 내용이 A/B 와 무관하게 바뀐 경로 = 진짜 결함 후보. */
  readonly corruptedPaths: string[];
};

/**
 * **측정 기반 분기 편집기 판정.** 같은 컨트롤에 서로 다른 마커 A, B 를 넣은 두 커밋을 받아
 * 분기 경로별로 셋 중 하나로 가른다.
 *
 *   A 일 때와 B 일 때 내용이 다르다        → 그 컨트롤은 그 분기 자식의 편집기(정상, 2층 면제)
 *   A/B 와 무관하게 내용이 바뀌었다        → 진짜 결함(2층이 실패시킨다)
 *   내용이 before 와 같다                  → 건드리지 않았다(면제도 결함도 아니다)
 *
 * 손으로 관리하는 예외 목록이 아니므로 새 폼이 들어와도 자동으로 옳게 분류된다.
 */
export function classifyBranchEditors(
  before: Command,
  afterA: Command,
  afterB: Command,
  appliedA: string | undefined,
  appliedB: string | undefined
): BranchEditorClassification {
  const editablePaths: string[] = [];
  const undecidablePaths: string[] = [];
  const corruptedPaths: string[] = [];
  // 값을 한 종류만 넣을 수 있는 컨트롤(체크박스 토글, 후보가 1개뿐인 select)은 두 실행이 같은
  // 값을 받는다. 그러면 "내용이 A/B 와 무관하게 바뀌었다"와 "편집기가 같은 값을 두 번 썼다"를
  // 구분할 수 없다 — 결함으로 몰지 말고 판정 불가로 남기고, 호출부가 개수를 로그로 찍는다.
  const distinguishable = appliedA !== undefined && appliedB !== undefined && appliedA !== appliedB;
  const arraysA = collectBranchArrays(afterA);
  const arraysB = collectBranchArrays(afterB);
  for (const [path, beforeArray] of collectBranchArrays(before)) {
    const base = normalizeJson(beforeArray);
    const a = arraysA.has(path) ? normalizeJson(arraysA.get(path)) : null;
    const b = arraysB.has(path) ? normalizeJson(arraysB.get(path)) : null;
    if (a === null || b === null) continue; // 경로 소실 — 1층 담당.
    if (a === base && b === base) continue; // 무변경.
    if (a !== b) {
      // 넣은 값에 따라 내용이 달라진다 = 이 분기 자식의 편집기다.
      editablePaths.push(path);
      continue;
    }
    if (!distinguishable) {
      undecidablePaths.push(path);
      continue;
    }
    // 서로 다른 값을 넣었는데 결과가 같고 before 와도 다르다 → 입력과 무관한 변형. 결함이다.
    corruptedPaths.push(path);
  }
  return { editablePaths, undecidablePaths, corruptedPaths };
}

/** 합성 증명용 변이: 모든 자식 명령 배열을 [] 로 만든다(구멍 2 재현). */
export function mutateDropBranches<T>(value: T): T {
  if (Array.isArray(value)) {
    if (isCommandArray(value)) return [] as unknown as T;
    return value.map((entry) => mutateDropBranches(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = mutateDropBranches(child);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * 합성 증명용 변이: **길이는 그대로 두고** 자식 하나의 kind 만 바꾼다.
 * 1층이 길이만 보는 게 아니라 kind 시퀀스까지 본다는 것을 증명한다.
 */
export function mutateSwapChildKind<T>(value: T): T {
  if (Array.isArray(value)) {
    if (isCommandArray(value) && value.length > 0) {
      const head = value[0] as { kind?: unknown };
      const replacement = head?.kind === "breakLoop" ? { kind: "inputWait" } : { kind: "breakLoop" };
      return [replacement, ...value.slice(1)] as unknown as T;
    }
    return value.map((entry) => mutateSwapChildKind(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = mutateSwapChildKind(child);
    }
    return out as unknown as T;
  }
  return value;
}

/** 합성 증명용 변이: 자식 명령 배열의 마지막 원소를 잘라낸다(부분 소실). */
export function mutateTruncateBranches<T>(value: T): T {
  if (Array.isArray(value)) {
    if (isCommandArray(value)) return value.slice(0, Math.max(0, value.length - 1)) as unknown as T;
    return value.map((entry) => mutateTruncateBranches(entry)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      out[key] = mutateTruncateBranches(child);
    }
    return out as unknown as T;
  }
  return value;
}
