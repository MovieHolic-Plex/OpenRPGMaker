// 기획 부합 힌트 — 기획 문장에 나온 핵심어(눈·겨울, 동료, 던전, 보스)가 게임 데이터에 흔적이 있는지.
// 판정이 아니라 힌트다: 전부 경고로 낸다.

import type { Project } from "@/project/types";
import { visitAllCommands } from "./walk";
import type { Finding } from "./types";
import type { MapGraph } from "./mapGraph";

export function briefTextOf(project: Project): string {
  const brief = project.gameDesignBrief;
  if (!brief) return "";
  return [brief.summary, ...Object.values(brief.answers ?? {}).map((answer) => answer?.text ?? "")].join("\n");
}

const SNOW = /눈보라|눈 ?덮|설원|겨울|snow|winter|blizzard|얼음|얼어붙/iu;
const COMPANION = /동료|합류|companion|party member/iu;
const DUNGEON = /던전|동굴|dungeon|cave|탑|유적|성채/iu;
const BOSS = /보스|정령|boss/iu;

export function checkBriefConformance(project: Project, briefText: string, graph: MapGraph): Finding[] {
  if (!briefText.trim()) return [];
  const findings: Finding[] = [];
  const maps = Object.values(project.maps);
  const commandKinds = new Map<string, unknown[]>();
  visitAllCommands(project, ({ command }) => {
    const kind = String(command.kind);
    const list = commandKinds.get(kind) ?? [];
    list.push(command);
    commandKinds.set(kind, list);
  });
  if (SNOW.test(briefText)) {
    const snowMap = maps.find((map) => map.climate?.mode === "fixed" && map.climate.weather === "snow");
    const snowWeather = (commandKinds.get("setWeather") ?? []).some((command) => (command as { weather?: unknown }).weather === "snow");
    const snowTiles = maps.some((map) => /snow|ice|winter/iu.test(map.tilesetId));
    const globalSnow = JSON.stringify(project.system ?? {}).includes("\"snow\"");
    if (!snowMap && !snowWeather && !globalSnow) {
      findings.push({ severity: "warning", code: "brief-no-snow", message: `기획은 눈·겨울 배경인데 눈 기후(climate snow)·눈 날씨 명령이 있는 맵이 없습니다${snowTiles ? " (눈 타일셋 맵은 있음)" : ""}.` });
    }
  }
  if (COMPANION.test(briefText)) {
    const start = new Set(project.session?.partyActorIds ?? []);
    const joins = (commandKinds.get("changeParty") ?? []).filter((command) => {
      const c = command as { action?: unknown; actorId?: unknown };
      return c.action === "add" && typeof c.actorId === "string" && !start.has(c.actorId);
    });
    if (joins.length === 0) findings.push({ severity: "warning", code: "brief-no-companion", message: "기획에 동료가 있는데 시작 파티 밖의 배우를 올바르게 합류시키는 changeParty(action:add, actorId) 가 없습니다." });
  }
  if (DUNGEON.test(briefText)) {
    const dungeon = maps.filter((map) => /dungeon|cave/iu.test(map.tilesetId) || DUNGEON.test(map.name));
    const reachableWithContent = dungeon.filter((map) => graph.reachable.has(map.id) && (map.events?.length ?? 0) > 0);
    if (reachableWithContent.length === 0) {
      findings.push({ severity: "warning", code: "brief-no-dungeon", message: `기획에 던전이 있는데 갈 수 있고 이벤트가 있는 던전 맵이 없습니다${dungeon.length ? ` (던전 맵 ${dungeon.map((m) => m.name).join(", ")} 은 못 가거나 비어 있음)` : ""}.` });
    }
  }
  if (BOSS.test(briefText) && (commandKinds.get("battleProcessing") ?? []).length === 0) {
    findings.push({ severity: "warning", code: "brief-no-boss", message: "기획에 보스가 있는데 전투(battleProcessing) 명령이 하나도 없습니다." });
  }
  return findings;
}
