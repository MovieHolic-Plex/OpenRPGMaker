// test/aiPreferenceMemorySettings.test.ts
// "AI 가 기억한 내 성향" 섹션. 성향은 사람이 명시적으로 입력하지 않은 것을 관측으로 굳히는
// 기능이라, 목록을 볼 수도 지울 수도 없으면 사용자는 AI 가 왜 그렇게 행동하는지 알 수 없고
// 되돌릴 수도 없다 — 그래서 이 표면이 실제로 읽고 쓰는지를 단정한다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  listPreferenceFacts,
  loadPreferenceFacts,
  savePreferenceFacts,
  type PreferenceFact,
} from "@/ai/preferenceMemory";
import { renderPreferenceMemorySettings } from "@/editor/panels/aiPreferenceMemorySettings";
import { findByTestId, installFakeDom, renderWithFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | null = null;
let storage: Map<string, string>;

function installFakeLocalStorage(): void {
  storage = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
      clear: () => storage.clear(),
    },
  });
}

function fact(overrides: Partial<PreferenceFact> & { readonly id: string; readonly text: string }): PreferenceFact {
  return {
    scope: "global",
    strength: "medium",
    evidence: 2,
    source: "observed",
    updatedAt: 1_000,
    ...overrides,
  };
}

function render(projectScopeKey?: string): FakeElement {
  return renderWithFakeDom(
    () => renderPreferenceMemorySettings(projectScopeKey ? { projectScopeKey } : {}).element,
  );
}

function rows(root: FakeElement): FakeElement[] {
  return root.querySelectorAll("[data-testid='ai-preference-row']");
}

// fakeDom 에는 KeyboardEvent 가 없다 — 기존 fakeDom 테스트와 같은 관례로 Event 에 key 를 심는다.
function keydown(key: string): KeyboardEvent {
  const event = new Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  return event as KeyboardEvent;
}

beforeEach(() => {
  restoreDom = installFakeDom();
  installFakeLocalStorage();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("빈 상태", () => {
  it("왜 비어 있는지 말해 준다 — 빈 목록만 보여 주면 고장난 것처럼 읽힌다", () => {
    const root = render();
    const empty = findByTestId(root, "ai-preference-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent ?? "").toContain("되돌리거나");
    expect(rows(root)).toHaveLength(0);
  });

  it("성향이 기본값일 뿐 지시가 우선이라는 사실을 화면에서도 밝힌다", () => {
    const root = render();
    const hint = root.querySelectorAll(".ai-preference-hint")[0];
    expect(hint?.textContent ?? "").toContain("지시가 항상 우선");
  });
});

describe("목록", () => {
  it("전역과 프로젝트를 두 그룹으로 나눠 보여 준다", () => {
    savePreferenceFacts([
      fact({ id: "g1", text: "마을은 작게 유지한다", strength: "strong" }),
      fact({ id: "p1", text: "이 게임은 호러다", scope: "project", projectScopeKey: "local:A::m1" }),
      fact({ id: "q1", text: "남의 프로젝트 사실", scope: "project", projectScopeKey: "local:B::m1" }),
    ]);
    const root = render("local:A::m1");
    const text = root.textContent ?? "";
    expect(text).toContain("전역(모든 프로젝트)");
    expect(text).toContain("이 프로젝트 한정");
    expect(text).toContain("마을은 작게 유지한다");
    expect(text).toContain("이 게임은 호러다");
    expect(text).not.toContain("남의 프로젝트 사실");
    expect(rows(root)).toHaveLength(2);
  });

  it("조회 키가 없으면 전역 성향만 보인다", () => {
    savePreferenceFacts([
      fact({ id: "g1", text: "전역 성향" }),
      fact({ id: "p1", text: "프로젝트 성향", scope: "project", projectScopeKey: "local:A::m1" }),
    ]);
    const root = render();
    expect(root.textContent ?? "").toContain("전역 성향");
    expect(root.textContent ?? "").not.toContain("프로젝트 성향");
  });

  it("강도와 근거를 함께 보여 준다 — 왜 이 성향이 센지 알 수 있어야 한다", () => {
    savePreferenceFacts([fact({ id: "g1", text: "어두운 톤", strength: "strong", evidence: 5 })]);
    const root = render();
    expect(root.textContent ?? "").toContain("강함");
    expect(root.textContent ?? "").toContain("근거 5");
  });

  // 채팅 패널은 스코프를 **함수로** 넘긴다. 그 패널의 conversationScope 는 '새 대화'와
  // 프로젝트 전환에서 재대입되는 let 이라, 값으로 한 번 굳히면 프로젝트를 바꾼 뒤에도
  // 팝오버가 이전 프로젝트의 성향을 계속 보여 준다.
  it("조회 키를 함수로 주면 refresh 시점의 스코프를 읽는다", () => {
    savePreferenceFacts([
      fact({ id: "a1", text: "A 프로젝트 사실", scope: "project", projectScopeKey: "local:A::m1" }),
      fact({ id: "b1", text: "B 프로젝트 사실", scope: "project", projectScopeKey: "local:B::m1" }),
    ]);
    let scope = "local:A::m1";
    // 같은 인스턴스를 계속 쓴다 — 팝오버는 한 번 만들어 두고 열 때마다 refresh 만 부른다.
    const view = renderPreferenceMemorySettings({ projectScopeKey: () => scope });
    expect(view.element.textContent ?? "").toContain("A 프로젝트 사실");
    expect(view.element.textContent ?? "").not.toContain("B 프로젝트 사실");

    scope = "local:B::m1";
    view.refresh();
    expect(view.element.textContent ?? "").toContain("B 프로젝트 사실");
    expect(view.element.textContent ?? "").not.toContain("A 프로젝트 사실");
  });

  it("조회 키를 값으로 주면 예전처럼 그 스코프에 고정된다", () => {
    savePreferenceFacts([
      fact({ id: "a1", text: "A 프로젝트 사실", scope: "project", projectScopeKey: "local:A::m1" }),
    ]);
    const view = renderPreferenceMemorySettings({ projectScopeKey: "local:A::m1" });
    view.refresh();
    expect(view.element.textContent ?? "").toContain("A 프로젝트 사실");
  });
});

describe("삭제와 고정", () => {
  it("삭제를 누르면 저장소에서 사라지고 목록이 즉시 갱신된다", () => {
    savePreferenceFacts([fact({ id: "g1", text: "지울 성향" }), fact({ id: "g2", text: "남을 성향" })]);
    const root = render();
    expect(rows(root)).toHaveLength(2);

    const target = rows(root).find((row) => (row.textContent ?? "").includes("지울 성향"));
    target?.querySelectorAll("[data-testid='ai-preference-delete']")[0]?.click();

    expect(loadPreferenceFacts().map((entry) => entry.id)).toEqual(["g2"]);
    expect(rows(root)).toHaveLength(1);
    expect(root.textContent ?? "").not.toContain("지울 성향");
  });

  it("고정 버튼이 상태를 저장하고 aria-pressed 로 알린다", () => {
    savePreferenceFacts([fact({ id: "g1", text: "고정할 성향" })]);
    const root = render();
    const pin = () => findByTestId(root, "ai-preference-pin");
    expect(pin()?.getAttribute("aria-pressed")).toBe("false");

    pin()?.click();
    expect(loadPreferenceFacts()[0].pinned).toBe(true);
    expect(pin()?.getAttribute("aria-pressed")).toBe("true");
    expect(pin()?.textContent).toBe("고정됨");

    pin()?.click();
    expect(loadPreferenceFacts()[0].pinned).toBe(false);
  });

  it("전체 비우기가 저장소를 지운다", () => {
    savePreferenceFacts([fact({ id: "g1", text: "성향 하나" })]);
    const root = render();
    findByTestId(root, "ai-preference-clear")?.click();
    expect(loadPreferenceFacts()).toEqual([]);
    expect(findByTestId(root, "ai-preference-empty")).not.toBeNull();
  });
});

describe("직접 추가", () => {
  it("사람이 쓴 성향은 전역·강함·고정으로 들어간다", () => {
    const root = render();
    const input = findByTestId(root, "ai-preference-add-input");
    if (!input) throw new Error("add input missing");
    input.value = "마을은 집 4채 이하로 만들어 줘";
    findByTestId(root, "ai-preference-add")?.click();

    const saved = loadPreferenceFacts();
    expect(saved).toHaveLength(1);
    // 손으로 쓴 것이 관측보다 강해야 하고, 다음 증류가 지우면 입력 칸이 무의미해진다.
    expect(saved[0]).toMatchObject({
      text: "마을은 집 4채 이하로 만들어 줘",
      scope: "global",
      strength: "strong",
      source: "manual",
      pinned: true,
    });
    expect(input.value).toBe("");
    expect(rows(root)).toHaveLength(1);
  });

  it("빈 입력은 아무것도 만들지 않는다", () => {
    const root = render();
    const input = findByTestId(root, "ai-preference-add-input");
    input!.value = "   ";
    findByTestId(root, "ai-preference-add")?.click();
    expect(loadPreferenceFacts()).toEqual([]);
  });

  it("Enter 로도 추가된다", () => {
    const root = render();
    const input = findByTestId(root, "ai-preference-add-input");
    input!.value = "항상 어두운 톤으로";
    input!.dispatchEvent(keydown("Enter"));
    expect(loadPreferenceFacts()).toHaveLength(1);
  });

  it("Enter 가 아닌 키는 추가하지 않는다", () => {
    const root = render();
    const input = findByTestId(root, "ai-preference-add-input");
    input!.value = "아직 확정 아님";
    input!.dispatchEvent(keydown("a"));
    expect(loadPreferenceFacts()).toEqual([]);
  });

  it("같은 문장을 두 번 넣어도 행이 늘지 않는다", () => {
    const root = render();
    const input = findByTestId(root, "ai-preference-add-input");
    const add = findByTestId(root, "ai-preference-add");
    input!.value = "마을은 작게";
    add?.click();
    input!.value = "마을은 작게";
    add?.click();
    expect(listPreferenceFacts().global).toHaveLength(1);
    expect(rows(root)).toHaveLength(1);
  });
});

describe("구조", () => {
  it("<details> 를 쓰지 않는다 — ::details-content 가 내부 스크롤러를 죽인 전례가 있다", () => {
    savePreferenceFacts([fact({ id: "g1", text: "성향" })]);
    const root = render();
    expect(root.querySelectorAll("details")).toHaveLength(0);
    expect(findByTestId(root, "ai-preference-list")).not.toBeNull();
  });
});
