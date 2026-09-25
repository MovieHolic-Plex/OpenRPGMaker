// 회상 스토리(투더문식) 장르 검사 — 「끝까지 가나」 다음 질문, 「연출이 서고 추억의 물건이 보이나」를 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고/참고다.
// 2026-09-24 도그푸딩 「자장가의 마지막 소절」에서 찾은 것:
//   - 연출(이동·카메라·페이드)이 0개인 대사 나열 컷신, 기획에는 「두 주인공 이동·카메라·페이드」가 적혀 있었다.
//   - 메멘토 9개가 전부 그림 없음 + 물건 타일 없음(빈 바닥) — 무엇을 조사할지 보이지 않는다.
//   - 컷신이 pan 으로 끝나 조작이 돌아온 뒤에도 카메라가 화면에 고정됐다.

import { canMove } from "@/project/collision";
import type { EventPage, GameEvent, GameMap, Project } from "@/project/types";
import type { Finding } from "./types";

const STORY_BRIEF = /회상|기억|추억|메멘토|컷신|to the moon|투더문|story-cutscene/iu;
const STAGING_BRIEF = /이동 연출|걸어 들어|카메라|페이드|fade|camera/iu;
const MEMENTO_WORD = /메멘토|추억의 물건|memento/iu;

type Cmd = Record<string, unknown> & { readonly kind?: string };

function walk(list: readonly unknown[] | undefined, visit: (command: Cmd) => void): void {
  for (const raw of list ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const command = raw as Cmd;
    visit(command);
    for (const key of ["then", "else", "commands", "victoryBranch", "defeatBranch", "escapeBranch", "otherwiseBranch", "cancelBranch"]) {
      if (Array.isArray(command[key])) walk(command[key] as unknown[], visit);
    }
    for (const listKey of ["options", "branches"]) {
      const options = command[listKey];
      if (Array.isArray(options)) for (const option of options) {
        if (option && typeof option === "object") {
          walk((option as { branch?: unknown[] }).branch, visit);
          walk((option as { commands?: unknown[] }).commands, visit);
        }
      }
    }
  }
}

function m2Title(command: Cmd): string {
  return typeof command.commandId === "string" ? command.commandId : "";
}

function isCutscenePage(page: EventPage): boolean {
  return (page.commands ?? []).some((command) => command.kind === "cutsceneControl");
}

function visible(page: EventPage, map: GameMap, event: GameEvent): boolean {
  if (page.graphic?.sprite !== undefined || page.graphic?.appearanceId !== undefined) return page.graphic?.transparent !== true;
  return (map.upperTiles[event.y * map.width + event.x] ?? -1) > 0;
}

const DIR: Record<string, { dx: number; dy: number }> = { up: { dx: 0, dy: -1 }, down: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } };

export function checkStory(project: Project, briefText: string | undefined): Finding[] {
  const brief = briefText ?? "";
  const genre = project.system?.genre === "story-cutscene" || STORY_BRIEF.test(brief);
  if (!genre) return [];
  const findings: Finding[] = [];
  let cutscenes = 0;
  let staged = 0;
  for (const map of Object.values(project.maps)) {
    const where = (event: GameEvent, pageIndex: number) => ({ mapId: map.id, mapName: map.name, eventId: event.id, eventName: event.name, pageIndex, x: event.x, y: event.y });
    const mementos: GameEvent[] = [];
    for (const event of map.events ?? []) {
      (event.pages ?? []).forEach((page, pageIndex) => {
        const kinds = new Set<string>();
        const m2 = new Set<string>();
        let lastCamera = "";
        walk(page.commands, (command) => {
          if (command.kind) kinds.add(command.kind);
          if (command.kind === "m2Command") {
            const id = m2Title(command);
            m2.add(id);
            if (id.includes("camera-control")) lastCamera = String((command.fields as Record<string, unknown> | undefined)?.mode ?? "");
          }
        });
        if (isCutscenePage(page)) {
          cutscenes += 1;
          const moves = kinds.has("moveEvent");
          const camera = [...m2].some((id) => id.includes("camera-control"));
          const fade = [...m2].some((id) => id.includes("screen-effect") || id.includes("tint-screen"));
          if (moves || camera || fade) staged += 1;
          if (lastCamera === "panTo") {
            findings.push({
              severity: "warning", code: "story-camera-left-fixed",
              message: `컷신이 카메라 pan 으로 끝납니다 — 조작이 돌아온 뒤에도 카메라가 그 칸에 고정돼 주인공을 따라가지 않습니다(camera return 을 넣으세요).`,
              where: where(event, pageIndex),
            });
          }
        }
        // 이벤트 이동 경로가 벽으로 가면 런타임은 최대 30초 멈춘다.
        walk(page.commands, (command) => {
          if (command.kind !== "moveEvent") return;
          const target = String(command.eventId ?? "");
          const mover = map.events.find((entry) => entry.id === target);
          if (!mover) return;
          let x = mover.x; let y = mover.y; let through = false;
          const route = command.route as { moves?: { kind: string; dir?: string; enabled?: boolean }[] } | undefined;
          for (const move of route?.moves ?? []) {
            if (move.kind === "setThrough") through = move.enabled === true;
            if (move.kind !== "move" || !move.dir || !DIR[move.dir]) continue;
            const nx = x + DIR[move.dir]!.dx; const ny = y + DIR[move.dir]!.dy;
            if (!through && !canMove(project, map, x, y, nx, ny)) {
              findings.push({
                severity: "warning", code: "story-move-blocked",
                message: `컷신 이동 '${target}' 이 (${x},${y})→(${nx},${ny}) 에서 막힙니다(벽·물·맵 밖) — 런타임은 최대 30초 멈춘 뒤 넘어갑니다.`,
                where: where(event, pageIndex),
              });
              break;
            }
            x = nx; y = ny;
          }
        });
      });
      const first = event.pages?.[0];
      const label = `${event.name ?? ""} ${first?.name ?? ""}`;
      if (first && first.trigger?.kind === "action" && (MEMENTO_WORD.test(label) || /^ev_(memento|examine)/u.test(event.id))) mementos.push(event);
    }
    const hidden = mementos.filter((event) => !visible(event.pages![0]!, map, event));
    if (hidden.length > 0) {
      findings.push({
        severity: "warning", code: "story-memento-invisible",
        message: `${map.name}: 추억의 물건 ${hidden.length}/${mementos.length}개가 빈 바닥 위 투명 이벤트입니다(${hidden.map((event) => event.name ?? event.id).join(", ")}) — 플레이어는 무엇을 조사할지 볼 수 없습니다.`,
        where: { mapId: map.id, mapName: map.name },
      });
    }
  }
  if (cutscenes > 0 && staged === 0 && STAGING_BRIEF.test(brief)) {
    findings.push({
      severity: "warning", code: "story-no-staging",
      message: `기획에 이동·카메라·페이드 연출이 적혀 있는데 컷신 ${cutscenes}개 중 연출이 있는 컷신이 하나도 없습니다(대사만 나열).`,
    });
  }
  return findings;
}
