// 파티 편성(changeParty)이 실제 배우를 가리키는지 쓰기 도구에서 확인한다 — 중첩 분기(선택지·조건·전투 결과)까지.
//
// 2026-09-24 등대지기 3차: 동료 합류 선택지 분기에 `{changeParty, speciesId:"actor_scout", level:1}` 이 저장됐다.
// 형식 검증(shapeCommandFields)은 changeParty 의 actorId 를 보지 않고, DB 참조 검증(eventDraftValidator)은
// 편집기 화면에서만 돌아 도구 경로를 지나쳤다. 런타임 파티에 null 이 들어가 보스전이 「Missing actor」로 멈췄다.
// 별칭은 commandFieldAliases 가 actorId 로 옮긴다. 여기서는 옮긴 뒤에도 배우가 아니면 거부한다 —
// 추측해 다른 배우를 넣으면 엉뚱한 동료가 합류한다(손실을 낳는 추측이라 거부가 맞다).

import { nestedCommandLists } from "@/project/authoredCommandIndex";
import type { Command, GameEvent, Project } from "@/project/types";
import { ToolError } from "./types";

function* walk(commands: readonly Command[] | undefined, path: string): Generator<{ command: Command; path: string }> {
  if (!Array.isArray(commands)) return;
  for (const [index, command] of commands.entries()) {
    const here = `${path}[${index}]`;
    yield { command, path: here };
    let branches: readonly (readonly Command[])[] = [];
    try { branches = nestedCommandLists(command); } catch { branches = []; }
    for (const [branchIndex, branch] of branches.entries()) yield* walk(branch, `${here}.branch${branchIndex}`);
  }
}

/** 명령 목록의 모든 changeParty 가 DB 배우를 가리키지 않으면 ToolError(invalid-args). */
export function assertPartyActorReferences(project: Project, commands: readonly Command[] | undefined, label: string): void {
  const actors = project.database.actors;
  const known = new Set(actors.map(actor => actor.id));
  const byName = new Map(actors.map(actor => [actor.name.trim(), actor.id]));
  const problems: string[] = [];
  for (const { command, path } of walk(commands, label)) {
    if (command.kind !== "changeParty") continue;
    const record = command as unknown as Record<string, unknown>;
    const actorId = typeof record.actorId === "string" ? record.actorId.trim() : "";
    if (actorId && known.has(actorId)) continue;
    // 배우 이름을 id 자리에 쓴 경우는 뜻이 하나라 옮긴다.
    const named = actorId ? byName.get(actorId) : undefined;
    if (named) { record.actorId = named; continue; }
    problems.push(actorId
      ? `${path}: changeParty.actorId '${actorId}' 는 배우가 아닙니다`
      : `${path}: changeParty 에 actorId 가 없습니다${typeof record.speciesId === "string" ? "(speciesId 는 몬스터 지급 giveMonster 의 필드)" : ""}`);
  }
  if (problems.length === 0) return;
  const catalog = actors.slice(0, 12).map(actor => `${actor.id}(${actor.name})`).join(", ");
  throw new ToolError(
    `파티 편성이 존재하는 배우를 가리키지 않습니다 — 이대로면 플레이 중 파티에 빈 자리가 생겨 전투가 시작되지 않습니다.\n- ${problems.join("\n- ")}\n`
      + `동료 합류는 {kind:"changeParty", actorId:<배우 id>, action:"add"} 이다. 배우가 없으면 먼저 upsert_actor 로 만든다. `
      + `몬스터를 주려면 giveMonster 를 쓴다. 배우 목록: ${catalog || "(없음)"}`,
    { code: "party-actor-missing" },
  );
}

/** 이벤트의 공통 명령과 모든 페이지 명령을 검사한다. */
export function assertEventPartyActorReferences(project: Project, event: GameEvent): void {
  assertPartyActorReferences(project, event.commands, `${event.id}.commands`);
  for (const page of event.pages ?? []) assertPartyActorReferences(project, page.commands, `${event.id}.${page.id}.commands`);
}
