// 몬스터 원정의 첫 판(MVP) — 체육관 하나 캠페인(19맵)을 맵 5장으로 줄인다.
//
// 왜(2026-11-23 오너): 「ai 가 한 번에 '게임' 을 만들어 버리는 걸 지양하고 싶다. 처음에 프로젝트를 시작하면 맵을 3개에서 5개 정도
// 만드는 소규모로 MVP 만 보여주는 방식」. 남기는 맵 = 시작 마을 · 박사 연구소(첫 동료) · 1번길(야생 조우·포획) · 다음 마을 · 그 체육관.
// 체육관 관장을 이기면 배지와 함께 바로 엔딩이다(관측탑·리그는 짓지 않는다). 회복 센터·도구점 실내 대신 그 건물 문 앞에
// 회복 도우미·도구 상인을 세운다. 지운 맵으로 가던 문 이벤트는 지우고, 그 밖의 이동(진 뒤 돌아가기 등)은 시작 칸으로 돌린다.
// 키우는 것은 사용자가 이어서 청한다(「다음 지역 만들어 줘」).
import { isPassable } from "@/project/collision";
import type { Command, GameEvent, GameMap, Project } from "@/project/types";
import type { ExpeditionManifest } from "./world";

type Cell = { x: number; y: number };

function walk(node: unknown, visit: (cmd: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) { for (const item of node) walk(item, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Record<string, unknown>);
  for (const value of Object.values(node)) if (value && typeof value === "object") walk(value, visit);
}

/** 이 캠페인에서 남길 맵 id — 시작 마을, 그 마을에서 문으로 가는 연구소, 시작 마을→다음 마을 길, 다음 마을, 그 체육관. */
export function mvpMapIds(project: Project, manifest: ExpeditionManifest): string[] {
  const home = project.startMapId;
  const lab = manifest.links.find((l) => l.from === home && /_lab$/u.test(l.to))?.to;
  const route = manifest.links.find((l) => l.from === home && manifest.maps.find((m) => m.id === l.to)?.role === "field")?.to;
  const town2 = route ? manifest.links.find((l) => l.from === route && l.to !== home && manifest.maps.find((m) => m.id === l.to)?.role === "town")?.to : undefined;
  const gym = town2 ? manifest.links.find((l) => l.from === town2 && /_gym$/u.test(l.to))?.to : undefined;
  const ids = [home, lab, route, town2, gym];
  if (ids.some((id) => !id || !project.maps[id])) throw new Error(`MVP 맵을 찾지 못했다: ${ids.join(", ")}`);
  return ids as string[];
}

function freeCellNear(project: Project, map: GameMap, want: Cell): Cell {
  const taken = new Set(map.events.map((e) => `${e.x},${e.y}`));
  if (project.startMapId === map.id) taken.add(`${project.startPos.x},${project.startPos.y}`);
  for (let r = 0; r < Math.max(map.width, map.height); r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = want.x + dx, y = want.y + dy;
      if (!taken.has(`${x},${y}`) && isPassable(project, map, x, y) && isPassable(project, map, x, y + 1)) return { x, y };
    }
  }
  return want;
}

/** 같은 마을의 주민 이벤트를 본떠 새 사람을 세운다(그림·움직임·페이지 모양은 그대로, 이름·글·명령만 바꾼다). */
function standIn(project: Project, map: GameMap, id: string, name: string, at: Cell, commands: Command[]): void {
  const template = map.events.find((e) => /_local$/u.test(e.id)) ?? map.events.find((e) => (e.pages?.[0]?.graphic as { sprite?: unknown } | undefined)?.sprite);
  if (!template) return;
  const cell = freeCellNear(project, map, at);
  const copy = structuredClone(template) as GameEvent;
  copy.id = `${map.id}_${id}`;
  copy.name = name;
  copy.x = cell.x; copy.y = cell.y;
  copy.commands = commands;
  if (copy.pages?.length) copy.pages = [{ ...copy.pages[0]!, id: `${copy.id}_page`, name, conditions: [], commands }];
  map.events.push(copy);
}

export function trimExpeditionToMvp(project: Project, manifest: ExpeditionManifest): { kept: string[]; removed: string[] } {
  const kept = mvpMapIds(project, manifest);
  const keep = new Set(kept);
  const removed = Object.keys(project.maps).filter((id) => !keep.has(id));
  const gone = new Set(removed);
  const home = project.maps[project.startMapId]!;
  const back = { mapId: home.id, x: project.startPos.x, y: project.startPos.y };

  // 가게·센터를 대신 세울 자리 = 지운 건물의 문 바로 아래.
  const doors = new Map<string, { mapId: string; at: Cell }>();
  for (const link of manifest.links) {
    if (!keep.has(link.from) || !gone.has(link.to)) continue;
    doors.set(link.to, { mapId: link.from, at: link.source });
  }
  const shopCommand = Object.values(project.maps).flatMap((m) => m.events).flatMap((e) => {
    const found: Command[] = [];
    walk(e.pages, (cmd) => { if (cmd.kind === "shop" && !found.length) found.push(structuredClone(cmd) as unknown as Command); });
    return found;
  })[0];

  for (const id of kept) {
    const map = project.maps[id]!;
    // 지운 맵으로만 가는 문 이벤트는 지운다(manifest 의 연결 이벤트).
    const doorIds = new Set(manifest.links.filter((l) => l.from === id && gone.has(l.to)).map((l) => l.eventId));
    map.events = map.events.filter((e) => !doorIds.has(e.id));
    // 그 밖의 이동(진 뒤 센터로 돌아가기 등)은 시작 칸으로.
    for (const event of map.events) walk([event.commands, event.pages], (cmd) => {
      if (cmd.kind === "transfer" && typeof cmd.mapId === "string" && gone.has(cmd.mapId)) Object.assign(cmd, back);
    });
  }
  for (const [to, door] of doors) {
    const map = project.maps[door.mapId]!;
    const below = { x: door.at.x, y: door.at.y + 1 };
    if (/_center$/u.test(to)) standIn(project, map, "mvp_nurse", "회복 도우미", below, [
      { kind: "text", body: "동료들이 지쳤구나. 내가 기운을 북돋아 줄게!", speaker: "회복 도우미" } as Command,
      { kind: "recoverAll" } as Command,
      { kind: "checkpointSave", label: `${map.name} 회복` } as Command,
      { kind: "text", body: "모두 건강해졌어. 쓰러지면 여기서 다시 시작해." } as Command,
    ]);
    else if (/_mart$/u.test(to) && shopCommand) standIn(project, map, "mvp_shop", "도구 상인", below, [
      { kind: "text", body: "포획구슬과 회복약을 챙겨 가렴.", speaker: "도구 상인" } as Command,
      shopCommand,
    ]);
  }

  // 체육관 관장을 이기면 배지를 받고 바로 엔딩(리그·관측탑 없음).
  const endingId = project.endings?.[0]?.id;
  const badge = project.system.monsterCampaign?.badges[0]?.switchId;
  if (endingId && badge) {
    for (const event of project.maps[kept[4]!]!.events) walk(event.pages, (cmd) => {
      for (const key of ["victoryBranch", "then", "branch"]) {
        const list = cmd[key];
        if (!Array.isArray(list)) continue;
        const at = list.findIndex((c: Record<string, unknown>) => (c?.kind === "switch" || c?.kind === "setSwitch") && c.switchId === badge && c.value !== false);
        if (at < 0 || list.some((c: Record<string, unknown>) => c?.kind === "triggerEnding")) continue;
        list.splice(list.length, 0,
          { kind: "text", body: "첫 배지를 받았다! 이 섬의 모험은 이제 막 시작되었다." },
          { kind: "setSwitch", switchId: "mx_ending", value: true },
          { kind: "checkpointSave", label: "첫 배지" },
          { kind: "triggerEnding", endingId });
      }
    });
  }

  for (const id of removed) delete project.maps[id];
  project.mapTree = { mapId: home.id, children: kept.filter((id) => id !== home.id).map((mapId) => ({ mapId, children: [] })) };
  const fallback = project.system.gameOver?.recoveryFallback;
  if (project.system.gameOver && fallback && gone.has(fallback.mapId)) project.system.gameOver = { ...project.system.gameOver, recoveryFallback: { mapId: home.id, x: project.startPos.x, y: project.startPos.y } };
  const campaign = project.system.monsterCampaign;
  if (campaign) {
    campaign.locations = campaign.locations?.filter((l) => keep.has(l.mapId));
    campaign.objectives = campaign.objectives?.filter((o) => o.id === "starter" || o.id === "gym_1");
  }
  for (const ending of project.endings ?? []) if (ending.presentation) ending.presentation = { ...ending.presentation, credits: ending.presentation.credits?.replace("별빛섬 몬스터 원정", "별빛섬 몬스터 원정 · 첫 판") };
  return { kept, removed };
}
