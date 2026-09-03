import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { worldCanonPromptSection } from "@/ai/worldCanonContext";
import { renderOverviewTab } from "@/editor/panels/databaseOverviewView";
import { applyWelcomeGenrePresetToOpenProject } from "@/editor/welcomeGenrePresetApply";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

describe("worldCanon → assistant context", () => {
  it("injects the canon as a fixed block with absences as hard constraints", () => {
    const project = createBlankProject();
    project.worldCanon = {
      name: "서녘 공화국",
      premise: "마법은 피의 대가다.",
      tones: ["grim", "political"],
      absences: ["총", "엘프"],
      laws: { death: { present: false, note: "부활 없음" } },
      body: "왕위는 비어 있다.",
    };
    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });
    expect(prompt).toContain("## 이 세계(세계관 고정)");
    expect(prompt).toContain("서녘 공화국");
    expect(prompt).toContain("총, 엘프");
    // 예산 밖 고정분 — 초소형 예산에서도 살아남는다.
    const tiny = buildSystemPrompt(project, { budgetChars: 600 });
    expect(tiny).toContain("## 이 세계(세계관 고정)");
  });

  it("emits nothing when the canon is empty and never revives the entity digest", () => {
    const project = createBlankProject();
    expect(worldCanonPromptSection(project.worldCanon)).toBeNull();
    const prompt = buildSystemPrompt(project, { budgetChars: 20000 });
    expect(prompt).not.toContain("## 이 세계(세계관 고정)");
    expect(prompt).not.toContain("## 세계관 다이제스트");
  });

  it("caps the body excerpt so a novel cannot eat the window", () => {
    const section = worldCanonPromptSection({ body: "가".repeat(5000) });
    expect(section).not.toBeNull();
    expect((section ?? "").length).toBeLessThan(1400);
  });
});

describe("worldCanon → database overview", () => {
  let cleanup: (() => void) | undefined;
  beforeEach(() => {
    cleanup = installFakeDom();
    store.replace(createBlankProject());
  });
  afterEach(() => cleanup?.());

  function render(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    renderOverviewTab(host as unknown as HTMLElement, () => undefined);
    return host;
  }

  it("shows the authored world name and premise", () => {
    store.update((draft) => {
      draft.worldCanon = { name: "안개 해안", premise: "바다가 기억을 삼킨다." };
    });
    const card = findByTestId(render(), "db-overview-canon");
    expect(card?.textContent).toContain("안개 해안");
    expect(card?.textContent).toContain("바다가 기억을 삼킨다.");
  });

  it("invites authoring when the canon is empty", () => {
    const card = findByTestId(render(), "db-overview-canon");
    expect(card?.textContent).toContain("이 세계를 적어 보세요");
  });
});

describe("worldCanon → welcome genre seed", () => {
  beforeEach(() => {
    store.replace(createBlankProject());
  });

  it("seeds tones and a premise when the canon is blank", () => {
    applyWelcomeGenrePresetToOpenProject("monster-collect");
    const canon = store.getCurrent().worldCanon;
    expect(canon?.tones?.length ?? 0).toBeGreaterThan(0);
    expect(canon?.premise).toBeTruthy();
  });

  it("never overwrites an authored canon", () => {
    store.update((draft) => {
      draft.worldCanon = { name: "내 세계", tones: ["gothic"] };
    });
    applyWelcomeGenrePresetToOpenProject("monster-collect");
    expect(store.getCurrent().worldCanon).toEqual({ name: "내 세계", tones: ["gothic"] });
  });
});
