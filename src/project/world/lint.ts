import type { GameEvent, Project } from "../types";
import type { LintIssue } from "../lint/projectLint";
import type { ProjectWorld, WorldRef } from "./types";

const DEFAULT_PAGE_NAME_RE = /^(페이지|page)\s*\d+$/iu;

export function lintWorld(world: ProjectWorld, project: Project): LintIssue[] {
  const issues: LintIssue[] = [];
  checkMissingRefs(world, project, issues);
  checkUnlinkedLore(world, issues);
  checkUnregisteredNpcEvents(world, project, issues);
  checkUnregisteredItems(world, project, issues);
  checkGuidelineBodies(world, issues);
  return issues;
}

function checkMissingRefs(world: ProjectWorld, project: Project, issues: LintIssue[]): void {
  const refs = projectRefs(project);
  for (const entity of world.entities) {
    for (const ref of entity.refs ?? []) {
      if (refExists(ref, refs)) continue;
      issues.push({
        severity: "error",
        code: "world-ref-missing",
        message: `세계관 ${entity.id}(${entity.name})의 참조가 존재하지 않습니다: ${ref.kind}:${ref.id}`,
      });
    }
  }
}

function checkUnlinkedLore(world: ProjectWorld, issues: LintIssue[]): void {
  for (const entity of world.entities) {
    if (entity.type === "guideline") continue;
    if ((entity.refs ?? []).length > 0) continue;
    if (isDraftEntity(entity)) continue;
    issues.push({
      severity: "warning",
      code: "world-lore-unlinked",
      message: `세계관 lore 개체가 게임 개체와 연결되어 있지 않습니다: ${entity.id}(${entity.name})`,
    });
  }
}

function isDraftEntity(entity: { readonly name: string; readonly summary: string }): boolean {
  const hay = `${entity.name} ${entity.summary}`.toLowerCase();
  return (hay.includes("draft") || hay.includes("초안")) && entity.summary.trim().length < 12;
}

function checkUnregisteredNpcEvents(world: ProjectWorld, project: Project, issues: LintIssue[]): void {
  const registeredEventIds = refIds(world, "event");
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      if (registeredEventIds.has(event.id)) continue;
      const name = namedNpcEventName(event);
      if (!name) continue;
      issues.push({
        severity: "warning",
        code: "world-npc-unregistered",
        mapId: map.id,
        x: event.x,
        y: event.y,
        message: `명명 NPC 이벤트가 세계관에 등록되어 있지 않습니다: ${map.id}/${event.id} (${name})`,
      });
    }
  }
}

function checkUnregisteredItems(world: ProjectWorld, project: Project, issues: LintIssue[]): void {
  const registeredItemIds = refIds(world, "item");
  for (const item of project.database.items) {
    const name = item.name.trim();
    if (!name || registeredItemIds.has(item.id)) continue;
    issues.push({
      severity: "warning",
      code: "world-item-unregistered",
      message: `명명 아이템이 세계관에 등록되어 있지 않습니다: ${item.id} (${name})`,
    });
  }
}

function checkGuidelineBodies(world: ProjectWorld, issues: LintIssue[]): void {
  for (const entity of world.entities) {
    if (entity.type !== "guideline") continue;
    if (entity.body?.trim()) continue;
    issues.push({
      severity: "info",
      code: "world-guideline-body-missing",
      message: `제작 규범 세계관 개체에 본문이 없습니다: ${entity.id}(${entity.name})`,
    });
  }
}

function projectRefs(project: Project): Record<WorldRef["kind"], ReadonlySet<string>> {
  return {
    map: new Set(Object.keys(project.maps)),
    event: new Set(Object.values(project.maps).flatMap((map) => map.events.map((event) => event.id))),
    item: new Set(project.database.items.map((item) => item.id)),
    skill: new Set(project.database.skills.map((skill) => skill.id)),
    actor: new Set(project.database.actors.map((actor) => actor.id)),
  };
}

function refExists(ref: WorldRef, refs: Record<WorldRef["kind"], ReadonlySet<string>>): boolean {
  return refs[ref.kind].has(ref.id);
}

function refIds(world: ProjectWorld, kind: WorldRef["kind"]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const entity of world.entities) {
    for (const ref of entity.refs ?? []) {
      if (ref.kind === kind) ids.add(ref.id);
    }
  }
  return ids;
}

function namedNpcEventName(event: GameEvent): string | null {
  for (const page of event.pages ?? []) {
    const name = page.name.trim();
    if (!name || DEFAULT_PAGE_NAME_RE.test(name)) continue;
    if (page.graphic.transparent === true || !page.graphic.sprite) continue;
    return name;
  }
  return null;
}
