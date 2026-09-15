// DB 레코드 속성 변경의 정확한 평가자 — 실측 실패에서 나온 계약.
//
// 왜(2026-09-16 라이브): "슬라임의 최대 HP를 300으로" 요청에 정확한 평가자가 없어 항목이
// functionalUnresolved 로 남았고, 모델이 repair_acceptance 로 닫으려다 라운드 예산을 다 써
// 초안이 검토/적용에 닿지 못했다(16라운드 중 9회가 헛 조회). 이 기준이 그 구멍을 채운다 —
// 저장된 필드값만 증명하고 런타임 전투 동작은 여전히 functionalUnresolved 다.
import { describe, expect, it } from "vitest";
import { ACCEPTANCE_EXAMPLES, parseAcceptanceCriteria, type AcceptanceCriterion } from "@/ai/assistantAcceptance";
import { ACCEPTANCE_CRITERIA_SCHEMA } from "@/ai/assistantAcceptanceTools";
import { evaluateAcceptanceCriterion } from "@/ai/assistantAcceptanceEvaluation";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function evaluate(project: Project, input: unknown) {
  const criteria = parseAcceptanceCriteria(input);
  expect(criteria, "criterion must parse").not.toBeNull();
  const criterion = criteria![0] as AcceptanceCriterion;
  return evaluateAcceptanceCriterion(criterion, { project, baseline: project, bindings: new Map(), reviewed: () => false });
}

function slimeProject(): { project: Project; recordId: string; baselineHp: number } {
  const project = createBlankProject();
  const enemy = project.database.enemies[0];
  expect(enemy, "blank project must ship at least one enemy record").toBeDefined();
  return { project, recordId: enemy.id, baselineHp: enemy.stats.maxHp };
}

describe("dbRecordValues 수용 기준", () => {
  it("요청한 저장값이 반영되면 통과한다", () => {
    const { project, recordId } = slimeProject();
    project.database.enemies[0].stats.maxHp = 300;
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }]).passed).toBe(true);
  });

  it("값이 그대로면 통과하지 않는다 — 문구가 아니라 저장소를 본다", () => {
    const { project, recordId, baselineHp } = slimeProject();
    const result = evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }]);
    expect(result.passed).toBe(false);
    expect(result.observed).toContain(String(baselineHp));
  });

  it("레코드가 없거나 id 가 중복이면 통과하지 않는다", () => {
    const { project, recordId } = slimeProject();
    project.database.enemies[0].stats.maxHp = 300;
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId: "enemy_absent", fields: { "stats.maxHp": 300 } }]).passed).toBe(false);
    project.database.enemies.push(structuredClone(project.database.enemies[0]));
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }]).passed).toBe(false);
  });

  it("여러 필드를 함께 요구할 수 있다 — 하나라도 다르면 실패한다", () => {
    const { project, recordId } = slimeProject();
    project.database.enemies[0].stats.maxHp = 300;
    const fields = { "stats.maxHp": 300, "stats.attack": project.database.enemies[0].stats.attack };
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields }]).passed).toBe(true);
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { ...fields, "stats.attack": 999999 } }]).passed).toBe(false);
  });

  it("못된 모양은 닫힌 채 거부된다", () => {
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "no_such_collection", recordId: "a", fields: { "stats.maxHp": 1 } }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "", fields: { "stats.maxHp": 1 } }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", fields: {} }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", fields: { "stats": { maxHp: 1 } } }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", fields: { "stats.maxHp": 1 }, unexpected: true }])).toBeNull();
  });

  it("모델에게 제공되는 스키마에 실려 있다 — 없으면 다시 닫을 수 없는 항목이 된다", () => {
    expect(ACCEPTANCE_EXAMPLES.dbRecordValues).toBeDefined();
    expect(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.kind.enum).toContain("dbRecordValues");
    expect(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.collection.enum).toContain("enemies");
    expect(ACCEPTANCE_CRITERIA_SCHEMA.items.properties.allowedChanges.items.properties.kind.enum).toContain("dbRecordValues");
  });

  it("보존 허용 목록에 DB 필드를 넣으면 그 필드만 바뀐 초안이 통과한다", () => {
    const { project, recordId } = slimeProject();
    const baseline = structuredClone(project);
    project.database.enemies[0].stats.maxHp = 300;
    const input = { kind: "projectPreserve", scope: "project",
      allowedChanges: [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }] };
    const criteria = parseAcceptanceCriteria([input]);
    expect(criteria).not.toBeNull();
    expect(evaluateAcceptanceCriterion(criteria![0] as AcceptanceCriterion, { project, baseline, bindings: new Map(), reviewed: () => false }).passed).toBe(true);
  });

  it("허용되지 않은 다른 값이 함께 바뀌면 보존은 실패한다", () => {
    const { project, recordId } = slimeProject();
    const baseline = structuredClone(project);
    project.database.enemies[0].stats.maxHp = 300;
    project.database.enemies[0].stats.attack += 1;
    const input = { kind: "projectPreserve", scope: "project",
      allowedChanges: [{ kind: "dbRecordValues", collection: "enemies", recordId, fields: { "stats.maxHp": 300 } }] };
    const criteria = parseAcceptanceCriteria([input]);
    expect(criteria).not.toBeNull();
    expect(evaluateAcceptanceCriterion(criteria![0] as AcceptanceCriterion, { project, baseline, bindings: new Map(), reviewed: () => false }).passed).toBe(false);
  });
  it("id 를 모를 때는 유일한 이름으로 해석한다 — id 를 지어내지 않는다", () => {
    const { project } = slimeProject();
    project.database.enemies[0].stats.maxHp = 300;
    const name = project.database.enemies[0].name;
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordName: name, fields: { "stats.maxHp": 300 } }]).passed).toBe(true);
    project.database.enemies.push({ ...structuredClone(project.database.enemies[0]), id: "enemy_same_name", stats: { ...project.database.enemies[0].stats, maxHp: 78 } });
    expect(evaluate(project, [{ kind: "dbRecordValues", collection: "enemies", recordName: name, fields: { "stats.maxHp": 300 } }]).passed).toBe(false);
  });

  it("recordId 와 recordName 은 정확히 하나만 받는다", () => {
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordId: "a", recordName: "b", fields: { "stats.maxHp": 1 } }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", fields: { "stats.maxHp": 1 } }])).toBeNull();
    expect(parseAcceptanceCriteria([{ kind: "dbRecordValues", collection: "enemies", recordName: "b", fields: { "stats.maxHp": 1 } }])).not.toBeNull();
  });
});
