/**
 * 스킬 탭 `연출` 카드의 애니메이션 스테이지 계약.
 *
 * 1) 프레임이 2장 이상이면 열자마자 자동 반복 재생한다(셀 레이어 data-frame-index 전진 + 랩어라운드).
 * 2) 프레임 카운터 칩이 그 인덱스를 따라간다.
 * 3) 프레임 1장 / reduced-motion 은 정지 상태가 1급이다.
 * 4) 픽커 변경으로 표시면이 교체되면 인터벌은 확정적으로 죽는다(분리된 DOM 에 타이머가 남지 않는다).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { skillFields } from "@/editor/panels/databaseBasicRecordFields";
import {
  renderSkillAnimationStage,
  resumeSkillAnimationStagesIn,
  stopSkillAnimationStagesIn,
} from "@/editor/panels/databaseSkillAnimationStage";
import { renderRecordTab } from "@/editor/panels/databaseRecordViews";
import { setSelectedRecordId } from "@/editor/panels/databaseRecordViewSession";
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { SHOW_ANIMATION_FRAME_MS } from "@/editor/panels/eventEditor/showAnimationPlayback";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { BattleAnimationFrame, Project, SkillRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

type FakeBrowserGlobals = {
  readonly Image: typeof globalThis.Image | undefined;
  readonly window: typeof globalThis.window | undefined;
};

let restoreDom: (() => void) | undefined;
let previousBrowserGlobals: FakeBrowserGlobals;
let armedIntervals: Set<unknown>;
let clearIntervalSpy: ReturnType<typeof vi.fn>;
let reducedMotion = false;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousBrowserGlobals = { Image: globalThis.Image, window: globalThis.window };
  vi.useFakeTimers();
  armedIntervals = new Set<unknown>();
  reducedMotion = false;
  clearIntervalSpy = vi.fn((id: unknown) => {
    armedIntervals.delete(id);
    globalThis.clearInterval(id as ReturnType<typeof setInterval>);
  });
  Object.defineProperty(globalThis, "Image", {
    configurable: true,
    value: class {
      addEventListener(): void {}
      set src(_value: string) {}
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      clearInterval: clearIntervalSpy,
      setInterval: (handler: () => void, ms: number) => {
        const id = globalThis.setInterval(handler, ms);
        armedIntervals.add(id);
        return id;
      },
      matchMedia: (query: string) => ({ matches: reducedMotion && query.includes("prefers-reduced-motion") }),
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  restoreDom?.();
  restoreDom = undefined;
  restoreBrowserGlobal("Image", previousBrowserGlobals.Image);
  restoreBrowserGlobal("window", previousBrowserGlobals.window);
});

function restoreBrowserGlobal(name: "Image" | "window", value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }
  Object.defineProperty(globalThis, name, { configurable: true, value });
}

function frame(pattern: number): BattleAnimationFrame {
  return { cells: [{ pattern, x: 0, y: 0, zoom: 100, opacity: 255, visible: true }] };
}

/** 프레임 수를 지정한 애니메이션 하나만 가진 프로젝트를 store 에 올리고 스킬을 돌려준다. */
function installProject(frameCount: number): { readonly project: Project; readonly skill: SkillRecord } {
  const project = createBlankProject();
  project.database.battleAnimations = [
    {
      id: "anim_stage_test",
      name: "불꽃 폭발",
      resourceId: "sample_title",
      sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
      frames: Array.from({ length: frameCount }, (_, index) => frame(index)),
    },
  ];
  const authored = project.database.skills[0];
  if (!authored) throw new Error("기본 스킬이 없다");
  authored.animationId = "anim_stage_test";
  store.replace(project);
  const current = store.getCurrent();
  const skill = current.database.skills.find((entry) => entry.id === authored.id);
  const animation = current.database.battleAnimations.find((entry) => entry.id === "anim_stage_test");
  if (!skill) throw new Error("스킬이 store 에 없다");
  if ((animation?.frames?.length ?? 0) !== frameCount) throw new Error("프레임 수가 유지되지 않았다");
  return { project: current, skill };
}

function mount(skill: SkillRecord, project: Project): { readonly host: FakeElement; readonly stop: () => void } {
  const host = document.createElement("div");
  const stage = renderSkillAnimationStage(skill, project);
  host.append(stage.element);
  document.body.append(host);
  if (!(host instanceof FakeElement)) throw new Error("Expected fake stage host");
  return { host, stop: stage.stop };
}

function byTestId(root: FakeElement, testid: string): FakeElement {
  const element = findByTestId(root, testid);
  if (!element) throw new Error(`missing test id ${testid}`);
  return element;
}

describe("스킬 탭 애니메이션 스테이지", () => {
  it("프레임을 자동 반복 재생하고 프레임 카운터가 따라간다", () => {
    const { project, skill } = installProject(3);
    const { host, stop } = mount(skill, project);

    const cells = byTestId(host, "db-skill-animation-cells");
    const counter = byTestId(host, "db-skill-animation-frame-counter");
    const toggle = byTestId(host, "db-skill-animation-toggle");
    expect(cells.dataset.frameIndex).toBe("0");
    expect(counter.textContent).toBe("1 / 3");
    expect(toggle.attrs["aria-pressed"]).toBe("true");
    expect(toggle.textContent).toBe("■ 정지");
    expect(byTestId(host, "db-skill-animation-sheet-meta").textContent).toBe("96×96 · 5열 · 15fps");

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("1");
    expect(counter.textContent).toBe("2 / 3");

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("2");
    expect(counter.textContent).toBe("3 / 3");

    // 랩어라운드: 마지막 프레임 뒤 0 으로 돌아가 계속 돈다.
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("0");
    expect(counter.textContent).toBe("1 / 3");
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("1");

    stop();
  });

  it("캐시된 DOM을 다시 붙이면 자동재생을 재개한다", () => {
    const { project, skill } = installProject(3);
    const scope = document.createElement("div") as unknown as FakeElement;
    document.body.append(scope);
    const rendered = renderSkillAnimationStage(skill, project);
    scope.append(rendered.element as unknown as FakeElement);
    const stage = byTestId(scope, "db-skill-animation-stage");
    Object.defineProperty(stage, "isConnected", {
      configurable: true,
      get: () => document.body.contains(stage as unknown as Node),
    });
    const cells = byTestId(scope, "db-skill-animation-cells");
    const toggle = byTestId(scope, "db-skill-animation-toggle");

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    const cached = [...scope.childNodes];
    scope.replaceChildren();
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(armedIntervals.size).toBe(0);
    expect(toggle.textContent).toBe("▶ 재생");
    expect(toggle.attrs["aria-pressed"]).toBe("false");

    scope.replaceChildren(...cached);
    resumeSkillAnimationStagesIn(scope as unknown as ParentNode);
    expect(armedIntervals.size).toBe(1);
    expect(toggle.textContent).toBe("■ 정지");
    expect(toggle.attrs["aria-pressed"]).toBe("true");
    expect(cells.dataset.frameIndex).toBe("0");

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("1");

    rendered.stop();
  });

  it("소유 범위를 정리하면 내부 스테이지 인터벌이 즉시 모두 멈춘다", () => {
    const { project, skill } = installProject(3);
    const scope = document.createElement("div") as unknown as FakeElement;
    document.body.append(scope);
    const rendered = renderSkillAnimationStage(skill, project);
    scope.append(rendered.element as unknown as FakeElement);
    const toggle = byTestId(scope, "db-skill-animation-toggle");
    expect(armedIntervals.size).toBe(1);

    stopSkillAnimationStagesIn(scope as unknown as ParentNode);

    expect(armedIntervals.size).toBe(0);
    expect(toggle.textContent).toBe("▶ 재생");
    expect(toggle.attrs["aria-pressed"]).toBe("false");
  });

  it("프레임이 1장이면 정지 렌더 + 토글 비활성", () => {
    const { project, skill } = installProject(1);
    const { host, stop } = mount(skill, project);

    const cells = byTestId(host, "db-skill-animation-cells");
    const toggle = byTestId(host, "db-skill-animation-toggle");
    expect(cells.dataset.frameIndex).toBe("0");
    expect(byTestId(host, "db-skill-animation-frame-counter").textContent).toBe("1 / 1");
    expect(toggle.disabled).toBe(true);
    expect(toggle.attrs["aria-pressed"]).toBe("false");
    expect(armedIntervals.size).toBe(0);

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 4);
    expect(cells.dataset.frameIndex).toBe("0");

    stop();
  });

  it("prefers-reduced-motion 이면 첫 프레임에 서고 인터벌을 만들지 않는다", () => {
    reducedMotion = true;
    const { project, skill } = installProject(3);
    const { host, stop } = mount(skill, project);

    const cells = byTestId(host, "db-skill-animation-cells");
    const toggle = byTestId(host, "db-skill-animation-toggle");
    expect(cells.dataset.frameIndex).toBe("0");
    expect(armedIntervals.size).toBe(0);
    expect(toggle.disabled).toBe(false);
    expect(toggle.attrs["aria-pressed"]).toBe("false");

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 4);
    expect(cells.dataset.frameIndex).toBe("0");

    // 토글로는 재생할 수 있다.
    toggle.click();
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("1");

    stop();
  });

  it("토글이 재생을 멈추고 다시 시작한다", () => {
    const { project, skill } = installProject(3);
    const { host, stop } = mount(skill, project);
    const cells = byTestId(host, "db-skill-animation-cells");
    const toggle = byTestId(host, "db-skill-animation-toggle");

    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("1");

    toggle.click();
    expect(toggle.textContent).toBe("▶ 재생");
    expect(toggle.attrs["aria-pressed"]).toBe("false");
    expect(armedIntervals.size).toBe(0);
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 3);
    expect(cells.dataset.frameIndex).toBe("1");

    toggle.click();
    expect(toggle.textContent).toBe("■ 정지");
    expect(toggle.attrs["aria-pressed"]).toBe("true");
    expect(cells.dataset.frameIndex).toBe("0");
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(cells.dataset.frameIndex).toBe("1");

    stop();
  });

  it("레코드 전환은 새 폼으로 교체하기 전에 이전 스테이지 인터벌을 즉시 정리한다", () => {
    const { skill } = installProject(3);
    const project = store.getCurrent();
    const nextSkill: SkillRecord = {
      ...structuredClone(skill),
      id: "skill_stage_next",
      name: "다음 스킬",
      animationId: undefined,
    };
    store.update((draft) => {
      draft.database.skills.push(nextSkill);
    }, { scope: "database", collection: "skills" });
    setSelectedRecordId("skills", skill.id);

    const host = document.createElement("div") as unknown as FakeElement;
    document.body.append(host);
    renderRecordTab(host as unknown as HTMLElement, "skills", () => undefined);
    expect(armedIntervals.size).toBe(1);

    byTestId(host, `db-record-row-${nextSkill.id}`).click();

    expect(armedIntervals.size).toBe(0);
  });

  it("픽커 변경으로 표시면이 교체되면 분리된 스테이지의 인터벌이 정리된다", () => {
    const { skill } = installProject(3);
    const form = document.createElement("section") as unknown as FakeElement;
    document.body.append(form);
    skillFields(form as unknown as HTMLElement, skill.id);
    renderSkillRecordForm(form as unknown as HTMLElement, skill);

    const detached = byTestId(form, "db-skill-animation-cells");
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS);
    expect(detached.dataset.frameIndex).toBe("1");
    expect(armedIntervals.size).toBe(1);

    const stageInterval = [...armedIntervals][0];
    expect(stageInterval).toBeDefined();
    const picker = byTestId(form, "db-picker-animation");
    picker.value = "anim_stage_test";
    picker.dispatchEvent(new Event("change"));

    expect(clearIntervalSpy).toHaveBeenCalledWith(stageInterval);
    expect(armedIntervals.has(stageInterval)).toBe(false);
    // 새 스테이지 하나만 무장돼 있다.
    expect(armedIntervals.size).toBe(1);

    const live = byTestId(form, "db-skill-animation-cells");
    expect(live).not.toBe(detached);
    vi.advanceTimersByTime(SHOW_ANIMATION_FRAME_MS * 2);
    // 분리된 스테이지는 1에서 얼고, 살아 있는 스테이지만 2까지 전진한다.
    expect(detached.dataset.frameIndex).toBe("1");
    expect(live.dataset.frameIndex).toBe("2");

    findByTestId(form, "db-skill-animation-toggle")?.click();
  });

  it("해석할 수 없는 애셋 URL이면 빈 상태를 표시하고 인터벌을 만들지 않는다", () => {
    const { project, skill } = installProject(3);
    const animation = project.database.battleAnimations.find((entry) => entry.id === skill.animationId);
    if (!animation) throw new Error("테스트 애니메이션이 없다");
    animation.resourceId = "missing_animation_resource";
    const { host } = mount(skill, project);

    const preview = byTestId(host, "db-skill-animation-preview");
    expect(preview.querySelector(".db-skill-animation-preview-empty")?.textContent).toBe("(애니메이션 없음)");
    expect(findByTestId(host, "db-skill-animation-stage")).toBeNull();
    expect(armedIntervals.size).toBe(0);
  });

  it("애니메이션 미지정이면 기존 빈 상태 문구를 유지한다", () => {
    const { project, skill } = installProject(3);
    const { host } = mount({ ...skill, animationId: undefined }, project);

    const preview = byTestId(host, "db-skill-animation-preview");
    expect(preview.querySelector(".db-skill-animation-preview-empty")?.textContent).toBe("(애니메이션 없음)");
    expect(findByTestId(host, "db-skill-animation-stage")).toBeNull();
    expect(armedIntervals.size).toBe(0);
  });
});
