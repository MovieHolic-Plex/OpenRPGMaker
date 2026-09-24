// 꿈 세계 탐험(유메닛키식) 장르 검사 — 반복 맵·효과로 외형 변화·허브 문·깨어나기·저장이 게임 규칙으로 성립하나.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고다.
// 2026-09-24 꿈 세계 도그푸딩: 「가장자리가 이어지는 숲」은 가장자리 한가운데 투명 이동 이벤트 네 칸, 「효과를 얻으면
// 외형이 바뀐다」는 대사 한 줄뿐이었다. 막힘 검사는 둘 다 통과했다.

import type { GameMap, Project } from "@/project/types";
import { isPassable } from "@/project/collision";
import { mapLoopsX, mapLoopsY } from "@/project/mapLoop";
import { briefTextOf } from "./brief";
import { visitAllCommands, type CommandVisit } from "./walk";
import type { Finding } from "./types";

const DREAM_BRIEF = /꿈|dream|유메닛키/iu;
const LOOP_BRIEF = /반복\s*맵|반대편으로\s*이어|끝없는|이어지는\s*(?:맵|숲|복도)|루프/iu;
const EFFECT_BRIEF = /효과|이펙트|effect/iu;
const APPEARANCE_BRIEF = /외형|모습|변신|appearance/iu;
const WAKE_BRIEF = /깨어|깨기|꼬집/iu;
const SAVE_BRIEF = /저장|일기/iu;

function isActorGraphicChange(visit: CommandVisit): boolean {
  const command = visit.command as Record<string, unknown>;
  return command.kind === "m2Command" && typeof command.commandId === "string" && command.commandId.includes("change-actor-graphic");
}

/** 같은 맵 반대편으로 옮기는 touch 이동 이벤트 = 반복을 이벤트로 흉내 낸 것. */
function edgeWrapEvents(map: GameMap): number {
  let count = 0;
  for (const event of map.events) {
    const onEdge = event.x === 0 || event.y === 0 || event.x === map.width - 1 || event.y === map.height - 1;
    if (!onEdge) continue;
    const text = JSON.stringify(event.pages ?? []);
    if (text.includes(`"mapId":"${map.id}"`) && /"kind":"transfer"/u.test(text)) count += 1;
  }
  return count;
}

function loopOpenings(project: Project, map: GameMap): number {
  let open = 0;
  if (mapLoopsX(map)) for (let y = 0; y < map.height; y++) if (isPassable(project, map, 0, y) && isPassable(project, map, map.width - 1, y)) open++;
  if (mapLoopsY(map)) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, 0) && isPassable(project, map, x, map.height - 1)) open++;
  return open;
}

export function checkDream(project: Project, briefText = briefTextOf(project)): Finding[] {
  if (!DREAM_BRIEF.test(briefText)) return [];
  const findings: Finding[] = [];
  const maps = Object.values(project.maps);
  const looping = maps.filter((map) => map.loop);
  if (LOOP_BRIEF.test(briefText)) {
    if (looping.length === 0) {
      const faked = maps.filter((map) => edgeWrapEvents(map) > 0);
      findings.push({ severity: "warning", code: "dream-no-loop-map", message: faked.length
        ? `기획에 가장자리가 이어지는 반복 맵이 있는데 반복 맵이 없고, ${faked.map((m) => m.name).join("·")} 에서 가장자리 이동 이벤트로 흉내 냈습니다 — 나머지 가장자리는 막히고 넘을 때마다 화면이 바뀝니다. set_map_properties loop 를 쓰세요.`
        : "기획에 가장자리가 이어지는 반복 맵이 있는데 반복 맵(map.loop)이 하나도 없습니다." });
    }
    for (const map of looping) {
      if (loopOpenings(project, map) === 0) findings.push({ severity: "warning", code: "dream-loop-edge-closed", message: `${map.name}(${map.id}) 은 반복 맵인데 가장자리가 전부 막혀 넘어갈 수 없습니다(테두리 벽·물).` });
    }
  }
  const graphicChanges: CommandVisit[] = [];
  let saveMenus = 0;
  visitAllCommands(project, (visit) => {
    if (isActorGraphicChange(visit)) graphicChanges.push(visit);
    if ((visit.command as { kind?: string }).kind === "openSaveMenu") saveMenus += 1;
  });
  if (EFFECT_BRIEF.test(briefText) && APPEARANCE_BRIEF.test(briefText) && graphicChanges.length === 0) {
    findings.push({ severity: "warning", code: "dream-effect-no-appearance", message: "기획은 효과를 얻으면 외형이 바뀌는데 주인공 모습을 바꾸는 명령(m2-024-change-actor-graphic)이 어디에도 없습니다 — 대사로만 바뀌었다고 말합니다." });
  }
  if (WAKE_BRIEF.test(briefText)) {
    const start = project.startMapId;
    let wakes = 0;
    visitAllCommands(project, (visit) => {
      const command = visit.command as Record<string, unknown>;
      if (command.kind === "transfer" && command.mapId === start && visit.where.mapId !== start) wakes += 1;
    });
    if (wakes === 0) findings.push({ severity: "warning", code: "dream-no-wake", message: "기획에 꿈에서 깨어나기가 있는데 꿈 맵에서 시작 방으로 돌아오는 이동이 없습니다." });
  }
  if (SAVE_BRIEF.test(briefText) && saveMenus === 0) {
    findings.push({ severity: "warning", code: "dream-no-save", message: "기획에 일기장 저장이 있는데 저장 메뉴를 여는 명령(openSaveMenu)이 없습니다." });
  }
  return findings;
}
