import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEnemyRecordForm } from "@/editor/panels/databaseAdvancedRecordViews";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { FakeElement, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  store.replace(project);
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function enemyWithMonsterResource(resourceId: string | undefined) {
  const project = store.getCurrent();
  const troop = project.database.troops[0]!;
  const enemyId = troop.members?.[0]?.enemyId ?? troop.enemyIds[0];
  const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
  if (!enemy) throw new Error("enemy fixture missing");
  enemy.monsterResourceId = resourceId;
  return enemy;
}

function previewButtons(form: FakeElement): FakeElement[] {
  return form.querySelectorAll("button").filter((node) => node.className.includes("db-resource-set-button"));
}

describe("몬스터 그래픽 미리보기 슬롯", () => {
  it("generated 리소스를 해석할 수 없으면 클릭 불가능한 정적 라벨을 보여준다 (데드 버튼 금지)", () => {
    const enemy = enemyWithMonsterResource("generated-nonexistent-sheet");
    const form = new FakeElement("div");
    renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
    const dead = previewButtons(form);
    expect(dead.length, "리소스 선택 불가 컨텍스트에서 버튼을 렌더하면 안 된다").toBe(0);
    const text = form.textContent ?? "";
    expect(text).toContain("generated-nonexistent-sheet");
  });

  it("리소스가 없으면 (없음) 라벨만 보여준다", () => {
    const enemy = enemyWithMonsterResource(undefined);
    const form = new FakeElement("div");
    renderEnemyRecordForm(form as unknown as HTMLElement, enemy);
    expect(previewButtons(form).length).toBe(0);
    expect(form.textContent ?? "").toContain("(없음)");
  });
});
