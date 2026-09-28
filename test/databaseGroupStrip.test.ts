// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

/**
 * 그룹 띠 — 띠를 누르면 옆 목록이 그 그룹 구획으로 바뀐다.
 * 결함(2026-09-28): syncGroupStrip 이 부를 때마다 보는 그룹을 활성 탭의 그룹으로 되돌려,
 * 띠를 눌러도 목록이 그대로였다. 활성 탭이 **바뀐 때만** 따라가야 한다.
 */
const previous = store.getCurrent();

function host(): HTMLElement {
  const root = document.createElement("div");
  root.className = "database-modal-body";
  document.body.replaceChildren(root);
  renderDatabasePanel(root);
  return root;
}

function viewed(root: HTMLElement): string | undefined {
  return root.querySelector<HTMLElement>(".db-tabs")?.dataset.viewGroup;
}

function inView(root: HTMLElement, testid: string): string | undefined {
  return root.querySelector<HTMLElement>(`[data-testid="${testid}"]`)?.dataset.inView;
}

beforeEach(() => {
  store.replace(createBlankProject(), { preserveEventDrafts: false });
  setDatabaseActiveTab("classes");
});

afterEach(() => {
  document.body.replaceChildren();
  store.replace(previous, { preserveEventDrafts: false });
});

describe("자료집 그룹 띠", () => {
  it("띠를 누르면 보는 구획이 바뀌고 활성 탭은 그대로다", () => {
    const root = host();
    expect(viewed(root)).toBe("party");
    expect(inView(root, "db-tab-classes")).toBe("1");
    expect(inView(root, "db-tab-enemies")).toBe("0");

    root.querySelector<HTMLElement>('[data-testid="db-group-strip-monster"]')!.click();

    expect(viewed(root)).toBe("monster");
    expect(inView(root, "db-tab-enemies")).toBe("1");
    expect(inView(root, "db-tab-classes")).toBe("0");
    const strip = root.querySelector<HTMLElement>('[data-testid="db-group-strip-monster"]')!;
    expect(strip.getAttribute("aria-pressed")).toBe("true");
    expect(root.querySelector<HTMLElement>('[data-testid="db-group-strip-party"]')!.getAttribute("aria-pressed")).toBe("false");
    // 탭은 사용자가 고를 때까지 바뀌지 않는다.
    expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-classes");
  });

  it("다른 구획의 탭을 고르면 그 탭 그룹이 계속 보인다", () => {
    const root = host();
    root.querySelector<HTMLElement>('[data-testid="db-group-strip-monster"]')!.click();
    root.querySelector<HTMLElement>('[data-testid="db-tab-enemies"]')!.click();
    expect(viewed(root)).toBe("monster");
    expect(root.querySelector<HTMLElement>(".db-tab.active")?.dataset.testid).toBe("db-tab-enemies");

    root.querySelector<HTMLElement>('[data-testid="db-group-strip-system"]')!.click();
    expect(viewed(root)).toBe("system");
  });

  it("프로그램 점프(조수·딥링크)는 새 활성 탭의 그룹으로 띠를 옮긴다", () => {
    const root = host();
    root.querySelector<HTMLElement>('[data-testid="db-group-strip-monster"]')!.click();
    setDatabaseActiveTab("skills");
    const rerooted = host();
    expect(viewed(rerooted)).toBe("party");
    expect(inView(rerooted, "db-tab-skills")).toBe("1");
  });
});
