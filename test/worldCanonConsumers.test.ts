import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { findWorldCanonAbsenceHits, worldCanonPromptSection } from "@/ai/worldCanonContext";
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

  // 2026-09-20 사용자 요청: 세계관이 틀리면 안 되므로 본문 상한을 600 → 20,000자로 올렸다.
  // 이 절은 예산 슬라이싱 밖의 고정분이라, 상한이 없으면 본문 하나가 실제 대화 기록을 밀어낸다.
  // 그래서 "무제한"이 아니라 "실사용에서 잘릴 일이 거의 없는 선"으로 잡는다.
  it("긴 본문은 20,000자까지 싣고, 그 위는 잘라 고지한다", () => {
    // 상한 안쪽은 전문이 그대로 실린다(잘림 표시가 없어야 한다).
    const inside = worldCanonPromptSection({ body: "가".repeat(19_000) });
    expect(inside).not.toBeNull();
    expect(inside).toContain("가".repeat(19_000));
    expect(inside).not.toContain("이 세계 본문");

    // 상한을 넘으면 잘리고, 얼마나 남았는지 고지한다.
    const beyond = worldCanonPromptSection({ body: "가".repeat(25_000) });
    expect(beyond).not.toBeNull();
    expect(beyond).toContain("…(이 세계 본문 5000자 더 있음");
    // 잘림 고지까지 포함해도 상한 + 고지문 수준이어야 한다(폭주 방지).
    expect((beyond ?? "").length).toBeLessThan(20_400);
  });
  it("treats a status-only shell as empty so it never emits a phantom block", () => {
    expect(worldCanonPromptSection({ status: "canon" })).toBeNull();
    const project = createBlankProject();
    project.worldCanon = { status: "canon" };
    expect(buildSystemPrompt(project, { budgetChars: 20000 })).not.toContain("## 이 세계(세계관 고정)");
  });

  it("marks the status line so draft/canon/secret read differently", () => {
    expect(worldCanonPromptSection({ name: "서녘", status: "canon" })).toContain("확정");
    expect(worldCanonPromptSection({ name: "서녘", status: "secret" })).toContain("비밀");
    expect(worldCanonPromptSection({ name: "서녘" })).not.toContain("상태:");
  });
});

describe("findWorldCanonAbsenceHits", () => {
  it("returns nothing when the canon is undefined", () => {
    expect(findWorldCanonAbsenceHits("총을 들어라", undefined)).toEqual([]);
  });

  it("returns nothing when the text is empty", () => {
    expect(findWorldCanonAbsenceHits("", { absences: ["총"] })).toEqual([]);
  });

  it("returns nothing when absence entries are empty", () => {
    expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국" })).toEqual([]);
    expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국", absences: [] })).toEqual([]);
    expect(findWorldCanonAbsenceHits("총을 들어라", { name: "왕국", absences: [""] })).toEqual([]);
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
